import { TemplateBuilder } from "@/components/programs/template-builder";
import { listExercises } from "@/services/exercise-service";
import { getCurrentAppUser } from "@/services/auth-service";

export default async function ProgramTemplatesPage() {
  const appUser = await getCurrentAppUser();
  if (appUser.role === "client") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Program Templates</h1>
        <p className="text-sm text-red-600">Only coach/admin accounts can access template builder.</p>
      </section>
    );
  }

  const exercises = await listExercises();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Program Template Builder</h1>
      <TemplateBuilder exercises={exercises} />
    </section>
  );
}
