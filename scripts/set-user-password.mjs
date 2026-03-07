#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const [email, newPassword] = process.argv.slice(2);

if (!email || !newPassword) {
  console.error("Usage: node scripts/set-user-password.mjs <email> <newPassword>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXT_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or EXT_SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error(listError.message);
  process.exit(1);
}

const user = usersData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user found for ${email}`);
  process.exit(1);
}

const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
  password: newPassword,
  email_confirm: true
});

if (updateError) {
  console.error(updateError.message);
  process.exit(1);
}

console.log(`Password updated for ${email}`);
