import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createDocumentFromTemplate, deriveContractStatus, getDocumentRecipients, sendDocument } from "@/lib/breezedoc";
import { enforceRateLimit } from "@/lib/security-controls";
import { writeAuditLog } from "@/lib/audit-log";
import { requireRecentAuth } from "@/lib/session-security";

type AppUser = {
  id: string;
  role: "admin" | "coach" | "client";
  email: string;
  full_name: string | null;
};

async function authorize(request: Request, requestedClientId?: string | null) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser, error: appUserError } = await supabase.from("app_users").select("id,role,email,full_name").eq("id", user.id).single();
  if (appUserError || !appUser) {
    return { error: NextResponse.json({ error: appUserError?.message || "Unauthorized" }, { status: 401 }) };
  }

  if (appUser.role === "client") {
    const { data: clientRow, error: clientError } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
    if (clientError || !clientRow) return { error: NextResponse.json({ error: clientError?.message || "Client profile missing" }, { status: 404 }) };
    return { supabase, user, appUser: appUser as AppUser, clientId: clientRow.id };
  }

  if (!requestedClientId) return { error: NextResponse.json({ error: "client_id is required" }, { status: 400 }) };

  const clientQuery =
    appUser.role === "coach"
      ? supabase.from("clients").select("id").eq("id", requestedClientId).eq("coach_id", user.id).maybeSingle()
      : supabase.from("clients").select("id").eq("id", requestedClientId).maybeSingle();

  const { data: clientRow, error: clientError } = await clientQuery;
  if (clientError || !clientRow) return { error: NextResponse.json({ error: clientError?.message || "Client not found" }, { status: 404 }) };

  return { supabase, user, appUser: appUser as AppUser, clientId: clientRow.id };
}

function fallbackName(name: string | null | undefined, email: string, id: string) {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return email.split("@")[0] || id;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  const refresh = searchParams.get("refresh") === "1";

  const auth = await authorize(request, clientId);
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const { data: latest, error } = await supabase
    .from("client_contracts")
    .select("*")
    .eq("client_id", auth.clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!latest) return NextResponse.json({ contract: null });

  if (!refresh || !latest.document_id || (auth.appUser.role !== "admin" && auth.appUser.role !== "coach")) {
    return NextResponse.json({ contract: latest });
  }

  try {
    const recipients = await getDocumentRecipients(latest.document_id);
    const status = deriveContractStatus(recipients);
    const completedAt =
      recipients
        .filter((recipient) => recipient.completed_at)
        .map((recipient) => recipient.completed_at as string)
        .sort()
        .at(-1) || null;
    const openedAt =
      recipients
        .filter((recipient) => recipient.opened_at)
        .map((recipient) => recipient.opened_at as string)
        .sort()
        .at(-1) || null;
    const sentAt =
      recipients
        .filter((recipient) => recipient.sent_at)
        .map((recipient) => recipient.sent_at as string)
        .sort()
        .at(-1) || null;

    const { data: updated, error: updateError } = await supabase
      .from("client_contracts")
      .update({
        status,
        sent_at: sentAt || latest.sent_at,
        opened_at: openedAt || latest.opened_at,
        completed_at: completedAt || latest.completed_at,
        provider_payload: {
          ...(latest.provider_payload || {}),
          recipients
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", latest.id)
      .select("*")
      .single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    return NextResponse.json({ contract: updated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to refresh contract status" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const reauth = requireRecentAuth(request);
  if (reauth) return reauth;

  const body = (await request.json()) as { client_id: string };
  const auth = await authorize(request, body.client_id);
  if ("error" in auth) return auth.error;

  if (auth.appUser.role !== "admin" && auth.appUser.role !== "coach") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await enforceRateLimit({
    scope: "contracts.send",
    identifier: auth.user.id,
    limit: 10,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const templateId = Number(process.env.BREEZEDOC_TEMPLATE_ID || 0);
  if (!Number.isFinite(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "Missing or invalid BREEZEDOC_TEMPLATE_ID" }, { status: 500 });
  }

  const clientParty = Number(process.env.BREEZEDOC_CLIENT_PARTY || 1);
  const coachParty = Number(process.env.BREEZEDOC_COACH_PARTY || 2);

  const { data: clientUser, error: clientUserError } = await auth.supabase
    .from("clients")
    .select("user_id,app_users!clients_user_id_fkey(id,email,full_name)")
    .eq("id", auth.clientId)
    .single();

  if (clientUserError) return NextResponse.json({ error: clientUserError.message }, { status: 400 });

  const joined = Array.isArray(clientUser.app_users) ? clientUser.app_users[0] : clientUser.app_users;
  const clientEmail = joined?.email;
  if (!clientEmail) return NextResponse.json({ error: "Client email missing" }, { status: 400 });

  const clientName = fallbackName(joined?.full_name, clientEmail, clientUser.user_id);
  const coachName = fallbackName(auth.appUser.full_name, auth.appUser.email, auth.appUser.id);
  const coachEmail = auth.appUser.email;

  try {
    const created = await createDocumentFromTemplate(templateId);
    const sent = await sendDocument(created.id, [
      { name: clientName, email: clientEmail, party: clientParty },
      { name: coachName, email: coachEmail, party: coachParty }
    ]);

    const recipients = await getDocumentRecipients(created.id).catch(() => sent.recipients || []);
    const status = deriveContractStatus(recipients || []);

    const sentAt =
      (recipients || [])
        .filter((recipient) => recipient.sent_at)
        .map((recipient) => recipient.sent_at as string)
        .sort()
        .at(-1) || new Date().toISOString();

    const { data: contract, error: insertError } = await auth.supabase
      .from("client_contracts")
      .insert({
        client_id: auth.clientId,
        provider: "breezedoc",
        template_id: templateId,
        document_id: created.id,
        document_slug: created.slug || sent.slug || null,
        status,
        client_name: clientName,
        client_email: clientEmail,
        coach_name: coachName,
        coach_email: coachEmail,
        client_party: clientParty,
        coach_party: coachParty,
        sent_at: sentAt,
        provider_payload: {
          created,
          sent,
          recipients
        },
        created_by: auth.user.id
      })
      .select("*")
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

    await writeAuditLog({
      supabase: auth.supabase,
      request,
      actorId: auth.user.id,
      action: "contract.send",
      entityType: "client_contract",
      entityId: String(contract.id),
      metadata: {
        client_id: auth.clientId,
        provider: "breezedoc",
        document_id: created.id
      }
    });

    return NextResponse.json({ contract });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send contract" }, { status: 400 });
  }
}
