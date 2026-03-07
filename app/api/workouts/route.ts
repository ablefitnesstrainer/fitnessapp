import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

type WorkoutSetPayload = {
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
};

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    client_id: string;
    day_id: string;
    total_volume: number;
    sets: WorkoutSetPayload[];
  };

  const startedAt = new Date();

  const { data: log, error: logError } = await supabase
    .from("workout_logs")
    .insert({
      client_id: body.client_id,
      day_id: body.day_id,
      started_at: startedAt.toISOString(),
      completed_at: new Date().toISOString(),
      total_volume: body.total_volume,
      duration_minutes: 45
    })
    .select("id,duration_minutes")
    .single();

  if (logError) return NextResponse.json({ error: logError.message }, { status: 400 });

  if (body.sets.length) {
    const { error: setsError } = await supabase.from("workout_sets").insert(
      body.sets.map((set) => ({
        log_id: log.id,
        exercise_id: set.exercise_id,
        set_number: set.set_number,
        reps: set.reps,
        weight: set.weight
      }))
    );

    if (setsError) {
      return NextResponse.json({ error: setsError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ id: log.id, duration_minutes: log.duration_minutes });
}

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    action: "swap_permanent";
    program_exercise_id: string;
    exercise_id: string;
  };

  if (body.action !== "swap_permanent") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const { error } = await supabase
    .from("program_exercises")
    .update({ exercise_id: body.exercise_id })
    .eq("id", body.program_exercise_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
