import { NextResponse } from "next/server";
import { authorizeChallengeAccess } from "../../_auth";
import { writeAuditLog } from "@/lib/audit-log";
import { recordLegalAcceptance } from "@/lib/legal-acceptance";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeChallengeAccess();
  if ("error" in auth) return auth.error;
  const { supabase, userId, clientId } = auth.context;

  if (!clientId) {
    return NextResponse.json({ error: "Only client accounts can self-enroll." }, { status: 403 });
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id,status,starts_on,ends_on")
    .eq("id", params.id)
    .maybeSingle();
  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 400 });
  if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  const todayIso = new Date().toISOString().slice(0, 10);
  if (challenge.status === "closed") return NextResponse.json({ error: "This challenge has ended." }, { status: 400 });
  if (challenge.starts_on > todayIso) return NextResponse.json({ error: "This challenge has not started yet." }, { status: 400 });
  if (challenge.ends_on < todayIso) return NextResponse.json({ error: "This challenge has ended." }, { status: 400 });

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

  try {
    await recordLegalAcceptance({
      supabase,
      actorUserId: userId,
      appUserId: userId,
      clientId,
      documentType: "challenge_participation",
      documentVersion: "v1-2026-03-12",
      source: "challenge_join",
      metadata: { challenge_id: params.id }
    });
  } catch {
    // Do not block enrollment flow when acceptance tracking is unavailable.
  }

  return NextResponse.json({ ok: true });
}
