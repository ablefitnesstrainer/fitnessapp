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

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  let query = supabase
    .from("club_member_events")
    .select("id,event_type,status,notes,payload,retry_count,last_error,processed_at,created_at,app_user_id,client_id,challenge_id,template_id,stripe_customer_id,stripe_subscription_id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ events: data || [] });
}
