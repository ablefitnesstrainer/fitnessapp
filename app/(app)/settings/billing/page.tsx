import { createClient } from "@/lib/supabase-server";
import { getCurrentAppUser } from "@/services/auth-service";
import { BillingSettingsForm } from "@/components/settings/billing-settings-form";

const isMissingColumn = (code?: string) => code === "42703" || code === "PGRST204";

export default async function BillingSettingsPage() {
  const appUser = await getCurrentAppUser();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("app_users")
    .select("role,subscription_status,subscription_price_id,subscription_current_period_end,billing_updated_at")
    .eq("id", appUser.id)
    .single();

  if (error && !isMissingColumn(error.code)) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-sm text-red-600">{error.message}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Billing</h1>
      <BillingSettingsForm
        initialState={{
          role: (data?.role || appUser.role) as "admin" | "coach" | "client",
          subscription_status: data?.subscription_status || "inactive",
          subscription_price_id: data?.subscription_price_id || null,
          subscription_current_period_end: data?.subscription_current_period_end || null,
          billing_updated_at: data?.billing_updated_at || null,
          stripe_configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID)
        }}
      />
    </section>
  );
}
