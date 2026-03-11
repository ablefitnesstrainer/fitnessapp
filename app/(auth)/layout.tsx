import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(96,165,250,0.32),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(34,197,94,0.2),transparent_36%),linear-gradient(180deg,#f7fbff_0%,#edf4ff_100%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/40 lg:grid-cols-[1.1fr_1fr]">
        <div className="hidden bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-700 p-10 text-white lg:block">
          <div className="mb-5 flex justify-center">
            <Image
              src="/able-logo-official.png"
              alt="Able Fitness"
              width={170}
              height={170}
              className="h-[170px] w-[170px] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
              priority
              unoptimized
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Able Fitness</p>
          <h1 className="mt-5 text-4xl font-bold leading-tight">Train smarter. Stay consistent. Keep progressing.</h1>
          <p className="mt-4 text-sm leading-relaxed text-blue-100">
            Log workouts, track nutrition, and complete weekly check-ins in one focused workspace.
          </p>
          <div className="mt-8 space-y-3 text-sm text-blue-100">
            <p>Simple daily workout and habit tracking</p>
            <p>Nutrition, recovery, and progress insights</p>
            <p>Weekly check-ins with direct coach messaging</p>
          </div>
        </div>
        <div className="bg-white p-6 sm:p-10">
          {children}
          <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/privacy" className="font-semibold text-slate-600 hover:text-slate-900">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link href="/terms" className="font-semibold text-slate-600 hover:text-slate-900">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
