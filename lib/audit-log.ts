import type { createClient } from "@/lib/supabase-server";

type SupabaseServerClient = ReturnType<typeof createClient>;

export async function writeAuditLog(params: {
  supabase: SupabaseServerClient;
  request: Request;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const forwardedFor = params.request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0]?.trim() : null;
  const userAgent = params.request.headers.get("user-agent");

  try {
    await params.supabase.from("audit_logs").insert({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      metadata: params.metadata || {},
      ip_address: ipAddress,
      user_agent: userAgent
    });
  } catch {
    // Do not block primary request on audit-log write failures.
  }
}
