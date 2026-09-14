import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MANAGERS, logAudit, requireMember, requireRoles } from "@/lib/rbac.server";

export type VenueTable = {
  id: string;
  displayCode: string;
  area: string | null;
  seats: number;
  active: boolean;
  tag: { id: string; token: string; status: string; version: number } | null;
};

export const listTables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, tenantId } = await requireMember(context.userId);

    const [{ data: tables }, { data: tags }] = await Promise.all([
      admin
        .from("venue_tables")
        .select("id, display_code, area, seats, active")
        .eq("tenant_id", tenantId)
        .order("display_code"),
      admin
        .from("nfc_tags")
        .select("id, table_id, token, status, token_version")
        .eq("tenant_id", tenantId)
        .neq("status", "REVOKED"),
    ]);

    const byTable = new Map<string, (typeof tags extends null ? never : NonNullable<typeof tags>)[number]>();
    for (const t of tags ?? []) byTable.set(t.table_id as string, t);

    return (tables ?? []).map((t) => {
      const tag = byTable.get(t.id as string);
      return {
        id: t.id as string,
        displayCode: t.display_code as string,
        area: (t.area as string | null) ?? null,
        seats: t.seats as number,
        active: t.active as boolean,
        tag: tag
          ? {
              id: tag.id as string,
              token: tag.token as string,
              status: tag.status as string,
              version: tag.token_version as number,
            }
          : null,
      } satisfies VenueTable;
    });
  });

export const saveTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        displayCode: z.string().min(1).max(20),
        area: z.string().max(40).nullable().optional(),
        seats: z.number().int().min(1).max(40).optional(),
        active: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireRoles(context.userId, MANAGERS);
    const payload = {
      tenant_id: tenantId,
      display_code: data.displayCode,
      area: data.area ?? null,
      seats: data.seats ?? 4,
      active: data.active ?? true,
    };

    if (data.id) {
      const { error } = await admin
        .from("venue_tables")
        .update(payload)
        .eq("id", data.id)
        .eq("tenant_id", tenantId);
      if (error) throw new Error(error.message);
      await logAudit(admin, {
        tenantId,
        actorId: context.userId,
        action: "TABLE_UPDATED",
        entityType: "venue_table",
        entityId: data.id,
        next: payload,
      });
      return { id: data.id };
    }

    const { data: row, error } = await admin
      .from("venue_tables")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "TABLE_CREATED",
      entityType: "venue_table",
      entityId: row.id as string,
      next: payload,
    });
    return { id: row.id as string };
  });
