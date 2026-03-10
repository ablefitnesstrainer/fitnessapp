import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import {
  clearFailedLoginAttempts,
  enforceRateLimit,
  getLoginLockoutState,
  getRequestIp,
  recordFailedLoginAttempt,
  rateLimitExceededResponse
} from "@/lib/security-controls";
import { createClient } from "@/lib/supabase-server";
import { writeAuditLog } from "@/lib/audit-log";

type LoginBody = {
  email: string;
  password: string;
};

export async function POST(request: NextRequest) {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return NextResponse.json({ error: "Server auth is not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as LoginBody | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const ipLimit = await enforceRateLimit({
    scope: "auth.login.ip",
    identifier: ip,
    limit: 50,
    windowSeconds: 10 * 60
  });
  if (ipLimit) return ipLimit;

  const emailLimit = await enforceRateLimit({
    scope: "auth.login.email",
    identifier: email,
    limit: 20,
    windowSeconds: 10 * 60
  });
  if (emailLimit) return emailLimit;

  const lockoutState = await getLoginLockoutState(email);
  if (lockoutState.locked) {
    return rateLimitExceededResponse(lockoutState.retryAfterSeconds, "Account temporarily locked. Please try again shortly.");
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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const failed = await recordFailedLoginAttempt(email);
    if (failed.locked) {
      return rateLimitExceededResponse(
        failed.retryAfterSeconds,
        "Too many failed attempts. Account temporarily locked."
      );
    }
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await clearFailedLoginAttempts(email);

  try {
    const appSupabase = createClient();
    await writeAuditLog({
      supabase: appSupabase,
      request,
      actorId: data.user.id,
      action: "auth.login_success",
      entityType: "user",
      entityId: data.user.id,
      metadata: { method: "password" }
    });
  } catch {
    // Do not block login.
  }

  return response;
}
