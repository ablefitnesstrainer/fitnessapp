import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { isBillingEnforced, isSubscriptionActive } from "@/lib/billing";
import {
  AUTH_AT_COOKIE,
  LAST_SEEN_AT_COOKIE,
  MFA_TRUSTED_UNTIL_COOKIE,
  clearSessionSecurityCookies,
  getIdleTimeoutMinutes,
  isSessionIdle,
  touchLastSeenCookie
} from "@/lib/session-security";

const allowPublicSignup = process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true";
const isMissingRelation = (code?: string) => code === "42P01" || code === "PGRST205";
const isMissingColumn = (code?: string) => code === "42703" || code === "PGRST204";
const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isMfaTrustValid(trustedUntil: string | null | undefined) {
  if (!trustedUntil) return false;
  const ts = new Date(trustedUntil).getTime();
  if (!Number.isFinite(ts)) return false;
  return ts > Date.now();
}

function withSecurityHeaders(request: NextRequest, response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com"
  ].join("; ");
  response.headers.set("Content-Security-Policy", csp);

  const isHttps = request.nextUrl.protocol === "https:";
  const isLocalHost = request.nextUrl.hostname === "localhost" || request.nextUrl.hostname === "127.0.0.1";
  if (isHttps && !isLocalHost) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  return response;
}

function sameOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;

  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const expectedOrigin = `${proto}://${host}`;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin) {
    return origin === expectedOrigin;
  }

  if (referer) {
    return referer === expectedOrigin || referer.startsWith(`${expectedOrigin}/`);
  }

  return false;
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const isApiRequest = pathname.startsWith("/api/");
  if (isApiRequest && mutatingMethods.has(request.method) && hasSupabaseAuthCookie(request) && !sameOrigin(request)) {
    return withSecurityHeaders(request, NextResponse.json({ error: "Invalid request origin" }, { status: 403 }));
  }

  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return withSecurityHeaders(request, supabaseResponse);
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          supabaseResponse.cookies.set(name, value, options);
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const isStaticAsset = pathname.startsWith("/_next") || pathname === "/favicon.ico" || /\.[a-zA-Z0-9]+$/.test(pathname);
  if (isStaticAsset) {
    return withSecurityHeaders(request, supabaseResponse);
  }
  const isPublicAuthPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/finish");

  if (!allowPublicSignup && pathname.startsWith("/register")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return withSecurityHeaders(request, NextResponse.redirect(redirectUrl));
  }

  if (!user && !isPublicAuthPath) {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(request, supabaseResponse);
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return withSecurityHeaders(request, NextResponse.redirect(redirectUrl));
  }

  const isLoginOrRegister = pathname.startsWith("/login") || pathname.startsWith("/register");
  if (user && isLoginOrRegister) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return withSecurityHeaders(request, NextResponse.redirect(redirectUrl));
  }

  const isPageRequest = !pathname.startsWith("/api") && !isPublicAuthPath;
  if (user && isPageRequest) {
    const appUserResult = await supabase
      .from("app_users")
      .select("id,role,subscription_status,stripe_customer_id,stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();
    const appUser =
      appUserResult.error && isMissingColumn(appUserResult.error.code)
        ? (await supabase.from("app_users").select("id,role").eq("id", user.id).maybeSingle()).data
        : appUserResult.data;
    touchLastSeenCookie(supabaseResponse);

    const isMfaPage = pathname.startsWith("/settings/mfa");
    const isBillingPage = pathname.startsWith("/settings/billing");
    const billingBypassPath =
      isBillingPage ||
      pathname.startsWith("/settings/profile") ||
      pathname.startsWith("/settings/password") ||
      pathname.startsWith("/settings/mfa");

    const subscriptionStatus =
      appUser && "subscription_status" in appUser ? (appUser as { subscription_status?: string | null }).subscription_status : null;
    const hasStripeBillingProfile = Boolean(
      appUser &&
        (("stripe_customer_id" in appUser && (appUser as { stripe_customer_id?: string | null }).stripe_customer_id) ||
          ("stripe_subscription_id" in appUser && (appUser as { stripe_subscription_id?: string | null }).stripe_subscription_id))
    );

    if (appUser?.role === "admin" || appUser?.role === "coach") {
      if (isBillingEnforced() && !billingBypassPath && !isSubscriptionActive(subscriptionStatus)) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/settings/billing";
        redirectUrl.searchParams.set("required", "1");
        return withSecurityHeaders(request, NextResponse.redirect(redirectUrl));
      }

      const lastSeenAt = request.cookies.get(LAST_SEEN_AT_COOKIE)?.value || null;
      const idleTimeoutMinutes = getIdleTimeoutMinutes();
      if (isSessionIdle(lastSeenAt, idleTimeoutMinutes)) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/login";
        redirectUrl.searchParams.set("reason", "session_timeout");
        const timeoutResponse = NextResponse.redirect(redirectUrl);
        clearSessionSecurityCookies(timeoutResponse);
        for (const cookie of request.cookies.getAll()) {
          if (cookie.name.startsWith("sb-")) {
            timeoutResponse.cookies.set(cookie.name, "", {
              maxAge: 0,
              path: "/",
              httpOnly: true,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production"
            });
          }
        }
        return withSecurityHeaders(request, timeoutResponse);
      }

      try {
        const [{ data: factorsData }, { data: aalData }] = await Promise.all([
          supabase.auth.mfa.listFactors(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        ]);

        const totpFactors = factorsData?.totp || [];
        const hasVerifiedFactor = totpFactors.some((factor) => factor.status === "verified");
        const currentLevel = aalData?.currentLevel;
        const mfaTrustUntil = request.cookies.get(MFA_TRUSTED_UNTIL_COOKIE)?.value || null;
        const trustedDevice = isMfaTrustValid(mfaTrustUntil);

        if (!hasVerifiedFactor && !isMfaPage) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = "/settings/mfa";
          redirectUrl.searchParams.set("required", "enroll");
          redirectUrl.searchParams.set("next", pathname);
          return withSecurityHeaders(request, NextResponse.redirect(redirectUrl));
        }

        if (hasVerifiedFactor && currentLevel !== "aal2" && !isMfaPage && !trustedDevice) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = "/settings/mfa";
          redirectUrl.searchParams.set("required", "verify");
          redirectUrl.searchParams.set("next", pathname);
          return withSecurityHeaders(request, NextResponse.redirect(redirectUrl));
        }
      } catch {
        // If provider MFA methods are temporarily unavailable, avoid blocking all app access.
      }
    }

    if (appUser?.role === "client") {
      if (isBillingEnforced() && hasStripeBillingProfile && !billingBypassPath && !isSubscriptionActive(subscriptionStatus)) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/settings/billing";
        redirectUrl.searchParams.set("required", "1");
        return withSecurityHeaders(request, NextResponse.redirect(redirectUrl));
      }

      const { data: clientRow } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
      if (clientRow?.id) {
        const { data: intakeRow, error: intakeError } = await supabase.from("client_intakes").select("id").eq("client_id", clientRow.id).maybeSingle();
        const intakeCompleted = isMissingRelation(intakeError?.code) ? true : Boolean(intakeRow?.id);

        if (!intakeCompleted && !pathname.startsWith("/checkins")) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = "/checkins";
          redirectUrl.searchParams.set("required", "intake");
          return withSecurityHeaders(request, NextResponse.redirect(redirectUrl));
        }
      }
    }
  }

  if (user) {
    if (!request.cookies.get(AUTH_AT_COOKIE)?.value) {
      supabaseResponse.cookies.set(AUTH_AT_COOKIE, new Date().toISOString(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/"
      });
    }
    touchLastSeenCookie(supabaseResponse);
  }

  return withSecurityHeaders(request, supabaseResponse);
}
