import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MANAGERS, logAudit, requireMember, requireRoles } from "@/lib/rbac.server";

export type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  visible: boolean;
};

export type MenuProduct = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number;
  station: "cozinha" | "bar";
  available: boolean;
  archived: boolean;
};

/** Full menu for the staff area (includes hidden and archived items). */
export const listMenu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, tenantId } = await requireMember(context.userId);

    const [{ data: categories }, { data: products }] = await Promise.all([
      admin
        .from("categories")
        .select("id, name, sort_order, visible")
        .eq("tenant_id", tenantId)
        .order("sort_order"),
      admin
        .from("products")
        .select("id, category_id, name, description, price, station, available, archived")
        .eq("tenant_id", tenantId)
        .order("sort_order"),
    ]);

    return {
      categories: (categories ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        sortOrder: c.sort_order as number,
        visible: c.visible as boolean,
      })) satisfies MenuCategory[],
      products: (products ?? []).map((p) => ({
        id: p.id as string,
        categoryId: (p.category_id as string | null) ?? null,
        name: p.name as string,
        description: (p.description as string | null) ?? null,
        price: Number(p.price),
        station: p.station as "cozinha" | "bar",
        available: p.available as boolean,
        archived: p.archived as boolean,
      })) satisfies MenuProduct[],
    };
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(60),
        sortOrder: z.number().int().min(0).max(999).optional(),
        visible: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireRoles(context.userId, MANAGERS);
    const payload = {
      tenant_id: tenantId,
      name: data.name,
      sort_order: data.sortOrder ?? 0,
      visible: data.visible ?? true,
    };

    if (data.id) {
      const { error } = await admin
        .from("categories")
        .update(payload)
        .eq("id", data.id)
        .eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
      await logAudit(admin, {
        tenantId,
        actorId: context.userId,
        action: "CATEGORY_UPDATED",
        entityType: "category",
        entityId: data.id,
        next: payload,
      });
      return { id: data.id };
    }

    const { data: row, error } = await admin
      .from("categories")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "CATEGORY_CREATED",
      entityType: "category",
      entityId: row.id as string,
      next: payload,
    });
    return { id: row.id as string };
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        name: z.string().min(2).max(80),
        description: z.string().max(300).nullable().optional(),
        price: z.number().min(0).max(100000),
        station: z.enum(["cozinha", "bar"]),
        available: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireRoles(context.userId, MANAGERS);
    const payload = {
      tenant_id: tenantId,
      category_id: data.categoryId ?? null,
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      station: data.station,
      available: data.available ?? true,
    };

    if (data.id) {
      const { error } = await admin
        .from("products")
        .update(payload)
        .eq("id", data.id)
        .eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
      await logAudit(admin, {
        tenantId,
        actorId: context.userId,
        action: "PRODUCT_UPDATED",
        entityType: "product",
        entityId: data.id,
        next: payload,
      });
      return { id: data.id };
    }

    const { data: row, error } = await admin.from("products").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "PRODUCT_CREATED",
      entityType: "product",
      entityId: row.id as string,
      next: payload,
    });
    return { id: row.id as string };
  });

/** Availability toggle and soft removal — history is never deleted. */
export const setProductState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        available: z.boolean().optional(),
        archived: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireRoles(context.userId, MANAGERS);
    const patch: Record<string, boolean> = {};
    if (typeof data.available === "boolean") patch["available"] = data.available;
    if (typeof data.archived === "boolean") patch["archived"] = data.archived;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await admin
      .from("products")
      .update(patch)
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: data.archived ? "PRODUCT_ARCHIVED" : "PRODUCT_STATE_CHANGED",
      entityType: "product",
      entityId: data.id,
      next: patch,
    });
    return { ok: true };
  });
