import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeAuditLog } from "@/lib/audit-log";

type Payload = {
  name: string;
  goal_type: string;
  days_per_week: number;
  experience_level: string;
  equipment_type: string;
  days: {
    day_number: number;
    exercises: {
      exercise_id: string;
      sets: number;
      reps: number;
      warmup_sets: number[];
    }[];
  }[];
};

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: appUser, error: appUserError } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (appUserError) return NextResponse.json({ error: appUserError.message }, { status: 400 });
  if (!appUser || (appUser.role !== "coach" && appUser.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (await request.json()) as Payload;

  const { data: template, error: templateError } = await supabase
    .from("program_templates")
    .insert({
      coach_id: user.id,
      name: payload.name,
      goal_type: payload.goal_type,
      days_per_week: payload.days_per_week,
      experience_level: payload.experience_level,
      equipment_type: payload.equipment_type
    })
    .select("*")
    .single();

  if (templateError) return NextResponse.json({ error: templateError.message }, { status: 400 });

  const { data: week, error: weekError } = await supabase
    .from("program_weeks")
    .insert({
      template_id: template.id,
      week_number: 1
    })
    .select("*")
    .single();

  if (weekError) return NextResponse.json({ error: weekError.message }, { status: 400 });

  for (const day of payload.days) {
    const { data: dayRow, error: dayError } = await supabase
      .from("program_days")
      .insert({
        week_id: week.id,
        day_number: day.day_number
      })
      .select("*")
      .single();

    if (dayError) return NextResponse.json({ error: dayError.message }, { status: 400 });

    if (day.exercises.length > 0) {
      const { error: exercisesError } = await supabase.from("program_exercises").insert(
        day.exercises.map((exercise, idx) => ({
          day_id: dayRow.id,
          exercise_id: exercise.exercise_id,
          sets: exercise.sets,
          reps: exercise.reps,
          warmup_sets: exercise.warmup_sets,
          order_index: idx
        }))
      );

      if (exercisesError) return NextResponse.json({ error: exercisesError.message }, { status: 400 });
    }
  }

  await writeAuditLog({
    supabase,
    request,
    actorId: user.id,
    action: "program.template.create",
    entityType: "program_template",
    entityId: template.id,
    metadata: {
      name: payload.name,
      days_per_week: payload.days_per_week,
      experience_level: payload.experience_level,
      equipment_type: payload.equipment_type
    }
  });

  return NextResponse.json({ template });
}
