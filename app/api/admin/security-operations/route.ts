import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { requireRecentAuth } from "@/lib/session-security";
import { writeAuditLog } from "@/lib/audit-log";

const settingsKeys = [
  "key_rotation:last_completed_on",
  "key_rotation:next_due_on",
  "backup_restore:last_test_on",
  "backup_restore:next_test_on"
] as const;

async function authorizeAdmin(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser } = await supabase.from("app_users").select("id,role").eq("id", user.id).single();
  if (!appUser || appUser.role !== "admin") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { userId: user.id };
}

export async function GET() {
  const supabase = createClient();
  const auth = await authorizeAdmin(supabase);
  if ("error" in auth) return auth.error;

  const { data, error } = await supabase.from("security_settings").select("key,value").in("key", [...settingsKeys]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const byKey = new Map((data || []).map((row) => [row.key, row.value]));

  return NextResponse.json({
    keyRotation: {
      lastCompletedOn: (byKey.get("key_rotation:last_completed_on") as any)?.date || null,
      nextDueOn: (byKey.get("key_rotation:next_due_on") as any)?.date || null
    },
    backupRestore: {
      lastTestOn: (byKey.get("backup_restore:last_test_on") as any)?.date || null,
      nextTestOn: (byKey.get("backup_restore:next_test_on") as any)?.date || null
    }
  });
}

export async function PUT(request: Request) {
  const reauth = requireRecentAuth(request);
  if (reauth) return reauth;

  const supabase = createClient();
  const auth = await authorizeAdmin(supabase);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    keyRotationLastCompletedOn?: string | null;
    keyRotationNextDueOn?: string | null;
    backupRestoreLastTestOn?: string | null;
    backupRestoreNextTestOn?: string | null;
  };

  const upserts = [
    {
      key: "key_rotation:last_completed_on",
      value: { date: body.keyRotationLastCompletedOn || null },
      updated_by: auth.userId,
      updated_at: new Date().toISOString()
    },
    {
      key: "key_rotation:next_due_on",
      value: { date: body.keyRotationNextDueOn || null },
      updated_by: auth.userId,
      updated_at: new Date().toISOString()
    },
    {
      key: "backup_restore:last_test_on",
      value: { date: body.backupRestoreLastTestOn || null },
      updated_by: auth.userId,
      updated_at: new Date().toISOString()
    },
    {
      key: "backup_restore:next_test_on",
      value: { date: body.backupRestoreNextTestOn || null },
      updated_by: auth.userId,
      updated_at: new Date().toISOString()
    }
  ];

  const { error } = await supabase.from("security_settings").upsert(upserts, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    supabase,
    request,
    actorId: auth.userId,
    action: "security.operations_update",
    entityType: "security_settings",
    metadata: {
      keys: upserts.map((entry) => entry.key)
    }
  });

  return NextResponse.json({ ok: true });
}
