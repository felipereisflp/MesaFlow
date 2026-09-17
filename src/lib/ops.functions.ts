import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MANAGERS, logAudit, requireMember, requireRoles } from "@/lib/rbac.server";

export type StationItem = {
  id: string;
  name: string;
  quantity: number;
  note: string | null;
  status: string;
  createdAt: string;
  tableCode: string;
  orderNote: string | null;
};

const STATION_FLOW = ["SUBMITTED", "IN_PREPARATION", "READY", "DELIVERED"] as const;

export function nextStatus(current: string) {
  const idx = STATION_FLOW.indexOf(current as (typeof STATION_FLOW)[number]);
  if (idx < 0 || idx === STATION_FLOW.length - 1) return null;
  return STATION_FLOW[idx + 1]!;
}

/** Live queue for one station (kitchen or bar). */
export const listStationQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ station: z.enum(["cozinha", "bar"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireMember(context.userId);

    const { data: items } = await admin
      .from("order_items")
      .select("id, name_snapshot, quantity, note, status, created_at, order_id, dining_session_id")
      .eq("tenant_id", tenantId)
      .eq("station", data.station)
      .in("status", ["SUBMITTED", "CONFIRMED", "IN_PREPARATION", "READY"])
      .order("created_at");

    const rows = items ?? [];
    if (rows.length === 0) return [] as StationItem[];

    const sessionIds = [...new Set(rows.map((r) => r.dining_session_id as string))];
    const orderIds = [...new Set(rows.map((r) => r.order_id as string))];

    const [{ data: sessions }, { data: orders }] = await Promise.all([
      admin.from("dining_sessions").select("id, table_id").in("id", sessionIds),
      admin.from("orders").select("id, note").in("id", orderIds),
    ]);

    const tableIds = [...new Set((sessions ?? []).map((s) => s.table_id as string))];
    const { data: tables } = await admin
      .from("venue_tables")
      .select("id, display_code")
      .in("id", tableIds.length ? tableIds : ["00000000-0000-0000-0000-000000000000"]);

    const tableById = new Map((tables ?? []).map((t) => [t.id as string, t.display_code as string]));
    const sessionTable = new Map(
      (sessions ?? []).map((s) => [s.id as string, tableById.get(s.table_id as string) ?? "?"]),
    );
    const orderNote = new Map((orders ?? []).map((o) => [o.id as string, (o.note as string | null) ?? null]));

    return rows.map((r) => ({
      id: r.id as string,
      name: r.name_snapshot as string,
      quantity: r.quantity as number,
      note: (r.note as string | null) ?? null,
      status: r.status as string,
      createdAt: r.created_at as string,
      tableCode: sessionTable.get(r.dining_session_id as string) ?? "?",
      orderNote: orderNote.get(r.order_id as string) ?? null,
    })) satisfies StationItem[];
  });

/** Moves one item to the next step of its station flow. */
export const advanceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ itemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireMember(context.userId);

    const { data: item } = await admin
      .from("order_items")
      .select("id, status, name_snapshot")
      .eq("id", data.itemId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!item) throw new Error("Item não encontrado.");

    const current = item.status === "CONFIRMED" ? "SUBMITTED" : (item.status as string);
    const next = nextStatus(current);
    if (!next) throw new Error("Este item já foi entregue.");

    const { error } = await admin
      .from("order_items")
      .update({ status: next })
      .eq("id", data.itemId)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "ITEM_STATUS_CHANGED",
      entityType: "order_item",
      entityId: data.itemId,
      previous: { status: item.status },
      next: { status: next },
    });

    return { status: next };
  });

