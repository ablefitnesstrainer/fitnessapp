import { createClient } from "@/lib/supabase-server";

export async function listExercises(filters?: { muscle?: string; equipment?: string }) {
  const supabase = createClient();
  let query = supabase.from("exercises").select("*").order("name");

  if (filters?.muscle) {
    query = query.eq("primary_muscle", filters.muscle);
  }

  if (filters?.equipment) {
    query = query.eq("equipment", filters.equipment);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data;
}
