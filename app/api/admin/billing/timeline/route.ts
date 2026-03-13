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

export async function GET(request: Request) {
  const supabase = createClient();
  const auth = await authorizeAdmin(supabase);
  if ("error" in auth) return auth.error;

  const searchParams = new URL(request.url).searchParams;
  const appUserId = searchParams.get("app_user_id");
  const limit = Math.min(200, Math.max(20, Number(searchParams.get("limit") || 80)));

  const usersQuery = supabase
    .from("app_users")
    .select("id,email,full_name,role,subscription_status,subscription_price_id,subscription_current_period_end,billing_updated_at")
    .in("role", ["client", "coach", "admin"])
    .order("updated_at", { ascending: false })
    .limit(200);

  const eventsQuery = appUserId
    ? supabase.from("club_member_events").select("*").eq("app_user_id", appUserId).order("created_at", { ascending: false }).limit(limit)
    : supabase.from("club_member_events").select("*").order("created_at", { ascending: false }).limit(limit);

  const [usersRes, clubEventsRes, webhookEventsRes] = await Promise.all([
    usersQuery,
    eventsQuery,
    supabase.from("billing_webhook_events").select("*").order("processed_at", { ascending: false }).limit(limit)
  ]);

  if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 400 });
  if (clubEventsRes.error) return NextResponse.json({ error: clubEventsRes.error.message }, { status: 400 });
  if (webhookEventsRes.error) return NextResponse.json({ error: webhookEventsRes.error.message }, { status: 400 });

  return NextResponse.json({
    users: usersRes.data || [],
    club_events: clubEventsRes.data || [],
    webhook_events: webhookEventsRes.data || []
  });
}

