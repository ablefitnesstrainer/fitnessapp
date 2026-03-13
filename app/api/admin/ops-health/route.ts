import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

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

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [failedWebhooks, recentWebhooks, openSupport, warningClubEvents, opsAlerts, settingsRes] = await Promise.all([
    supabase.from("billing_webhook_events").select("id", { count: "exact", head: true }).eq("status", "failed").gte("processed_at", since),
    supabase.from("billing_webhook_events").select("event_type,status,processed_at,error_message").order("processed_at", { ascending: false }).limit(20),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    supabase.from("club_member_events").select("id", { count: "exact", head: true }).in("status", ["warning", "failed"]).gte("created_at", since),
    supabase.from("ops_alert_events").select("alert_key,severity,status,last_seen_at,last_sent_at,message,occurrences").order("last_seen_at", { ascending: false }).limit(20),
    supabase
      .from("security_settings")
      .select("key,value")
      .in("key", ["key_rotation:last_completed_on", "key_rotation:next_due_on", "backup_restore:last_test_on", "backup_restore:next_test_on"])
  ]);

  if (failedWebhooks.error) return NextResponse.json({ error: failedWebhooks.error.message }, { status: 400 });
  if (recentWebhooks.error) return NextResponse.json({ error: recentWebhooks.error.message }, { status: 400 });
  if (openSupport.error) return NextResponse.json({ error: openSupport.error.message }, { status: 400 });
  if (warningClubEvents.error) return NextResponse.json({ error: warningClubEvents.error.message }, { status: 400 });
  if (opsAlerts.error) return NextResponse.json({ error: opsAlerts.error.message }, { status: 400 });
  if (settingsRes.error) return NextResponse.json({ error: settingsRes.error.message }, { status: 400 });

  const byKey = new Map((settingsRes.data || []).map((row) => [row.key, row.value as Record<string, unknown>]));

  return NextResponse.json({
    summary: {
      failed_webhooks_24h: failedWebhooks.count || 0,
      warning_or_failed_provisioning_24h: warningClubEvents.count || 0,
      open_support_tickets: openSupport.count || 0
    },
    security_ops: {
      key_rotation_last_completed: String(byKey.get("key_rotation:last_completed_on")?.date || ""),
      key_rotation_next_due: String(byKey.get("key_rotation:next_due_on")?.date || ""),
      backup_restore_last_test: String(byKey.get("backup_restore:last_test_on")?.date || ""),
      backup_restore_next_due: String(byKey.get("backup_restore:next_test_on")?.date || "")
    },
    webhook_events: recentWebhooks.data || [],
    ops_alerts: opsAlerts.data || []
  });
}

