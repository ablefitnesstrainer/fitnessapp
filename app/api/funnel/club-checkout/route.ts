import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { enforceRateLimit, getRequestIp } from "@/lib/security-controls";

function baseUrlFromRequest(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !(process.env.CLUB_STRIPE_PRICE_ID || process.env.STRIPE_PRICE_ID)) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const limited = await enforceRateLimit({
    scope: "funnel.club_checkout",
    identifier: ip,
    limit: 30,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const configuredShared = process.env.CLUB_CHECKOUT_SHARED_KEY;
  const providedShared = request.headers.get("x-club-shared-key");
  if (providedShared && configuredShared && providedShared !== configuredShared) {
    return NextResponse.json({ error: "Invalid shared key" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    source?: string | null;
    campaign?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_term?: string | null;
    utm_content?: string | null;
    success_url?: string | null;
    cancel_url?: string | null;
    customer_email?: string | null;
  };

  const source = (body.source || "funnel").trim().slice(0, 100);
  const campaign = (body.campaign || "").trim().slice(0, 100) || null;
  const utm = {
    utm_source: (body.utm_source || "").trim().slice(0, 120) || null,
    utm_medium: (body.utm_medium || "").trim().slice(0, 120) || null,
    utm_campaign: (body.utm_campaign || "").trim().slice(0, 120) || null,
    utm_term: (body.utm_term || "").trim().slice(0, 120) || null,
    utm_content: (body.utm_content || "").trim().slice(0, 120) || null
  };

  const baseUrl = baseUrlFromRequest(request);
  const successUrl = body.success_url?.trim() || process.env.CLUB_SUCCESS_URL || `${baseUrl}/login?club=success`;
  const cancelUrl = body.cancel_url?.trim() || process.env.CLUB_CANCEL_URL || `${baseUrl}/login?club=cancel`;

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: body.customer_email?.trim() || undefined,
    line_items: [
      {
        price: process.env.CLUB_STRIPE_PRICE_ID || process.env.STRIPE_PRICE_ID,
        quantity: 1
      }
    ],
    allow_promotion_codes: true,
    metadata: {
      source,
      campaign: campaign || "",
      created_at_iso: new Date().toISOString(),
      ...utm
    },
    subscription_data: {
      metadata: {
        source,
        campaign: campaign || "",
        ...utm
      }
    },
    success_url: successUrl,
    cancel_url: cancelUrl
  });

  return NextResponse.json({ checkout_url: session.url });
}
