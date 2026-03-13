import { NextResponse } from "next/server";
import { authorizeChallengeAccess } from "../_auth";
import { writeAuditLog } from "@/lib/audit-log";

type RankingConfigInput = {
  ranking_slot: number;
  label: string;
  workouts_weight: number;
  checkins_weight: number;
  nutrition_weight: number;
  habits_weight: number;
  tie_breaker?: string;
};

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeChallengeAccess({ requireCoachOrAdmin: true });
  if ("error" in auth) return auth.error;
  const { supabase, role, userId } = auth.context;

  if (!params.id) return NextResponse.json({ error: "Challenge id is required" }, { status: 400 });

  const { data: existing, error: existingError } = await supabase
    .from("challenges")
    .select("id,created_by,status,logo_storage_path")
    .eq("id", params.id)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });
  if (!existing) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  if (role === "coach" && existing.created_by !== userId) {
    return NextResponse.json({ error: "Coach can only edit own challenges" }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    description?: string | null;
    starts_on?: string;
    ends_on?: string;
    status?: "draft" | "active" | "closed";
    ranking_configs?: RankingConfigInput[];
    template_id?: string | null;
    start_on?: string | null;
    assignment_note?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.starts_on !== undefined) updates.starts_on = body.starts_on;
  if (body.ends_on !== undefined) updates.ends_on = body.ends_on;
  if (body.status !== undefined) updates.status = body.status;

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase.from("challenges").update(updates).eq("id", params.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (Array.isArray(body.ranking_configs)) {
    const sanitized = body.ranking_configs
      .filter((entry) => entry.ranking_slot >= 1 && entry.ranking_slot <= 3)
      .map((entry) => ({
        challenge_id: params.id,
        ranking_slot: entry.ranking_slot,
        label: entry.label?.trim() || `Ranking ${entry.ranking_slot}`,
        workouts_weight: Number(entry.workouts_weight) || 0,
        checkins_weight: Number(entry.checkins_weight) || 0,
        nutrition_weight: Number(entry.nutrition_weight) || 0,
        habits_weight: Number(entry.habits_weight) || 0,
        tie_breaker: entry.tie_breaker || "workouts_then_checkins"
      }));

    if (!sanitized.length) {
      return NextResponse.json({ error: "At least one ranking config is required" }, { status: 400 });
    }

    const { error: deleteError } = await supabase.from("challenge_leaderboard_configs").delete().eq("challenge_id", params.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

    const { error: insertError } = await supabase.from("challenge_leaderboard_configs").insert(sanitized);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  if (body.template_id) {
    const startOn = body.start_on && /^\d{4}-\d{2}-\d{2}$/.test(body.start_on)
      ? body.start_on
      : body.starts_on || new Date().toISOString().slice(0, 10);

    const { error: mappingError } = await supabase.from("challenge_program_assignments").upsert(
      {
        challenge_id: params.id,
        template_id: body.template_id,
        start_on: startOn,
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
    action: "challenge.update",
    entityType: "challenge",
    entityId: params.id,
    metadata: {
      updated_fields: Object.keys(updates),
      ranking_configs_updated: Array.isArray(body.ranking_configs),
      template_updated: Boolean(body.template_id)
    }
  });

  const { data: challenge, error: challengeError } = await supabase
    .from("challenges")
    .select("id,name,description,starts_on,ends_on,status,created_by,created_at,updated_at,logo_storage_path")
    .eq("id", params.id)
    .single();
  if (challengeError) return NextResponse.json({ error: challengeError.message }, { status: 400 });

  return NextResponse.json({ challenge });
}
