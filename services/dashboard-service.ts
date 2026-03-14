import { createClient } from "@/lib/supabase-server";
import { displayNameFromIdentity } from "@/lib/display-name";
import { getCurrentAppUser, getCurrentClientProfile } from "@/services/auth-service";

export async function getDashboardData() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const todayIso = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const nextMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0));
  const nextMonthStartIso = nextMonthStart.toISOString().slice(0, 10);
  const nextMonthEndIso = nextMonthEnd.toISOString().slice(0, 10);

  const [{ data: upcomingChallenge }, { data: activeChallenge }] = await Promise.all([
    supabase
      .from("challenges")
      .select("id,name,description,starts_on,ends_on,status")
      .in("status", ["draft", "active"])
      .gte("starts_on", nextMonthStartIso)
      .lte("starts_on", nextMonthEndIso)
      .order("starts_on", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("challenges")
      .select("id,name,starts_on,ends_on,status,welcome_video_url,welcome_video_title")
      .lte("starts_on", todayIso)
      .gte("ends_on", todayIso)
      .neq("status", "closed")
      .order("starts_on", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  const welcomeVideo =
    activeChallenge?.welcome_video_url
      ? {
          url: String(activeChallenge.welcome_video_url).trim(),
          title: String(activeChallenge.welcome_video_title || activeChallenge.name || "Welcome to Able Fitness").trim()
        }
      : { url: "", title: "Welcome to Able Fitness" };

  if (appUser.role === "client") {
    const client = await getCurrentClientProfile();
    if (!client) {
      return { workoutLogs: [], mealLogs: [], checkins: [], upcomingChallenge: null, welcomeVideo };
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
      checkins: checkinsRes.data,
      upcomingChallenge: null,
      welcomeVideo
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

  const unreadRes = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("receiver_id", appUser.id).is("read_at", null);
  if (unreadRes.error && unreadRes.error.code !== "42703" && unreadRes.error.code !== "PGRST204") {
    throw unreadRes.error;
  }

  const roster = rosterRes.data || [];
  const clientIds = roster.map((c) => c.id);
  const userIds = roster.map((c) => c.user_id);

  const [usersRes, assignmentsRes, workoutLogsRes, rosterCheckinsRes, contractsRes] = await Promise.all([
    userIds.length ? supabase.from("app_users").select("id,email,full_name,role").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    clientIds.length ? supabase.from("program_assignments").select("client_id,active").in("client_id", clientIds).eq("active", true) : Promise.resolve({ data: [], error: null }),
    clientIds.length ? supabase.from("workout_logs").select("client_id,completed_at").in("client_id", clientIds).order("completed_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    clientIds.length
      ? supabase.from("checkins").select("client_id,created_at,adherence,nutrition_adherence_percent").in("client_id", clientIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    clientIds.length
      ? supabase
          .from("client_contracts")
          .select("id,client_id,document_id,document_slug,status,sent_at,opened_at,completed_at,created_at")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ]);

  if (usersRes.error) throw usersRes.error;
  if (assignmentsRes.error) throw assignmentsRes.error;
  if (workoutLogsRes.error) throw workoutLogsRes.error;
  if (rosterCheckinsRes.error) throw rosterCheckinsRes.error;
  if (contractsRes.error) throw contractsRes.error;

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
  const latestContractByClientId = new Map<
    string,
    {
      id: string;
      status: string;
      documentId: number;
      documentSlug: string | null;
      sentAt: string | null;
      openedAt: string | null;
      completedAt: string | null;
      createdAt: string;
    }
  >();
  for (const entry of contractsRes.data || []) {
    if (!latestContractByClientId.has(entry.client_id)) {
      latestContractByClientId.set(entry.client_id, {
        id: entry.id,
        status: entry.status || "not_sent",
        documentId: Number(entry.document_id),
        documentSlug: entry.document_slug || null,
        sentAt: entry.sent_at || null,
        openedAt: entry.opened_at || null,
        completedAt: entry.completed_at || null,
        createdAt: entry.created_at
      });
    }
  }

  const nowMs = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;
  const overdueCheckins = roster
    .map((client) => {
      const identity = userById.get(client.user_id);
      if (!identity || identity.role !== "client") return null;
      const latest = (checkinsByClientId.get(client.id) || [])[0];
      const daysSinceCheckin = latest ? Math.floor((nowMs - new Date(latest.created_at).getTime()) / dayMs) : null;
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

      const daysSinceCheckin = latestCheckin ? Math.floor((nowMs - new Date(latestCheckin.created_at).getTime()) / dayMs) : null;
      const lastWorkoutAt = latestWorkoutByClientId.get(client.id) ?? null;
      const daysSinceWorkout = lastWorkoutAt ? Math.floor((nowMs - new Date(lastWorkoutAt).getTime()) / dayMs) : null;
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

  const totalRostersClients = roster.filter((c) => {
    const identity = userById.get(c.user_id);
    return identity?.role === "client";
  }).length;
  const contractsSent = Array.from(latestContractByClientId.values()).filter((contract) => contract.status !== "not_sent").length;
  const contractsOpened = Array.from(latestContractByClientId.values()).filter((contract) => contract.status === "opened" || contract.status === "viewed" || contract.status === "completed").length;
  const contractsCompleted = Array.from(latestContractByClientId.values()).filter((contract) => contract.status === "completed").length;
  const percent = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
  const contractQueue = roster
    .map((client) => {
      const identity = userById.get(client.user_id);
      if (!identity || identity.role !== "client") return null;
      const latest = latestContractByClientId.get(client.id) || null;
      const status = latest?.status || "not_sent";
      if (status === "completed") return null;
      return {
        clientId: client.id,
        clientUserId: client.user_id,
        clientName: displayNameFromIdentity({
          fullName: identity.full_name,
          email: identity.email,
          fallbackId: identity.id
        }),
        status,
        contractId: latest?.id || null,
        documentId: latest?.documentId || null,
        documentSlug: latest?.documentSlug || null,
        sentAt: latest?.sentAt || null,
        openedAt: latest?.openedAt || null,
        completedAt: latest?.completedAt || null
      };
    })
    .filter(
      (
        item
      ): item is {
        clientId: string;
        clientUserId: string;
        clientName: string;
        status: string;
        contractId: string | null;
        documentId: number | null;
        documentSlug: string | null;
        sentAt: string | null;
        openedAt: string | null;
        completedAt: string | null;
      } => Boolean(item)
    )
    .sort((a, b) => {
      const rank = (status: string) => {
        if (status === "not_sent") return 0;
        if (status === "sent") return 1;
        if (status === "opened" || status === "viewed") return 2;
        return 3;
      };
      const rankDiff = rank(a.status) - rank(b.status);
      if (rankDiff !== 0) return rankDiff;
      const aTs = a.sentAt ? new Date(a.sentAt).getTime() : 0;
      const bTs = b.sentAt ? new Date(b.sentAt).getTime() : 0;
      return aTs - bTs;
    })
    .slice(0, 12);
  const lowAdherenceClients = priorityQueue.filter(
    (item) => typeof item.adherencePercent === "number" && item.adherencePercent < 75
  ).length;
  const sevenDaysAgoTs = Date.now() - 1000 * 60 * 60 * 24 * 7;
  const checkinsThisWeek = (checkinsRes.data || []).filter((entry) => new Date(entry.created_at).getTime() >= sevenDaysAgoTs).length;
  const activityFeed = [
    ...(rosterCheckinsRes.data || [])
      .filter((entry) => new Date(entry.created_at).getTime() >= sevenDaysAgoTs)
      .map((entry) => {
        const client = roster.find((item) => item.id === entry.client_id);
        const identity = client ? userById.get(client.user_id) : null;
        const adherence = entry.nutrition_adherence_percent ?? entry.adherence ?? null;
        return {
          type: "checkin" as const,
          clientId: entry.client_id,
          clientUserId: client?.user_id || "",
          clientName: displayNameFromIdentity({
            fullName: identity?.full_name || null,
            email: identity?.email || null,
            fallbackId: client?.user_id || entry.client_id
          }),
          occurredAt: entry.created_at,
          detail: adherence === null ? "Check-in submitted" : `Check-in submitted (adherence ${adherence}%)`
        };
      }),
    ...(workoutLogsRes.data || [])
      .filter((entry) => entry.completed_at && new Date(entry.completed_at).getTime() >= sevenDaysAgoTs)
      .map((entry) => {
        const client = roster.find((item) => item.id === entry.client_id);
        const identity = client ? userById.get(client.user_id) : null;
        return {
          type: "workout" as const,
          clientId: entry.client_id,
          clientUserId: client?.user_id || "",
          clientName: displayNameFromIdentity({
            fullName: identity?.full_name || null,
            email: identity?.email || null,
            fallbackId: client?.user_id || entry.client_id
          }),
          occurredAt: entry.completed_at as string,
          detail: "Workout completed"
        };
      }),
    ...(contractsRes.data || [])
      .filter((entry) => entry.completed_at && new Date(entry.completed_at).getTime() >= sevenDaysAgoTs)
      .map((entry) => {
        const client = roster.find((item) => item.id === entry.client_id);
        const identity = client ? userById.get(client.user_id) : null;
        return {
          type: "contract" as const,
          clientId: entry.client_id,
          clientUserId: client?.user_id || "",
          clientName: displayNameFromIdentity({
            fullName: identity?.full_name || null,
            email: identity?.email || null,
            fallbackId: client?.user_id || entry.client_id
          }),
          occurredAt: entry.completed_at as string,
          detail: "Contract signed"
        };
      })
  ]
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 20);

  return {
    counts: {
      clients: appUser.role === "admin" ? clientsRes.count ?? 0 : totalRostersClients,
      templates: templatesRes.count ?? 0
    },
    contractFunnel: {
      sent: contractsSent,
      opened: contractsOpened,
      completed: contractsCompleted,
      sentRate: percent(contractsSent, totalRostersClients),
      openRate: percent(contractsOpened, contractsSent),
      completionRate: percent(contractsCompleted, contractsSent)
    },
    coachDigest: {
      contractsPending: contractQueue.length,
      overdueCheckins: overdueCheckins.length,
      unreadMessages: unreadRes.error ? 0 : unreadRes.count ?? 0,
      lowAdherenceClients,
      checkinsThisWeek
    },
    checkins: checkinsRes.data,
    activityFeed,
    contractQueue,
    priorityQueue,
    overdueCheckins,
    upcomingChallenge: upcomingChallenge || null,
    welcomeVideo
  };
}
