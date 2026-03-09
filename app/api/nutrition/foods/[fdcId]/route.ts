import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getFoodDetail } from "@/lib/usda-fdc";

export async function GET(_request: Request, { params }: { params: { fdcId: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!params.fdcId) return NextResponse.json({ error: "fdcId is required" }, { status: 400 });

  try {
    const food = await getFoodDetail(params.fdcId);
    return NextResponse.json({ food });
  } catch {
    return NextResponse.json({ error: "Food details temporarily unavailable" }, { status: 503 });
  }
}
