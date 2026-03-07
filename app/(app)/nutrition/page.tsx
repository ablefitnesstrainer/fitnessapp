import { NutritionTracker } from "@/components/nutrition/nutrition-tracker";
import { createClient } from "@/lib/supabase-server";
import { getCurrentAppUser, getCurrentClientProfile } from "@/services/auth-service";

export default async function NutritionPage() {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();

  if (appUser.role !== "client") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <p className="text-slate-700">Nutrition tracking is available in client accounts.</p>
      </section>
    );
  }

  const client = await getCurrentClientProfile();
  if (!client) {
    return <p className="text-sm text-red-600">Client profile not found.</p>;
  }

  const [{ data: target }, { data: meals, error: mealError }] = await Promise.all([
    supabase.from("nutrition_targets").select("calories,protein,carbs,fat").eq("client_id", client.id).maybeSingle(),
    supabase.from("meal_logs").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(50)
  ]);

  if (mealError) {
    throw mealError;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Nutrition Tracking</h1>
      <NutritionTracker clientId={client.id} target={target} initialMeals={meals || []} />
    </section>
  );
}
