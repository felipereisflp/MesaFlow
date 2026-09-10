import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAudit, newOpaqueToken } from "@/lib/audit.server";

const MANAGERS = ["owner", "admin", "gerente"];

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireManager(userId: string) {
  const admin = await loadAdmin();
  const { data } = await admin.from("user_roles").select("role, tenant_id").eq("user_id", userId);
  const found = (data ?? []).find((r) => MANAGERS.includes(r.role as string));
  if (!found) throw new Error("Apenas gerente, admin ou dono podem gerenciar as tags.");
  return { admin, tenantId: found.tenant_id as string };
}

export const createTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ tableId: z.string().uuid(), label: z.string().max(40).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireManager(context.userId);
    const token = newOpaqueToken();
    const { data: tag, error } = await admin
      .from("nfc_tags")
      .insert({
        tenant_id: tenantId,
        table_id: data.tableId,
        token,
        label: data.label ?? null,
      })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "NFC_CREATED",
      entityType: "nfc_tag",
      entityId: tag.id as string,
    });
    return { id: tag.id as string, token: tag.token as string };
  });

export const rotateTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tagId: z.string().uuid(), reason: z.string().min(10).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireManager(context.userId);
    const { data: current } = await admin
      .from("nfc_tags")
      .select("token_version")
      .eq("id", data.tagId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!current) throw new Error("Tag não encontrada.");

    const token = newOpaqueToken();
    const { error } = await admin
      .from("nfc_tags")
      .update({
        token,
        token_version: (current.token_version as number) + 1,
        status: "ACTIVE",
      })
      .eq("id", data.tagId)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);

    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "NFC_ROTATED",
      entityType: "nfc_tag",
      entityId: data.tagId,
      reason: data.reason,
    });
    return { token };
  });

export const revokeTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tagId: z.string().uuid(), reason: z.string().min(10).max(300) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { admin, tenantId } = await requireManager(context.userId);
    const { error } = await admin
      .from("nfc_tags")
      .update({ status: "REVOKED" })
      .eq("id", data.tagId)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "NFC_REVOKED",
      entityType: "nfc_tag",
      entityId: data.tagId,
      reason: data.reason,
    });
    return { ok: true };
  });
