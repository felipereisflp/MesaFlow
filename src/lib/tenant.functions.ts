import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logAudit } from "@/lib/audit.server";

const MANAGEMENT = ["owner", "admin"] as const;

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireTenant(supabase: ReturnType<typeof Object>, userId: string) {
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

async function requireRole(userId: string, roles: readonly string[]) {
  const admin = await loadAdmin();
  const { data } = await admin.from("user_roles").select("role, tenant_id").eq("user_id", userId);
  const found = (data ?? []).find((r) => roles.includes(r.role as string));
  if (!found) throw new Error("Você não tem permissão para esta ação.");
  return found.tenant_id as string;
}

export const createTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(2).max(80),
        fullName: z.string().min(2).max(80),
        brandColor: z.string().max(20).optional(),
        serviceFeePct: z.number().min(0).max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const admin = await loadAdmin();
    const userId = context.userId;

    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.tenant_id) return { tenantId: profile.tenant_id as string };

    const { data: tenant, error } = await admin
      .from("tenants")
      .insert({
        name: data.name,
        brand_color: data.brandColor ?? "#1d4ed8",
        service_fee_pct: data.serviceFeePct ?? 10,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await admin
      .from("profiles")
      .update({ tenant_id: tenant.id, full_name: data.fullName })
      .eq("id", userId);
    await admin.from("user_roles").insert({ user_id: userId, tenant_id: tenant.id, role: "owner" });
    await logAudit(admin, {
      tenantId: tenant.id,
      actorId: userId,
      action: "TENANT_CREATED",
      entityType: "tenant",
      entityId: tenant.id,
      next: { name: data.name },
    });

    return { tenantId: tenant.id as string };
  });

export const listTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, tenantId } = await requireTenant(null, context.userId);
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, phone, active")
      .eq("tenant_id", tenantId);
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id, role")
      .eq("tenant_id", tenantId);
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailById = new Map(users?.users?.map((u) => [u.id, u.email ?? ""]) ?? []);

    return (profiles ?? []).map((p) => ({
      id: p.id as string,
      fullName: (p.full_name as string) || "(sem nome)",
      email: emailById.get(p.id as string) ?? "",
      active: p.active as boolean,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
    }));
  });

export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().min(2).max(80),
        password: z.string().min(8).max(72),
        role: z.enum(["owner", "admin", "gerente", "caixa", "garcom", "cozinha", "bar", "auditor"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const tenantId = await requireRole(context.userId, MANAGEMENT);
    const admin = await loadAdmin();

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const newUserId = created.user!.id;

    await admin
      .from("profiles")
      .upsert({ id: newUserId, tenant_id: tenantId, full_name: data.fullName });
    await admin
      .from("user_roles")
      .insert({ user_id: newUserId, tenant_id: tenantId, role: data.role });
    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "TEAM_MEMBER_ADDED",
      entityType: "user",
      entityId: newUserId,
      next: { email: data.email, role: data.role },
    });

    return { id: newUserId };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["owner", "admin", "gerente", "caixa", "garcom", "cozinha", "bar", "auditor"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const tenantId = await requireRole(context.userId, MANAGEMENT);
    const admin = await loadAdmin();
    const { data: before } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("tenant_id", tenantId);

    await admin.from("user_roles").delete().eq("user_id", data.userId).eq("tenant_id", tenantId);
    await admin
      .from("user_roles")
      .insert({ user_id: data.userId, tenant_id: tenantId, role: data.role });
    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "TEAM_ROLE_CHANGED",
      entityType: "user",
      entityId: data.userId,
      previous: before,
      next: { role: data.role },
    });
    return { ok: true };
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const tenantId = await requireRole(context.userId, MANAGEMENT);
    if (data.userId === context.userId) throw new Error("Você não pode remover a si mesmo.");
    const admin = await loadAdmin();
    await admin.from("user_roles").delete().eq("user_id", data.userId).eq("tenant_id", tenantId);
    await admin.from("profiles").update({ active: false, tenant_id: null }).eq("id", data.userId);
    await logAudit(admin, {
      tenantId,
      actorId: context.userId,
      action: "TEAM_MEMBER_REMOVED",
      entityType: "user",
      entityId: data.userId,
    });
    return { ok: true };
  });
