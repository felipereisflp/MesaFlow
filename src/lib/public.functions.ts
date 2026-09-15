import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { newOpaqueToken } from "@/lib/audit.server";

const SESSION_HOURS = 6;

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type PublicMenuProduct = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number;
};

export type PublicBootstrap = {
  sessionToken: string;
  tenant: { name: string; currency: string; serviceFeePct: number; serviceFeeEnabled: boolean };
  table: { id: string; displayCode: string };
  categories: { id: string; name: string }[];
  products: PublicMenuProduct[];
};

/** Resolves an NFC/QR tag token: validates it and opens (or reuses) the table's tab. */
export const openTableSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().regex(/^[0-9a-f]{32}$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const admin = await loadAdmin();

    const { data: tag } = await admin
      .from("nfc_tags")
      .select("id, tenant_id, table_id, status")
      .eq("token", data.token)
      .maybeSingle();

    if (!tag || tag.status !== "ACTIVE") {
      await admin.from("security_events").insert({
        tenant_id: (tag?.tenant_id as string | undefined) ?? null,
        kind: "TAG_RESOLVE_FAILED",
        detail: { reason: tag ? "revoked" : "unknown_token" } as never,
      });
      throw new Error("Etiqueta inválida ou desativada. Chame um atendente.");
    }

    const tenantId = tag.tenant_id as string;

    const [{ data: tenant }, { data: table }] = await Promise.all([
      admin
        .from("tenants")
        .select("name, currency, service_fee_pct, service_fee_enabled, status")
        .eq("id", tenantId)
        .maybeSingle(),
      admin
        .from("venue_tables")
        .select("id, display_code, active")
        .eq("id", tag.table_id as string)
        .maybeSingle(),
    ]);

    if (!tenant || tenant.status !== "ACTIVE") throw new Error("Estabelecimento indisponível.");
    if (!table || table.active !== true) throw new Error("Esta mesa está indisponível no momento.");

    const { data: existing } = await admin
      .from("dining_sessions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("table_id", table.id as string)
      .not("status", "in", "(CLOSED,CANCELLED)")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let diningSessionId = existing?.id as string | undefined;
    if (!diningSessionId) {
      const { data: created, error } = await admin
        .from("dining_sessions")
        .insert({ tenant_id: tenantId, table_id: table.id as string, status: "OPEN" })
        .select("id")
        .single();
      if (error) throw new Error("Não foi possível abrir a comanda desta mesa.");
      diningSessionId = created.id as string;
    }

    const sessionToken = newOpaqueToken() + newOpaqueToken();
    await admin.from("customer_sessions").insert({
      tenant_id: tenantId,
      dining_session_id: diningSessionId,
      token: sessionToken,
      expires_at: new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString(),
    });

    const [{ data: categories }, { data: products }] = await Promise.all([
      admin
        .from("categories")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("visible", true)
        .order("sort_order"),
      admin
        .from("products")
        .select("id, category_id, name, description, price")
        .eq("tenant_id", tenantId)
        .eq("available", true)
        .eq("archived", false)
        .order("sort_order"),
    ]);

    return {
      sessionToken,
      tenant: {
        name: tenant.name as string,
        currency: tenant.currency as string,
        serviceFeePct: Number(tenant.service_fee_pct),
        serviceFeeEnabled: tenant.service_fee_enabled as boolean,
      },
      table: { id: table.id as string, displayCode: table.display_code as string },
      categories: (categories ?? []).map((c) => ({ id: c.id as string, name: c.name as string })),
      products: (products ?? []).map((p) => ({
        id: p.id as string,
        categoryId: (p.category_id as string | null) ?? null,
        name: p.name as string,
        description: (p.description as string | null) ?? null,
        price: Number(p.price),
      })),
    } satisfies PublicBootstrap;
  });

async function resolveCustomerSession(sessionToken: string) {
  const admin = await loadAdmin();
  const { data: cs } = await admin
    .from("customer_sessions")
    .select("tenant_id, dining_session_id, expires_at")
    .eq("token", sessionToken)
    .maybeSingle();
  if (!cs) throw new Error("Sessão expirada. Encoste o celular na etiqueta novamente.");
  if (new Date(cs.expires_at as string).getTime() < Date.now())
    throw new Error("Sessão expirada. Encoste o celular na etiqueta novamente.");
  return {
    admin,
    tenantId: cs.tenant_id as string,
    diningSessionId: cs.dining_session_id as string,
  };
}

