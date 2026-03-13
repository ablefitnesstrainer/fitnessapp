import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { enforceRateLimit, getRequestIp } from "@/lib/security-controls";

function normalizeOrigin(origin?: string | null) {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function allowedOrigins() {
  const configured = (process.env.CLUB_CHECKOUT_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));

  return new Set([
    "https://ablefitnesscoaching.com",
    "https://www.ablefitnesscoaching.com",
    ...configured
  ]);
}

function corsHeaders(origin?: string | null) {
  const normalized = normalizeOrigin(origin);
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Club-Shared-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  });

  if (normalized && allowedOrigins().has(normalized)) {
    headers.set("Access-Control-Allow-Origin", normalized);
  }

  return headers;
}

function baseUrlFromRequest(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  if (!headers.get("Access-Control-Allow-Origin")) {
    return new NextResponse(null, { status: 403, headers });
  }
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  if (!headers.get("Access-Control-Allow-Origin")) {
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403, headers });
  }

  if (!process.env.STRIPE_SECRET_KEY || !(process.env.CLUB_STRIPE_PRICE_ID || process.env.STRIPE_PRICE_ID)) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 400, headers });
  }

  const ip = getRequestIp(request);
  const limited = await enforceRateLimit({
    scope: "funnel.club_checkout",
    identifier: ip,
    limit: 30,
    windowSeconds: 60 * 60
  });
  if (limited) {
    const res = limited;
    headers.forEach((value, key) => res.headers.set(key, value));
    return res;
  }

  const configuredShared = process.env.CLUB_CHECKOUT_SHARED_KEY;
  const providedShared = request.headers.get("x-club-shared-key");
  if (providedShared && configuredShared && providedShared !== configuredShared) {
    return NextResponse.json({ error: "Invalid shared key" }, { status: 403, headers });
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

  return NextResponse.json({ checkout_url: session.url }, { headers });
}
