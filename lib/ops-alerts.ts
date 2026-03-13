import { createAdminClient } from "@/lib/supabase-admin";

type Severity = "info" | "warning" | "critical";

type OpsAlertPolicy = {
  enabled: boolean;
  recipientEmail: string | null;
  fromEmail: string | null;
  dedupeWindowMinutes: number;
  quietHoursStart: number;
  quietHoursEnd: number;
};

type ReportOpsAlertInput = {
  alertKey: string;
  message: string;
  severity?: Severity;
  metadata?: Record<string, unknown>;
};

const DEFAULT_POLICY: OpsAlertPolicy = {
  enabled: true,
  recipientEmail: process.env.OPS_ALERT_EMAIL || process.env.SECURITY_ALERT_EMAIL || null,
  fromEmail: process.env.OPS_ALERT_FROM || process.env.SECURITY_ALERT_FROM || "onboarding@resend.dev",
  dedupeWindowMinutes: 60,
  quietHoursStart: 22,
  quietHoursEnd: 6
};

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function inQuietHours(hour: number, start: number, end: number) {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

async function loadPolicy(): Promise<OpsAlertPolicy> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("security_settings").select("value").eq("key", "alerts:ops_runtime").maybeSingle();
    const raw = (data?.value || {}) as Record<string, unknown>;
    return {
      enabled: raw.enabled === undefined ? DEFAULT_POLICY.enabled : Boolean(raw.enabled),
      recipientEmail:
        typeof raw.recipient_email === "string" && raw.recipient_email.trim()
          ? raw.recipient_email.trim()
          : DEFAULT_POLICY.recipientEmail,
      fromEmail: typeof raw.from_email === "string" && raw.from_email.trim() ? raw.from_email.trim() : DEFAULT_POLICY.fromEmail,
      dedupeWindowMinutes: clampInt(raw.dedupe_window_minutes, DEFAULT_POLICY.dedupeWindowMinutes, 1, 24 * 60),
      quietHoursStart: clampInt(raw.quiet_hours_start, DEFAULT_POLICY.quietHoursStart, 0, 23),
      quietHoursEnd: clampInt(raw.quiet_hours_end, DEFAULT_POLICY.quietHoursEnd, 0, 23)
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

async function sendEmail(params: { to: string; from: string; subject: string; text: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: params.html
    })
  });
}

export async function reportOpsAlert(input: ReportOpsAlertInput) {
  const policy = await loadPolicy();
  const severity = input.severity || "warning";
  const now = new Date();
  const nowIso = now.toISOString();
  const admin = createAdminClient();

  try {
    const { data: existing } = await admin
      .from("ops_alert_events")
      .select("id,last_sent_at,occurrences")
      .eq("alert_key", input.alertKey)
      .maybeSingle();

    const dedupeMs = policy.dedupeWindowMinutes * 60_000;
    const lastSentMs = existing?.last_sent_at ? new Date(existing.last_sent_at).getTime() : null;
    const deduped = lastSentMs ? Date.now() - lastSentMs < dedupeMs : false;
    const quiet = inQuietHours(now.getHours(), policy.quietHoursStart, policy.quietHoursEnd);
    const shouldSuppress = deduped || (quiet && severity !== "critical");

    const basePayload = {
      alert_key: input.alertKey,
      channel: "email",
      severity,
      message: input.message,
      metadata: input.metadata || {},
      last_seen_at: nowIso,
      updated_at: nowIso
    };

    if (existing?.id) {
      await admin
        .from("ops_alert_events")
        .update({
          ...basePayload,
          status: shouldSuppress ? "suppressed" : "sent",
          occurrences: (existing.occurrences || 0) + 1,
          ...(shouldSuppress ? {} : { last_sent_at: nowIso })
        })
        .eq("id", existing.id);
    } else {
      await admin.from("ops_alert_events").insert({
        ...basePayload,
        status: shouldSuppress ? "suppressed" : "sent",
        first_seen_at: nowIso,
        occurrences: 1,
        ...(shouldSuppress ? {} : { last_sent_at: nowIso })
      });
    }

    if (shouldSuppress || !policy.enabled || !policy.recipientEmail) return;

    const details = JSON.stringify(input.metadata || {}, null, 2);
    const subject = `[Able Fitness Ops] ${severity.toUpperCase()} - ${input.alertKey}`;
    const text = `${input.message}\n\nKey: ${input.alertKey}\nTime: ${nowIso}\n\nMetadata:\n${details}`;
    const html = `
      <h2>Able Fitness Ops Alert</h2>
      <p><strong>Severity:</strong> ${severity}</p>
      <p><strong>Key:</strong> ${input.alertKey}</p>
      <p>${input.message}</p>
      <pre style="background:#f6f8fa;padding:12px;border-radius:8px;">${details}</pre>
    `;

    await sendEmail({
      to: policy.recipientEmail,
      from: policy.fromEmail || "onboarding@resend.dev",
      subject,
      text,
      html
    });
  } catch {
    // Never throw from alerting path.
  }
}

