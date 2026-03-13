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
  const challengeLine = input.challengeName ? `You are enrolled in <strong>${escapeHtml(input.challengeName)}</strong>.` : "";

  const subject = settings.welcomeSubject || "Welcome to AbleFit Club";

  const intro = input.existingUser
    ? `Welcome back, ${escapeHtml(firstName)}.`
    : `Welcome, ${escapeHtml(firstName)}.`;
  const bodyCopy = input.existingUser ? settings.welcomeBodyExisting : settings.welcomeBodyNew;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const loginUrl = appUrl ? `${appUrl}/login` : input.magicLink;
  const forgotPasswordUrl = appUrl ? `${appUrl}/forgot-password` : "";
  const passwordHelpLine = forgotPasswordUrl
    ? `Want a password-based login too? Use <a href="${forgotPasswordUrl}" style="color:#2563eb;">Forgot password</a> after your first sign-in to set one.`
    : "Want a password-based login too? Use Forgot password after your first sign-in to set one.";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h2 style="margin-bottom:8px;">${escapeHtml(settings.welcomeHeading || "AbleFit Club")}</h2>
      <p>${intro}</p>
      <p>${escapeHtml(bodyCopy || "Your membership is active and your dashboard is ready.")}</p>
      ${challengeLine ? `<p>${challengeLine}</p>` : ""}
      <p style="margin:18px 0;">
        <a href="${input.magicLink}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600;">${escapeHtml(settings.welcomeButtonLabel || "Open Your Portal")}</a>
      </p>
      <p><strong>No password is required for first login.</strong> The button above signs you in securely via magic link.</p>
      <p>${passwordHelpLine}</p>
      <p style="margin:10px 0 0 0;">Login page: <a href="${loginUrl}" style="color:#2563eb;">${escapeHtml(loginUrl)}</a></p>
      <p style="font-size:12px;color:#475569;">If you need help, contact ${escapeHtml(support)}.</p>
    </div>
  `;

  const text = [
    `AbleFit Club`,
    `${intro}`,
    `${bodyCopy || "Your membership is active and your dashboard is ready."}`,
    `${input.challengeName ? `Enrolled in: ${input.challengeName}` : "Membership is active."}`,
    `Open your portal: ${input.magicLink}`,
    `No password is required for first login. The portal link signs you in securely.`,
    forgotPasswordUrl
      ? `If you want password login later, use Forgot password: ${forgotPasswordUrl}`
      : `If you want password login later, use Forgot password from the login page.`,
    `Login page: ${loginUrl}`,
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
