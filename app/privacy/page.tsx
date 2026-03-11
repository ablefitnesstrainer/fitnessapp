import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Legal</p>
        <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="text-sm text-slate-600">Effective date: March 10, 2026</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">What We Collect</h2>
        <p>
          We collect account data (name, email, role), coaching data (workouts, nutrition logs, habits, check-ins, messages),
          and files you upload (such as progress photos and attachments). We also store technical logs needed for security and
          operations.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">How We Use Data</h2>
        <p>
          Your data is used to deliver coaching services, track progress, provide messaging, support account security, and
          improve app reliability.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Storage and Security</h2>
        <p>
          Data is stored using Supabase/PostgreSQL infrastructure with role-based access controls and row-level security policies
          where configured. Sensitive files are stored in private buckets with signed access URLs.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Sharing</h2>
        <p>
          We do not sell personal data. Data may be shared with service providers required to run the app (hosting, database,
          e-signature) and when required by law.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Your Choices</h2>
        <p>
          You can request updates or deletion of personal profile data through your coach/admin. Some data may be retained for
          legal, billing, and security records.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
        <p>
          For privacy questions, contact your coach/admin through in-app messages. This policy may be updated periodically, and
          the effective date will be revised when changes are made.
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
