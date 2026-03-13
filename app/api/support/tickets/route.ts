import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeAuditLog } from "@/lib/audit-log";
import { enforceRateLimit } from "@/lib/security-controls";

type Role = "admin" | "coach" | "client";

async function authorize() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser, error: appUserError } = await supabase.from("app_users").select("id,role").eq("id", user.id).single();
  if (appUserError || !appUser) return { error: NextResponse.json({ error: appUserError?.message || "Unauthorized" }, { status: 401 }) };

  let clientId: string | null = null;
  if (appUser.role === "client") {
    const { data: clientRow } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
    clientId = clientRow?.id || null;
  }

  return { supabase, userId: user.id, role: appUser.role as Role, clientId };
}

export async function GET(request: Request) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { supabase, role, userId, clientId } = auth;

  const search = new URL(request.url).searchParams;
  const statusFilter = search.get("status");
  const limit = Math.min(200, Math.max(20, Number(search.get("limit") || 80)));

  let query = supabase
    .from("support_tickets")
    .select("id,client_id,created_by,assigned_to,subject,category,message,status,priority,last_response_at,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusFilter && ["open", "in_progress", "resolved", "closed"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  if (role === "client") {
    if (!clientId) return NextResponse.json({ tickets: [] });
    query = query.eq("client_id", clientId);
  } else if (role === "coach") {
    const { data: ownClients } = await supabase.from("clients").select("id").eq("coach_id", userId);
    const ids = (ownClients || []).map((row) => row.id);
    if (!ids.length) return NextResponse.json({ tickets: [] });
    query = query.in("client_id", ids);
  }

  const { data: tickets, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const clientIds = Array.from(new Set((tickets || []).map((row) => row.client_id).filter(Boolean)));
  const userIds = Array.from(new Set((tickets || []).flatMap((row) => [row.created_by, row.assigned_to]).filter(Boolean)));

  const [{ data: clients }, { data: users }] = await Promise.all([
    clientIds.length
      ? supabase.from("clients").select("id,user_id,app_users!clients_user_id_fkey(id,email,full_name)").in("id", clientIds)
      : Promise.resolve({ data: [] as any[] }),
    userIds.length ? supabase.from("app_users").select("id,email,full_name").in("id", userIds) : Promise.resolve({ data: [] as any[] })
  ]);

  const clientNameById = new Map<string, string>();
  (clients || []).forEach((row: any) => {
    const joined = Array.isArray(row.app_users) ? row.app_users[0] : row.app_users;
    const name = joined?.full_name || joined?.email || row.user_id || row.id;
    clientNameById.set(row.id, name);
  });

  const userNameById = new Map<string, string>();
  (users || []).forEach((row: any) => {
    userNameById.set(row.id, row.full_name || row.email || row.id);
  });

  return NextResponse.json({
    tickets: (tickets || []).map((row) => ({
      ...row,
      client_name: clientNameById.get(row.client_id) || row.client_id,
      created_by_name: userNameById.get(row.created_by) || row.created_by,
      assigned_to_name: row.assigned_to ? userNameById.get(row.assigned_to) || row.assigned_to : null
    }))
  });
}

export async function POST(request: Request) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { supabase, role, userId, clientId } = auth;

  const limited = await enforceRateLimit({
    scope: "support.tickets.create",
    identifier: userId,
    limit: 20,
    windowSeconds: 60 * 60
  });
  if (limited) return limited;

  const body = (await request.json()) as {
    subject?: string;
    category?: string;
    message?: string;
    priority?: string;
    client_id?: string | null;
  };

  const subject = (body.subject || "").trim();
  const category = (body.category || "other").trim();
  const message = (body.message || "").trim();
  const priority = (body.priority || "normal").trim();

  if (!subject) return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (!["login", "billing", "contracts", "technical", "other"].includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!["low", "normal", "high", "urgent"].includes(priority)) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  let resolvedClientId = role === "client" ? clientId : body.client_id || null;
  if (!resolvedClientId) return NextResponse.json({ error: "client_id is required" }, { status: 400 });

  if (role === "coach") {
    const { data: clientRow } = await supabase.from("clients").select("id,coach_id").eq("id", resolvedClientId).maybeSingle();
    if (!clientRow || clientRow.coach_id !== userId) {
      return NextResponse.json({ error: "Coach can only create tickets for assigned clients" }, { status: 403 });
    }
  }

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      client_id: resolvedClientId,
      created_by: userId,
      subject,
      category,
      message,
      priority,
      status: "open",
      last_response_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("support_ticket_updates").insert({
    ticket_id: ticket.id,
    author_id: userId,
    message,
    status_to: "open"
  });

  await writeAuditLog({
    supabase,
    request,
    actorId: userId,
    action: "support.ticket_create",
    entityType: "support_ticket",
    entityId: ticket.id,
    metadata: { client_id: resolvedClientId, category, priority }
  });

  return NextResponse.json({ ticket });
}

