"use client";

import { createBrowserClient } from "@supabase/ssr";
import { assertEnv, env } from "@/lib/env";

export function createClient() {
  assertEnv();
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
