import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MANAGERS, logAudit, requireMember, requireRoles } from "@/lib/rbac.server";

const CASHIERS = ["owner", "admin", "gerente", "caixa"] as const;
const OPEN_STATES = ["OPEN", "ORDERING", "PAYMENT_PENDING", "PARTIALLY_PAID"] as const;

export type OpenTab = {
  sessionId: string;
  tableCode: string;
  status: string;
  itemsTotal: number;
  serviceFee: number;
  discountTotal: number;
  paidTotal: number;
  balance: number;
  openedAt: string;
};

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

/** Every open tab with live totals (service fee recalculated from the tenant setting). */
export const listOpenTabs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, tenantId } = await requireRoles(context.userId, CASHIERS);

    const [{ data: tenant }, { data: sessions }] = await Promise.all([
      admin
        .from("tenants")
        .select("service_fee_pct, service_fee_enabled")
        .eq("id", tenantId)
        .maybeSingle(),
      admin
        .from("dining_sessions")
        .select("id, table_id, status, items_total, service_fee, discount_total, paid_total, opened_at")
        .eq("tenant_id", tenantId)
        .in("status", OPEN_STATES as unknown as string[])
        .order("opened_at"),
    ]);

    const rows = sessions ?? [];
    if (rows.length === 0) return [] as OpenTab[];

    const { data: tables } = await admin
      .from("venue_tables")
      .select("id, display_code")
      .in("id", [...new Set(rows.map((r) => r.table_id as string))]);
    const tableById = new Map((tables ?? []).map((t) => [t.id as string, t.display_code as string]));

    const pct = Number(tenant?.service_fee_pct ?? 0);
    const feeOn = tenant?.service_fee_enabled === true;

    return rows.map((s) => {
      const itemsTotal = Number(s.items_total ?? 0);
      const discount = Number(s.discount_total ?? 0);
      const paid = Number(s.paid_total ?? 0);
      const fee = feeOn ? round2(Math.max(0, itemsTotal - discount) * (pct / 100)) : 0;
      return {
        sessionId: s.id as string,
        tableCode: tableById.get(s.table_id as string) ?? "?",
        status: s.status as string,
        itemsTotal,
        serviceFee: fee,
        discountTotal: discount,
        paidTotal: paid,
        balance: round2(Math.max(0, itemsTotal - discount + fee - paid)),
        openedAt: s.opened_at as string,
      } satisfies OpenTab;
    });
  });

export type TabDetail = {
  items: { id: string; name: string; quantity: number; unitPrice: number; status: string }[];
  payments: { id: string; method: string; amount: number; note: string | null; createdAt: string }[];
};

export const getTabDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireMember(context.userId);

    const [{ data: items }, { data: payments }] = await Promise.all([
      admin
        .from("order_items")
        .select("id, name_snapshot, quantity, unit_price_snapshot, status")
        .eq("tenant_id", tenantId)
        .eq("dining_session_id", data.sessionId)
        .neq("status", "CANCELLED")
        .order("created_at"),
      admin
        .from("payments")
        .select("id, method, amount, note, created_at, status")
        .eq("tenant_id", tenantId)
        .eq("dining_session_id", data.sessionId)
        .order("created_at"),
    ]);

    return {
      items: (items ?? []).map((i) => ({
        id: i.id as string,
        name: i.name_snapshot as string,
        quantity: i.quantity as number,
        unitPrice: Number(i.unit_price_snapshot),
        status: i.status as string,
      })),
      payments: (payments ?? [])
        .filter((p) => p.status !== "REFUNDED")
        .map((p) => ({
          id: p.id as string,
          method: p.method as string,
          amount: Number(p.amount),
          note: (p.note as string | null) ?? null,
          createdAt: p.created_at as string,
        })),
    } satisfies TabDetail;
  });

/** Registers a manual payment (cash, Pix, card machine). */
export const registerPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        method: z.enum(["DINHEIRO", "PIX", "CARTAO"]),
        amount: z.number().positive().max(100000),
        note: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireRoles(context.userId, CASHIERS);

    const { data: session } = await admin
      .from("dining_sessions")
      .select("id, status, paid_total, version")
      .eq("id", data.sessionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!session) throw new Error("Comanda não encontrada.");
    if (!OPEN_STATES.includes(session.status as (typeof OPEN_STATES)[number]))
      throw new Error("Esta comanda não está mais aberta.");

    const amount = round2(data.amount);
    const { error } = await admin.from("payments").insert({
      tenant_id: tenantId,
      dining_session_id: data.sessionId,
      method: data.method,
      amount,
      status: "CONFIRMED",
      source: "MANUAL",
      registered_by: context.userId,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);

    const paid = round2(Number(session.paid_total ?? 0) + amount);
    await admin
      .from("dining_sessions")
      .update({
        paid_total: paid,
        status: "PARTIALLY_PAID",
        version: Number(session.version ?? 1) + 1,
      })
      .eq("id", data.sessionId);

    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "PAYMENT_REGISTERED",
      entityType: "dining_session",
      entityId: data.sessionId,
      previous: { paid_total: Number(session.paid_total ?? 0) },
      next: { paid_total: paid, method: data.method, amount },
    });

    return { paidTotal: paid };
  });