export type PublicTabItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  status: string;
  station: "cozinha" | "bar";
};

/** Current tab: items, statuses and totals for the customer's table. */
export const getTabState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionToken: z.string().min(32).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { admin, diningSessionId } = await resolveCustomerSession(data.sessionToken);

    const [{ data: session }, { data: items }] = await Promise.all([
      admin
        .from("dining_sessions")
        .select("status, items_total, service_fee, discount_total, paid_total")
        .eq("id", diningSessionId)
        .maybeSingle(),
      admin
        .from("order_items")
        .select("id, name_snapshot, quantity, unit_price_snapshot, status, station, created_at")
        .eq("dining_session_id", diningSessionId)
        .neq("status", "CANCELLED")
        .order("created_at"),
    ]);

    return {
      status: (session?.status as string) ?? "OPEN",
      itemsTotal: Number(session?.items_total ?? 0),
      serviceFee: Number(session?.service_fee ?? 0),
      discountTotal: Number(session?.discount_total ?? 0),
      paidTotal: Number(session?.paid_total ?? 0),
      items: (items ?? []).map((i) => ({
        id: i.id as string,
        name: i.name_snapshot as string,
        quantity: i.quantity as number,
        unitPrice: Number(i.unit_price_snapshot),
        status: i.status as string,
        station: i.station as "cozinha" | "bar",
      })) satisfies PublicTabItem[],
    };
  });

/** Sends a customer order; the idempotency key prevents duplicates on retry. */
export const submitCustomerOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionToken: z.string().min(32).max(80),
        idempotencyKey: z.string().min(8).max(80),
        note: z.string().max(300).optional(),
        items: z
          .array(
            z.object({
              productId: z.string().uuid(),
              quantity: z.number().int().min(1).max(30),
              note: z.string().max(140).optional(),
            }),
          )
          .min(1)
          .max(40),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { admin, tenantId, diningSessionId } = await resolveCustomerSession(data.sessionToken);

    const { data: dup } = await admin
      .from("orders")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle();
    if (dup) return { orderId: dup.id as string, duplicated: true };

    const ids = data.items.map((i) => i.productId);
    const { data: products } = await admin
      .from("products")
      .select("id, name, price, station, available, archived")
      .eq("tenant_id", tenantId)
      .in("id", ids);

    const byId = new Map((products ?? []).map((p) => [p.id as string, p]));
    for (const i of data.items) {
      const p = byId.get(i.productId);
      if (!p || p.available !== true || p.archived === true)
        throw new Error("Um dos itens saiu do cardápio. Atualize a página.");
    }

    const { data: order, error } = await admin
      .from("orders")
      .insert({
        tenant_id: tenantId,
        dining_session_id: diningSessionId,
        origin: "CLIENTE",
        status: "SUBMITTED",
        idempotency_key: data.idempotencyKey,
        note: data.note ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error("Não foi possível enviar o pedido. Tente novamente.");

    const rows = data.items.map((i) => {
      const p = byId.get(i.productId)!;
      return {
        tenant_id: tenantId,
        order_id: order.id as string,
        dining_session_id: diningSessionId,
        product_id: i.productId,
        name_snapshot: p.name as string,
        unit_price_snapshot: Number(p.price),
        modifiers_snapshot: [] as never,
        quantity: i.quantity,
        note: i.note ?? null,
        station: p.station as "cozinha" | "bar",
        status: "SUBMITTED",
      };
    });
    const { error: itemsError } = await admin.from("order_items").insert(rows);
    if (itemsError) throw new Error("Não foi possível registrar os itens do pedido.");

    const addition = rows.reduce((sum, r) => sum + r.unit_price_snapshot * r.quantity, 0);
    const { data: current } = await admin
      .from("dining_sessions")
      .select("items_total, version")
      .eq("id", diningSessionId)
      .maybeSingle();

    await admin
      .from("dining_sessions")
      .update({
        items_total: Number(current?.items_total ?? 0) + addition,
        status: "ORDERING",
        version: Number(current?.version ?? 1) + 1,
      })
      .eq("id", diningSessionId);

    return { orderId: order.id as string, duplicated: false };
  });
