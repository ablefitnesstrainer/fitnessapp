import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";

function getBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: appUser, error } = await supabase
    .from("app_users")
    .select("id,role,stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (error || !appUser) return NextResponse.json({ error: error?.message || "User not found" }, { status: 400 });
  if (appUser.role === "client") return NextResponse.json({ error: "Billing is managed by your coach." }, { status: 403 });
  if (!appUser.stripe_customer_id) return NextResponse.json({ error: "No Stripe customer found. Start subscription first." }, { status: 400 });

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: appUser.stripe_customer_id,
    return_url: `${getBaseUrl(request)}/settings/billing`
  });

  return NextResponse.json({ url: session.url });
}
