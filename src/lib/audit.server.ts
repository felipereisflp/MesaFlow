import type { SupabaseClient } from "@supabase/supabase-js";

type AuditInput = {
  tenantId: string;
  actorId?: string | null;
  actorType?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  previous?: unknown;
  next?: unknown;
  reason?: string | null;
  result?: string;
};

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Appends an audit entry, chained by hash to the tenant's previous entry. */
export async function logAudit(admin: SupabaseClient, input: AuditInput) {
  const { data: last } = await admin
    .from("audit_events")
    .select("curr_hash")
    .eq("tenant_id", input.tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevHash = (last?.["curr_hash"] as string | undefined) ?? null;
  const payload = {
    tenant_id: input.tenantId,
    actor_id: input.actorId ?? null,
    actor_type: input.actorType ?? "USER",
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    previous_state_summary: (input.previous ?? null) as never,
    new_state_summary: (input.next ?? null) as never,
    reason: input.reason ?? null,
    result: input.result ?? "SUCCESS",
  };
  const currHash = await sha256(`${prevHash ?? ""}|${JSON.stringify(payload)}`);

  await admin.from("audit_events").insert({ ...payload, prev_hash: prevHash, curr_hash: currHash });
}

/** 128-bit opaque token from a CSPRNG. */
export function newOpaqueToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
