import { OpsHealthPanel } from "@/components/admin/ops-health-panel";
import { getCurrentAppUser } from "@/services/auth-service";

export default async function AdminOpsHealthPage() {
  const appUser = await getCurrentAppUser();

  if (appUser.role !== "admin") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Ops Health</h1>
        <p className="text-sm text-red-600">Admin access required.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Ops Health</h1>
      <p className="text-sm text-slate-600">Operational health for billing webhooks, provisioning alerts, support queue, and security ops cadence.</p>
      <OpsHealthPanel />
    </section>
  );
}
