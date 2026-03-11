import { WorkoutLogger } from "@/components/workouts/workout-logger";
import { WorkoutHistoryCalendar } from "@/components/workouts/workout-history-calendar";
import { createClient } from "@/lib/supabase-server";
import { getCurrentAppUser, getCurrentClientProfile } from "@/services/auth-service";
import { ensureSelfClientProfile } from "@/lib/self-client";

export default async function WorkoutsPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  const client =
    appUser.role === "client"
      ? await getCurrentClientProfile()
      : await (async () => {
          const selfClientId = await ensureSelfClientProfile({
            supabase,
            userId: appUser.id
          });
          const { data } = await supabase.from("clients").select("*").eq("id", selfClientId).maybeSingle();
          return data;
        })();
  if (!client) {
    return <p className="text-sm text-red-600">Client profile not found.</p>;
  }

  const { data: assignment } = await supabase
    .from("program_assignments")
    .select("template_id,start_week,current_week_number,current_day_number,start_on")
    .eq("client_id", client.id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!assignment) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Workouts</h1>
        <p className="text-slate-700">No active program assigned yet.</p>
      </section>
    );
  }

  const { data: weeks } = await supabase
    .from("program_weeks")
    .select("id,week_number")
    .eq("template_id", assignment.template_id)
    .order("week_number", { ascending: true });

  const currentWeekNumber = assignment.current_week_number ?? assignment.start_week ?? 1;
  const week = (weeks || []).find((entry) => entry.week_number === currentWeekNumber) || (weeks || [])[0];

  if (!week) {
    return <p className="text-sm text-red-600">Assigned template has no week data.</p>;
  }

  const { data: days } = await supabase.from("program_days").select("id,day_number").eq("week_id", week.id).order("day_number");
  const currentDayNumber = assignment.current_day_number ?? 1;
  const day = (days || []).find((entry) => entry.day_number === currentDayNumber) || (days || [])[0];

  if (!day) {
    return <p className="text-sm text-red-600">No training days found in assigned week.</p>;
  }

  const { data: dayExercises } = await supabase
    .from("program_exercises")
    .select("id,exercise_id,sets,reps,warmup_sets,exercises(name,primary_muscle,equipment,video_url)")
    .eq("day_id", day.id)
    .order("order_index");

  const { data: options } = await supabase.from("exercises").select("id,name,primary_muscle,equipment").order("name");

  const weekIds = (weeks || []).map((entry) => entry.id);
  const { data: allProgramDays } = weekIds.length
    ? await supabase.from("program_days").select("id,week_id,day_number").in("week_id", weekIds).order("day_number", { ascending: true })
    : { data: [] as Array<{ id: string; week_id: string; day_number: number }> };

  const { data: workoutHistoryRows } = await supabase
    .from("workout_logs")
    .select("id,day_id,completed_at,total_volume,duration_minutes")
    .eq("client_id", client.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(30);

  const weekNumberById = new Map((weeks || []).map((entry) => [entry.id, entry.week_number]));
  const dayMetaById = new Map(
    (allProgramDays || []).map((entry) => [
      entry.id,
      {
        week_number: weekNumberById.get(entry.week_id) ?? null,
        day_number: entry.day_number
      }
    ])
  );

  const workoutHistory = (workoutHistoryRows || []).map((entry) => {
    const meta = dayMetaById.get(entry.day_id);
    return {
      id: entry.id,
      completed_at: entry.completed_at,
      total_volume: entry.total_volume,
      duration_minutes: entry.duration_minutes,
      week_number: meta?.week_number ?? null,
      day_number: meta?.day_number ?? null
    };
  });

  const sortedProgramDays = (allProgramDays || [])
    .map((entry) => ({
      week_number: weekNumberById.get(entry.week_id) ?? 0,
      day_number: entry.day_number
    }))
    .filter((entry) => entry.week_number > 0)
    .sort((a, b) => (a.week_number === b.week_number ? a.day_number - b.day_number : a.week_number - b.week_number));

  const upcomingDays = sortedProgramDays
    .filter(
      (entry) =>
        entry.week_number > week.week_number || (entry.week_number === week.week_number && entry.day_number >= day.day_number)
    )
    .slice(0, 8)
    .map((entry) => ({
      ...entry,
      is_current: entry.week_number === week.week_number && entry.day_number === day.day_number
    }));

  const normalizedExercises = (dayExercises || []).map((entry) => ({
    program_exercise_id: entry.id,
    exercise_id: entry.exercise_id,
    sets: entry.sets,
    reps: entry.reps,
    warmup_sets: Array.isArray(entry.warmup_sets) ? (entry.warmup_sets as number[]) : [],
    name: Array.isArray(entry.exercises) ? entry.exercises[0]?.name || "Exercise" : (entry.exercises as { name?: string })?.name || "Exercise",
    primary_muscle: Array.isArray(entry.exercises)
      ? entry.exercises[0]?.primary_muscle || null
      : (entry.exercises as { primary_muscle?: string | null })?.primary_muscle || null,
    equipment: Array.isArray(entry.exercises)
      ? entry.exercises[0]?.equipment || null
      : (entry.exercises as { equipment?: string | null })?.equipment || null,
    video_url: Array.isArray(entry.exercises)
      ? entry.exercises[0]?.video_url || null
      : (entry.exercises as { video_url?: string | null })?.video_url || null
  }));

  const todayIso = new Date().toISOString().slice(0, 10);
  const assignmentStartOn = assignment.start_on || todayIso;
  const startsInFuture = assignmentStartOn > todayIso;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{appUser.role === "client" ? "Workout Logging" : "My Workout Logging"}</h1>
      {startsInFuture && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Program start date is scheduled for {new Date(`${assignmentStartOn}T00:00:00`).toLocaleDateString()}.
        </div>
      )}
      <WorkoutHistoryCalendar history={workoutHistory} upcoming={upcomingDays} />
      {!startsInFuture ? (
        <WorkoutLogger
          clientId={client.id}
          dayId={day.id}
          weekNumber={week.week_number}
          dayNumber={day.day_number}
          dayLabel={`Day ${day.day_number}`}
          exercises={normalizedExercises}
          exerciseOptions={options || []}
        />
      ) : null}
    </section>
  );
}
