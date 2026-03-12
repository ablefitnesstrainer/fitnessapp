import { getCurrentAppUser } from "@/services/auth-service";
import { ModerationQueue } from "@/components/community/moderation-queue";

export default async function CommunityModerationPage() {
  const appUser = await getCurrentAppUser();

  if (appUser.role !== "admin" && appUser.role !== "coach") {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Moderation Queue</h1>
        <p className="text-sm text-rose-600">Coach/admin access required.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="card bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Community</p>
        <h1 className="mt-2 text-3xl font-bold">Moderation Queue</h1>
        <p className="mt-2 text-sm text-blue-100">Review reports, hide abusive content, and resolve incidents.</p>
      </div>
      <ModerationQueue />
    </section>
  );
}
