import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="space-y-4">
      <ResetPasswordForm />
      <p className="text-center text-sm text-slate-600">
        Back to <Link href="/login" className="text-brand-600">Login</Link>
      </p>
    </div>
  );
}
