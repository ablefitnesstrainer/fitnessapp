#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const [email] = process.argv.slice(2);

if (!email) {
  console.error("Usage: node scripts/generate-recovery-link.mjs <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or EXT_SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data, error } = await supabase.auth.admin.generateLink({
  type: "recovery",
  email,
  options: {
    redirectTo: "http://localhost:3000/auth/callback?next=/reset-password"
  }
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log("Open this URL in your browser:");
console.log(data.properties?.action_link || data.properties?.hashed_token || "No link returned");
