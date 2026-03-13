import { ClubAutomationPanel } from "@/components/admin/club-automation-panel";
import { getCurrentAppUser } from "@/services/auth-service";

export default async function ClubAutomationPage() {
  const appUser = await getCurrentAppUser();

  if (appUser.role !== "admin") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Club Automation</h1>
        <p className="text-sm text-red-600">Admin access required.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Club Automation</h1>
      <ClubAutomationPanel />
    </section>
  );
}
