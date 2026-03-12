import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { writeAuditLog } from "@/lib/audit-log";
import { enforceRateLimit } from "@/lib/security-controls";
import { requireRecentAuth } from "@/lib/session-security";

export async function POST(request: Request) {
  const reauth = requireRecentAuth(request);
  if (reauth) return reauth;

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: appUser } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (!appUser || appUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await enforceRateLimit({
    scope: "admin.set_password",
    identifier: user.id,
    limit: 12,
    windowSeconds: 10 * 60
  });
  if (limited) return limited;

  const body = (await request.json()) as { email: string; new_password: string };
  if (!body.email || !body.new_password || body.new_password.length < 8) {
    return NextResponse.json({ error: "Email and password (8+ chars) are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: usersData, error: listError } = await admin.auth.admin.listUsers();
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 400 });
  }

  const targetUser = usersData.users.find((u) => u.email?.toLowerCase() === body.email.toLowerCase());
  if (!targetUser) {
    return NextResponse.json({ error: "Auth user not found" }, { status: 404 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(targetUser.id, {
    password: body.new_password,
    email_confirm: true
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await writeAuditLog({
    supabase,
    request,
    actorId: user.id,
    action: "admin.reset_password",
    entityType: "user",
    entityId: targetUser.id,
    metadata: { email: body.email.toLowerCase() }
  });

  return NextResponse.json({ ok: true });
}
