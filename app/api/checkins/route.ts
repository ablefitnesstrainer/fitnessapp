import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const isMissingSchemaField = (code?: string) => code === "42703" || code === "42P01" || code === "PGRST204" || code === "PGRST205";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    client_id: string;
    workouts_completed: number;
    workouts_scheduled: number;
    energy: number;
    hunger: number;
    sleep: number;
    stress: number;
    adherence: number;
    overall_week_rating: number;
    biggest_win: string;
    biggest_challenge: string;
    average_body_weight?: number | null;
    progress_photos_uploaded: string;
    cycle_status: string;
    nutrition_adherence_percent: number;
    protein_goal_hit: boolean;
    hydration_goal_hit: boolean;
    digestion_notes: string;
    training_performance: string;
    recovery_status: string;
    confidence_next_week: number;
    support_needed: string;
    notes: string;
  };

  const { data: checkin, error } = await supabase
    .from("checkins")
    .insert({
      client_id: body.client_id,
      workouts_completed: body.workouts_completed,
      workouts_scheduled: body.workouts_scheduled,
      energy: body.energy,
      hunger: body.hunger,
      sleep: body.sleep,
      stress: body.stress,
      adherence: body.adherence,
      overall_week_rating: body.overall_week_rating,
      biggest_win: body.biggest_win,
      biggest_challenge: body.biggest_challenge,
      average_body_weight: body.average_body_weight ?? null,
      progress_photos_uploaded: body.progress_photos_uploaded,
      cycle_status: body.cycle_status,
      nutrition_adherence_percent: body.nutrition_adherence_percent,
      protein_goal_hit: body.protein_goal_hit,
      hydration_goal_hit: body.hydration_goal_hit,
      digestion_notes: body.digestion_notes,
      training_performance: body.training_performance,
      recovery_status: body.recovery_status,
      confidence_next_week: body.confidence_next_week,
      support_needed: body.support_needed,
      notes: body.notes
    })
    .select("*")
    .single();

  if (error && isMissingSchemaField(error.code)) {
    const { data: legacyCheckin, error: legacyError } = await supabase
      .from("checkins")
      .insert({
        client_id: body.client_id,
        workouts_completed: body.workouts_completed,
        energy: body.energy,
        hunger: body.hunger,
        sleep: body.sleep,
        stress: body.stress,
        adherence: body.adherence,
        notes: body.notes
      })
      .select("*")
      .single();

    if (legacyError) return NextResponse.json({ error: legacyError.message }, { status: 400 });
    return NextResponse.json({ checkin: legacyCheckin });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ checkin });
}
