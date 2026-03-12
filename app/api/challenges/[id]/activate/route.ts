import { NextResponse } from "next/server";
import { authorizeChallengeAccess } from "../../_auth";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeChallengeAccess({ requireCoachOrAdmin: true });
  if ("error" in auth) return auth.error;
  const { supabase, role, userId } = auth.context;

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id,created_by,status")
    .eq("id", params.id)
    .maybeSingle();
  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 400 });
  if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  if (role === "coach" && challenge.created_by !== userId) {
    return NextResponse.json({ error: "Coach can only activate own challenges" }, { status: 403 });
  }

  const { error: updateError } = await supabase.from("challenges").update({ status: "active" }).eq("id", params.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  await writeAuditLog({
    supabase,
    request,
    actorId: userId,
    action: "challenge.activate",
    entityType: "challenge",
    entityId: params.id,
    metadata: { previous_status: challenge.status }
  });

  return NextResponse.json({ ok: true });
}
