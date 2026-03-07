import { createClient } from "@/lib/supabase-server";
import { getCurrentAppUser, getCurrentClientProfile } from "@/services/auth-service";

export async function getDashboardData() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  if (appUser.role === "client") {
    const client = await getCurrentClientProfile();
    if (!client) {
      return { workoutLogs: [], mealLogs: [], checkins: [] };
    }

    const [workoutLogsRes, mealLogsRes, checkinsRes] = await Promise.all([
      supabase.from("workout_logs").select("id,completed_at,total_volume").eq("client_id", client.id).order("completed_at", { ascending: true }),
      supabase.from("meal_logs").select("id,created_at,calories,protein,carbs,fat").eq("client_id", client.id).order("created_at", { ascending: true }),
      supabase.from("checkins").select("id,created_at,energy,sleep,stress,adherence").eq("client_id", client.id).order("created_at", { ascending: true })
    ]);

    if (workoutLogsRes.error) throw workoutLogsRes.error;
    if (mealLogsRes.error) throw mealLogsRes.error;
    if (checkinsRes.error) throw checkinsRes.error;

    return {
      workoutLogs: workoutLogsRes.data,
      mealLogs: mealLogsRes.data,
      checkins: checkinsRes.data
    };
  }

  const [clientsRes, templatesRes, checkinsRes] = await Promise.all([
    supabase.from("app_users").select("id", { count: "exact", head: true }).eq("role", "client"),
    supabase.from("program_templates").select("id", { count: "exact", head: true }),
    supabase.from("checkins").select("id,created_at,adherence").order("created_at", { ascending: true }).limit(100)
  ]);

  if (clientsRes.error) throw clientsRes.error;
  if (templatesRes.error) throw templatesRes.error;
  if (checkinsRes.error) throw checkinsRes.error;

  return {
    counts: {
      clients: clientsRes.count ?? 0,
      templates: templatesRes.count ?? 0
    },
    checkins: checkinsRes.data
  };
}
