import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: appUser } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!appUser || (appUser.role !== "admin" && appUser.role !== "coach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { client_id: string; template_id: string; start_on?: string | null };
  if (!body.client_id || !body.template_id) {
    return NextResponse.json({ error: "client_id and template_id are required" }, { status: 400 });
  }

  const startOn = body.start_on && /^\d{4}-\d{2}-\d{2}$/.test(body.start_on) ? body.start_on : new Date().toISOString().slice(0, 10);

  if (appUser.role === "coach") {
    const [{ data: client }, { data: template }] = await Promise.all([
      supabase.from("clients").select("coach_id").eq("id", body.client_id).single(),
      supabase.from("program_templates").select("coach_id").eq("id", body.template_id).single()
    ]);

    if (!client || !template || client.coach_id !== user.id || template.coach_id !== user.id) {
      return NextResponse.json({ error: "Coach can only assign own templates to own clients" }, { status: 403 });
    }
  }

  const { error } = await supabase.from("program_assignments").upsert(
    {
      client_id: body.client_id,
      template_id: body.template_id,
      start_week: 1,
      current_week_number: 1,
      current_day_number: 1,
      start_on: startOn,
      active: true
    },
    { onConflict: "client_id,template_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog({
    supabase,
    request,
    actorId: user.id,
    action: "program.assign_template",
    entityType: "client",
    entityId: body.client_id,
    metadata: { template_id: body.template_id, actor_role: appUser.role, start_on: startOn }
  });

  return NextResponse.json({ ok: true });
}
