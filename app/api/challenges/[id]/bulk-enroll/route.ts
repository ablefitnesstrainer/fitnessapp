import { NextResponse } from "next/server";
import { authorizeChallengeAccess } from "../../_auth";
import { writeAuditLog } from "@/lib/audit-log";
import { enforceRateLimit } from "@/lib/security-controls";
import { recordLegalAcceptance } from "@/lib/legal-acceptance";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeChallengeAccess({ requireCoachOrAdmin: true });
  if ("error" in auth) return auth.error;
  const { supabase, role, userId } = auth.context;

  const limited = await enforceRateLimit({
    scope: "challenges.bulk_enroll",
    identifier: userId,
    limit: 20,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const body = (await request.json()) as {
    client_ids: string[];
    start_on?: string | null;
    template_id?: string | null;
    assignment_note?: string | null;
  };

  const clientIds = Array.from(new Set((body.client_ids || []).filter(Boolean)));
  if (!clientIds.length) {
    return NextResponse.json({ error: "client_ids is required" }, { status: 400 });
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id,created_by,starts_on")
    .eq("id", params.id)
    .maybeSingle();
  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 400 });
  if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  if (role === "coach" && challenge.created_by !== userId) {
    return NextResponse.json({ error: "Coach can only bulk-enroll own challenges" }, { status: 403 });
  }

  const [{ data: clients, error: clientsError }, { data: mapping, error: mappingError }] = await Promise.all([
    supabase.from("clients").select("id,coach_id").in("id", clientIds),
    supabase
      .from("challenge_program_assignments")
      .select("template_id,start_on,assignment_note")
      .eq("challenge_id", params.id)
      .maybeSingle()
  ]);

  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 400 });
  if (mappingError) return NextResponse.json({ error: mappingError.message }, { status: 400 });

  const validClients = (clients || []).filter((client) => role !== "coach" || client.coach_id === userId);
  if (!validClients.length) {
    return NextResponse.json({ error: "No eligible clients to enroll" }, { status: 400 });
  }

  const templateId = body.template_id || mapping?.template_id || null;
  const startOn =
    (body.start_on && /^\d{4}-\d{2}-\d{2}$/.test(body.start_on) ? body.start_on : null) ||
    mapping?.start_on ||
    challenge.starts_on;

  if (templateId && role === "coach") {
    const { data: template, error: templateError } = await supabase
      .from("program_templates")
      .select("id,coach_id")
      .eq("id", templateId)
      .maybeSingle();
    if (templateError) return NextResponse.json({ error: templateError.message }, { status: 400 });
    if (!template || template.coach_id !== userId) {
      return NextResponse.json({ error: "Coach can only assign own templates" }, { status: 403 });
    }
  }

  const enrollmentRows = validClients.map((client) => ({
    challenge_id: params.id,
    client_id: client.id,
    enrolled_by: userId
  }));

  const { error: enrollError } = await supabase
    .from("challenge_enrollments")
    .upsert(enrollmentRows, { onConflict: "challenge_id,client_id", ignoreDuplicates: true });
  if (enrollError) return NextResponse.json({ error: enrollError.message }, { status: 400 });

  if (templateId) {
    const assignmentRows = validClients.map((client) => ({
      client_id: client.id,
      template_id: templateId,
      start_week: 1,
      current_week_number: 1,
      current_day_number: 1,
      start_on: startOn,
      active: true
    }));

    const { error: assignmentError } = await supabase
      .from("program_assignments")
      .upsert(assignmentRows, { onConflict: "client_id,template_id" });
    if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 400 });

    const { error: mappingUpsertError } = await supabase.from("challenge_program_assignments").upsert(
      {
        challenge_id: params.id,
        template_id: templateId,
        start_on: startOn,
        assignment_note: body.assignment_note ?? mapping?.assignment_note ?? null,
        created_by: userId
      },
      { onConflict: "challenge_id" }
    );

    if (mappingUpsertError) return NextResponse.json({ error: mappingUpsertError.message }, { status: 400 });
  }

  await writeAuditLog({
    supabase,
    request,
    actorId: userId,
    action: "challenge.bulk_enroll",
    entityType: "challenge",
    entityId: params.id,
    metadata: {
      enrolled_count: validClients.length,
      template_id: templateId,
      start_on: startOn
    }
  });

  try {
    await Promise.all(
      validClients.map((client) =>
        recordLegalAcceptance({
          supabase,
          actorUserId: userId,
          clientId: client.id,
          documentType: "challenge_participation",
          documentVersion: "v1-2026-03-12",
          source: "coach_bulk_enroll",
          metadata: {
            challenge_id: params.id,
            template_id: templateId
          }
        })
      )
    );
  } catch {
    // Keep enrollment flow non-blocking if legal acceptance table is unavailable.
  }

  return NextResponse.json({
    ok: true,
    enrolled_count: validClients.length,
    template_id: templateId,
    start_on: startOn
  });
}
