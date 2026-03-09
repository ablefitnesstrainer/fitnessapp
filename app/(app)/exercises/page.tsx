import { ExerciseLibrary } from "@/components/exercises/exercise-library";
import { listExercises } from "@/services/exercise-service";
import { getCurrentAppUser } from "@/services/auth-service";

export default async function ExercisesPage() {
  const appUser = await getCurrentAppUser();
  const exercises = await listExercises();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Exercise Library</h1>
      <ExerciseLibrary initialExercises={exercises} canImport={appUser.role === "admin" || appUser.role === "coach"} />
    </section>
  );
}
