import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase-server";
import { writeAuditLog } from "@/lib/audit-log";
import { applySessionSecurityCookies } from "@/lib/session-security";
import { enforceRateLimit, getRequestIp } from "@/lib/security-controls";

type ReauthBody = {
  password: string;
};

export async function POST(request: NextRequest) {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit({
    scope: "auth.reauth",
    identifier: `${user.id}:${getRequestIp(request)}`,
    limit: 20,
    windowSeconds: 10 * 60
  });
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as ReauthBody | null;
  const password = body?.password?.trim();
  if (!password) return NextResponse.json({ error: "Password is required" }, { status: 400 });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password
  });
  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  applySessionSecurityCookies(response);

  try {
    const appSupabase = createClient();
    await writeAuditLog({
      supabase: appSupabase,
      request,
      actorId: data.user.id,
      action: "auth.reauth_success",
      entityType: "user",
      entityId: data.user.id,
      metadata: { method: "password" }
    });
  } catch {
    // Do not block response on audit failures.
  }

  return response;
}

