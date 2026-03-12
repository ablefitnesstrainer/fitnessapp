import Link from "next/link";
import { getCurrentAppUser } from "@/services/auth-service";
import { SecurityOperationsPanel } from "@/components/admin/security-operations-panel";

export default async function SecurityOperationsPage() {
  const appUser = await getCurrentAppUser();

  if (appUser.role !== "admin") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Security Operations</h1>
        <p className="text-sm text-rose-600">Admin access required.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Security Operations</h1>
          <p className="text-sm text-slate-600">Quarterly key rotation and backup restore verification checklist.</p>
        </div>
        <Link href="/admin/security" className="btn-secondary">
          Back to Security Log
        </Link>
      </div>
      <SecurityOperationsPanel />
    </section>
  );
}
