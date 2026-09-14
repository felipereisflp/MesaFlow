import { logAudit } from "@/lib/audit.server";

export const MANAGERS = ["owner", "admin", "gerente"] as const;

export async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Resolves the caller's tenant, asserting one of the allowed roles. */
export async function requireRoles(userId: string, roles: readonly string[]) {
  const admin = await loadAdmin();
  const { data } = await admin.from("user_roles").select("role, tenant_id").eq("user_id", userId);
  const found = (data ?? []).find((r) => roles.includes(r.role as string));
  if (!found) throw new Error("Você não tem permissão para esta ação.");
  return { admin, tenantId: found.tenant_id as string };
}

/** Any signed-in staff member of a tenant (read-only surfaces). */
export async function requireMember(userId: string) {
  const admin = await loadAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();
  const tenantId = profile?.tenant_id as string | null | undefined;
  if (!tenantId) throw new Error("Nenhum estabelecimento vinculado a este usuário.");
  return { admin, tenantId };
}

export { logAudit };
