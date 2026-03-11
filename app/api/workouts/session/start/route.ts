import { NextResponse } from "next/server";
import { authorizeByClientId } from "../_access";

type StartPayload = {
  client_id: string;
  day_id: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as StartPayload;
  if (!body.client_id || !body.day_id) {
    return NextResponse.json({ error: "client_id and day_id are required" }, { status: 400 });
  }

  const auth = await authorizeByClientId(body.client_id);
  if ("error" in auth) return auth.error;
  const { supabase, clientId } = auth.context;

  const { data: existing, error: existingError } = await supabase
    .from("workout_logs")
    .select("id,started_at,completed_at")
    .eq("client_id", clientId)
    .eq("day_id", body.day_id)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });

  let logId = existing?.id || "";
  let startedAt = existing?.started_at || new Date().toISOString();

  if (!existing) {
    const { data: created, error: createError } = await supabase
      .from("workout_logs")
      .insert({
        client_id: clientId,
        day_id: body.day_id,
        started_at: startedAt
      })
      .select("id,started_at")
      .single();

    if (createError || !created) {
      return NextResponse.json({ error: createError?.message || "Failed to start workout session" }, { status: 400 });
    }

    logId = created.id;
    startedAt = created.started_at;
  }

  const { data: restored, error: restoredError } = await supabase
    .from("workout_sets")
    .select("id,program_exercise_id,exercise_id,is_warmup,set_number,reps,weight,created_at")
    .eq("log_id", logId)
    .order("is_warmup", { ascending: true })
    .order("set_number", { ascending: true });

  if (restoredError) return NextResponse.json({ error: restoredError.message }, { status: 400 });

  return NextResponse.json({
    log_id: logId,
    started_at: startedAt,
    restored_sets: restored || []
  });
}
