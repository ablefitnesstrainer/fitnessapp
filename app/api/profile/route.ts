import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { full_name?: string };
  const fullName = (body.full_name || "").trim();

  if (!fullName) {
    return NextResponse.json({ error: "full_name is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("app_users").update({ full_name: fullName }).eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
