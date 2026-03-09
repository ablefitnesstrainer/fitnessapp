import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

async function assertCanAccessClient(clientId: string, userId: string) {
  const supabase = createClient();
  const { data: appUser, error: appUserError } = await supabase.from("app_users").select("role").eq("id", userId).single();
  if (appUserError || !appUser) return { ok: false, status: 403, error: "Forbidden" };

  const { data: client, error: clientError } = await supabase.from("clients").select("id,user_id,coach_id").eq("id", clientId).maybeSingle();
  if (clientError || !client) return { ok: false, status: 404, error: "Client not found" };

  const allowed = appUser.role === "admin" || client.user_id === userId || client.coach_id === userId;
  if (!allowed) return { ok: false, status: 403, error: "Forbidden" };

  return { ok: true } as const;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    client_id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };

  const access = await assertCanAccessClient(body.client_id, user.id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data: quickMeal, error } = await supabase
    .from("quick_meal_templates")
    .insert({
      client_id: body.client_id,
      name: body.name,
      calories: body.calories,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ quickMeal });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const quickMealId = searchParams.get("id");
  if (!quickMealId) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { data: quickMeal, error: findError } = await supabase
    .from("quick_meal_templates")
    .select("id,client_id")
    .eq("id", quickMealId)
    .maybeSingle();

  if (findError || !quickMeal) return NextResponse.json({ error: "Quick meal not found" }, { status: 404 });

  const access = await assertCanAccessClient(quickMeal.client_id, user.id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { error } = await supabase.from("quick_meal_templates").delete().eq("id", quickMealId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
