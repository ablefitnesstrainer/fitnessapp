import { notFound } from "next/navigation";
import { ClientProfileEditor } from "@/components/clients/client-profile-editor";
import { ClientProgressPanel } from "@/components/clients/client-progress-panel";
import { createClient } from "@/lib/supabase-server";
import { displayNameFromIdentity } from "@/lib/display-name";
import { getCurrentAppUser } from "@/services/auth-service";

const isMissingRelation = (code?: string) => code === "42P01" || code === "PGRST205";

export default async function ClientEditPage({ params }: { params: { clientId: string } }) {
  const supabase = createClient();
  const currentUser = await getCurrentAppUser();

  if (currentUser.role !== "admin" && currentUser.role !== "coach") {
    return <p className="text-sm text-red-600">Only coach/admin accounts can edit clients.</p>;
  }

  const clientQuery =
    currentUser.role === "coach"
      ? supabase.from("clients").select("id,user_id,coach_id,age,height,goal,equipment").eq("id", params.clientId).eq("coach_id", currentUser.id).maybeSingle()
      : supabase.from("clients").select("id,user_id,coach_id,age,height,goal,equipment").eq("id", params.clientId).maybeSingle();

  const { data: client, error: clientError } = await clientQuery;

  if (clientError) throw clientError;
  if (!client) notFound();

  const [{ data: userRow }, { data: weightRow }, intakeResponse, { data: targetRow }] = await Promise.all([
    supabase.from("app_users").select("id,email,full_name").eq("id", client.user_id).maybeSingle(),
    supabase.from("bodyweight_logs").select("weight").eq("client_id", client.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("client_intakes").select("*").eq("client_id", client.id).maybeSingle(),
    supabase.from("nutrition_targets").select("calories,protein,carbs,fat").eq("client_id", client.id).maybeSingle()
  ]);

  if (intakeResponse.error && !isMissingRelation(intakeResponse.error.code)) throw intakeResponse.error;

  const intake = intakeResponse.data;

  const clientName = displayNameFromIdentity({
    fullName: userRow?.full_name,
    email: userRow?.email,
    fallbackId: client.user_id
  });

  return (
    <section className="space-y-4">
      <ClientProfileEditor
        clientId={client.id}
        clientName={clientName}
        initial={{
          age: client.age ?? null,
          height: client.height ?? null,
          goal: client.goal ?? "",
          equipment: client.equipment ?? "",
          currentWeight: weightRow?.weight ? Number(weightRow.weight) : null,
          sexAtBirth: intake?.sex_at_birth === "female" ? "female" : "male",
          primaryGoal: intake?.primary_goal ?? "",
          trainingExperience: intake?.training_experience ?? "",
          injuriesOrLimitations: intake?.injuries_or_limitations ?? "",
          equipmentAccess: intake?.equipment_access ?? "",
          daysPerWeek: intake?.days_per_week ?? null,
          sessionLengthMinutes: intake?.session_length_minutes ?? null,
          nutritionPreferences: intake?.nutrition_preferences ?? "",
          dietaryRestrictions: intake?.dietary_restrictions ?? "",
          stressLevel: intake?.stress_level ?? null,
          sleepHours: intake?.sleep_hours ?? null,
          readinessToChange: intake?.readiness_to_change ?? null,
          supportNotes: intake?.support_notes ?? "",
          calories: targetRow?.calories ?? null,
          protein: targetRow?.protein ?? null,
          carbs: targetRow?.carbs ?? null,
          fat: targetRow?.fat ?? null
        }}
      />
      <ClientProgressPanel clientId={client.id} />
    </section>
  );
}
