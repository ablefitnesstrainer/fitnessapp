import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: appUser } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!appUser || (appUser.role !== "admin" && appUser.role !== "coach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { client_id: string; coach_id: string | null };

  if (!body.client_id) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  let coachIdToSet = body.coach_id;

  if (appUser.role === "coach") {
    // Coaches can only assign themselves.
    coachIdToSet = user.id;
  }

  const { error } = await supabase.from("clients").update({ coach_id: coachIdToSet }).eq("id", body.client_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, coach_id: coachIdToSet });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: appUser } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!appUser || (appUser.role !== "admin" && appUser.role !== "coach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  if (appUser.role === "coach") {
    const { data: existingClient } = await supabase.from("clients").select("coach_id").eq("id", clientId).single();
    if (!existingClient || existingClient.coach_id !== user.id) {
      return NextResponse.json({ error: "Coach can only delete assigned clients" }, { status: 403 });
    }
  }

  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
