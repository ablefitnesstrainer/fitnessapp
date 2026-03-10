import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { getSecuritySettingsForAdmin, refreshSecuritySettingsCache } from "@/lib/security-controls";
import { writeAuditLog } from "@/lib/audit-log";

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

  const settings = await getSecuritySettingsForAdmin();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const supabase = createClient();
  const auth = await authorizeAdmin(supabase);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    rateLimits?: Record<string, { limit: number; windowSeconds: number }>;
    lockoutPolicy?: { threshold: number; baseSeconds: number; maxSeconds: number };
  };

  const upserts: { key: string; value: Record<string, unknown>; updated_by: string; updated_at: string }[] = [];
  const nowIso = new Date().toISOString();

  if (body.rateLimits) {
    for (const [scope, policy] of Object.entries(body.rateLimits)) {
      upserts.push({
        key: `rate_limit:${scope}`,
        value: {
          limit: Math.max(1, Math.floor(policy.limit)),
          window_seconds: Math.max(1, Math.floor(policy.windowSeconds))
        },
        updated_by: auth.userId,
        updated_at: nowIso
      });
    }
  }

  if (body.lockoutPolicy) {
    upserts.push({
      key: "lockout:login",
      value: {
        threshold: Math.max(1, Math.floor(body.lockoutPolicy.threshold)),
        base_seconds: Math.max(1, Math.floor(body.lockoutPolicy.baseSeconds)),
        max_seconds: Math.max(1, Math.floor(body.lockoutPolicy.maxSeconds))
      },
      updated_by: auth.userId,
      updated_at: nowIso
    });
  }

  if (!upserts.length) {
    return NextResponse.json({ error: "No settings provided" }, { status: 400 });
  }

  const { error } = await supabase.from("security_settings").upsert(upserts, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await refreshSecuritySettingsCache();

  await writeAuditLog({
    supabase,
    request,
    actorId: auth.userId,
    action: "security.settings_update",
    entityType: "security_settings",
    metadata: { keys: upserts.map((entry) => entry.key) }
  });

  const settings = await getSecuritySettingsForAdmin();
  return NextResponse.json(settings);
}