/** Applies a discount to the tab (managers only). */
export const applyDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        amount: z.number().min(0).max(100000),
        reason: z.string().min(3).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireRoles(context.userId, MANAGERS);

    const { data: session } = await admin
      .from("dining_sessions")
      .select("id, items_total, discount_total, version")
      .eq("id", data.sessionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!session) throw new Error("Comanda não encontrada.");
    if (data.amount > Number(session.items_total ?? 0))
      throw new Error("O desconto não pode ser maior que o consumo.");

    await admin
      .from("dining_sessions")
      .update({ discount_total: round2(data.amount), version: Number(session.version ?? 1) + 1 })
      .eq("id", data.sessionId);

    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "DISCOUNT_APPLIED",
      entityType: "dining_session",
      entityId: data.sessionId,
      previous: { discount_total: Number(session.discount_total ?? 0) },
      next: { discount_total: data.amount },
      reason: data.reason,
    });

    return { ok: true };
  });

/** Closes a tab. A remaining balance requires a manager and a written reason. */
export const closeTab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ sessionId: z.string().uuid(), reason: z.string().max(200).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireRoles(context.userId, CASHIERS);

    const [{ data: tenant }, { data: session }] = await Promise.all([
      admin
        .from("tenants")
        .select("service_fee_pct, service_fee_enabled")
        .eq("id", tenantId)
        .maybeSingle(),
      admin
        .from("dining_sessions")
        .select("id, status, items_total, discount_total, paid_total, version")
        .eq("id", data.sessionId)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);
    if (!session) throw new Error("Comanda não encontrada.");

    const itemsTotal = Number(session.items_total ?? 0);
    const discount = Number(session.discount_total ?? 0);
    const fee =
      tenant?.service_fee_enabled === true
        ? round2(Math.max(0, itemsTotal - discount) * (Number(tenant.service_fee_pct ?? 0) / 100))
        : 0;
    const balance = round2(itemsTotal - discount + fee - Number(session.paid_total ?? 0));

    if (balance > 0.009) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const isManager = (roles ?? []).some((r) => MANAGERS.includes(r.role as never));
      if (!isManager)
        throw new Error("Há saldo em aberto. Somente um gerente pode liberar a mesa assim.");
      if (!data.reason || data.reason.trim().length < 3)
        throw new Error("Informe o motivo para liberar a mesa com saldo em aberto.");
    }

    const { error } = await admin
      .from("dining_sessions")
      .update({
        status: balance > 0.009 ? "CLOSED" : "PAID",
        service_fee: fee,
        closed_at: new Date().toISOString(),
        version: Number(session.version ?? 1) + 1,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);

    await admin
      .from("dining_sessions")
      .update({ status: "CLOSED" })
      .eq("id", data.sessionId);

    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: balance > 0.009 ? "TAB_CLOSED_WITH_BALANCE" : "TAB_CLOSED",
      entityType: "dining_session",
      entityId: data.sessionId,
      previous: { status: session.status, paid_total: Number(session.paid_total ?? 0) },
      next: { status: "CLOSED", service_fee: fee, balance },
      reason: data.reason ?? null,
    });

    return { closed: true, balance };
  });

export type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  reason: string | null;
  createdAt: string;
  actorName: string;
};

/** Recent audit trail for the tenant. */
export const listAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, tenantId } = await requireRoles(context.userId, [...MANAGERS, "auditor"]);

    const { data: events } = await admin
      .from("audit_events")
      .select("event_id, action, entity_type, reason, created_at, actor_id")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100);

    const rows = events ?? [];
    const actorIds = [...new Set(rows.map((e) => e.actor_id as string).filter(Boolean))];
    const { data: profiles } = actorIds.length
      ? await admin.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string]));

    return rows.map((e) => ({
      id: e.event_id as string,
      action: e.action as string,
      entityType: e.entity_type as string,
      reason: (e.reason as string | null) ?? null,
      createdAt: e.created_at as string,
      actorName: nameById.get(e.actor_id as string) ?? "Sistema",
    })) satisfies AuditEntry[];
  });
