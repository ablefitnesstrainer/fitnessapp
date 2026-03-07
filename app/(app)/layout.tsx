import { Navigation } from "@/components/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentAppUser } from "@/services/auth-service";
import { BrandLogo } from "@/components/brand-logo";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const appUser = await getCurrentAppUser();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  return (
    <div className="min-h-screen lg:flex">
      <Navigation />
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
        </div>
      </main>
    </div>
  );
}
