import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeAuditLog } from "@/lib/audit-log";

type EditableRow = {
  exercise_id: string;
  sets: number;
  reps: number;
  warmup_sets: number[];
  block_type?: "standard" | "circuit";
  circuit_label?: string | null;
  circuit_rounds?: number | null;
};

async function requireCoachOrAdmin() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: appUser, error: appUserError } = await supabase.from("app_users").select("id,role").eq("id", user.id).single();
  if (appUserError || !appUser || (appUser.role !== "admin" && appUser.role !== "coach")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, userId: user.id, role: appUser.role as "admin" | "coach" };
}

export async function GET(request: Request) {
  const auth = await requireCoachOrAdmin();
  if ("error" in auth) return auth.error;

  const { supabase, userId, role } = auth;
  const url = new URL(request.url);
  const templateId = url.searchParams.get("template_id");

  if (!templateId) {
    return NextResponse.json({ error: "template_id is required" }, { status: 400 });
  }

  let templateQuery = supabase.from("program_templates").select("id,name,coach_id").eq("id", templateId);
  if (role !== "admin") {
    templateQuery = templateQuery.eq("coach_id", userId);
  }

  const { data: template, error: templateError } = await templateQuery.single();
  if (templateError || !template) {
    return NextResponse.json({ error: templateError?.message || "Template not found" }, { status: 404 });
  }

  const { data: weeks, error: weeksError } = await supabase
    .from("program_weeks")
    .select("id,week_number")
    .eq("template_id", template.id)
    .order("week_number");

  if (weeksError) return NextResponse.json({ error: weeksError.message }, { status: 400 });
  if (!weeks?.length) return NextResponse.json({ template, weeks: [] });

  const weekIds = weeks.map((week) => week.id);
  const { data: days, error: daysError } = await supabase
    .from("program_days")
    .select("id,week_id,day_number")
    .in("week_id", weekIds)
    .order("day_number");

  if (daysError) return NextResponse.json({ error: daysError.message }, { status: 400 });

  const dayIds = (days || []).map((day) => day.id);
  const { data: exercises, error: exercisesError } = dayIds.length
    ? await supabase
        .from("program_exercises")
        .select("id,day_id,exercise_id,sets,reps,warmup_sets,order_index,block_type,circuit_label,circuit_rounds,exercises(name,primary_muscle,equipment)")
        .in("day_id", dayIds)
        .order("order_index")
    : { data: [], error: null };

  if (exercisesError) return NextResponse.json({ error: exercisesError.message }, { status: 400 });

  const dayExerciseMap = new Map<string, typeof exercises>();
  for (const row of exercises || []) {
    const list = dayExerciseMap.get(row.day_id) || [];
    list.push(row);
    dayExerciseMap.set(row.day_id, list);
  }

  const weeksPayload = weeks.map((week) => ({
    week_number: week.week_number,
    days: (days || [])
      .filter((day) => day.week_id === week.id)
      .sort((a, b) => a.day_number - b.day_number)
      .map((day) => ({
        id: day.id,
        day_number: day.day_number,
        exercises: (dayExerciseMap.get(day.id) || []).map((exercise) => {
          const joinedExercise = Array.isArray(exercise.exercises) ? exercise.exercises[0] : exercise.exercises;
          return {
            id: exercise.id,
            exercise_id: exercise.exercise_id,
            exercise_name: joinedExercise?.name || "Unknown exercise",
            primary_muscle: joinedExercise?.primary_muscle || null,
            equipment: joinedExercise?.equipment || null,
            sets: exercise.sets,
            reps: exercise.reps,
            warmup_sets: Array.isArray(exercise.warmup_sets) ? exercise.warmup_sets : [],
            block_type: exercise.block_type || "standard",
            circuit_label: exercise.circuit_label || null,
            circuit_rounds: exercise.circuit_rounds || null,
            order_index: exercise.order_index
          };
        })
      }))
  }));

  return NextResponse.json({ template, weeks: weeksPayload });
}

export async function PATCH(request: Request) {
  const auth = await requireCoachOrAdmin();
  if ("error" in auth) return auth.error;

  const { supabase, userId, role } = auth;
  const payload = (await request.json()) as {
    template_id: string;
    week_number: number;
    day_number: number;
    exercises: EditableRow[];
  };

  if (!payload.template_id || !payload.week_number || !payload.day_number) {
    return NextResponse.json({ error: "template_id, week_number, and day_number are required" }, { status: 400 });
  }

  let templateQuery = supabase.from("program_templates").select("id,coach_id").eq("id", payload.template_id);
  if (role !== "admin") templateQuery = templateQuery.eq("coach_id", userId);
  const { data: template, error: templateError } = await templateQuery.single();

  if (templateError || !template) {
    return NextResponse.json({ error: templateError?.message || "Template not found" }, { status: 404 });
  }

  const { data: week, error: weekError } = await supabase
    .from("program_weeks")
    .select("id")
    .eq("template_id", payload.template_id)
    .eq("week_number", payload.week_number)
    .single();

  if (weekError || !week) return NextResponse.json({ error: weekError?.message || "Week not found" }, { status: 404 });

  const { data: day, error: dayError } = await supabase
    .from("program_days")
    .select("id")
    .eq("week_id", week.id)
    .eq("day_number", payload.day_number)
    .single();

  if (dayError || !day) return NextResponse.json({ error: dayError?.message || "Day not found" }, { status: 404 });

  const normalized = (payload.exercises || [])
    .filter((row) => row.exercise_id)
    .slice(0, 200)
    .map((row, index) => {
      const sets = Math.max(1, Math.floor(Number(row.sets) || 1));
      const reps = Math.max(1, Math.floor(Number(row.reps) || 1));
      const warmup = Array.isArray(row.warmup_sets)
        ? row.warmup_sets
            .map((value) => Math.max(0, Math.floor(Number(value) || 0)))
            .filter((value) => Number.isFinite(value))
        : [];
      const blockType = row.block_type === "circuit" ? "circuit" : "standard";

      return {
        day_id: day.id,
        exercise_id: row.exercise_id,
        sets,
        reps,
        warmup_sets: warmup,
        block_type: blockType,
        circuit_label: blockType === "circuit" ? (row.circuit_label?.trim() || "Circuit") : null,
        circuit_rounds: blockType === "circuit" ? Math.max(1, Math.floor(Number(row.circuit_rounds) || 3)) : null,
        order_index: index
      };
    });

  const { error: removeError } = await supabase.from("program_exercises").delete().eq("day_id", day.id);
  if (removeError) return NextResponse.json({ error: removeError.message }, { status: 400 });

  if (normalized.length) {
    const { error: insertError } = await supabase.from("program_exercises").insert(normalized);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  await writeAuditLog({
    supabase,
    request,
    actorId: userId,
    action: "program.template.day.update",
    entityType: "program_template",
    entityId: payload.template_id,
    metadata: {
      week_number: payload.week_number,
      day_number: payload.day_number,
      exercise_count: normalized.length
    }
  });

  return NextResponse.json({ ok: true, updated: normalized.length });
}
