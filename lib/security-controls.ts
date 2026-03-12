import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

type RateLimitInput = {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type LoginLockoutResult = {
  locked: boolean;
  retryAfterSeconds: number;
  failedAttempts: number;
};

type SecuritySettingRow = {
  key: string;
  value: Record<string, unknown>;
};

type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
};

type LockoutPolicy = {
  threshold: number;
  baseSeconds: number;
  maxSeconds: number;
};

const memoryRateLimits = new Map<string, { startedAtMs: number; hits: number }>();
const settingsCacheTtlMs = 60_000;
let cachedSettings: Map<string, Record<string, unknown>> | null = null;
let cachedSettingsAtMs = 0;

const defaultRateLimitPolicies: Record<string, RateLimitPolicy> = {
  "auth.login.ip": { limit: 50, windowSeconds: 10 * 60 },
  "auth.login.email": { limit: 20, windowSeconds: 10 * 60 },
  "auth.reauth": { limit: 20, windowSeconds: 10 * 60 },
  "messages.send": { limit: 120, windowSeconds: 60 },
  "messages.upload": { limit: 20, windowSeconds: 10 * 60 },
  "admin.set_password": { limit: 12, windowSeconds: 10 * 60 },
  "exercises.import_csv": { limit: 8, windowSeconds: 60 * 60 },
  "programs.generate": { limit: 60, windowSeconds: 60 * 60 },
  "contracts.send": { limit: 10, windowSeconds: 60 * 60 }
};

const defaultLockoutPolicy: LockoutPolicy = {
  threshold: 5,
  baseSeconds: 60,
  maxSeconds: 3600
};

function nowMs() {
  return Date.now();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function loadSettingsSnapshot(forceRefresh = false) {
  const currentMs = nowMs();
  if (!forceRefresh && cachedSettings && currentMs - cachedSettingsAtMs < settingsCacheTtlMs) {
    return cachedSettings;
  }

  const next = new Map<string, Record<string, unknown>>();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("security_settings").select("key,value");
    if (!error) {
      (data as SecuritySettingRow[] | null)?.forEach((row) => {
        if (row?.key && row?.value && typeof row.value === "object") {
          next.set(row.key, row.value);
        }
      });
    }
  } catch {
    // Keep defaults when unavailable.
  }

  cachedSettings = next;
  cachedSettingsAtMs = currentMs;
  return next;
}

export async function getRateLimitPolicy(scope: string, fallback?: RateLimitPolicy): Promise<RateLimitPolicy> {
  const defaultPolicy = fallback || defaultRateLimitPolicies[scope] || { limit: 60, windowSeconds: 60 };
  const settings = await loadSettingsSnapshot();
  const raw = settings.get(`rate_limit:${scope}`);
  if (!raw) return defaultPolicy;

  return {
    limit: parsePositiveInt(raw.limit, defaultPolicy.limit),
    windowSeconds: parsePositiveInt(raw.window_seconds, defaultPolicy.windowSeconds)
  };
}

async function getLoginLockoutPolicy(): Promise<LockoutPolicy> {
  const settings = await loadSettingsSnapshot();
  const raw = settings.get("lockout:login");
  if (!raw) return defaultLockoutPolicy;

  return {
    threshold: parsePositiveInt(raw.threshold, defaultLockoutPolicy.threshold),
    baseSeconds: parsePositiveInt(raw.base_seconds, defaultLockoutPolicy.baseSeconds),
    maxSeconds: parsePositiveInt(raw.max_seconds, defaultLockoutPolicy.maxSeconds)
  };
}

export async function getSecuritySettingsForAdmin() {
  const settings = await loadSettingsSnapshot(true);

  const rateLimits: Record<string, RateLimitPolicy> = {};
  for (const [scope, policy] of Object.entries(defaultRateLimitPolicies)) {
    const raw = settings.get(`rate_limit:${scope}`);
    rateLimits[scope] = {
      limit: parsePositiveInt(raw?.limit, policy.limit),
      windowSeconds: parsePositiveInt(raw?.window_seconds, policy.windowSeconds)
    };
  }

  const rawLockout = settings.get("lockout:login");
  const lockoutPolicy: LockoutPolicy = {
    threshold: parsePositiveInt(rawLockout?.threshold, defaultLockoutPolicy.threshold),
    baseSeconds: parsePositiveInt(rawLockout?.base_seconds, defaultLockoutPolicy.baseSeconds),
    maxSeconds: parsePositiveInt(rawLockout?.max_seconds, defaultLockoutPolicy.maxSeconds)
  };

  return { rateLimits, lockoutPolicy };
}

