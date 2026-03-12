import { NextResponse } from "next/server";
import { authorizeChallengeAccess } from "./_auth";
import { writeAuditLog } from "@/lib/audit-log";
import { enforceRateLimit } from "@/lib/security-controls";

type RankingConfigInput = {
  ranking_slot: number;
  label: string;
  workouts_weight: number;
  checkins_weight: number;
  nutrition_weight: number;
  habits_weight: number;
  tie_breaker?: string;
};

export async function GET(request: Request) {
  const auth = await authorizeChallengeAccess();
  if ("error" in auth) return auth.error;
  const { supabase, role, clientId, userId } = auth.context;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  if (role === "client") {
    const query = supabase.from("challenges").select("id,name,description,starts_on,ends_on,status,created_at").order("starts_on", { ascending: false });

    if (status) query.eq("status", status);
    const { data: challenges, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const challengeIds = (challenges || []).map((entry) => entry.id);
    const { data: enrollments, error: enrollmentError } = challengeIds.length
      ? await supabase
          .from("challenge_enrollments")
          .select("challenge_id")
          .eq("client_id", clientId as string)
          .in("challenge_id", challengeIds)
      : { data: [], error: null };
    if (enrollmentError) return NextResponse.json({ error: enrollmentError.message }, { status: 400 });

    const enrolledChallengeIds = new Set((enrollments || []).map((entry) => entry.challenge_id));

    return NextResponse.json({
      challenges: (challenges || []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        starts_on: entry.starts_on,
        ends_on: entry.ends_on,
        status: entry.status,
        created_at: entry.created_at,
        enrolled: enrolledChallengeIds.has(entry.id)
      }))
    });
  }

  const query = supabase
    .from("challenges")
    .select("id,name,description,starts_on,ends_on,status,created_by,created_at")
    .order("starts_on", { ascending: false });
  if (status) query.eq("status", status);
  if (role === "coach") query.eq("created_by", userId);

  const { data: challenges, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const challengeIds = (challenges || []).map((c) => c.id);
  const [{ data: enrollments }, { data: mappings }, { data: configs }] = await Promise.all([
    challengeIds.length
      ? supabase.from("challenge_enrollments").select("challenge_id,id").in("challenge_id", challengeIds)
      : Promise.resolve({ data: [] as Array<{ challenge_id: string; id: string }>, error: null }),
    challengeIds.length
      ? supabase
          .from("challenge_program_assignments")
          .select("challenge_id,template_id,start_on,assignment_note")
          .in("challenge_id", challengeIds)
      : Promise.resolve({ data: [] as Array<{ challenge_id: string; template_id: string; start_on: string; assignment_note: string | null }>, error: null }),
    challengeIds.length
      ? supabase
          .from("challenge_leaderboard_configs")
          .select("challenge_id,ranking_slot,label,workouts_weight,checkins_weight,nutrition_weight,habits_weight,tie_breaker")
          .in("challenge_id", challengeIds)
          .order("ranking_slot", { ascending: true })
      : Promise.resolve({
          data: [] as Array<{
            challenge_id: string;
            ranking_slot: number;
            label: string;
            workouts_weight: number;
            checkins_weight: number;
            nutrition_weight: number;
            habits_weight: number;
            tie_breaker: string;
          }>,
          error: null
        })
  ]);

  const enrollmentCountByChallenge = new Map<string, number>();
  for (const row of enrollments || []) {
    enrollmentCountByChallenge.set(row.challenge_id, (enrollmentCountByChallenge.get(row.challenge_id) || 0) + 1);
  }
  const mappingByChallenge = new Map((mappings || []).map((row) => [row.challenge_id, row]));
  const configByChallenge = new Map<string, typeof configs>();
  for (const config of configs || []) {
    const current = configByChallenge.get(config.challenge_id) || [];
    current.push(config);
    configByChallenge.set(config.challenge_id, current);
  }

  return NextResponse.json({
    challenges: (challenges || []).map((challenge) => ({
      ...challenge,
      enrollment_count: enrollmentCountByChallenge.get(challenge.id) || 0,
      program_assignment: mappingByChallenge.get(challenge.id) || null,
      ranking_configs: configByChallenge.get(challenge.id) || []
    }))
  });
}

export async function POST(request: Request) {
  const auth = await authorizeChallengeAccess({ requireCoachOrAdmin: true });
  if ("error" in auth) return auth.error;
  const { supabase, role, userId } = auth.context;

  const limited = await enforceRateLimit({
    scope: "challenges.create",
    identifier: userId,
    limit: 20,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const body = (await request.json()) as {
    name: string;
    description?: string;
    starts_on: string;
    ends_on: string;
    status?: "draft" | "active" | "closed";
    ranking_configs?: RankingConfigInput[];
    template_id?: string | null;
    start_on?: string | null;
    assignment_note?: string | null;
  };

  if (!body.name?.trim() || !body.starts_on || !body.ends_on) {
    return NextResponse.json({ error: "name, starts_on, and ends_on are required" }, { status: 400 });
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .insert({
      name: body.name.trim(),
      description: body.description?.trim() || null,
      starts_on: body.starts_on,
      ends_on: body.ends_on,
      status: body.status || "draft",
      created_by: userId
    })
    .select("*")
    .single();
  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 400 });

  if (Array.isArray(body.ranking_configs) && body.ranking_configs.length) {
    const rows = body.ranking_configs
      .filter((entry) => entry.ranking_slot >= 1 && entry.ranking_slot <= 3)
      .map((entry) => ({
        challenge_id: challenge.id,
        ranking_slot: entry.ranking_slot,
        label: entry.label?.trim() || `Ranking ${entry.ranking_slot}`,
        workouts_weight: Number(entry.workouts_weight) || 0,
        checkins_weight: Number(entry.checkins_weight) || 0,
        nutrition_weight: Number(entry.nutrition_weight) || 0,
        habits_weight: Number(entry.habits_weight) || 0,
        tie_breaker: entry.tie_breaker || "workouts_then_checkins"
      }));

    if (rows.length) {
      const { error: configError } = await supabase.from("challenge_leaderboard_configs").insert(rows);
      if (configError) return NextResponse.json({ error: configError.message }, { status: 400 });
    }
  }

  if (body.template_id) {
    const { error: mappingError } = await supabase.from("challenge_program_assignments").upsert(
      {
        challenge_id: challenge.id,
        template_id: body.template_id,
        start_on: body.start_on || body.starts_on,
        assignment_note: body.assignment_note || null,
        created_by: userId
      },
      { onConflict: "challenge_id" }
    );
    if (mappingError) return NextResponse.json({ error: mappingError.message }, { status: 400 });
  }

  await writeAuditLog({
    supabase,
    request,
    actorId: userId,
    action: "challenge.create",
    entityType: "challenge",
    entityId: challenge.id,
    metadata: { role, status: challenge.status }
  });

  return NextResponse.json({ challenge });
}
