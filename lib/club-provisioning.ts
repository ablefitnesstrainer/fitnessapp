import { createAdminClient } from "@/lib/supabase-admin";
import { getClubAutomationSettings } from "@/lib/club-automation";
import { sendClubWelcomeEmail } from "@/lib/welcome-email";

type ProvisionInput = {
  email: string;
  fullName?: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  subscriptionPriceId: string | null;
  currentPeriodEnd: number | null;
  source?: string | null;
  campaign?: string | null;
  utm?: Record<string, string | null | undefined>;
  requestUserAgent?: string | null;
};

type ProvisionResult = {
  appUserId: string;
  clientId: string;
  challengeId: string | null;
  challengeName: string | null;
  templateId: string | null;
  existingUser: boolean;
  welcomeEmailStatus: "sent" | "skipped" | "failed";
  welcomeEmailError: string | null;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function findAuthUserIdByEmail(email: string) {
  const admin = createAdminClient();
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function ensureAuthAppClientRows(params: { email: string; fullName?: string | null }) {
  const admin = createAdminClient();
  const normalizedEmail = params.email.trim().toLowerCase();
  const normalizedName = (params.fullName || "").trim() || null;

  const { data: existingAppUser } = await admin
    .from("app_users")
    .select("id,role,email,full_name")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingAppUser?.id) {
    if (normalizedName && (!existingAppUser.full_name || !String(existingAppUser.full_name).trim())) {
      await admin.from("app_users").update({ full_name: normalizedName }).eq("id", existingAppUser.id);
    }

    const { data: existingClient } = await admin.from("clients").select("id").eq("user_id", existingAppUser.id).maybeSingle();
    if (existingClient?.id) {
      return { appUserId: existingAppUser.id, clientId: existingClient.id, existingUser: true };
    }

    const { data: createdClient, error: createClientError } = await admin
      .from("clients")
      .insert({ user_id: existingAppUser.id })
      .select("id")
      .single();

    if (createClientError) throw new Error(createClientError.message);
    return { appUserId: existingAppUser.id, clientId: createdClient.id, existingUser: true };
  }

  let authUserId = await findAuthUserIdByEmail(normalizedEmail);
  if (!authUserId) {
    const createAuthRes = await admin.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        source: "club_purchase"
      }
    });

    if (createAuthRes.error || !createAuthRes.data.user?.id) {
      throw new Error(createAuthRes.error?.message || "Unable to create auth user");
    }

    authUserId = createAuthRes.data.user.id;
  }

  const upsertRes = await admin.from("app_users").upsert(
    {
      id: authUserId,
      email: normalizedEmail,
      full_name: normalizedName,
      role: "client"
    },
    { onConflict: "id" }
  );

  if (upsertRes.error) throw new Error(upsertRes.error.message);

  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .upsert({ user_id: authUserId }, { onConflict: "user_id" })
    .select("id")
    .single();

  if (clientError) throw new Error(clientError.message);
  return { appUserId: authUserId, clientId: clientRow.id, existingUser: false };
}

async function syncBillingFields(params: {
  appUserId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  subscriptionPriceId: string | null;
  currentPeriodEnd: number | null;
}) {
  const admin = createAdminClient();
  const payload = {
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    subscription_status: params.subscriptionStatus,
    subscription_price_id: params.subscriptionPriceId,
    subscription_current_period_end: params.currentPeriodEnd ? new Date(params.currentPeriodEnd * 1000).toISOString() : null,
    billing_updated_at: new Date().toISOString()
  };

  const { error } = await admin.from("app_users").update(payload).eq("id", params.appUserId);
  if (error) throw new Error(error.message);
}

async function resolveChallenge() {
  const admin = createAdminClient();
  const today = todayIsoDate();

  const { data: activeChallenge } = await admin
    .from("challenges")
    .select("id,name,starts_on,ends_on,status")
    .eq("status", "active")
    .lte("starts_on", today)
    .gte("ends_on", today)
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeChallenge?.id) return activeChallenge;

  const settings = await getClubAutomationSettings();
  if (settings.fallbackMode !== "next_upcoming") return null;

  const { data: upcomingChallenge } = await admin
    .from("challenges")
    .select("id,name,starts_on,ends_on,status")
    .eq("status", "active")
    .gt("starts_on", today)
    .order("starts_on", { ascending: true })
    .limit(1)
    .maybeSingle();

  return upcomingChallenge || null;
}

