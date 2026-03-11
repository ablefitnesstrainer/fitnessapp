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
  const payload = {
    log_id: body.log_id,
    program_exercise_id: body.program_exercise_id,
    exercise_id: body.exercise_id,
    is_warmup: Boolean(body.is_warmup),
    set_number: Math.max(1, Math.floor(body.set_number)),
    reps: Math.max(0, Math.floor(body.reps)),
    weight: Math.max(0, Number(body.weight))
  };

  const { error } = await supabase.from("workout_sets").upsert(
    payload,
    {
      onConflict: "log_id,program_exercise_id,is_warmup,set_number"
    }
  );

  if (!error) {
    return NextResponse.json({ saved_at: nowIso });
  }

  // Backward-compatible fallback if the ON CONFLICT index is missing in production.
  const missingConflictConstraint =
    error.code === "42P10" || error.message.toLowerCase().includes("no unique or exclusion constraint");

  if (!missingConflictConstraint) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: existingRow, error: findError } = await supabase
    .from("workout_sets")
    .select("id")
    .eq("log_id", payload.log_id)
    .eq("program_exercise_id", payload.program_exercise_id)
    .eq("is_warmup", payload.is_warmup)
    .eq("set_number", payload.set_number)
    .maybeSingle();

  if (findError) return NextResponse.json({ error: findError.message }, { status: 400 });

  if (existingRow?.id) {
    const { error: updateError } = await supabase
      .from("workout_sets")
      .update({
        reps: payload.reps,
        weight: payload.weight,
        exercise_id: payload.exercise_id
      })
      .eq("id", existingRow.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ saved_at: nowIso });
  }

  const { error: insertError } = await supabase.from("workout_sets").insert(payload);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  return NextResponse.json({ saved_at: nowIso });
}
