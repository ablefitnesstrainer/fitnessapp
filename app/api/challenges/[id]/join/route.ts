import { NextResponse } from "next/server";
import { authorizeChallengeAccess } from "../../_auth";
import { writeAuditLog } from "@/lib/audit-log";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeChallengeAccess();
  if ("error" in auth) return auth.error;
  const { supabase, userId, clientId } = auth.context;

  if (!clientId) {
    return NextResponse.json({ error: "Only client accounts can self-enroll." }, { status: 403 });
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id,status")
    .eq("id", params.id)
    .maybeSingle();
  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 400 });
  if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  if (challenge.status !== "active") return NextResponse.json({ error: "Only active challenges can be joined" }, { status: 400 });

  const { error } = await supabase
    .from("challenge_enrollments")
    .upsert(
      {
        challenge_id: params.id,
        client_id: clientId,
        enrolled_by: userId
      },
      { onConflict: "challenge_id,client_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    supabase,
    request,
    actorId: userId,
    action: "challenge.join",
    entityType: "challenge",
    entityId: params.id,
    metadata: { client_id: clientId }
  });

  return NextResponse.json({ ok: true });
}
