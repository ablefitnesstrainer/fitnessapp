import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { calculateMifflinStJeorTargets, type SexAtBirth } from "@/lib/macro-calculator";

const isMissingRelation = (code?: string) => code === "42P01" || code === "PGRST205";
const isMissingSchemaField = (code?: string) => code === "42703" || code === "PGRST204";

export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: appUser } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!appUser || (appUser.role !== "admin" && appUser.role !== "coach")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    client_id: string;
    age?: number;
    height?: number;
    goal?: string;
    equipment?: string;
    current_weight?: number;
    sex_at_birth?: "male" | "female";
    primary_goal?: string;
    training_experience?: string;
    injuries_or_limitations?: string;
    equipment_access?: string;
    days_per_week?: number;
    session_length_minutes?: number;
    nutrition_preferences?: string;
    dietary_restrictions?: string;
    stress_level?: number;
    sleep_hours?: number;
    readiness_to_change?: number;
    support_notes?: string;
    auto_calculate_targets?: boolean;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };

  if (!body.client_id) {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }

  const { data: existingClient, error: existingClientError } = await supabase
    .from("clients")
    .select("id,coach_id")
    .eq("id", body.client_id)
    .maybeSingle();

  if (existingClientError) return NextResponse.json({ error: existingClientError.message }, { status: 400 });
  if (!existingClient) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  if (appUser.role === "coach" && existingClient.coach_id !== user.id) {
    return NextResponse.json({ error: "Coach can only edit assigned clients" }, { status: 403 });
  }

  const clientUpdate: Record<string, unknown> = {};
  if (typeof body.age === "number") clientUpdate.age = body.age;
  if (typeof body.height === "number") clientUpdate.height = body.height;
  if (typeof body.goal === "string") clientUpdate.goal = body.goal;
  if (typeof body.equipment === "string") clientUpdate.equipment = body.equipment;

  if (Object.keys(clientUpdate).length > 0) {
    const { error: clientUpdateError } = await supabase.from("clients").update(clientUpdate).eq("id", body.client_id);
    if (clientUpdateError) return NextResponse.json({ error: clientUpdateError.message }, { status: 400 });
  }

  if (typeof body.current_weight === "number" && Number.isFinite(body.current_weight) && body.current_weight > 0) {
    const { error: weightError } = await supabase.from("bodyweight_logs").insert({
      client_id: body.client_id,
      weight: body.current_weight
    });
    if (weightError) return NextResponse.json({ error: weightError.message }, { status: 400 });
  }

  const intakePayload = {
    client_id: body.client_id,
    primary_goal: body.primary_goal ?? "",
    sex_at_birth: body.sex_at_birth ?? "male",
    training_experience: body.training_experience ?? null,
    injuries_or_limitations: body.injuries_or_limitations ?? null,
    equipment_access: body.equipment_access ?? null,
    days_per_week: body.days_per_week ?? null,
    session_length_minutes: body.session_length_minutes ?? null,
    nutrition_preferences: body.nutrition_preferences ?? null,
    dietary_restrictions: body.dietary_restrictions ?? null,
    stress_level: body.stress_level ?? null,
    sleep_hours: body.sleep_hours ?? null,
    readiness_to_change: body.readiness_to_change ?? null,
    support_notes: body.support_notes ?? null
  };

  let { error: intakeError } = await supabase.from("client_intakes").upsert(intakePayload, { onConflict: "client_id" });

  if (intakeError && isMissingSchemaField(intakeError.code)) {
    const fallbackPayload = {
      client_id: body.client_id,
      primary_goal: body.primary_goal ?? "",
      training_experience: body.training_experience ?? null,
      injuries_or_limitations: body.injuries_or_limitations ?? null,
      equipment_access: body.equipment_access ?? null,
      days_per_week: body.days_per_week ?? null,
      session_length_minutes: body.session_length_minutes ?? null,
      nutrition_preferences: body.nutrition_preferences ?? null,
      dietary_restrictions: body.dietary_restrictions ?? null,
      stress_level: body.stress_level ?? null,
      sleep_hours: body.sleep_hours ?? null,
      readiness_to_change: body.readiness_to_change ?? null,
      support_notes: body.support_notes ?? null
    };
    const fallback = await supabase.from("client_intakes").upsert(fallbackPayload, { onConflict: "client_id" });
    intakeError = fallback.error;
  }

  if (intakeError && !isMissingRelation(intakeError.code)) {
    return NextResponse.json({ error: intakeError.message }, { status: 400 });
  }

  const hasManualTargets =
    typeof body.calories === "number" &&
    typeof body.protein === "number" &&
    typeof body.carbs === "number" &&
    typeof body.fat === "number";

  if (hasManualTargets) {
    const { error: manualTargetError } = await supabase.from("nutrition_targets").upsert(
      {
        client_id: body.client_id,
        calories: body.calories,
        protein: body.protein,
        carbs: body.carbs,
        fat: body.fat
      },
      { onConflict: "client_id" }
    );
    if (manualTargetError) return NextResponse.json({ error: manualTargetError.message }, { status: 400 });
  } else if (body.auto_calculate_targets) {
    if (
      typeof body.age === "number" &&
      typeof body.height === "number" &&
      typeof body.current_weight === "number" &&
      body.current_weight > 0
    ) {
      const targets = calculateMifflinStJeorTargets({
        sexAtBirth: (body.sex_at_birth || "male") as SexAtBirth,
        age: body.age,
        heightInches: body.height,
        weightLbs: body.current_weight,
        daysPerWeek: body.days_per_week ?? null,
        goalText: body.primary_goal || body.goal || ""
      });

      const { error: autoTargetError } = await supabase.from("nutrition_targets").upsert(
        {
          client_id: body.client_id,
          calories: targets.calories,
          protein: targets.protein,
          carbs: targets.carbs,
          fat: targets.fat
        },
        { onConflict: "client_id" }
      );
      if (autoTargetError) return NextResponse.json({ error: autoTargetError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
