import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Legal</p>
        <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
        <p className="text-sm text-slate-600">Effective date: March 10, 2026</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Use of the App</h2>
        <p>
          This app is provided for fitness coaching, accountability, and progress tracking. You agree to use the platform only
          for lawful purposes and to keep your login credentials secure.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">No Medical Advice</h2>
        <p>
          Content and coaching guidance in this app are educational only and are not medical advice. You should consult a
          licensed physician before starting or changing exercise or nutrition programs.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Assumption of Risk</h2>
        <p>
          Exercise and nutrition changes involve risk. By using this app, you voluntarily assume responsibility for your actions,
          decisions, and outcomes related to training and nutrition.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">User Content</h2>
        <p>
          You retain ownership of the data and files you submit, but you grant permission to store and process that data as needed
          to deliver coaching services and app functionality.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Account Access and Termination</h2>
        <p>
          Access may be suspended or terminated for abuse, unauthorized use, or security concerns. Coaches/admins may remove
          client access in accordance with coaching relationship terms.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, the app owners and coaches are not liable for indirect, incidental, or
          consequential damages arising from use of the platform.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Changes to Terms</h2>
        <p>
          These terms may be updated from time to time. Continued use of the app after updates means you accept the revised terms.
        </p>
      </section>

      <div className="text-sm">
        <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">
          Back to login
        </Link>
      </div>
    </main>
  );
}
