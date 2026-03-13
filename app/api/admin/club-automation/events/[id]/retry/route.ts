import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/audit-log";
import { requireRecentAuth } from "@/lib/session-security";
import { sendClubWelcomeEmail } from "@/lib/welcome-email";

async function authorizeAdmin(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser } = await supabase.from("app_users").select("id,role").eq("id", user.id).single();
  if (!appUser || appUser.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { userId: user.id };
}

async function regenerateMagicLink(email: string) {
  const admin = createAdminClient();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const redirectTo = appUrl ? `${appUrl}/auth/callback?next=/dashboard` : undefined;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo }
  });
  if (error) throw new Error(error.message);

  const actionLink =
    (data as { properties?: { action_link?: string } }).properties?.action_link ||
    (data as { action_link?: string }).action_link ||
    "";
  if (!actionLink) throw new Error("No magic link returned");
  return actionLink;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const reauth = requireRecentAuth(request);
  if (reauth) return reauth;

  const supabase = createClient();
  const auth = await authorizeAdmin(supabase);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as { action?: "email" | "assignment" };
  const action = body.action || "email";

  const admin = createAdminClient();
  const { data: eventRow, error: eventError } = await admin.from("club_member_events").select("*").eq("id", params.id).single();
  if (eventError || !eventRow) return NextResponse.json({ error: eventError?.message || "Event not found" }, { status: 404 });

  const payload = (eventRow.payload || {}) as Record<string, unknown>;

  try {
    if (action === "email") {
      const email = String(payload.email || "").trim().toLowerCase();
      if (!email) return NextResponse.json({ error: "Event missing email payload" }, { status: 400 });
      const fullName = typeof payload.full_name === "string" ? payload.full_name : null;
      const challengeName = typeof payload.challenge_name === "string" ? payload.challenge_name : null;
      const existingUser = Boolean(payload.existing_user);
      const magicLink = await regenerateMagicLink(email);

      await sendClubWelcomeEmail({
        toEmail: email,
        fullName,
        magicLink,
        challengeName,
        existingUser
      });
    } else {
      if (!eventRow.client_id || !eventRow.challenge_id) {
        return NextResponse.json({ error: "Event missing client/challenge assignment context" }, { status: 400 });
      }

      const { error: enrollError } = await admin.from("challenge_enrollments").upsert(
        {
          challenge_id: eventRow.challenge_id,
          client_id: eventRow.client_id,
          enrolled_by: eventRow.app_user_id || auth.userId
        },
        { onConflict: "challenge_id,client_id" }
      );
      if (enrollError) throw new Error(enrollError.message);

      if (eventRow.template_id) {
        const { data: mapRow } = await admin
          .from("challenge_program_assignments")
          .select("start_on")
          .eq("challenge_id", eventRow.challenge_id)
          .maybeSingle();

        const { error: assignmentError } = await admin.from("program_assignments").upsert(
          {
            client_id: eventRow.client_id,
            template_id: eventRow.template_id,
            start_week: 1,
            current_week_number: 1,
            current_day_number: 1,
            start_on: mapRow?.start_on || new Date().toISOString().slice(0, 10),
            active: true
          },
          { onConflict: "client_id,template_id" }
        );
        if (assignmentError) throw new Error(assignmentError.message);
      }
    }

    const nextRetryCount = (eventRow.retry_count || 0) + 1;
    await admin
      .from("club_member_events")
      .update({
        status: "processed",
        retry_count: nextRetryCount,
        last_error: null,
        notes: action === "email" ? "Manual email retry succeeded" : "Manual assignment retry succeeded",
        processed_at: new Date().toISOString()
      })
      .eq("id", eventRow.id);

    await writeAuditLog({
      supabase,
      request,
      actorId: auth.userId,
      action: action === "email" ? "club.retry_welcome_email" : "club.retry_assignment",
      entityType: "club_member_event",
      entityId: eventRow.id,
      metadata: { target_event_id: eventRow.id }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retry failed";
    await admin
      .from("club_member_events")
      .update({
        status: "failed",
        retry_count: (eventRow.retry_count || 0) + 1,
        last_error: message,
        notes: action === "email" ? "Manual email retry failed" : "Manual assignment retry failed",
        processed_at: new Date().toISOString()
      })
      .eq("id", eventRow.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
