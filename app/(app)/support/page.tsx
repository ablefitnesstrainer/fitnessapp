import { getCurrentAppUser } from "@/services/auth-service";
import { SupportCenter } from "@/components/support/support-center";

export default async function SupportPage() {
  const appUser = await getCurrentAppUser();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Support</h1>
      <p className="text-sm text-slate-600">Submit support requests and track status updates for login, billing, contracts, and technical issues.</p>
      <SupportCenter role={appUser.role} />
    </section>
  );
}

