import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

async function authorizeCoachOrAdmin(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser, error } = await supabase.from("app_users").select("id,role").eq("id", user.id).single();
  if (error || !appUser) return { error: NextResponse.json({ error: error?.message || "Unauthorized" }, { status: 401 }) };
  if (appUser.role !== "coach" && appUser.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { userId: user.id };
}

export async function GET() {
  const supabase = createClient();
  const auth = await authorizeCoachOrAdmin(supabase);
  if ("error" in auth) return auth.error;

  const { data, error } = await supabase.from("message_templates").select("id,title,body,created_at").eq("owner_id", auth.userId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ templates: data || [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const auth = await authorizeCoachOrAdmin(supabase);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as { title: string; body: string };
  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("message_templates")
    .insert({ owner_id: auth.userId, title: body.title.trim(), body: body.body.trim() })
    .select("id,title,body,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ template: data });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const auth = await authorizeCoachOrAdmin(supabase);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase.from("message_templates").delete().eq("id", id).eq("owner_id", auth.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
