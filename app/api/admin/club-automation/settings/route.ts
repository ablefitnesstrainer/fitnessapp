import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getClubAutomationSettings, setClubAutomationSettings } from "@/lib/club-automation";
import { writeAuditLog } from "@/lib/audit-log";
import { requireRecentAuth } from "@/lib/session-security";

async function authorizeAdmin(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser } = await supabase.from("app_users").select("id,role").eq("id", user.id).single();
  if (!appUser || appUser.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { userId: user.id };
}

export async function GET() {
  const supabase = createClient();
  const auth = await authorizeAdmin(supabase);
  if ("error" in auth) return auth.error;

  const settings = await getClubAutomationSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const reauth = requireRecentAuth(request);
  if (reauth) return reauth;

  const supabase = createClient();
  const auth = await authorizeAdmin(supabase);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    enabled?: boolean;
    fallbackMode?: "next_upcoming" | "none";
    welcomeEmailEnabled?: boolean;
    welcomeFromEmail?: string | null;
    welcomeSupportEmail?: string | null;
  };

  const nextSettings = {
    enabled: Boolean(body.enabled),
    fallbackMode: body.fallbackMode === "none" ? "none" : "next_upcoming",
    welcomeEmailEnabled: Boolean(body.welcomeEmailEnabled),
    welcomeFromEmail: body.welcomeFromEmail?.trim() || null,
    welcomeSupportEmail: body.welcomeSupportEmail?.trim() || null
  } as const;

  const { error } = await setClubAutomationSettings(nextSettings, auth.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    supabase,
    request,
    actorId: auth.userId,
    action: "club.automation_settings_update",
    entityType: "club_automation",
    metadata: nextSettings
  });

  return NextResponse.json(nextSettings);
}
