import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

async function resolveAuthorizedClientId(supabase: ReturnType<typeof createClient>, requestedClientId?: string | null) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser, error: appUserError } = await supabase.from("app_users").select("id,role").eq("id", user.id).single();
  if (appUserError || !appUser) return { error: NextResponse.json({ error: appUserError?.message || "Unauthorized" }, { status: 401 }) };

  if (appUser.role === "client") {
    const { data: client, error: clientError } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
    if (clientError || !client) return { error: NextResponse.json({ error: clientError?.message || "Client profile not found" }, { status: 404 }) };
    if (requestedClientId && requestedClientId !== client.id) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { clientId: client.id, userId: user.id, role: appUser.role as "admin" | "coach" | "client" };
  }

  if (!requestedClientId) return { error: NextResponse.json({ error: "client_id is required" }, { status: 400 }) };
  if (appUser.role === "admin") return { clientId: requestedClientId, userId: user.id, role: appUser.role as "admin" | "coach" | "client" };

  const { data: managedClient, error: managedClientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", requestedClientId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (managedClientError || !managedClient) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { clientId: requestedClientId, userId: user.id, role: appUser.role as "admin" | "coach" | "client" };
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const requestedClientId = searchParams.get("client_id");

  const auth = await resolveAuthorizedClientId(supabase, requestedClientId);
  if ("error" in auth) return auth.error;

  const { data: habits, error } = await supabase
    .from("habits")
    .select("id,client_id,name,target_value,unit,is_active,created_at")
    .eq("client_id", auth.clientId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ habits: habits || [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const body = (await request.json()) as {
    client_id?: string;
    name: string;
    target_value?: number;
    unit?: string;
  };

  const auth = await resolveAuthorizedClientId(supabase, body.client_id || null);
  if ("error" in auth) return auth.error;

  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Habit name is required" }, { status: 400 });

  const { data: habit, error } = await supabase
    .from("habits")
    .insert({
      client_id: auth.clientId,
      name,
      target_value: body.target_value && body.target_value > 0 ? body.target_value : 1,
      unit: body.unit?.trim() || "times",
      created_by: auth.userId
    })
    .select("id,client_id,name,target_value,unit,is_active,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ habit });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const body = (await request.json()) as {
    client_id?: string;
    habit_id: string;
    name?: string;
    target_value?: number;
    unit?: string;
    is_active?: boolean;
  };

  if (!body.habit_id) return NextResponse.json({ error: "habit_id is required" }, { status: 400 });

  const auth = await resolveAuthorizedClientId(supabase, body.client_id || null);
  if ("error" in auth) return auth.error;

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.target_value === "number" && Number.isFinite(body.target_value) && body.target_value > 0) updates.target_value = body.target_value;
  if (typeof body.unit === "string") updates.unit = body.unit.trim() || "times";
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

  const { data: habit, error } = await supabase
    .from("habits")
    .update(updates)
    .eq("id", body.habit_id)
    .eq("client_id", auth.clientId)
    .select("id,client_id,name,target_value,unit,is_active,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ habit });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const habitId = searchParams.get("habit_id");
  const requestedClientId = searchParams.get("client_id");
  if (!habitId) return NextResponse.json({ error: "habit_id is required" }, { status: 400 });

  const auth = await resolveAuthorizedClientId(supabase, requestedClientId);
  if ("error" in auth) return auth.error;

  const { error } = await supabase.from("habits").update({ is_active: false }).eq("id", habitId).eq("client_id", auth.clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
