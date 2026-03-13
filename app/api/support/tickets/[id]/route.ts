import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { writeAuditLog } from "@/lib/audit-log";

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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { supabase, role, userId, clientId } = auth;

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (ticketError) return NextResponse.json({ error: ticketError.message }, { status: 400 });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  if (role === "client" && ticket.client_id !== clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (role === "coach") {
    const { data: owned } = await supabase.from("clients").select("id").eq("id", ticket.client_id).eq("coach_id", userId).maybeSingle();
    if (!owned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: updates, error: updatesError } = await supabase
    .from("support_ticket_updates")
    .select("id,ticket_id,author_id,message,status_to,created_at")
    .eq("ticket_id", params.id)
    .order("created_at", { ascending: true });
  if (updatesError) return NextResponse.json({ error: updatesError.message }, { status: 400 });

  const authorIds = Array.from(new Set((updates || []).map((row) => row.author_id).filter(Boolean)));
  const { data: users } = authorIds.length
    ? await supabase.from("app_users").select("id,email,full_name").in("id", authorIds)
    : { data: [] as any[] };
  const byId = new Map((users || []).map((user) => [user.id, user.full_name || user.email || user.id]));

  return NextResponse.json({
    ticket,
    updates: (updates || []).map((row) => ({ ...row, author_name: byId.get(row.author_id) || row.author_id }))
  });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { supabase, role, userId, clientId } = auth;

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (ticketError) return NextResponse.json({ error: ticketError.message }, { status: 400 });
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  if (role === "client" && ticket.client_id !== clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (role === "coach") {
    const { data: owned } = await supabase.from("clients").select("id").eq("id", ticket.client_id).eq("coach_id", userId).maybeSingle();
    if (!owned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    message?: string | null;
    status?: "open" | "in_progress" | "resolved" | "closed";
    assigned_to?: string | null;
    priority?: "low" | "normal" | "high" | "urgent";
  };

  const nextStatus = body.status && ["open", "in_progress", "resolved", "closed"].includes(body.status) ? body.status : null;
  const nextPriority = body.priority && ["low", "normal", "high", "urgent"].includes(body.priority) ? body.priority : null;
  const nextMessage = body.message?.trim() || null;

  if (!nextStatus && !nextPriority && !nextMessage && body.assigned_to === undefined) {
    return NextResponse.json({ error: "No changes submitted" }, { status: 400 });
  }

  if (role === "client" && (body.assigned_to !== undefined || nextPriority)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };
  if (nextStatus) updatePayload.status = nextStatus;
  if (nextPriority) updatePayload.priority = nextPriority;
  if (body.assigned_to !== undefined && role !== "client") updatePayload.assigned_to = body.assigned_to || null;
  if (nextMessage) updatePayload.last_response_at = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("support_tickets")
    .update(updatePayload)
    .eq("id", params.id)
    .select("*")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  if (nextMessage || nextStatus) {
    const { error: insertError } = await supabase.from("support_ticket_updates").insert({
      ticket_id: params.id,
      author_id: userId,
      message: nextMessage || (nextStatus ? `Status changed to ${nextStatus}` : "Ticket updated"),
      status_to: nextStatus
    });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  await writeAuditLog({
    supabase,
    request,
    actorId: userId,
    action: "support.ticket_update",
    entityType: "support_ticket",
    entityId: params.id,
    metadata: {
      status: nextStatus,
      priority: nextPriority,
      assigned_to: body.assigned_to ?? undefined,
      has_message: Boolean(nextMessage)
    }
  });

  return NextResponse.json({ ticket: updated });
}

