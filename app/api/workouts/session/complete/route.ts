import { NextResponse } from "next/server";
import { authorizeByLogId } from "../_access";

type CompletePayload = {
  log_id: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CompletePayload;
  if (!body.log_id) return NextResponse.json({ error: "log_id is required" }, { status: 400 });

  const auth = await authorizeByLogId(body.log_id);
  if ("error" in auth) return auth.error;
  const { supabase, clientId } = auth.context;

  const { data: log, error: logError } = await supabase
    .from("workout_logs")
    .select("id,day_id,started_at,completed_at")
    .eq("id", body.log_id)
    .single();
  if (logError || !log) return NextResponse.json({ error: logError?.message || "Workout session not found" }, { status: 404 });

  const now = new Date();
  const startedAt = new Date(log.started_at);
  const durationMinutes = Math.max(1, Math.round((now.getTime() - startedAt.getTime()) / 60000));

  const { data: sets, error: setsError } = await supabase.from("workout_sets").select("reps,weight").eq("log_id", body.log_id);
  if (setsError) return NextResponse.json({ error: setsError.message }, { status: 400 });

  const totalVolume = (sets || []).reduce((sum, set) => sum + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0);

  if (!log.completed_at) {
    const { error: updateLogError } = await supabase
      .from("workout_logs")
      .update({
        completed_at: now.toISOString(),
        duration_minutes: durationMinutes,
        total_volume: totalVolume
      })
      .eq("id", body.log_id);

    if (updateLogError) return NextResponse.json({ error: updateLogError.message }, { status: 400 });
  }

  let nextWeekNumber: number | null = null;
  let nextDayNumber: number | null = null;

  const { data: assignment, error: assignmentError } = await supabase
    .from("program_assignments")
    .select("template_id,start_week,current_week_number,current_day_number")
    .eq("client_id", clientId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 400 });
  }

  if (assignment) {
    const { data: weeks, error: weeksError } = await supabase
      .from("program_weeks")
      .select("id,week_number")
      .eq("template_id", assignment.template_id)
      .order("week_number", { ascending: true });
    if (weeksError) return NextResponse.json({ error: weeksError.message }, { status: 400 });

    const weekList = weeks || [];
    const currentWeekNumber = assignment.current_week_number ?? assignment.start_week ?? 1;
    const currentWeekIndex = Math.max(0, weekList.findIndex((week) => week.week_number === currentWeekNumber));
    const currentWeek = weekList[currentWeekIndex] || weekList[0];

    if (currentWeek) {
      const { data: days, error: daysError } = await supabase
        .from("program_days")
        .select("id,day_number")
        .eq("week_id", currentWeek.id)
        .order("day_number", { ascending: true });
      if (daysError) return NextResponse.json({ error: daysError.message }, { status: 400 });

      const dayList = days || [];
      const currentDayNumber = assignment.current_day_number ?? 1;
      const currentDayIndex = Math.max(0, dayList.findIndex((day) => day.day_number === currentDayNumber));

      if (dayList[currentDayIndex + 1]) {
        nextWeekNumber = currentWeek.week_number;
        nextDayNumber = dayList[currentDayIndex + 1].day_number;
      } else if (weekList[currentWeekIndex + 1]) {
        const upcomingWeek = weekList[currentWeekIndex + 1];
        const { data: nextWeekDays, error: nextWeekDaysError } = await supabase
          .from("program_days")
          .select("day_number")
          .eq("week_id", upcomingWeek.id)
          .order("day_number", { ascending: true });
        if (nextWeekDaysError) return NextResponse.json({ error: nextWeekDaysError.message }, { status: 400 });
        nextWeekNumber = upcomingWeek.week_number;
        nextDayNumber = nextWeekDays?.[0]?.day_number ?? 1;
      } else {
        nextWeekNumber = currentWeek.week_number;
        nextDayNumber = dayList[currentDayIndex]?.day_number ?? 1;
      }

      const { error: updateAssignmentError } = await supabase
        .from("program_assignments")
        .update({
          current_week_number: nextWeekNumber,
          current_day_number: nextDayNumber,
          updated_at: now.toISOString()
        })
        .eq("client_id", clientId)
        .eq("template_id", assignment.template_id);

      if (updateAssignmentError) return NextResponse.json({ error: updateAssignmentError.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    duration_minutes: durationMinutes,
    total_volume: totalVolume,
    next_week_number: nextWeekNumber,
    next_day_number: nextDayNumber
  });
}
