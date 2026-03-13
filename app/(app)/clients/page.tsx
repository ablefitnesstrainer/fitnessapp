import { RosterTable } from "@/components/clients/roster-table";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
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
    idsForLookup.length
      ? supabase.from("app_users").select("id,email,full_name,role,profile_photo_path").in("id", idsForLookup)
      : Promise.resolve({ data: [], error: null }),
    (clients || []).length
      ? supabase
          .from("program_assignments")
          .select("client_id,active,start_on,created_at")
          .in("client_id", (clients || []).map((client) => client.id))
          .eq("active", true)
          .order("created_at", { ascending: false })
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

  const sevenDaysAgoIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
  const [{ data: nutritionTargets, error: nutritionTargetsError }, { data: recentMeals, error: recentMealsError }, { data: contracts, error: contractsError }] = await Promise.all([
    (clients || []).length
      ? supabase.from("nutrition_targets").select("client_id,calories,protein,carbs,fat").in("client_id", (clients || []).map((client) => client.id))
      : Promise.resolve({ data: [], error: null }),
    (clients || []).length
      ? supabase.from("meal_logs").select("client_id,created_at,calories,protein,carbs,fat").in("client_id", (clients || []).map((client) => client.id)).gte("created_at", sevenDaysAgoIso)
      : Promise.resolve({ data: [], error: null }),
    (clients || []).length
      ? supabase
          .from("client_contracts")
          .select("id,client_id,document_id,document_slug,status,sent_at,opened_at,completed_at,created_at")
          .in("client_id", (clients || []).map((client) => client.id))
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ]);

  if (nutritionTargetsError) throw nutritionTargetsError;
  if (recentMealsError) throw recentMealsError;
  if (contractsError) throw contractsError;

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
  const photoPaths = Array.from(new Set((users || []).map((u) => u.profile_photo_path).filter((p): p is string => Boolean(p))));
  const profilePhotoByUserId = new Map<string, string | null>();
  if (photoPaths.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: signedRows } = await admin.storage.from("profile-photos").createSignedUrls(photoPaths, 60 * 60);
      const signedByPath = new Map((signedRows || []).map((row) => [row.path, row.signedUrl]));
      for (const user of users || []) {
        if (user.profile_photo_path) {
          profilePhotoByUserId.set(user.id, signedByPath.get(user.profile_photo_path) || null);
        }
      }
    } catch {
      for (const user of users || []) {
        profilePhotoByUserId.set(user.id, null);
      }
    }
  }
  const assignedClientIds = new Set((assignments || []).map((assignment) => assignment.client_id));
  const assignmentStartByClientId = new Map<string, string | null>();
  for (const assignment of assignments || []) {
    if (!assignmentStartByClientId.has(assignment.client_id)) {
      assignmentStartByClientId.set(assignment.client_id, assignment.start_on || null);
    }
  }
  const intakeByClientId = new Map((intakes || []).map((intake) => [intake.client_id, intake]));
  const latestContractByClientId = new Map<string, {
    id: string;
    documentId: number;
    documentSlug: string | null;
    status: string;
    sentAt: string | null;
    openedAt: string | null;
    completedAt: string | null;
    createdAt: string;
  }>();
  const latestWeightByClientId = new Map<string, number>();
  const checkinsByClientId = new Map<string, { created_at: string; adherence: number | null; nutrition_adherence_percent: number | null }[]>();
  const targetByClientId = new Map(
    (nutritionTargets || []).map((target) => [
      target.client_id,
      { calories: Number(target.calories), protein: Number(target.protein), carbs: Number(target.carbs), fat: Number(target.fat) }
    ])
  );
  const mealsByClientAndDay = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const entry of bodyweights || []) {
    if (!latestWeightByClientId.has(entry.client_id)) {
      latestWeightByClientId.set(entry.client_id, Number(entry.weight));
    }
  }
  for (const meal of recentMeals || []) {
    const day = new Date(meal.created_at).toISOString().slice(0, 10);
    const key = `${meal.client_id}:${day}`;
    const current = mealsByClientAndDay.get(key) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    current.calories += Number(meal.calories) || 0;
    current.protein += Number(meal.protein) || 0;
    current.carbs += Number(meal.carbs) || 0;
    current.fat += Number(meal.fat) || 0;
    mealsByClientAndDay.set(key, current);
  }
  for (const entry of checkins || []) {
    const list = checkinsByClientId.get(entry.client_id) || [];
    list.push(entry);
    checkinsByClientId.set(entry.client_id, list);
  }
  for (const contract of contracts || []) {
    if (!latestContractByClientId.has(contract.client_id)) {
      latestContractByClientId.set(contract.client_id, {
        id: contract.id,
        documentId: contract.document_id,
        documentSlug: contract.document_slug,
        status: contract.status,
        sentAt: contract.sent_at,
        openedAt: contract.opened_at,
        completedAt: contract.completed_at,
        createdAt: contract.created_at
      });
    }
  }

  const dayKeys = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

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
    const target = targetByClientId.get(client.id) || null;
    const sevenDayHitPercent =
      target && target.calories > 0 && target.protein > 0 && target.carbs > 0 && target.fat > 0
        ? Math.round(
            (dayKeys.reduce((hits, day) => {
              const dayTotals = mealsByClientAndDay.get(`${client.id}:${day}`);
              if (!dayTotals) return hits;

              const caloriesRatio = dayTotals.calories / target.calories;
              const proteinRatio = dayTotals.protein / target.protein;
              const carbsRatio = dayTotals.carbs / target.carbs;
              const fatRatio = dayTotals.fat / target.fat;

              const hit =
                caloriesRatio >= 0.9 &&
                caloriesRatio <= 1.1 &&
                proteinRatio >= 0.9 &&
                proteinRatio <= 1.1 &&
                carbsRatio >= 0.85 &&
                carbsRatio <= 1.15 &&
                fatRatio >= 0.85 &&
                fatRatio <= 1.15;

              return hit ? hits + 1 : hits;
            }, 0) /
              7) *
              100
          )
        : null;

    return {
      id: client.id,
      clientUserId: client.user_id,
      clientName: displayNameFromIdentity({ fullName: clientUser?.full_name, email: clientUser?.email, fallbackId: client.user_id }),
      clientPhotoUrl: profilePhotoByUserId.get(client.user_id) || null,
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
      sevenDayHitPercent,
      hasActiveProgram: assignedClientIds.has(client.id),
      programStartOn: assignmentStartByClientId.get(client.id) || null,
      createdAt: new Date(client.created_at).toLocaleDateString(),
      contract: latestContractByClientId.get(client.id) || null,
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
  const contractsSentCount = rows.filter((row) => Boolean(row.contract)).length;
  const contractsCompletedCount = rows.filter((row) => row.contract?.status === "completed").length;

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
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contracts Sent</p>
          <p className="mt-1 text-3xl font-bold">{contractsSentCount}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contracts Completed</p>
          <p className="mt-1 text-3xl font-bold">{contractsCompletedCount}</p>
        </div>
      </div>

      <RosterTable rows={rows} coaches={coachOptions} templates={templateOptions} isAdmin={currentUser.role === "admin"} />
    </section>
  );
}
