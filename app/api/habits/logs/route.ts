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
    return { clientId: client.id, role: appUser.role as "admin" | "coach" | "client" };
  }

  if (!requestedClientId) return { error: NextResponse.json({ error: "client_id is required" }, { status: 400 }) };
  if (appUser.role === "admin") return { clientId: requestedClientId, role: appUser.role as "admin" | "coach" | "client" };

  const { data: managedClient, error: managedClientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", requestedClientId)
    .eq("coach_id", user.id)
    .maybeSingle();
  if (managedClientError || !managedClient) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { clientId: requestedClientId, role: appUser.role as "admin" | "coach" | "client" };
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const requestedClientId = searchParams.get("client_id");
  const days = Math.max(1, Math.min(31, Number(searchParams.get("days") || 7)));

  const auth = await resolveAuthorizedClientId(supabase, requestedClientId);
  if ("error" in auth) return auth.error;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - (days - 1));
  const fromIsoDate = fromDate.toISOString().slice(0, 10);

  const { data: logs, error } = await supabase
    .from("habit_logs")
    .select("id,habit_id,client_id,log_date,value,completed,notes,created_at")
    .eq("client_id", auth.clientId)
    .gte("log_date", fromIsoDate)
    .order("log_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ logs: logs || [] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const body = (await request.json()) as {
    client_id?: string;
    habit_id: string;
    log_date: string;
    value?: number;
    completed?: boolean;
    notes?: string;
  };

  if (!body.habit_id || !body.log_date) {
    return NextResponse.json({ error: "habit_id and log_date are required" }, { status: 400 });
  }

  const auth = await resolveAuthorizedClientId(supabase, body.client_id || null);
  if ("error" in auth) return auth.error;

  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id,client_id")
    .eq("id", body.habit_id)
    .eq("client_id", auth.clientId)
    .maybeSingle();

  if (habitError || !habit) return NextResponse.json({ error: "Habit not found" }, { status: 404 });

  const { data: log, error } = await supabase
    .from("habit_logs")
    .upsert(
      {
        habit_id: body.habit_id,
        client_id: auth.clientId,
        log_date: body.log_date,
        value: typeof body.value === "number" ? body.value : 0,
        completed: Boolean(body.completed),
        notes: body.notes || null
      },
      { onConflict: "habit_id,log_date" }
    )
    .select("id,habit_id,client_id,log_date,value,completed,notes,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ log });
}
