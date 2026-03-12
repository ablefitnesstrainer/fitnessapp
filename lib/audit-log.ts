import type { createClient } from "@/lib/supabase-server";
import { detectSecurityAnomaly, isSensitiveSecurityAction, sensitiveSecurityActions, securityDeviceFingerprint } from "@/lib/security-anomaly";
import { sendSecurityAnomalyEmail } from "@/lib/security-alerts";
import { getSecurityAlertPolicy } from "@/lib/security-controls";

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
    let anomalyReasons: string[] = [];
    let deviceFingerprint = securityDeviceFingerprint(userAgent);
    let actorName: string | null = null;
    let actorEmail: string | null = null;

    if (isSensitiveSecurityAction(params.action)) {
      const [{ data: priorRows }, { data: actorRow }] = await Promise.all([
        params.supabase
          .from("audit_logs")
          .select("ip_address,user_agent")
          .eq("actor_id", params.actorId)
          .in("action", sensitiveSecurityActions)
          .order("created_at", { ascending: false })
          .limit(100),
        params.supabase.from("app_users").select("full_name,email").eq("id", params.actorId).maybeSingle()
      ]);

      const rawAnomaly = detectSecurityAnomaly({
        history: (priorRows || []) as Array<{ ip_address: string | null; user_agent: string | null }>,
        currentIp: ipAddress,
        currentUserAgent: userAgent
      });
      deviceFingerprint = rawAnomaly.deviceFingerprint || deviceFingerprint;
      actorName = (actorRow as { full_name?: string | null } | null)?.full_name || null;
      actorEmail = (actorRow as { email?: string | null } | null)?.email || null;

      const alertPolicy = await getSecurityAlertPolicy();
      const filteredReasons = rawAnomaly.reasons.filter((reason) => {
        if (reason === "new IP") return alertPolicy.notifyOnNewIp;
        if (reason === "new device profile") return alertPolicy.notifyOnNewDevice;
        return true;
      });
      anomalyReasons = filteredReasons;

      if (alertPolicy.enabled && filteredReasons.length >= Math.max(1, alertPolicy.minimumReasons || 1)) {
        await sendSecurityAnomalyEmail(
          {
            action: params.action,
            actorId: params.actorId,
            actorName,
            actorEmail,
            entityType: params.entityType,
            entityId: params.entityId || null,
            ipAddress,
            deviceFingerprint,
            reasons: filteredReasons,
            occurredAtIso: new Date().toISOString()
          },
          {
            recipientEmail: alertPolicy.recipientEmail,
            fromEmail: alertPolicy.fromEmail
          }
        );
      }
    }

    const metadata = {
      ...(params.metadata || {}),
      security_context: {
        ip: ipAddress,
        device: deviceFingerprint,
        anomaly_reasons: anomalyReasons
      }
    };

    await params.supabase.from("audit_logs").insert({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      metadata,
      ip_address: ipAddress,
      user_agent: userAgent
    });

  } catch {
    // Do not block primary request on audit-log write failures.
  }
}
