import { NextResponse } from "next/server";
import { authorizeChallengeAccess } from "../../../_auth";
import { recomputeChallengeLeaderboard } from "../../../_leaderboard";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeChallengeAccess({ requireCoachOrAdmin: true });
  if ("error" in auth) return auth.error;
  const { supabase, role, userId } = auth.context;

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id,created_by")
    .eq("id", params.id)
    .maybeSingle();
  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 400 });
  if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  if (role === "coach" && challenge.created_by !== userId) {
    return NextResponse.json({ error: "Coach can only recompute own challenges" }, { status: 403 });
  }

  try {
    const result = await recomputeChallengeLeaderboard({ supabase, challengeId: params.id });

    await writeAuditLog({
      supabase,
      request,
      actorId: userId,
      action: "challenge.leaderboard_recompute",
      entityType: "challenge",
      entityId: params.id,
      metadata: result
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Leaderboard recompute failed" }, { status: 400 });
  }
}
