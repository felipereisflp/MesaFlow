import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the signed-in user's profile, tenant and roles. */
export const getMyContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, tenant_id, active")
      .eq("id", userId)
      .maybeSingle();

    const tenantId = (profile?.tenant_id as string | null) ?? null;

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    type Tenant = { id: string; name: string; brand_color: string; service_fee_pct: number };
    let tenant: Tenant | null = null;
    if (tenantId) {
      const { data } = await supabaseAdmin
        .from("tenants")
        .select("id, name, brand_color, service_fee_pct")
        .eq("id", tenantId)
        .maybeSingle();
      tenant = (data as Tenant | null) ?? null;
    }

    return {
      userId,
      fullName: (profile?.full_name as string) ?? "",
      tenant,
      roles: (roles ?? []).map((r) => r.role as string),
    };
  });
