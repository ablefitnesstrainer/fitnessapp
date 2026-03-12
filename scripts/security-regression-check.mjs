import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(path, needle) {
  const content = read(path);
  assert(content.includes(needle), `${path} is missing expected string: ${needle}`);
}

function main() {
  assert(existsSync(resolve(root, "app/(app)/admin/security/page.tsx")), "Missing admin security page");
  assert(existsSync(resolve(root, "app/(app)/admin/security/settings/page.tsx")), "Missing admin security settings page");
  assert(existsSync(resolve(root, "app/(app)/settings/mfa/page.tsx")), "Missing MFA settings page");
  assert(existsSync(resolve(root, "app/api/auth/login/route.ts")), "Missing server-side login route");
  assert(existsSync(resolve(root, "app/api/auth/reauth/route.ts")), "Missing reauth API route");
  assert(existsSync(resolve(root, "app/api/contracts/route.ts")), "Missing contracts API route");
  assert(existsSync(resolve(root, "app/api/contracts/webhook/route.ts")), "Missing contracts webhook route");
  assert(existsSync(resolve(root, "app/api/admin/security-settings/route.ts")), "Missing security settings API route");
  assert(existsSync(resolve(root, "lib/security-controls.ts")), "Missing security controls helper");
  assert(existsSync(resolve(root, "supabase/migrations/0018_security_rate_limits_and_lockouts.sql")), "Missing security migration");
  assert(existsSync(resolve(root, "supabase/migrations/0019_security_settings.sql")), "Missing security settings migration");
  assert(existsSync(resolve(root, "supabase/migrations/0021_breezedoc_contracts.sql")), "Missing BreezeDoc contracts migration");

  assertIncludes("lib/supabase-middleware.ts", "Content-Security-Policy");
  assertIncludes("lib/supabase-middleware.ts", "Invalid request origin");
  assertIncludes("lib/supabase-middleware.ts", "/settings/mfa");

  assertIncludes("components/auth-form.tsx", "/api/auth/login");
  assertIncludes("app/api/messages/route.ts", "enforceRateLimit");
  assertIncludes("app/api/messages/upload/route.ts", "enforceRateLimit");
  assertIncludes("app/api/auth/reauth/route.ts", "auth.reauth");
  assertIncludes("app/api/admin/set-password/route.ts", "enforceRateLimit");
  assertIncludes("app/api/admin/set-password/route.ts", "requireRecentAuth");
  assertIncludes("app/api/exercises/import/route.ts", "enforceRateLimit");
  assertIncludes("app/api/admin/security-settings/route.ts", "security.settings_update");
  assertIncludes("app/api/admin/security-settings/route.ts", "requireRecentAuth");
  assertIncludes("app/api/contracts/route.ts", "contracts.send");
  assertIncludes("app/api/contracts/route.ts", "requireRecentAuth");
  assertIncludes("app/api/contracts/webhook/route.ts", "Invalid webhook signature");
  assertIncludes("app/api/clients/route.ts", "requireRecentAuth");
  assertIncludes("components/navigation.tsx", "/settings/mfa");

  console.log("Security regression check passed.");
}

main();
