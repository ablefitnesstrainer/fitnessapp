import { getClubAutomationSettings } from "@/lib/club-automation";

type WelcomeEmailInput = {
  toEmail: string;
  fullName: string | null;
  magicLink: string;
  challengeName: string | null;
  existingUser: boolean;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendClubWelcomeEmail(input: WelcomeEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const settings = await getClubAutomationSettings();
  const fromEmail = settings.welcomeFromEmail || process.env.WELCOME_EMAIL_FROM || "onboarding@resend.dev";
  const support = settings.welcomeSupportEmail || process.env.WELCOME_SUPPORT_EMAIL || "support@example.com";
  const firstName = (input.fullName || "").trim().split(" ")[0] || "there";
  const challengeLine = input.challengeName
    ? `You are enrolled in <strong>${escapeHtml(input.challengeName)}</strong>.`
    : "Your membership is active and your dashboard is ready.";

  const subject = input.existingUser
    ? "Your AbleFit Club membership is active"
    : "Welcome to AbleFit Club";

  const intro = input.existingUser
    ? `Welcome back, ${escapeHtml(firstName)}.`
    : `Welcome, ${escapeHtml(firstName)}.`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h2 style="margin-bottom:8px;">AbleFit Club</h2>
      <p>${intro}</p>
      <p>${challengeLine}</p>
      <p style="margin:18px 0;">
        <a href="${input.magicLink}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600;">Open Your Portal</a>
      </p>
      <p style="font-size:12px;color:#475569;">If you need help, contact ${escapeHtml(support)}.</p>
    </div>
  `;

  const text = [
    `AbleFit Club`,
    `${intro}`,
    `${input.challengeName ? `Enrolled in: ${input.challengeName}` : "Membership is active."}`,
    `Open your portal: ${input.magicLink}`,
    `Support: ${support}`
  ].join("\n\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [input.toEmail],
      subject,
      text,
      html
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend send failed (${response.status}): ${body}`);
  }
}
