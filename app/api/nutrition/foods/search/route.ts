import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { searchFoods } from "@/lib/usda-fdc";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ foods: [] });

  try {
    const foods = await searchFoods(q);
    return NextResponse.json({ foods });
  } catch {
    return NextResponse.json({ error: "Food search temporarily unavailable" }, { status: 503 });
  }
}
