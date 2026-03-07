import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="space-y-4">
      <AuthForm mode="login" />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <Link href="/forgot-password" className="font-semibold text-blue-700 hover:text-blue-800">
          Forgot password?
        </Link>
        <p className="text-slate-500">Account access is invite-only.</p>
      </div>
    </div>
  );
}
