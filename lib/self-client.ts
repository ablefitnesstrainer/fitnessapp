import type { createClient } from "@/lib/supabase-server";

type SupabaseServerClient = ReturnType<typeof createClient>;

export async function ensureSelfClientProfile(params: {
  supabase: SupabaseServerClient;
  userId: string;
}) {
  const { supabase, userId } = params;

  const { data: existing } = await supabase.from("clients").select("id").eq("user_id", userId).maybeSingle();
  if (existing?.id) return existing.id;

  const { data: inserted, error } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      coach_id: userId,
      goal: "Personal training",
      equipment: "mixed"
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    throw new Error(error?.message || "Failed to create self client profile");
  }

  return inserted.id;
}
