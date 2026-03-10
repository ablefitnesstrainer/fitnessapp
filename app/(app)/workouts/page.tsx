import { WorkoutLogger } from "@/components/workouts/workout-logger";
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
    .select("template_id,start_week")
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

  const { data: week } = await supabase
    .from("program_weeks")
    .select("id")
    .eq("template_id", assignment.template_id)
    .eq("week_number", assignment.start_week)
    .maybeSingle();

  if (!week) {
    return <p className="text-sm text-red-600">Assigned template has no week data.</p>;
  }

  const { data: day } = await supabase.from("program_days").select("id,day_number").eq("week_id", week.id).order("day_number").limit(1).maybeSingle();

  if (!day) {
    return <p className="text-sm text-red-600">No training days found in assigned week.</p>;
  }

  const { data: dayExercises } = await supabase
    .from("program_exercises")
    .select("id,exercise_id,sets,reps,warmup_sets,exercises(name,primary_muscle,equipment)")
    .eq("day_id", day.id)
    .order("order_index");

  const { data: options } = await supabase.from("exercises").select("id,name,primary_muscle,equipment").order("name");

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
      : (entry.exercises as { equipment?: string | null })?.equipment || null
  }));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{appUser.role === "client" ? "Workout Logging" : "My Workout Logging"}</h1>
      <WorkoutLogger clientId={client.id} dayId={day.id} exercises={normalizedExercises} exerciseOptions={options || []} />
    </section>
  );
}
