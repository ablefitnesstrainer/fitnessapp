import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeAuditLog } from "@/lib/audit-log";
import { enforceRateLimit } from "@/lib/security-controls";
import { ensureSelfClientProfile } from "@/lib/self-client";

type GeneratePayload = {
  template_id: string;
  client_id?: string | null;
  weeks: number;
  rep_progression: number;
  set_progression_every: number;
  deload_week?: number;
};

function progression(baseSets: number, baseReps: number, week: number, repProgression: number, setProgressionEvery: number, deloadWeek?: number) {
  if (deloadWeek && week === deloadWeek) {
    return {
      sets: Math.max(1, Math.floor(baseSets * 0.6)),
      reps: Math.max(5, Math.floor(baseReps * 0.7))
    };
  }

  const reps = baseReps + (week - 1) * repProgression;
  const sets = baseSets + Math.floor((week - 1) / setProgressionEvery);

  return { sets, reps };
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: appUser } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!appUser || (appUser.role !== "coach" && appUser.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await enforceRateLimit({
    scope: "programs.generate",
    identifier: user.id,
    limit: 60,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const payload = (await request.json()) as GeneratePayload;
  let assignmentClientId = payload.client_id || null;
  if (assignmentClientId === "__self__") {
    assignmentClientId = await ensureSelfClientProfile({
      supabase,
      userId: user.id
    });
  }

  const { data: existingWeeks, error: weeksError } = await supabase
    .from("program_weeks")
    .select("id,week_number")
    .eq("template_id", payload.template_id)
    .order("week_number");

  if (weeksError || !existingWeeks?.length) {
    return NextResponse.json({ error: weeksError?.message || "Template has no base week" }, { status: 400 });
  }

  const baseWeek = existingWeeks.find((week) => week.week_number === 1);
  if (!baseWeek) {
    return NextResponse.json({ error: "Template must contain week 1" }, { status: 400 });
  }

  const { data: baseDays, error: baseDaysError } = await supabase.from("program_days").select("id,day_number").eq("week_id", baseWeek.id);
  if (baseDaysError || !baseDays?.length) {
    return NextResponse.json({ error: baseDaysError?.message || "No base days found" }, { status: 400 });
  }

  const baseDayIds = baseDays.map((d) => d.id);
  const { data: baseExercises, error: baseExercisesError } = await supabase
    .from("program_exercises")
    .select("day_id,exercise_id,sets,reps,warmup_sets,order_index")
    .in("day_id", baseDayIds)
    .order("order_index");

  if (baseExercisesError) {
    return NextResponse.json({ error: baseExercisesError.message }, { status: 400 });
  }

  const extraWeekIds = existingWeeks.filter((week) => week.week_number > 1).map((week) => week.id);
  if (extraWeekIds.length) {
    await supabase.from("program_weeks").delete().in("id", extraWeekIds);
  }

  let createdWeeks = 0;

  for (let weekNumber = 2; weekNumber <= payload.weeks; weekNumber += 1) {
    const { data: week, error: weekInsertError } = await supabase
      .from("program_weeks")
      .insert({ template_id: payload.template_id, week_number: weekNumber })
      .select("id")
      .single();

    if (weekInsertError) {
      return NextResponse.json({ error: weekInsertError.message }, { status: 400 });
    }

    for (const day of baseDays) {
      const { data: newDay, error: dayInsertError } = await supabase
        .from("program_days")
        .insert({
          week_id: week.id,
          day_number: day.day_number
        })
        .select("id")
        .single();

      if (dayInsertError) {
        return NextResponse.json({ error: dayInsertError.message }, { status: 400 });
      }

      const dayExercises = baseExercises.filter((exercise) => exercise.day_id === day.id);
      const payloadExercises = dayExercises.map((exercise) => {
        const target = progression(exercise.sets, exercise.reps, weekNumber, payload.rep_progression, payload.set_progression_every, payload.deload_week);
        return {
          day_id: newDay.id,
          exercise_id: exercise.exercise_id,
          sets: target.sets,
          reps: target.reps,
          warmup_sets: exercise.warmup_sets,
          order_index: exercise.order_index
        };
      });

      if (payloadExercises.length) {
        const { error: exerciseInsertError } = await supabase.from("program_exercises").insert(payloadExercises);
        if (exerciseInsertError) {
          return NextResponse.json({ error: exerciseInsertError.message }, { status: 400 });
        }
      }
    }

    createdWeeks += 1;
  }

  if (assignmentClientId) {
    const { error: assignmentError } = await supabase.from("program_assignments").upsert(
      {
        client_id: assignmentClientId,
        template_id: payload.template_id,
        start_week: 1,
        active: true
      },
      {
        onConflict: "client_id,template_id"
      }
    );

    if (assignmentError) {
      return NextResponse.json({ error: assignmentError.message }, { status: 400 });
    }
  }

  await writeAuditLog({
    supabase,
    request,
    actorId: user.id,
    action: "program.generate",
    entityType: "program_template",
    entityId: payload.template_id,
    metadata: {
      created_weeks: createdWeeks,
      total_weeks: payload.weeks,
      rep_progression: payload.rep_progression,
      set_progression_every: payload.set_progression_every,
      deload_week: payload.deload_week ?? null,
      assigned_client_id: assignmentClientId
    }
  });

  return NextResponse.json({ createdWeeks });
}
