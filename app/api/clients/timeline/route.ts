import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

async function authorizeClientAccess(supabase: ReturnType<typeof createClient>, requestedClientId?: string | null) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser, error: appUserError } = await supabase.from("app_users").select("id,role").eq("id", user.id).single();
  if (appUserError || !appUser) return { error: NextResponse.json({ error: appUserError?.message || "Unauthorized" }, { status: 401 }) };

  if (appUser.role === "client") {
    const { data: client, error: clientError } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
    if (clientError || !client) return { error: NextResponse.json({ error: clientError?.message || "Client not found" }, { status: 404 }) };
    if (requestedClientId && requestedClientId !== client.id) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { clientId: client.id };
  }

  if (!requestedClientId) return { error: NextResponse.json({ error: "client_id is required" }, { status: 400 }) };
  if (appUser.role === "admin") return { clientId: requestedClientId };

  const { data: managedClient, error: managedClientError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", requestedClientId)
    .eq("coach_id", user.id)
    .maybeSingle();
  if (managedClientError || !managedClient) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { clientId: requestedClientId };
}

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const auth = await authorizeClientAccess(supabase, searchParams.get("client_id"));
  if ("error" in auth) return auth.error;

  const [workoutsRes, checkinsRes, mealsRes, weightsRes, photosRes, notesRes] = await Promise.all([
    supabase.from("workout_logs").select("id,completed_at,total_volume").eq("client_id", auth.clientId).order("completed_at", { ascending: false }).limit(20),
    supabase.from("checkins").select("id,created_at,adherence,overall_week_rating").eq("client_id", auth.clientId).order("created_at", { ascending: false }).limit(20),
    supabase.from("meal_logs").select("id,created_at,food_name,calories").eq("client_id", auth.clientId).order("created_at", { ascending: false }).limit(20),
    supabase.from("bodyweight_logs").select("id,created_at,weight").eq("client_id", auth.clientId).order("created_at", { ascending: false }).limit(20),
    supabase.from("progress_photos").select("id,created_at,caption,taken_at").eq("client_id", auth.clientId).order("created_at", { ascending: false }).limit(20),
    supabase.from("coach_notes").select("id,created_at,note").eq("client_id", auth.clientId).order("created_at", { ascending: false }).limit(20)
  ]);

  const err =
    workoutsRes.error ||
    checkinsRes.error ||
    mealsRes.error ||
    weightsRes.error ||
    photosRes.error ||
    notesRes.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 400 });

  const events: Array<{ id: string; type: string; at: string; title: string; detail?: string }> = [];

  for (const w of workoutsRes.data || []) {
    if (!w.completed_at) continue;
    events.push({
      id: `workout-${w.id}`,
      type: "workout",
      at: w.completed_at,
      title: "Workout completed",
      detail: w.total_volume ? `Volume: ${Math.round(Number(w.total_volume))}` : undefined
    });
  }
  for (const c of checkinsRes.data || []) {
    events.push({
      id: `checkin-${c.id}`,
      type: "checkin",
      at: c.created_at,
      title: "Weekly check-in submitted",
      detail: c.adherence !== null ? `Adherence: ${c.adherence}%` : undefined
    });
  }
  for (const m of mealsRes.data || []) {
    events.push({
      id: `meal-${m.id}`,
      type: "meal",
      at: m.created_at,
      title: `Meal logged: ${m.food_name}`,
      detail: `${m.calories} kcal`
    });
  }
  for (const b of weightsRes.data || []) {
    events.push({
      id: `weight-${b.id}`,
      type: "weight",
      at: b.created_at,
      title: "Bodyweight logged",
      detail: `${Number(b.weight)} lbs`
    });
  }
  for (const p of photosRes.data || []) {
    events.push({
      id: `photo-${p.id}`,
      type: "photo",
      at: p.created_at,
      title: "Progress photo added",
      detail: p.caption || (p.taken_at ? `Taken: ${new Date(p.taken_at).toLocaleDateString()}` : undefined)
    });
  }
  for (const n of notesRes.data || []) {
    events.push({
      id: `note-${n.id}`,
      type: "note",
      at: n.created_at,
      title: "Coach note added",
      detail: n.note
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return NextResponse.json({ events: events.slice(0, 100) });
}
