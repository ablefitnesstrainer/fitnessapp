import { createClient } from "@/lib/supabase-server";
import { displayNameFromIdentity } from "@/lib/display-name";
import { getCurrentAppUser, getCurrentClientProfile } from "@/services/auth-service";

export async function getDashboardData() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  if (appUser.role === "client") {
    const client = await getCurrentClientProfile();
    if (!client) {
      return { workoutLogs: [], mealLogs: [], checkins: [] };
    }

    const [workoutLogsRes, mealLogsRes, checkinsRes] = await Promise.all([
      supabase.from("workout_logs").select("id,completed_at,total_volume").eq("client_id", client.id).order("completed_at", { ascending: true }),
      supabase.from("meal_logs").select("id,created_at,calories,protein,carbs,fat").eq("client_id", client.id).order("created_at", { ascending: true }),
      supabase.from("checkins").select("id,created_at,energy,sleep,stress,adherence").eq("client_id", client.id).order("created_at", { ascending: true })
    ]);

    if (workoutLogsRes.error) throw workoutLogsRes.error;
    if (mealLogsRes.error) throw mealLogsRes.error;
    if (checkinsRes.error) throw checkinsRes.error;

    return {
      workoutLogs: workoutLogsRes.data,
      mealLogs: mealLogsRes.data,
      checkins: checkinsRes.data
    };
  }

  const clientsBaseQuery =
    appUser.role === "coach"
      ? supabase.from("clients").select("id,user_id,coach_id").eq("coach_id", appUser.id)
      : supabase.from("clients").select("id,user_id,coach_id");

  const [clientsRes, templatesRes, checkinsRes, rosterRes] = await Promise.all([
    supabase.from("app_users").select("id", { count: "exact", head: true }).eq("role", "client"),
    appUser.role === "coach"
      ? supabase.from("program_templates").select("id", { count: "exact", head: true }).eq("coach_id", appUser.id)
      : supabase.from("program_templates").select("id", { count: "exact", head: true }),
    supabase.from("checkins").select("id,created_at,adherence,nutrition_adherence_percent").order("created_at", { ascending: true }).limit(200),
    clientsBaseQuery
  ]);

  if (clientsRes.error) throw clientsRes.error;
  if (templatesRes.error) throw templatesRes.error;
  if (checkinsRes.error) throw checkinsRes.error;
  if (rosterRes.error) throw rosterRes.error;

  const roster = rosterRes.data || [];
  const clientIds = roster.map((c) => c.id);
  const userIds = roster.map((c) => c.user_id);

  const [usersRes, assignmentsRes, workoutLogsRes, rosterCheckinsRes] = await Promise.all([
    userIds.length ? supabase.from("app_users").select("id,email,full_name,role").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    clientIds.length ? supabase.from("program_assignments").select("client_id,active").in("client_id", clientIds).eq("active", true) : Promise.resolve({ data: [], error: null }),
    clientIds.length ? supabase.from("workout_logs").select("client_id,completed_at").in("client_id", clientIds).order("completed_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    clientIds.length
      ? supabase.from("checkins").select("client_id,created_at,adherence,nutrition_adherence_percent").in("client_id", clientIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ]);

  if (usersRes.error) throw usersRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;
  if (workoutLogsRes.error) throw workoutLogsRes.error;
  if (rosterCheckinsRes.error) throw rosterCheckinsRes.error;

  const userById = new Map((usersRes.data || []).map((u) => [u.id, u]));
  const activeAssignmentByClientId = new Set((assignmentsRes.data || []).map((a) => a.client_id));
  const latestWorkoutByClientId = new Map<string, string | null>();
  for (const log of workoutLogsRes.data || []) {
    if (!latestWorkoutByClientId.has(log.client_id)) {
      latestWorkoutByClientId.set(log.client_id, log.completed_at);
    }
  }

  const checkinsByClientId = new Map<string, { created_at: string; adherence: number | null; nutrition_adherence_percent: number | null }[]>();
  for (const entry of rosterCheckinsRes.data || []) {
    const current = checkinsByClientId.get(entry.client_id) || [];
    current.push(entry);
    checkinsByClientId.set(entry.client_id, current);
  }

  const now = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;
  const overdueCheckins = roster
    .map((client) => {
      const identity = userById.get(client.user_id);
      if (!identity || identity.role !== "client") return null;
      const latest = (checkinsByClientId.get(client.id) || [])[0];
      const daysSinceCheckin = latest ? Math.floor((now - new Date(latest.created_at).getTime()) / dayMs) : null;
      if (daysSinceCheckin === null || daysSinceCheckin >= 7) {
        return {
          clientId: client.id,
          clientUserId: client.user_id,
          clientName: displayNameFromIdentity({
            fullName: identity.full_name,
            email: identity.email,
            fallbackId: identity.id
          }),
          daysSinceCheckin: daysSinceCheckin === null ? null : daysSinceCheckin
        };
      }
      return null;
    })
    .filter(
      (item): item is { clientId: string; clientUserId: string; clientName: string; daysSinceCheckin: number | null } => Boolean(item)
    )
    .sort((a, b) => (b.daysSinceCheckin || 999) - (a.daysSinceCheckin || 999))
    .slice(0, 12);

  const priorityQueue = roster
    .map((client) => {
      const identity = userById.get(client.user_id);
      if (!identity || identity.role !== "client") return null;

      const items = checkinsByClientId.get(client.id) || [];
      const latestCheckin = items[0];
      const previousCheckin = items[1];
      const latestAdherence = latestCheckin ? latestCheckin.nutrition_adherence_percent ?? latestCheckin.adherence ?? null : null;
      const previousAdherence = previousCheckin ? previousCheckin.nutrition_adherence_percent ?? previousCheckin.adherence ?? null : null;
      const adherenceDelta = latestAdherence !== null && previousAdherence !== null ? latestAdherence - previousAdherence : null;

      const daysSinceCheckin = latestCheckin ? Math.floor((now - new Date(latestCheckin.created_at).getTime()) / dayMs) : null;
      const lastWorkoutAt = latestWorkoutByClientId.get(client.id) ?? null;
      const daysSinceWorkout = lastWorkoutAt ? Math.floor((now - new Date(lastWorkoutAt).getTime()) / dayMs) : null;
      const hasProgram = activeAssignmentByClientId.has(client.id);

      let score = 0;
      if (daysSinceCheckin === null || daysSinceCheckin >= 10) score += 4;
      else if (daysSinceCheckin >= 7) score += 2;
      if (daysSinceWorkout === null || daysSinceWorkout >= 14) score += 3;
      else if (daysSinceWorkout >= 7) score += 1;
      if (!hasProgram) score += 2;
      if (adherenceDelta !== null && adherenceDelta <= -10) score += 3;
      else if (adherenceDelta !== null && adherenceDelta <= -5) score += 2;

      const risk: "red" | "yellow" | "green" = score >= 6 ? "red" : score >= 3 ? "yellow" : "green";

      const reasons: string[] = [];
      if (daysSinceCheckin === null) reasons.push("No check-ins submitted yet");
      else if (daysSinceCheckin >= 7) reasons.push(`${daysSinceCheckin} days since last check-in`);
      if (daysSinceWorkout === null) reasons.push("No completed workouts yet");
      else if (daysSinceWorkout >= 7) reasons.push(`${daysSinceWorkout} days since last workout`);
      if (!hasProgram) reasons.push("No active program assigned");
      if (adherenceDelta !== null && adherenceDelta <= -5) reasons.push(`Adherence dropped ${Math.abs(adherenceDelta)}%`);

      return {
        clientId: client.id,
        clientUserId: client.user_id,
        clientName: displayNameFromIdentity({
          fullName: identity.full_name,
          email: identity.email,
          fallbackId: identity.id
        }),
        risk,
        score,
        lastCheckinAt: latestCheckin ? new Date(latestCheckin.created_at).toLocaleDateString() : "No check-in",
        adherencePercent: latestAdherence,
        reasons
      };
    })
    .filter(
      (
        item
      ): item is {
        clientId: string;
        clientUserId: string;
        clientName: string;
        risk: "red" | "yellow" | "green";
        score: number;
        lastCheckinAt: string;
        adherencePercent: number | null;
        reasons: string[];
      } => Boolean(item)
    )
    .sort((a, b) => (b?.score || 0) - (a?.score || 0))
    .slice(0, 12);

  return {
    counts: {
      clients: clientsRes.count ?? 0,
      templates: templatesRes.count ?? 0
    },
    checkins: checkinsRes.data,
    priorityQueue,
    overdueCheckins
  };
}
