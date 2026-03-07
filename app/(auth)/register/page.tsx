import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="card max-w-md space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Invite Only</p>
      <h1 className="text-2xl font-bold text-slate-900">Registration Disabled</h1>
      <p className="text-sm text-slate-600">New accounts are created by admin/coach invites only.</p>
      <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">
        Back to Login
      </Link>
    </div>
  );
}
