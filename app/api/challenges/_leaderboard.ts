import { computeScore, type LeaderboardConfig, type ClientMetrics, publicMemberName } from "./_scoring";
import { createClient } from "@/lib/supabase-server";

type SupabaseClient = ReturnType<typeof createClient>;

type ChallengeWindow = {
  id: string;
  starts_on: string;
  ends_on: string;
};

type Participant = {
  client_id: string;
  user_id: string;
  full_name: string | null;
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function dateDiffDays(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00Z`).getTime();
  const end = new Date(`${endIso}T00:00:00Z`).getTime();
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
}

function buildExpectedByClient(
  participants: Participant[],
  assignmentRows: Array<{ client_id: string; days_per_week: number | null; start_on: string | null }> | null,
  windowDays: number
) {
  const weeks = Math.max(1, Math.ceil(windowDays / 7));
  const result = new Map<string, number>();
  const byClient = new Map<string, { days_per_week: number | null; start_on: string | null }>();
  for (const row of assignmentRows || []) {
    if (!byClient.has(row.client_id)) byClient.set(row.client_id, row);
  }

  for (const participant of participants) {
    const assignment = byClient.get(participant.client_id);
    const daysPerWeek = Math.max(1, Number(assignment?.days_per_week || 3));
    result.set(participant.client_id, weeks * daysPerWeek);
  }

  return result;
}

function mapRatio(numerator: number, denominator: number) {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  return clamp01(numerator / denominator);
}

export async function recomputeChallengeLeaderboard(params: {
  supabase: SupabaseClient;
  challengeId: string;
}) {
  const { supabase, challengeId } = params;

  const [{ data: challenge, error: challengeError }, { data: enrollments, error: enrollmentsError }, { data: configs, error: configError }] = await Promise.all([
    supabase.from("challenges").select("id,starts_on,ends_on,status").eq("id", challengeId).single(),
    supabase
      .from("challenge_enrollments")
      .select("client_id,clients!inner(id,user_id,app_users!clients_user_id_fkey(full_name))")
      .eq("challenge_id", challengeId),
    supabase
      .from("challenge_leaderboard_configs")
      .select("ranking_slot,label,workouts_weight,checkins_weight,nutrition_weight,habits_weight,tie_breaker")
      .eq("challenge_id", challengeId)
      .order("ranking_slot", { ascending: true })
  ]);

  if (challengeError || !challenge) throw new Error(challengeError?.message || "Challenge not found");
  if (enrollmentsError) throw new Error(enrollmentsError.message);
  if (configError) throw new Error(configError.message);

  const participants: Participant[] = (enrollments || []).map((row: any) => ({
    client_id: row.client_id,
    user_id: row.clients.user_id,
    full_name: row.clients.app_users?.full_name || null
  }));

  if (!participants.length) {
    await supabase.from("challenge_leaderboard_scores").delete().eq("challenge_id", challengeId);
    return { participantCount: 0, slots: 0 };
  }

  const rankingConfigs: LeaderboardConfig[] = (configs || []).length
    ? (configs as LeaderboardConfig[])
    : [
        {
          ranking_slot: 1,
          label: "Overall Adherence",
          workouts_weight: 0.4,
          checkins_weight: 0.2,
          nutrition_weight: 0.25,
          habits_weight: 0.15,
          tie_breaker: "workouts_then_checkins"
        }
      ];

  const clientIds = participants.map((item) => item.client_id);
  const startsOn = challenge.starts_on;
  const endsOn = challenge.ends_on;

  const [
    workoutLogsRes,
    checkinsRes,
    habitsRes,
    targetsRes,
    mealsRes,
    assignmentsRes,
    existingScoresRes
  ] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("client_id,id")
      .in("client_id", clientIds)
      .gte("completed_at", `${startsOn}T00:00:00.000Z`)
      .lte("completed_at", `${endsOn}T23:59:59.999Z`),
    supabase
      .from("checkins")
      .select("client_id,id,nutrition_adherence_percent,adherence")
      .in("client_id", clientIds)
      .gte("created_at", `${startsOn}T00:00:00.000Z`)
      .lte("created_at", `${endsOn}T23:59:59.999Z`),
    supabase
      .from("habit_logs")
      .select("habit_id,completed_at,habits!inner(client_id)")
      .in("habits.client_id", clientIds)
      .gte("created_at", `${startsOn}T00:00:00.000Z`)
      .lte("created_at", `${endsOn}T23:59:59.999Z`),
    supabase.from("nutrition_targets").select("client_id,calories,protein,carbs,fat").in("client_id", clientIds),
    supabase
      .from("meal_logs")
      .select("client_id,created_at,calories,protein,carbs,fat")
      .in("client_id", clientIds)
      .gte("created_at", `${startsOn}T00:00:00.000Z`)
      .lte("created_at", `${endsOn}T23:59:59.999Z`),
    supabase
      .from("program_assignments")
      .select("client_id,start_on,program_templates!inner(days_per_week)")
      .in("client_id", clientIds)
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("challenge_leaderboard_scores")
      .select("client_id,ranking_slot,score")
      .eq("challenge_id", challengeId)
  ]);

  for (const res of [workoutLogsRes, checkinsRes, habitsRes, targetsRes, mealsRes, assignmentsRes, existingScoresRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const workoutCount = new Map<string, number>();
  for (const row of workoutLogsRes.data || []) {
    workoutCount.set(row.client_id, (workoutCount.get(row.client_id) || 0) + 1);
  }

  const checkinCount = new Map<string, number>();
  const checkinNutritionAvg = new Map<string, { total: number; count: number }>();
  for (const row of checkinsRes.data || []) {
    checkinCount.set(row.client_id, (checkinCount.get(row.client_id) || 0) + 1);
    const nutrition = Number(row.nutrition_adherence_percent ?? row.adherence ?? 0);
    const current = checkinNutritionAvg.get(row.client_id) || { total: 0, count: 0 };
    current.total += nutrition;
    current.count += 1;
    checkinNutritionAvg.set(row.client_id, current);
  }

  const completedHabits = new Map<string, number>();
  const totalHabits = new Map<string, number>();
  for (const row of habitsRes.data || []) {
    const clientId = (row as any).habits.client_id as string;
    totalHabits.set(clientId, (totalHabits.get(clientId) || 0) + 1);
    if (row.completed_at) {
      completedHabits.set(clientId, (completedHabits.get(clientId) || 0) + 1);
    }
  }

  const targetsByClient = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const target of targetsRes.data || []) {
    targetsByClient.set(target.client_id, {
      calories: Number(target.calories) || 0,
      protein: Number(target.protein) || 0,
      carbs: Number(target.carbs) || 0,
      fat: Number(target.fat) || 0
    });
  }

  const mealByClientDay = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const meal of mealsRes.data || []) {
    const day = new Date(meal.created_at).toISOString().slice(0, 10);
    const key = `${meal.client_id}:${day}`;
    const current = mealByClientDay.get(key) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    current.calories += Number(meal.calories) || 0;
    current.protein += Number(meal.protein) || 0;
    current.carbs += Number(meal.carbs) || 0;
    current.fat += Number(meal.fat) || 0;
    mealByClientDay.set(key, current);
  }

  const assignments = (assignmentsRes.data || []).map((row: any) => ({
    client_id: row.client_id,
    start_on: row.start_on,
    days_per_week: row.program_templates?.days_per_week ?? null
  }));

  const windowDays = dateDiffDays(startsOn, endsOn);
  const expectedWorkoutsByClient = buildExpectedByClient(participants, assignments, windowDays);
  const expectedCheckins = Math.max(1, Math.ceil(windowDays / 7));

  const existingByClientSlot = new Map<string, number>();
  for (const existing of existingScoresRes.data || []) {
    existingByClientSlot.set(`${existing.client_id}:${existing.ranking_slot}`, Number(existing.score) || 0);
  }

  const upsertRows: Array<Record<string, unknown>> = [];

  for (const config of rankingConfigs) {
    const scoredRows: Array<{
      challenge_id: string;
      client_id: string;
      ranking_slot: number;
      score: number;
      previous_score: number | null;
      workouts_component: number;
      checkins_component: number;
      nutrition_component: number;
      habits_component: number;
      updated_at: string;
      rank_position?: number;
    }> = participants.map((member) => {
      const expectedWorkouts = expectedWorkoutsByClient.get(member.client_id) || 1;
      const workoutsDone = workoutCount.get(member.client_id) || 0;
      const checkinsDone = checkinCount.get(member.client_id) || 0;
      const habitsDone = completedHabits.get(member.client_id) || 0;
      const habitsTotal = totalHabits.get(member.client_id) || 0;

      const target = targetsByClient.get(member.client_id);
      let nutritionRatio = 0;
      if (target && target.calories > 0 && target.protein > 0 && target.carbs > 0 && target.fat > 0) {
        const dayKeys = Array.from({ length: windowDays }).map((_, i) => {
          const date = new Date(`${startsOn}T00:00:00Z`);
          date.setUTCDate(date.getUTCDate() + i);
          return date.toISOString().slice(0, 10);
        });

        const hits = dayKeys.reduce((sum, day) => {
          const meal = mealByClientDay.get(`${member.client_id}:${day}`);
          if (!meal) return sum;
          const caloriesRatio = meal.calories / target.calories;
          const proteinRatio = meal.protein / target.protein;
          const carbsRatio = meal.carbs / target.carbs;
          const fatRatio = meal.fat / target.fat;
          const hit =
            caloriesRatio >= 0.9 && caloriesRatio <= 1.1 &&
            proteinRatio >= 0.9 && proteinRatio <= 1.1 &&
            carbsRatio >= 0.85 && carbsRatio <= 1.15 &&
            fatRatio >= 0.85 && fatRatio <= 1.15;
          return hit ? sum + 1 : sum;
        }, 0);
        nutritionRatio = mapRatio(hits, dayKeys.length);
      } else {
        const nutritionFromCheckins = checkinNutritionAvg.get(member.client_id);
        nutritionRatio = nutritionFromCheckins && nutritionFromCheckins.count > 0
          ? clamp01((nutritionFromCheckins.total / nutritionFromCheckins.count) / 100)
          : 0;
      }

      const metrics: ClientMetrics = {
        clientId: member.client_id,
        workoutsRatio: mapRatio(workoutsDone, expectedWorkouts),
        checkinsRatio: mapRatio(checkinsDone, expectedCheckins),
        nutritionRatio,
        habitsRatio: habitsTotal > 0 ? mapRatio(habitsDone, habitsTotal) : 0
      };

      const score = computeScore(metrics, config);
      return {
        challenge_id: challengeId,
        client_id: member.client_id,
        ranking_slot: config.ranking_slot,
        score: score.score,
        previous_score: existingByClientSlot.get(`${member.client_id}:${config.ranking_slot}`) ?? null,
        workouts_component: score.workoutsComponent,
        checkins_component: score.checkinsComponent,
        nutrition_component: score.nutritionComponent,
        habits_component: score.habitsComponent,
        updated_at: new Date().toISOString()
      };
    });

    scoredRows.sort((a, b) => Number(b.score) - Number(a.score));
    scoredRows.forEach((row, idx) => {
      row.rank_position = idx + 1;
      upsertRows.push(row);
    });
  }

  if (upsertRows.length) {
    const { error: upsertError } = await supabase
      .from("challenge_leaderboard_scores")
      .upsert(upsertRows, { onConflict: "challenge_id,client_id,ranking_slot" });
    if (upsertError) throw new Error(upsertError.message);
  }

  return { participantCount: participants.length, slots: rankingConfigs.length };
}

export async function getLeaderboardPage(params: {
  supabase: SupabaseClient;
  challengeId: string;
  slot: number;
  cursor?: number | null;
  limit: number;
}) {
  const { supabase, challengeId, slot, cursor = null, limit } = params;
  const offset = Math.max(0, Number(cursor || 0));

  const { data, error } = await supabase
    .from("challenge_leaderboard_scores")
    .select("challenge_id,client_id,ranking_slot,score,previous_score,rank_position,updated_at,clients!inner(user_id,app_users!clients_user_id_fkey(full_name))")
    .eq("challenge_id", challengeId)
    .eq("ranking_slot", slot)
    .order("rank_position", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);

  const rows = (data || []).map((row: any) => {
    const fullName = row.clients?.app_users?.full_name as string | null;
    const userId = row.clients?.user_id as string;
    const publicName = publicMemberName({ fullName, userId });
    return {
      rank: row.rank_position,
      client_id: row.client_id,
      member_name: publicName,
      score: Number(row.score) || 0,
      previous_score: row.previous_score === null ? null : Number(row.previous_score),
      delta: row.previous_score === null ? null : Math.round(((Number(row.score) || 0) - Number(row.previous_score || 0)) * 100) / 100,
      updated_at: row.updated_at
    };
  });

  const nextCursor = rows.length < limit ? null : offset + rows.length;
  return { items: rows, nextCursor };
}
