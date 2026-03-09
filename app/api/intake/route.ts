import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { calculateMifflinStJeorTargets } from "@/lib/macro-calculator";

const isMissingSchemaField = (code?: string) => code === "42703" || code === "PGRST204";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    client_id: string;
    sex_at_birth: "male" | "female";
    age: number;
    height: number;
    current_weight: number;
    primary_goal: string;
    training_experience: string;
    injuries_or_limitations: string;
    equipment_access: string;
    days_per_week: number;
    session_length_minutes: number;
    nutrition_preferences: string;
    dietary_restrictions: string;
    stress_level: number;
    sleep_hours: number;
    readiness_to_change: number;
    support_notes: string;
  };

  const intakePayload = {
    client_id: body.client_id,
    sex_at_birth: body.sex_at_birth,
    primary_goal: body.primary_goal,
    training_experience: body.training_experience,
    injuries_or_limitations: body.injuries_or_limitations,
    equipment_access: body.equipment_access,
    days_per_week: body.days_per_week,
    session_length_minutes: body.session_length_minutes,
    nutrition_preferences: body.nutrition_preferences,
    dietary_restrictions: body.dietary_restrictions,
    stress_level: body.stress_level,
    sleep_hours: body.sleep_hours,
    readiness_to_change: body.readiness_to_change,
    support_notes: body.support_notes
  };

  let { data: intake, error } = await supabase.from("client_intakes").upsert(intakePayload, { onConflict: "client_id" }).select("*").single();

  if (error && isMissingSchemaField(error.code)) {
    const fallbackPayload = {
      client_id: body.client_id,
      primary_goal: body.primary_goal,
      training_experience: body.training_experience,
      injuries_or_limitations: body.injuries_or_limitations,
      equipment_access: body.equipment_access,
      days_per_week: body.days_per_week,
      session_length_minutes: body.session_length_minutes,
      nutrition_preferences: body.nutrition_preferences,
      dietary_restrictions: body.dietary_restrictions,
      stress_level: body.stress_level,
      sleep_hours: body.sleep_hours,
      readiness_to_change: body.readiness_to_change,
      support_notes: body.support_notes
    };
    const fallback = await supabase.from("client_intakes").upsert(fallbackPayload, { onConflict: "client_id" }).select("*").single();
    intake = fallback.data;
    error = fallback.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: clientsError } = await supabase
    .from("clients")
    .update({
      age: body.age,
      height: body.height
    })
    .eq("id", body.client_id);

  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 400 });

  const { error: weightError } = await supabase.from("bodyweight_logs").insert({
    client_id: body.client_id,
    weight: body.current_weight
  });

  if (weightError) return NextResponse.json({ error: weightError.message }, { status: 400 });

  const autoTargets = calculateMifflinStJeorTargets({
    sexAtBirth: body.sex_at_birth,
    age: body.age,
    heightInches: body.height,
    weightLbs: body.current_weight,
    daysPerWeek: body.days_per_week,
    goalText: body.primary_goal
  });

  const { error: targetError } = await supabase.from("nutrition_targets").upsert(
    {
      client_id: body.client_id,
      calories: autoTargets.calories,
      protein: autoTargets.protein,
      carbs: autoTargets.carbs,
      fat: autoTargets.fat
    },
    { onConflict: "client_id" }
  );

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 400 });

  return NextResponse.json({ intake });
}
