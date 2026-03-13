import { createAdminClient } from "@/lib/supabase-admin";

export type ClubAutomationSettings = {
  enabled: boolean;
  fallbackMode: "next_upcoming" | "none";
  welcomeEmailEnabled: boolean;
  welcomeFromEmail: string | null;
  welcomeSupportEmail: string | null;
};

const DEFAULTS: ClubAutomationSettings = {
  enabled: true,
  fallbackMode: "next_upcoming",
  welcomeEmailEnabled: true,
  welcomeFromEmail: process.env.WELCOME_EMAIL_FROM || null,
  welcomeSupportEmail: process.env.WELCOME_SUPPORT_EMAIL || null
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
          : DEFAULTS.welcomeSupportEmail
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
      welcome_support_email: input.welcomeSupportEmail
    },
    updated_by: updatedBy,
    updated_at: nowIso
  };

  return admin.from("security_settings").upsert(payload, { onConflict: "key" });
}
