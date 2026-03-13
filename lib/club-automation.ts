import { createAdminClient } from "@/lib/supabase-admin";

export type ClubAutomationSettings = {
  enabled: boolean;
  fallbackMode: "next_upcoming" | "none";
  welcomeEmailEnabled: boolean;
  welcomeFromEmail: string | null;
  welcomeSupportEmail: string | null;
  welcomeSubject: string;
  welcomeHeading: string;
  welcomeBodyNew: string;
  welcomeBodyExisting: string;
  welcomeButtonLabel: string;
};

const DEFAULTS: ClubAutomationSettings = {
  enabled: true,
  fallbackMode: "next_upcoming",
  welcomeEmailEnabled: true,
  welcomeFromEmail: process.env.WELCOME_EMAIL_FROM || null,
  welcomeSupportEmail: process.env.WELCOME_SUPPORT_EMAIL || null,
  welcomeSubject: "Welcome to AbleFit Club",
  welcomeHeading: "AbleFit Club",
  welcomeBodyNew: "Your membership is active and your dashboard is ready.",
  welcomeBodyExisting: "Your membership is active and your dashboard is ready.",
  welcomeButtonLabel: "Open Your Portal"
};

function asBool(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

export async function getClubAutomationSettings(): Promise<ClubAutomationSettings> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("security_settings").select("value").eq("key", "club:automation").maybeSingle();
    const raw = (data?.value || {}) as Record<string, unknown>;
    const fallbackMode = raw.fallback_mode === "none" ? "none" : "next_upcoming";

    return {
      enabled: asBool(raw.enabled, DEFAULTS.enabled),
      fallbackMode,
      welcomeEmailEnabled: asBool(raw.welcome_email_enabled, DEFAULTS.welcomeEmailEnabled),
      welcomeFromEmail:
        typeof raw.welcome_from_email === "string" && raw.welcome_from_email.trim()
          ? raw.welcome_from_email.trim()
          : DEFAULTS.welcomeFromEmail,
      welcomeSupportEmail:
        typeof raw.welcome_support_email === "string" && raw.welcome_support_email.trim()
          ? raw.welcome_support_email.trim()
          : DEFAULTS.welcomeSupportEmail,
      welcomeSubject:
        typeof raw.welcome_subject === "string" && raw.welcome_subject.trim()
          ? raw.welcome_subject.trim()
          : DEFAULTS.welcomeSubject,
      welcomeHeading:
        typeof raw.welcome_heading === "string" && raw.welcome_heading.trim()
          ? raw.welcome_heading.trim()
          : DEFAULTS.welcomeHeading,
      welcomeBodyNew:
        typeof raw.welcome_body_new === "string" && raw.welcome_body_new.trim()
          ? raw.welcome_body_new.trim()
          : DEFAULTS.welcomeBodyNew,
      welcomeBodyExisting:
        typeof raw.welcome_body_existing === "string" && raw.welcome_body_existing.trim()
          ? raw.welcome_body_existing.trim()
          : DEFAULTS.welcomeBodyExisting,
      welcomeButtonLabel:
        typeof raw.welcome_button_label === "string" && raw.welcome_button_label.trim()
          ? raw.welcome_button_label.trim()
          : DEFAULTS.welcomeButtonLabel
    };
  } catch {
    return DEFAULTS;
  }
}

export async function setClubAutomationSettings(input: ClubAutomationSettings, updatedBy: string) {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const payload = {
    key: "club:automation",
    value: {
      enabled: input.enabled,
      fallback_mode: input.fallbackMode,
      welcome_email_enabled: input.welcomeEmailEnabled,
      welcome_from_email: input.welcomeFromEmail,
      welcome_support_email: input.welcomeSupportEmail,
      welcome_subject: input.welcomeSubject,
      welcome_heading: input.welcomeHeading,
      welcome_body_new: input.welcomeBodyNew,
      welcome_body_existing: input.welcomeBodyExisting,
      welcome_button_label: input.welcomeButtonLabel
    },
    updated_by: updatedBy,
    updated_at: nowIso
  };

  return admin.from("security_settings").upsert(payload, { onConflict: "key" });
}
