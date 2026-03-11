import { getCurrentAppUser } from "@/services/auth-service";
import { MfaSettingsForm } from "@/components/settings/mfa-settings-form";

export default async function MfaSettingsPage() {
  const appUser = await getCurrentAppUser();

  if (appUser.role !== "admin" && appUser.role !== "coach") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
        <p className="text-sm text-red-600">Two-factor authentication is currently required for coach/admin accounts only.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
      <MfaSettingsForm />
    </section>
  );
}

