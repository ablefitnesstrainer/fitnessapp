import { ProgramEditor } from "@/components/programs/program-editor";
import { createClient } from "@/lib/supabase-server";
import { getCurrentAppUser } from "@/services/auth-service";
import { listExercises } from "@/services/exercise-service";

export default async function ProgramEditorPage() {
  const appUser = await getCurrentAppUser();
  if (appUser.role === "client") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Program Editor</h1>
        <p className="text-sm text-red-600">Only coach/admin accounts can edit generated programs.</p>
      </section>
    );
  }

  const supabase = createClient();
  let templatesQuery = supabase.from("program_templates").select("id,name,coach_id").order("created_at", { ascending: false });
  if (appUser.role === "coach") templatesQuery = templatesQuery.eq("coach_id", appUser.id);
  const { data: templates, error } = await templatesQuery;

  if (error) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Program Editor</h1>
        <p className="text-sm text-red-600">{error.message}</p>
      </section>
    );
  }

  const exercises = await listExercises();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Generated Program Editor</h1>
      <ProgramEditor templates={(templates || []).map((row) => ({ id: row.id, name: row.name }))} exercises={exercises} />
    </section>
  );
}
