import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export type CommunityAuthContext = {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  role: "admin" | "coach" | "client";
  clientId: string | null;
};

export async function authorizeCommunityAccess(options?: { requireCoachOrAdmin?: boolean }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser, error: appUserError } = await supabase.from("app_users").select("id,role").eq("id", user.id).single();
  if (appUserError || !appUser) return { error: NextResponse.json({ error: appUserError?.message || "Unauthorized" }, { status: 401 }) };

  const role = appUser.role as "admin" | "coach" | "client";
  if (options?.requireCoachOrAdmin && role === "client") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  let clientId: string | null = null;
  const { data: client } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
  if (client?.id) clientId = client.id;

  return { context: { supabase, userId: user.id, role, clientId } as CommunityAuthContext };
}
