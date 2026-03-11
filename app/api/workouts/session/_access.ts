import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export type WorkoutAccessContext = {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  role: "admin" | "coach" | "client";
  clientId: string;
};

export async function authorizeByClientId(clientId: string) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: appUser, error: appUserError } = await supabase.from("app_users").select("role").eq("id", user.id).single();
  if (appUserError || !appUser) {
    return { error: NextResponse.json({ error: appUserError?.message || "Unauthorized" }, { status: 401 }) };
  }

  if (appUser.role === "client") {
    const { data: ownClient, error: ownClientError } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
    if (ownClientError || !ownClient || ownClient.id !== clientId) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { context: { supabase, userId: user.id, role: "client" as const, clientId } };
  }

  if (appUser.role === "coach") {
    const { data: client, error: clientError } = await supabase.from("clients").select("id,coach_id,user_id").eq("id", clientId).maybeSingle();
    if (clientError || !client) return { error: NextResponse.json({ error: clientError?.message || "Client not found" }, { status: 404 }) };
    if (client.coach_id !== user.id && client.user_id !== user.id) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
    return { context: { supabase, userId: user.id, role: "coach" as const, clientId } };
  }

  const { data: client, error: clientError } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (clientError || !client) return { error: NextResponse.json({ error: clientError?.message || "Client not found" }, { status: 404 }) };
  return { context: { supabase, userId: user.id, role: "admin" as const, clientId } };
}

export async function authorizeByLogId(logId: string) {
  const supabase = createClient();
  const { data: log, error: logError } = await supabase.from("workout_logs").select("id,client_id").eq("id", logId).maybeSingle();
  if (logError || !log) return { error: NextResponse.json({ error: logError?.message || "Workout session not found" }, { status: 404 }) };

  const auth = await authorizeByClientId(log.client_id);
  if ("error" in auth) return { error: auth.error };
  return { context: auth.context, log };
}
