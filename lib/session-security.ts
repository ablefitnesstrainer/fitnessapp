import { NextResponse } from "next/server";

export const AUTH_AT_COOKIE = "af_last_auth_at";
export const LAST_SEEN_AT_COOKIE = "af_last_seen_at";
export const MFA_TRUSTED_UNTIL_COOKIE = "af_mfa_trusted_until";

export function getIdleTimeoutMinutes() {
  const value = Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES || 30);
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.floor(value);
}

export function getSensitiveActionReauthMinutes() {
  const value = Number(process.env.SENSITIVE_ACTION_REAUTH_MINUTES || 15);
  if (!Number.isFinite(value) || value <= 0) return 15;
  return Math.floor(value);
}

export function getMfaTrustDays() {
  const value = Number(process.env.MFA_TRUST_DAYS || 14);
  if (!Number.isFinite(value) || value <= 0) return 14;
  return Math.floor(value);
}

export function nowIso() {
  return new Date().toISOString();
}

export function parseCookiesFromHeader(cookieHeader: string | null) {
  const output = new Map<string, string>();
  if (!cookieHeader) return output;
  const pairs = cookieHeader.split(";");
  for (const rawPair of pairs) {
    const pair = rawPair.trim();
    if (!pair) continue;
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    output.set(key, decodeURIComponent(value));
  }
  return output;
}

function toMs(value: string | null | undefined) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  return ts;
}

export function isSessionIdle(lastSeenAt: string | null | undefined, idleTimeoutMinutes: number) {
  const ts = toMs(lastSeenAt);
  if (!ts) return false;
  const idleMs = Math.max(1, idleTimeoutMinutes) * 60_000;
  return Date.now() - ts > idleMs;
}

export function isRecentAuthValid(lastAuthAt: string | null | undefined, reauthMinutes: number) {
  const ts = toMs(lastAuthAt);
  if (!ts) return false;
  const windowMs = Math.max(1, reauthMinutes) * 60_000;
  return Date.now() - ts <= windowMs;
}

export function applySessionSecurityCookies(response: NextResponse) {
  const iso = nowIso();
  response.cookies.set(AUTH_AT_COOKIE, iso, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  response.cookies.set(LAST_SEEN_AT_COOKIE, iso, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

export function touchLastSeenCookie(response: NextResponse) {
  response.cookies.set(LAST_SEEN_AT_COOKIE, nowIso(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

export function clearSessionSecurityCookies(response: NextResponse) {
  response.cookies.set(AUTH_AT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  response.cookies.set(LAST_SEEN_AT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  response.cookies.set(MFA_TRUSTED_UNTIL_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export function requireRecentAuth(request: Request, reauthMinutes = getSensitiveActionReauthMinutes()) {
  const cookies = parseCookiesFromHeader(request.headers.get("cookie"));
  const lastAuthAt = cookies.get(AUTH_AT_COOKIE) || null;
  if (isRecentAuthValid(lastAuthAt, reauthMinutes)) return null;

  return NextResponse.json(
    {
      error: "Recent re-authentication required before this action",
      code: "reauth_required",
      reauth_window_minutes: reauthMinutes
    },
    { status: 401 }
  );
}
