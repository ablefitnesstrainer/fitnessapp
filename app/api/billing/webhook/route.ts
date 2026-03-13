import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase-admin";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

async function syncSubscription(params: {
  customerId: string;
  subscriptionId: string;
  status: string;
  priceId: string | null;
  currentPeriodEnd: number | null;
  appUserId?: string | null;
}) {
  const admin = createAdminClient();
  const payload = {
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
    subscription_status: params.status,
    subscription_price_id: params.priceId,
    subscription_current_period_end: params.currentPeriodEnd
      ? new Date(params.currentPeriodEnd * 1000).toISOString()
      : null,
    billing_updated_at: new Date().toISOString()
  };

  if (params.appUserId) {
    const { error } = await admin.from("app_users").update(payload).eq("id", params.appUserId);
    if (!error) return;
  }

  await admin.from("app_users").update(payload).eq("stripe_customer_id", params.customerId);
}

async function markSubscriptionCanceled(subscription: Stripe.Subscription) {
  const admin = createAdminClient();
  const periodEnd = currentPeriodEnd(subscription);
  const payload = {
    stripe_subscription_id: subscription.id,
    subscription_status: "canceled",
    subscription_price_id: subscription.items.data[0]?.price?.id || null,
    subscription_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    billing_updated_at: new Date().toISOString()
  };

  await admin.from("app_users").update(payload).eq("stripe_customer_id", String(subscription.customer || ""));
}

function appUserIdFromMetadata(metadata?: Stripe.Metadata | null) {
  const raw = metadata?.app_user_id;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function currentPeriodEnd(subscription: Stripe.Subscription | Stripe.Response<Stripe.Subscription>) {
  const raw = (subscription as { current_period_end?: unknown }).current_period_end;
  return typeof raw === "number" ? raw : null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
      const appUserId = appUserIdFromMetadata(session.metadata);

      if (customerId && subscriptionId) {
        const stripe = getStripeClient();
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription({
          customerId,
          subscriptionId,
          status: subscription.status,
          priceId: subscription.items.data[0]?.price?.id || null,
          currentPeriodEnd: currentPeriodEnd(subscription),
          appUserId
        });
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      if (customerId) {
        await syncSubscription({
          customerId,
          subscriptionId: subscription.id,
          status: subscription.status,
          priceId: subscription.items.data[0]?.price?.id || null,
          currentPeriodEnd: currentPeriodEnd(subscription),
          appUserId: appUserIdFromMetadata(subscription.metadata)
        });
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await markSubscriptionCanceled(subscription);
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
