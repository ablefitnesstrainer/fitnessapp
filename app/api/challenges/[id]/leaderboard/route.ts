import { NextResponse } from "next/server";
import { authorizeChallengeAccess } from "../../_auth";
import { getLeaderboardPage } from "../../_leaderboard";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeChallengeAccess();
  if ("error" in auth) return auth.error;
  const { supabase, role, clientId } = auth.context;

  const search = new URL(request.url).searchParams;
  const slot = Math.min(3, Math.max(1, Number(search.get("slot") || 1)));
  const cursor = search.get("cursor");
  const limit = Math.min(200, Math.max(10, Number(search.get("limit") || 50)));

  if (role === "client") {
    const { data: enrolled, error: enrollError } = await supabase
      .from("challenge_enrollments")
      .select("id")
      .eq("challenge_id", params.id)
      .eq("client_id", clientId as string)
      .maybeSingle();
    if (enrollError) return NextResponse.json({ error: enrollError.message }, { status: 400 });
    if (!enrolled) return NextResponse.json({ error: "Not enrolled in this challenge" }, { status: 403 });
  }

  const [{ data: challenge, error: challengeError }, { data: configs, error: configsError }] = await Promise.all([
    supabase.from("challenges").select("id,name,status,starts_on,ends_on").eq("id", params.id).maybeSingle(),
    supabase
      .from("challenge_leaderboard_configs")
      .select("ranking_slot,label,workouts_weight,checkins_weight,nutrition_weight,habits_weight,tie_breaker")
      .eq("challenge_id", params.id)
      .order("ranking_slot", { ascending: true })
  ]);

  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 400 });
  if (configsError) return NextResponse.json({ error: configsError.message }, { status: 400 });
  if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });

  try {
    const page = await getLeaderboardPage({
      supabase,
      challengeId: params.id,
      slot,
      cursor: cursor ? Number(cursor) : null,
      limit
    });

    return NextResponse.json({
      challenge,
      slot,
      configs: configs || [],
      items: page.items,
      next_cursor: page.nextCursor
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fetch leaderboard" }, { status: 400 });
  }
}
