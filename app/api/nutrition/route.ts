import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    client_id: string;
    food_name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };

  const { data: meal, error } = await supabase
    .from("meal_logs")
    .insert({
      client_id: body.client_id,
      food_name: body.food_name,
      calories: body.calories,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ meal });
}
