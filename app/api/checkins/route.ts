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
    workouts_completed: number;
    energy: number;
    hunger: number;
    sleep: number;
    stress: number;
    adherence: number;
    notes: string;
  };

  const { data: checkin, error } = await supabase
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

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ checkin });
}
