import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { assertEnv, env } from "@/lib/env";

export function createClient() {
  assertEnv();

  const cookieStore = cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        cookieStore.set({ name, value, ...(options || {}) });
      },
      remove(name: string, options: Record<string, unknown>) {
        cookieStore.set({ name, value: "", ...(options || {}), maxAge: 0 });
      }
    }
  });
}
