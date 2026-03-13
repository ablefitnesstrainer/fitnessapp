import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase-admin";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";
import { logClubEvent, provisionClubMembership } from "@/lib/club-provisioning";
import { reportOpsAlert } from "@/lib/ops-alerts";

export const runtime = "nodejs";

function appUserIdFromMetadata(metadata?: Stripe.Metadata | null) {
  const raw = metadata?.app_user_id;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function currentPeriodEnd(subscription: Stripe.Subscription | Stripe.Response<Stripe.Subscription>) {
  const raw = (subscription as { current_period_end?: unknown }).current_period_end;
  return typeof raw === "number" ? raw : null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const parent = invoice.parent;
  if (!parent || parent.type !== "subscription_details") return null;
  const subscription = parent.subscription_details?.subscription;
  return typeof subscription === "string" ? subscription : null;
}

async function upsertWebhookEvent(input: {
  eventId: string;
  eventType: string;
  status: "processed" | "skipped" | "failed";
  errorMessage?: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("billing_webhook_events").upsert(
    {
      event_id: input.eventId,
      event_type: input.eventType,
      status: input.status,
      error_message: input.errorMessage || null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    { onConflict: "event_id" }
  );
}

async function alreadyProcessed(eventId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("billing_webhook_events").select("status").eq("event_id", eventId).maybeSingle();
  return data?.status === "processed";
}

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
    subscription_current_period_end: params.currentPeriodEnd ? new Date(params.currentPeriodEnd * 1000).toISOString() : null,
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
  await admin
    .from("app_users")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: "canceled",
      subscription_price_id: subscription.items.data[0]?.price?.id || null,
      subscription_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      billing_updated_at: new Date().toISOString()
    })
    .eq("stripe_customer_id", String(subscription.customer || ""));
}

async function syncSubscriptionById(subscriptionId: string) {
  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  if (!customerId) return;
  await syncSubscription({
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    priceId: subscription.items.data[0]?.price?.id || null,
    currentPeriodEnd: currentPeriodEnd(subscription),
    appUserId: appUserIdFromMetadata(subscription.metadata)
  });
}

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  const email = session.customer_details?.email || session.customer_email || null;

  if (!customerId || !subscriptionId || !email) {
    await logClubEvent({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      eventType: "club.checkout_missing_fields",
      status: "failed",
      notes: "Missing customer/subscription/email from checkout session",
      payload: {
        session_id: session.id
      }
    });
    throw new Error("Missing required checkout session fields");
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const fullName = session.customer_details?.name || null;
  const source = session.metadata?.source || null;
  const campaign = session.metadata?.campaign || null;
  const utm = {
    utm_source: session.metadata?.utm_source || null,
    utm_medium: session.metadata?.utm_medium || null,
    utm_campaign: session.metadata?.utm_campaign || null,
    utm_term: session.metadata?.utm_term || null,
    utm_content: session.metadata?.utm_content || null
  };

  const provisioned = await provisionClubMembership({
    email,
    fullName,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionStatus: subscription.status,
    subscriptionPriceId: subscription.items.data[0]?.price?.id || null,
    currentPeriodEnd: currentPeriodEnd(subscription),
    source,
    campaign,
    utm
  });

  await logClubEvent({
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    appUserId: provisioned.appUserId,
    clientId: provisioned.clientId,
    challengeId: provisioned.challengeId,
    templateId: provisioned.templateId,
    eventType: "club.provisioning.completed",
    status: provisioned.welcomeEmailStatus === "failed" ? "warning" : "processed",
    notes: provisioned.welcomeEmailStatus === "failed" ? "Provisioned, but welcome email failed" : "Provisioned and enrolled",
    payload: {
      email,
      full_name: fullName,
      challenge_name: provisioned.challengeName,
      existing_user: provisioned.existingUser,
      welcome_email_status: provisioned.welcomeEmailStatus,
      source,
      campaign,
      utm
    },
    lastError: provisioned.welcomeEmailError
  });

  if (provisioned.welcomeEmailStatus === "failed") {
    await reportOpsAlert({
      alertKey: `club:welcome-email-failed:${customerId}`,
      severity: "warning",
      message: "Club provisioning completed but welcome email failed.",
      metadata: {
        event_id: event.id,
        customer_id: customerId,
        subscription_id: subscriptionId,
        app_user_id: provisioned.appUserId,
        email_error: provisioned.welcomeEmailError
      }
    });
  }
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
    if (await alreadyProcessed(event.id)) {
      return NextResponse.json({ received: true, skipped: true });
    }

    if (event.type === "checkout.session.completed") {
      await handleCheckoutSessionCompleted(event);
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

    if (event.type === "invoice.payment_failed" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (subscriptionId) {
        await syncSubscriptionById(subscriptionId);
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge & { invoice?: string | null };
      const invoiceId = typeof charge.invoice === "string" ? charge.invoice : null;
      if (invoiceId) {
        const stripe = getStripeClient();
        const invoice = await stripe.invoices.retrieve(invoiceId);
        const subscriptionId = invoiceSubscriptionId(invoice);
        if (subscriptionId) {
          await syncSubscriptionById(subscriptionId);
        }
      }
    }

    await upsertWebhookEvent({ eventId: event.id, eventType: event.type, status: "processed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failed";
    await upsertWebhookEvent({ eventId: event.id, eventType: event.type, status: "failed", errorMessage: message });
    await reportOpsAlert({
      alertKey: `stripe:webhook-failed:${event.type}`,
      severity: "critical",
      message: "Stripe webhook processing failed.",
      metadata: {
        event_id: event.id,
        event_type: event.type,
        error: message
      }
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
