import { BillingTimelinePanel } from "@/components/admin/billing-timeline-panel";
import { getCurrentAppUser } from "@/services/auth-service";

export default async function AdminBillingPage() {
  const appUser = await getCurrentAppUser();

  if (appUser.role !== "admin") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Billing Timeline</h1>
        <p className="text-sm text-red-600">Admin access required.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Billing Timeline</h1>
      <p className="text-sm text-slate-600">Track Stripe sync status, provisioning events, and webhook processing health.</p>
      <BillingTimelinePanel />
    </section>
  );
}
