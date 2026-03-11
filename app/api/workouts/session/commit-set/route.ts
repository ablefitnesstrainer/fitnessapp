import { NextResponse } from "next/server";
import { authorizeByLogId } from "../_access";

type CommitSetPayload = {
  log_id: string;
  program_exercise_id: string;
  exercise_id: string;
  is_warmup: boolean;
  set_number: number;
  reps: number;
  weight: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CommitSetPayload;
  if (!body.log_id || !body.program_exercise_id || !body.exercise_id || !Number.isFinite(body.set_number) || !Number.isFinite(body.reps) || !Number.isFinite(body.weight)) {
    return NextResponse.json({ error: "log_id, program_exercise_id, exercise_id, set_number, reps, and weight are required" }, { status: 400 });
  }

  const auth = await authorizeByLogId(body.log_id);
  if ("error" in auth) return auth.error;
  const { supabase } = auth.context;

  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("workout_sets").upsert(
    {
      log_id: body.log_id,
      program_exercise_id: body.program_exercise_id,
      exercise_id: body.exercise_id,
      is_warmup: Boolean(body.is_warmup),
      set_number: Math.max(1, Math.floor(body.set_number)),
      reps: Math.max(0, Math.floor(body.reps)),
      weight: Math.max(0, Number(body.weight))
    },
    {
      onConflict: "log_id,program_exercise_id,is_warmup,set_number"
    }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ saved_at: nowIso });
}