async function assignChallengeAndProgram(params: { challengeId: string; clientId: string; appUserId: string }) {
  const admin = createAdminClient();

  const { error: enrollError } = await admin.from("challenge_enrollments").upsert(
    {
      challenge_id: params.challengeId,
      client_id: params.clientId,
      enrolled_by: params.appUserId
    },
    { onConflict: "challenge_id,client_id" }
  );

  if (enrollError) throw new Error(enrollError.message);

  const { data: mapping, error: mappingError } = await admin
    .from("challenge_program_assignments")
    .select("template_id,start_on")
    .eq("challenge_id", params.challengeId)
    .maybeSingle();

  if (mappingError) throw new Error(mappingError.message);

  if (!mapping?.template_id) {
    return { templateId: null };
  }

  const { error: assignmentError } = await admin.from("program_assignments").upsert(
    {
      client_id: params.clientId,
      template_id: mapping.template_id,
      start_week: 1,
      current_week_number: 1,
      current_day_number: 1,
      start_on: mapping.start_on,
      active: true
    },
    { onConflict: "client_id,template_id" }
  );

  if (assignmentError) throw new Error(assignmentError.message);
  return { templateId: mapping.template_id as string };
}

async function generateMagicLink(email: string) {
  const admin = createAdminClient();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const redirectTo = appUrl ? `${appUrl}/auth/finish?next=/dashboard` : undefined;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo
    }
  });

  if (error) throw new Error(error.message);

  const possibleLink =
    (data as { properties?: { action_link?: string } } | null)?.properties?.action_link ||
    (data as { action_link?: string } | null)?.action_link ||
    "";

  if (!possibleLink) throw new Error("Magic link was not returned");
  return possibleLink;
}

async function insertAuditLog(appUserId: string, action: string, metadata: Record<string, unknown>) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    actor_id: appUserId,
    action,
    entity_type: "club_membership",
    entity_id: appUserId,
    metadata,
    ip_address: null,
    user_agent: null
  });
}

export async function logClubEvent(params: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  appUserId?: string | null;
  clientId?: string | null;
  challengeId?: string | null;
  templateId?: string | null;
  eventType: string;
  status: "processed" | "warning" | "failed" | "pending";
  notes?: string | null;
  payload?: Record<string, unknown>;
  lastError?: string | null;
  retryCount?: number;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("club_member_events").insert({
    stripe_customer_id: params.stripeCustomerId || null,
    stripe_subscription_id: params.stripeSubscriptionId || null,
    app_user_id: params.appUserId || null,
    client_id: params.clientId || null,
    challenge_id: params.challengeId || null,
    template_id: params.templateId || null,
    event_type: params.eventType,
    status: params.status,
    notes: params.notes || null,
    payload: params.payload || {},
    retry_count: params.retryCount || 0,
    last_error: params.lastError || null,
    processed_at: new Date().toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function provisionClubMembership(input: ProvisionInput): Promise<ProvisionResult> {
  const settings = await getClubAutomationSettings();
  if (!settings.enabled) {
    throw new Error("Club automation is disabled");
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const ensured = await ensureAuthAppClientRows({ email: normalizedEmail, fullName: input.fullName || null });

  await syncBillingFields({
    appUserId: ensured.appUserId,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    subscriptionStatus: input.subscriptionStatus,
    subscriptionPriceId: input.subscriptionPriceId,
    currentPeriodEnd: input.currentPeriodEnd
  });

  await insertAuditLog(ensured.appUserId, "club.member_auto_provisioned", {
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    source: input.source || null,
    campaign: input.campaign || null,
    utm: input.utm || {}
  });

  const challenge = await resolveChallenge();
  let challengeId: string | null = null;
  let challengeName: string | null = null;
  let templateId: string | null = null;

  if (challenge?.id) {
    challengeId = challenge.id;
    challengeName = challenge.name;

    const assignment = await assignChallengeAndProgram({
      challengeId: challenge.id,
      clientId: ensured.clientId,
      appUserId: ensured.appUserId
    });
    templateId = assignment.templateId;

    await insertAuditLog(ensured.appUserId, "club.challenge_auto_enrolled", {
      challenge_id: challengeId,
      challenge_name: challengeName
    });

    if (templateId) {
      await insertAuditLog(ensured.appUserId, "club.program_auto_assigned", {
        challenge_id: challengeId,
        template_id: templateId
      });
    }
  }

  let welcomeEmailStatus: ProvisionResult["welcomeEmailStatus"] = "skipped";
  let welcomeEmailError: string | null = null;

  if (settings.welcomeEmailEnabled) {
    try {
      const magicLink = await generateMagicLink(normalizedEmail);
      await sendClubWelcomeEmail({
        toEmail: normalizedEmail,
        fullName: input.fullName || null,
        magicLink,
        challengeName,
        existingUser: ensured.existingUser
      });
      welcomeEmailStatus = "sent";
    } catch (error) {
      welcomeEmailStatus = "failed";
      welcomeEmailError = error instanceof Error ? error.message : "Unknown welcome email error";
    }
  }

  return {
    appUserId: ensured.appUserId,
    clientId: ensured.clientId,
    challengeId,
    challengeName,
    templateId,
    existingUser: ensured.existingUser,
    welcomeEmailStatus,
    welcomeEmailError
  };
}
