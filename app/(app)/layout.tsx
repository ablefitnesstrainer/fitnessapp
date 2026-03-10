import { Navigation } from "@/components/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentAppUser } from "@/services/auth-service";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const appUser = await getCurrentAppUser();
  const { count: unreadMessagesCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", appUser.id)
    .is("read_at", null);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  return (
    <div className="min-h-screen lg:flex">
      <Navigation role={appUser.role} unreadMessages={unreadMessagesCount || 0} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="page">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <BrandLogo size={40} />
              <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Performance Hub</p>
              <p className="text-sm font-semibold text-slate-900">Welcome back, {appUser.display_name}</p>
              <p className="text-sm font-medium text-slate-700">{today}</p>
              </div>
            </div>
            <SignOutButton />
          </header>
          {children}
          <footer className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
            Exercise and nutrition guidance in this app is educational and not medical advice.
            Consult a licensed physician before starting or changing any exercise or diet program.
            Participation is voluntary and users are responsible for their own decisions and outcomes.
          </footer>
        </div>
      </main>
    </div>
  );
}