/** Cancels an item (manager only), keeping history and reason. */
export const cancelItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ itemId: z.string().uuid(), reason: z.string().min(3).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireRoles(context.userId, MANAGERS);

    const { data: item } = await admin
      .from("order_items")
      .select("id, status, quantity, unit_price_snapshot, dining_session_id, charged")
      .eq("id", data.itemId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!item) throw new Error("Item não encontrado.");
    if (item.status === "CANCELLED") return { ok: true };

    const { error } = await admin
      .from("order_items")
      .update({ status: "CANCELLED", cancel_reason: data.reason, charged: false })
      .eq("id", data.itemId)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    const sessionId = item.dining_session_id as string;
    const { data: session } = await admin
      .from("dining_sessions")
      .select("items_total, version")
      .eq("id", sessionId)
      .maybeSingle();

    const deduction = Number(item.unit_price_snapshot) * Number(item.quantity);
    await admin
      .from("dining_sessions")
      .update({
        items_total: Math.max(0, Number(session?.items_total ?? 0) - deduction),
        version: Number(session?.version ?? 1) + 1,
      })
      .eq("id", sessionId);

    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "ITEM_CANCELLED",
      entityType: "order_item",
      entityId: data.itemId,
      previous: { status: item.status },
      next: { status: "CANCELLED" },
      reason: data.reason,
    });

    return { ok: true };
  });

export type FloorTable = {
  tableId: string;
  tableCode: string;
  area: string | null;
  seats: number;
  sessionId: string | null;
  status: string | null;
  itemsTotal: number;
  paidTotal: number;
  openItems: number;
  readyItems: number;
  openedAt: string | null;
};

/** Floor view: every active table with its tab summary. */
export const listFloor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, tenantId } = await requireMember(context.userId);

    const [{ data: tables }, { data: sessions }] = await Promise.all([
      admin
        .from("venue_tables")
        .select("id, display_code, area, seats")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("display_code"),
      admin
        .from("dining_sessions")
        .select("id, table_id, status, items_total, paid_total, opened_at")
        .eq("tenant_id", tenantId)
        .in("status", ["OPEN", "ORDERING", "PAYMENT_PENDING", "PARTIALLY_PAID"]),
    ]);

    const openSessions = sessions ?? [];
    const sessionIds = openSessions.map((s) => s.id as string);
    const { data: items } = sessionIds.length
      ? await admin
          .from("order_items")
          .select("dining_session_id, status")
          .in("dining_session_id", sessionIds)
      : { data: [] as { dining_session_id: string; status: string }[] };

    const counters = new Map<string, { open: number; ready: number }>();
    for (const i of items ?? []) {
      const key = i.dining_session_id as string;
      const c = counters.get(key) ?? { open: 0, ready: 0 };
      const status = i.status as string;
      if (status !== "DELIVERED" && status !== "CANCELLED") c.open += 1;
      if (status === "READY") c.ready += 1;
      counters.set(key, c);
    }

    const byTable = new Map(openSessions.map((s) => [s.table_id as string, s]));

    return (tables ?? []).map((t) => {
      const s = byTable.get(t.id as string);
      const c = s ? counters.get(s.id as string) : undefined;
      return {
        tableId: t.id as string,
        tableCode: t.display_code as string,
        area: (t.area as string | null) ?? null,
        seats: t.seats as number,
        sessionId: (s?.id as string | undefined) ?? null,
        status: (s?.status as string | undefined) ?? null,
        itemsTotal: Number(s?.items_total ?? 0),
        paidTotal: Number(s?.paid_total ?? 0),
        openItems: c?.open ?? 0,
        readyItems: c?.ready ?? 0,
        openedAt: (s?.opened_at as string | undefined) ?? null,
      } satisfies FloorTable;
    });
  });

/** Moves an open tab to another free table. */
export const transferTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid(), toTableId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireMember(context.userId);

    const { data: session } = await admin
      .from("dining_sessions")
      .select("id, table_id, status, version")
      .eq("id", data.sessionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!session) throw new Error("Comanda não encontrada.");

    const { data: busy } = await admin
      .from("dining_sessions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("table_id", data.toTableId)
      .in("status", ["OPEN", "ORDERING", "PAYMENT_PENDING", "PARTIALLY_PAID"])
      .maybeSingle();
    if (busy) throw new Error("A mesa de destino já tem uma comanda aberta.");

    const { error } = await admin
      .from("dining_sessions")
      .update({ table_id: data.toTableId, version: Number(session.version ?? 1) + 1 })
      .eq("id", data.sessionId)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "SESSION_TRANSFERRED",
      entityType: "dining_session",
      entityId: data.sessionId,
      previous: { table_id: session.table_id },
      next: { table_id: data.toTableId },
    });

    return { ok: true };
  });
