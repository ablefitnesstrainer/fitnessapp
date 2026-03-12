import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { getMfaTrustDays, MFA_TRUSTED_UNTIL_COOKIE } from "@/lib/session-security";

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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trustDays = getMfaTrustDays();
  const trustedUntil = new Date(Date.now() + trustDays * 24 * 60 * 60 * 1000).toISOString();

  response.cookies.set(MFA_TRUSTED_UNTIL_COOKIE, trustedUntil, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: trustDays * 24 * 60 * 60
  });

  return response;
}
