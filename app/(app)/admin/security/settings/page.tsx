import Link from "next/link";
import { getCurrentAppUser } from "@/services/auth-service";
import { SecuritySettingsForm } from "@/components/admin/security-settings-form";

export default async function AdminSecuritySettingsPage() {
  const appUser = await getCurrentAppUser();

  if (appUser.role !== "admin") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="text-sm text-red-600">Admin access required.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Security Settings</h1>
          <p className="text-sm text-slate-600">Manage lockout and abuse-protection thresholds without redeploying.</p>
        </div>
        <Link href="/admin/security" className="btn-secondary">
          Back to Security Log
        </Link>
      </div>
      <SecuritySettingsForm />
    </section>
  );
}
