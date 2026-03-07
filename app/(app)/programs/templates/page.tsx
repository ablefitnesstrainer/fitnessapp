import { TemplateBuilder } from "@/components/programs/template-builder";
import { listExercises } from "@/services/exercise-service";

export default async function ProgramTemplatesPage() {
  const exercises = await listExercises();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Program Template Builder</h1>
      <TemplateBuilder exercises={exercises} />
    </section>
  );
}