export async function refreshSecuritySettingsCache() {
  await loadSettingsSnapshot(true);
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function consumeRateLimitInMemory(input: RateLimitInput): RateLimitResult {
  const key = `${input.scope}:${input.identifier}`;
  const entry = memoryRateLimits.get(key);
  const currentMs = nowMs();
  const windowMs = input.windowSeconds * 1000;

  if (!entry || currentMs - entry.startedAtMs >= windowMs) {
    memoryRateLimits.set(key, { startedAtMs: currentMs, hits: 1 });
    return { allowed: true, remaining: Math.max(0, input.limit - 1), retryAfterSeconds: 0 };
  }

  const nextHits = entry.hits + 1;
  entry.hits = nextHits;
  memoryRateLimits.set(key, entry);

  if (nextHits <= input.limit) {
    return { allowed: true, remaining: Math.max(0, input.limit - nextHits), retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (currentMs - entry.startedAtMs)) / 1000));
  return { allowed: false, remaining: 0, retryAfterSeconds };
}

export async function consumeRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_scope: input.scope,
      p_identifier: input.identifier,
      p_limit: input.limit,
      p_window_seconds: input.windowSeconds
    });

    if (!error && Array.isArray(data) && data[0]) {
      return {
        allowed: Boolean(data[0].allowed),
        remaining: Number(data[0].remaining || 0),
        retryAfterSeconds: Number(data[0].retry_after_seconds || 0)
      };
    }
  } catch {
    // Fall through to memory fallback.
  }

  return consumeRateLimitInMemory(input);
}

export function rateLimitExceededResponse(retryAfterSeconds: number, message = "Too many requests") {
  const response = NextResponse.json({ error: message, retry_after_seconds: retryAfterSeconds }, { status: 429 });
  response.headers.set("Retry-After", String(Math.max(1, retryAfterSeconds)));
  return response;
}

export async function enforceRateLimit(input: RateLimitInput) {
  const policy = await getRateLimitPolicy(input.scope, { limit: input.limit, windowSeconds: input.windowSeconds });
  const result = await consumeRateLimit({
    ...input,
    limit: policy.limit,
    windowSeconds: policy.windowSeconds
  });
  if (result.allowed) return null;
  return rateLimitExceededResponse(result.retryAfterSeconds);
}

export async function getLoginLockoutState(email: string): Promise<LoginLockoutResult> {
  const normalizedEmail = normalizeEmail(email);
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("login_lockouts").select("failed_attempts,locked_until").eq("email", normalizedEmail).maybeSingle();
    if (!data?.locked_until) {
      return { locked: false, retryAfterSeconds: 0, failedAttempts: data?.failed_attempts || 0 };
    }

    const retryAfterMs = new Date(data.locked_until).getTime() - nowMs();
    if (retryAfterMs <= 0) {
      return { locked: false, retryAfterSeconds: 0, failedAttempts: data.failed_attempts || 0 };
    }

    return {
      locked: true,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      failedAttempts: data.failed_attempts || 0
    };
  } catch {
    return { locked: false, retryAfterSeconds: 0, failedAttempts: 0 };
  }
}

export async function recordFailedLoginAttempt(email: string): Promise<LoginLockoutResult> {
  const normalizedEmail = normalizeEmail(email);
  const policy = await getLoginLockoutPolicy();

  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("login_lockouts")
      .select("failed_attempts")
      .eq("email", normalizedEmail)
      .maybeSingle();

    const failedAttempts = (existing?.failed_attempts || 0) + 1;
    const nowIso = new Date().toISOString();
    let lockedUntil: string | null = null;
    let retryAfterSeconds = 0;

    if (failedAttempts >= policy.threshold) {
      const lockSeconds = Math.min(policy.maxSeconds, policy.baseSeconds * 2 ** (failedAttempts - policy.threshold));
      retryAfterSeconds = lockSeconds;
      lockedUntil = new Date(nowMs() + lockSeconds * 1000).toISOString();
    }

    await admin.from("login_lockouts").upsert({
      email: normalizedEmail,
      failed_attempts: failedAttempts,
      locked_until: lockedUntil,
      last_failed_at: nowIso,
      updated_at: nowIso
    });

    return {
      locked: Boolean(lockedUntil),
      retryAfterSeconds,
      failedAttempts
    };
  } catch {
    return { locked: false, retryAfterSeconds: 0, failedAttempts: 0 };
  }
}

export async function clearFailedLoginAttempts(email: string) {
  const normalizedEmail = normalizeEmail(email);
  try {
    const admin = createAdminClient();
    await admin.from("login_lockouts").delete().eq("email", normalizedEmail);
  } catch {
    // No-op.
  }
}
