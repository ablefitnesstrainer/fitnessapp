import { BrandLogo } from "@/components/brand-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(96,165,250,0.32),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(34,197,94,0.2),transparent_36%),linear-gradient(180deg,#f7fbff_0%,#edf4ff_100%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/40 lg:grid-cols-[1.1fr_1fr]">
        <div className="hidden bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-700 p-10 text-white lg:block">
          <BrandLogo size={64} className="border border-white/30 bg-black/30 p-1.5 shadow-md shadow-black/30" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Able Fitness</p>
          <h1 className="mt-5 text-4xl font-bold leading-tight">Coach better. Track faster. Retain longer.</h1>
          <p className="mt-4 text-sm leading-relaxed text-blue-100">
            Manage programming, nutrition, and client communication from one focused workspace.
          </p>
          <div className="mt-8 space-y-3 text-sm text-blue-100">
            <p>Program templates and progression logic</p>
            <p>Workout, macro, and adherence analytics</p>
            <p>Integrated weekly check-ins and messaging</p>
          </div>
        </div>
        <div className="bg-white p-6 sm:p-10">{children}</div>
      </div>
    </div>
  );
}
