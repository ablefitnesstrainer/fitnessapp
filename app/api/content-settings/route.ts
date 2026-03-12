import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/audit-log";

const URL_KEY = "content:client_welcome_video_url";
const TITLE_KEY = "content:client_welcome_video_title";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("security_settings").select("key,value").in("key", [URL_KEY, TITLE_KEY]);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const byKey = new Map((data || []).map((entry) => [entry.key, entry.value as Record<string, unknown>]));
    return NextResponse.json({
      welcome_video_url: String(byKey.get(URL_KEY)?.value || ""),
      welcome_video_title: String(byKey.get(TITLE_KEY)?.value || "Welcome to Able Fitness")
    });
  } catch {
    return NextResponse.json({ welcome_video_url: "", welcome_video_title: "Welcome to Able Fitness" });
  }
}

export async function PUT(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: appUser } = await supabase.from("app_users").select("id,role").eq("id", user.id).single();
  if (!appUser || (appUser.role !== "admin" && appUser.role !== "coach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { welcome_video_url?: string | null; welcome_video_title?: string | null };
  const url = (body.welcome_video_url || "").trim();
  const title = (body.welcome_video_title || "Welcome to Able Fitness").trim();

  if (url && !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Welcome video URL must start with http:// or https://" }, { status: 400 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { error } = await admin.from("security_settings").upsert(
    [
      { key: URL_KEY, value: { value: url }, updated_by: user.id, updated_at: nowIso },
      { key: TITLE_KEY, value: { value: title }, updated_by: user.id, updated_at: nowIso }
    ],
    { onConflict: "key" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    supabase,
    request,
    actorId: user.id,
    action: "content_settings.update_welcome_video",
    entityType: "security_settings",
    metadata: { has_url: Boolean(url), title }
  });

  return NextResponse.json({ ok: true, welcome_video_url: url, welcome_video_title: title });
}
