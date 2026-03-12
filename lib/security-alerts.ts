type SecurityAlertPayload = {
  action: string;
  actorId: string;
  actorName?: string | null;
  actorEmail?: string | null;
  entityType: string;
  entityId?: string | null;
  ipAddress: string | null;
  deviceFingerprint: string;
  reasons: string[];
  occurredAtIso: string;
};

export async function sendSecurityAnomalyEmail(payload: SecurityAlertPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.SECURITY_ALERT_EMAIL;
  const fromEmail = process.env.SECURITY_ALERT_FROM || "onboarding@resend.dev";

  if (!apiKey || !toEmail) return;

  const subject = `[Able Fitness Security] Anomaly detected: ${payload.action}`;
  const actorLabel = payload.actorName?.trim() || payload.actorEmail?.trim() || payload.actorId;
  const details = [
    `Action: ${payload.action}`,
    `Actor: ${actorLabel}`,
    `Actor ID: ${payload.actorId}`,
    `Entity: ${payload.entityType}${payload.entityId ? ` (${payload.entityId})` : ""}`,
    `Reasons: ${payload.reasons.join(", ")}`,
    `IP: ${payload.ipAddress || "unknown"}`,
    `Device: ${payload.deviceFingerprint}`,
    `Occurred: ${payload.occurredAtIso}`
  ].join("\n");

  const html = `
    <h2>Able Fitness Security Alert</h2>
    <p>A sensitive action anomaly was detected.</p>
    <pre style="background:#f6f8fa;padding:12px;border-radius:8px;">${details}</pre>
    <p>Review the Security Log in Admin and verify the actor/session immediately.</p>
  `;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        text: details,
        html
      })
    });
  } catch {
    // Never block primary request if alert email fails.
  }
}
