import { PasswordChangeForm } from "@/components/password-change-form";

export default function PasswordSettingsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Security Settings</h1>
      <PasswordChangeForm />
    </section>
  );
}
