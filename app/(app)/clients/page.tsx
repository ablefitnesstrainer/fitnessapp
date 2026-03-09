import { RosterTable } from "@/components/clients/roster-table";
import { createClient } from "@/lib/supabase-server";
import { displayNameFromIdentity } from "@/lib/display-name";
import { getCurrentAppUser } from "@/services/auth-service";

export default async function ClientsPage() {
  const supabase = createClient();
  const currentUser = await getCurrentAppUser();

  if (currentUser.role !== "admin" && currentUser.role !== "coach") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Client Roster</h1>
        <p className="text-sm text-red-600">Only coach/admin accounts can view the roster.</p>
      </section>
    );
  }

  const clientsQuery =
    currentUser.role === "coach"
      ? supabase.from("clients").select("id,user_id,coach_id,age,height,goal,equipment,created_at").eq("coach_id", currentUser.id)
      : supabase.from("clients").select("id,user_id,coach_id,age,height,goal,equipment,created_at");

  const { data: clients, error: clientsError } = await clientsQuery.order("created_at", { ascending: false });

  if (clientsError) {
    throw clientsError;
  }

  const idsForLookup = Array.from(new Set((clients || []).flatMap((client) => [client.user_id, client.coach_id]).filter(Boolean)));

  const coachesQuery =
    currentUser.role === "admin"
      ? supabase.from("app_users").select("id,email,full_name,role").in("role", ["coach", "admin"])
      : supabase.from("app_users").select("id,email,full_name,role").eq("id", currentUser.id);

  const templatesQuery =
    currentUser.role === "admin"
      ? supabase.from("program_templates").select("id,name").order("name")
      : supabase.from("program_templates").select("id,name").eq("coach_id", currentUser.id).order("name");

  const [{ data: users, error: usersError }, { data: assignments, error: assignmentsError }, { data: coaches, error: coachesError }, { data: templates, error: templatesError }, { data: bodyweights, error: bodyweightsError }, { data: checkins, error: checkinsError }] = await Promise.all([
    idsForLookup.length ? supabase.from("app_users").select("id,email,full_name,role").in("id", idsForLookup) : Promise.resolve({ data: [], error: null }),
    (clients || []).length
      ? supabase.from("program_assignments").select("client_id,active").in("client_id", (clients || []).map((client) => client.id)).eq("active", true)
      : Promise.resolve({ data: [], error: null }),
    coachesQuery,
    templatesQuery,
    (clients || []).length
      ? supabase.from("bodyweight_logs").select("client_id,weight,created_at").in("client_id", (clients || []).map((client) => client.id)).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    (clients || []).length
      ? supabase
          .from("checkins")
          .select("client_id,created_at,adherence,nutrition_adherence_percent")
          .in("client_id", (clients || []).map((client) => client.id))
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ]);

  if (usersError) throw usersError;
  if (assignmentsError) throw assignmentsError;
  if (coachesError) throw coachesError;
  if (templatesError) throw templatesError;
  if (bodyweightsError) throw bodyweightsError;
  if (checkinsError) throw checkinsError;

  const { data: intakes, error: intakesError } =
    (clients || []).length > 0
      ? await supabase
          .from("client_intakes")
          .select(
            "client_id,primary_goal,training_experience,injuries_or_limitations,equipment_access,days_per_week,session_length_minutes,nutrition_preferences,dietary_restrictions,stress_level,sleep_hours,readiness_to_change,support_notes,updated_at"
          )
          .in("client_id", (clients || []).map((client) => client.id))
      : { data: [], error: null };

  if (intakesError && intakesError.code !== "42P01" && intakesError.code !== "PGRST205" && intakesError.code !== "PGRST204") throw intakesError;

  const userMap = new Map((users || []).map((user) => [user.id, user]));
  const assignedClientIds = new Set((assignments || []).map((assignment) => assignment.client_id));
  const intakeByClientId = new Map((intakes || []).map((intake) => [intake.client_id, intake]));
  const latestWeightByClientId = new Map<string, number>();
  const checkinsByClientId = new Map<string, { created_at: string; adherence: number | null; nutrition_adherence_percent: number | null }[]>();
  for (const entry of bodyweights || []) {
    if (!latestWeightByClientId.has(entry.client_id)) {
      latestWeightByClientId.set(entry.client_id, Number(entry.weight));
    }
  }
  for (const entry of checkins || []) {
    const list = checkinsByClientId.get(entry.client_id) || [];
    list.push(entry);
    checkinsByClientId.set(entry.client_id, list);
  }

  const rows = (clients || [])
    .filter((client) => {
      const clientUser = userMap.get(client.user_id);
      return clientUser?.role === "client";
    })
    .map((client) => {
    const clientUser = userMap.get(client.user_id);
    const coachUser = client.coach_id ? userMap.get(client.coach_id) : null;
    const intake = intakeByClientId.get(client.id);
    const clientCheckins = checkinsByClientId.get(client.id) || [];
    const latestCheckin = clientCheckins[0];
    const latestAdherence = latestCheckin
      ? (latestCheckin.nutrition_adherence_percent ?? latestCheckin.adherence ?? null)
      : null;
    const previousAdherence =
      clientCheckins.length > 1
        ? (clientCheckins[1].nutrition_adherence_percent ?? clientCheckins[1].adherence ?? null)
        : null;
    const adherenceTrend: "up" | "down" | "flat" | "na" =
      latestAdherence === null || previousAdherence === null
        ? "na"
        : latestAdherence > previousAdherence
          ? "up"
          : latestAdherence < previousAdherence
            ? "down"
            : "flat";

    return {
      id: client.id,
      clientUserId: client.user_id,
      clientName: displayNameFromIdentity({ fullName: clientUser?.full_name, email: clientUser?.email, fallbackId: client.user_id }),
      coachId: client.coach_id,
      coachName: coachUser ? displayNameFromIdentity({ fullName: coachUser.full_name, email: coachUser.email, fallbackId: coachUser.id }) : "Unassigned",
      goal: client.goal || "-",
      equipment: client.equipment || "-",
      age: client.age ? String(client.age) : "-",
      height: client.height ? String(client.height) : "-",
      weight: latestWeightByClientId.has(client.id) ? String(latestWeightByClientId.get(client.id)) : "-",
      lastCheckinAt: latestCheckin ? new Date(latestCheckin.created_at).toLocaleDateString() : "-",
      adherencePercent: latestAdherence,
      adherenceTrend,
      hasActiveProgram: assignedClientIds.has(client.id),
      createdAt: new Date(client.created_at).toLocaleDateString(),
      intakeSubmitted: Boolean(intake),
      intakeSummary: intake
        ? {
            primaryGoal: intake.primary_goal || "-",
            trainingExperience: intake.training_experience || "-",
            injuriesOrLimitations: intake.injuries_or_limitations || "-",
            equipmentAccess: intake.equipment_access || "-",
            daysPerWeek: intake.days_per_week ?? null,
            sessionLengthMinutes: intake.session_length_minutes ?? null,
            nutritionPreferences: intake.nutrition_preferences || "-",
            dietaryRestrictions: intake.dietary_restrictions || "-",
            stressLevel: intake.stress_level ?? null,
            sleepHours: intake.sleep_hours ?? null,
            readinessToChange: intake.readiness_to_change ?? null,
            supportNotes: intake.support_notes || "-",
            updatedAt: intake.updated_at ? new Date(intake.updated_at).toLocaleDateString() : "-"
          }
        : null
    };
  });

  const coachOptions = (coaches || []).map((coach) => ({
    id: coach.id,
    name: displayNameFromIdentity({ fullName: coach.full_name, email: coach.email, fallbackId: coach.id })
  }));

  const templateOptions = (templates || []).map((template) => ({ id: template.id, name: template.name }));

  return (
    <section className="space-y-4">
      <div className="card bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Roster</p>
        <h1 className="mt-2 text-3xl font-bold">Client Roster</h1>
        <p className="mt-2 text-sm text-blue-100">View all clients, coach assignment, profile basics, and program status in one place.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total Clients</p>
          <p className="mt-1 text-3xl font-bold">{rows.length}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Programs Assigned</p>
          <p className="mt-1 text-3xl font-bold">{rows.filter((r) => r.hasActiveProgram).length}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Unassigned Programs</p>
          <p className="mt-1 text-3xl font-bold">{rows.filter((r) => !r.hasActiveProgram).length}</p>
        </div>
      </div>

      <RosterTable rows={rows} coaches={coachOptions} templates={templateOptions} isAdmin={currentUser.role === "admin"} />
    </section>
  );
}
