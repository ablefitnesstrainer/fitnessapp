import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const isMissingColumn = (code?: string) => code === "42703" || code === "PGRST204";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("app_users")
    .select("role,subscription_status,subscription_price_id,subscription_current_period_end,billing_updated_at")
    .eq("id", user.id)
    .single();

  if (error && !isMissingColumn(error.code)) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    role: data?.role || "client",
    subscription_status: data?.subscription_status || "inactive",
    subscription_price_id: data?.subscription_price_id || null,
    subscription_current_period_end: data?.subscription_current_period_end || null,
    billing_updated_at: data?.billing_updated_at || null,
    stripe_configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID)
  });
}
