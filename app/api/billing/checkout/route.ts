import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getStripeClient, getStripePriceId, isStripeConfigured } from "@/lib/stripe";
import { writeAuditLog } from "@/lib/audit-log";

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

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("id,email,role,stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (appUserError || !appUser) {
    return NextResponse.json({ error: appUserError?.message || "User not found" }, { status: 400 });
  }

  if (appUser.role === "client") {
    return NextResponse.json({ error: "Billing is managed by your coach." }, { status: 403 });
  }

  const stripe = getStripeClient();
  let customerId = appUser.stripe_customer_id || null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: appUser.email,
      name: user.user_metadata?.full_name || appUser.email,
      metadata: {
        app_user_id: appUser.id
      }
    });
    customerId = customer.id;

    const admin = createAdminClient();
    await admin
      .from("app_users")
      .update({
        stripe_customer_id: customerId,
        billing_updated_at: new Date().toISOString()
      })
      .eq("id", appUser.id);
  }

  const baseUrl = getBaseUrl(request);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: getStripePriceId(),
        quantity: 1
      }
    ],
    allow_promotion_codes: true,
    metadata: {
      app_user_id: appUser.id
    },
    subscription_data: {
      metadata: {
        app_user_id: appUser.id
      }
    },
    success_url: `${baseUrl}/settings/billing?success=1`,
    cancel_url: `${baseUrl}/settings/billing?cancel=1`
  });

  await writeAuditLog({
    supabase,
    request,
    actorId: appUser.id,
    action: "billing.checkout_session.create",
    entityType: "app_user",
    entityId: appUser.id,
    metadata: {
      stripe_customer_id: customerId,
      checkout_session_id: session.id
    }
  });

  return NextResponse.json({ url: session.url });
}
