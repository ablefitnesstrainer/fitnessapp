import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-4">
      <ForgotPasswordForm />
      <p className="text-center text-sm text-slate-600">
        Back to <Link href="/login" className="text-brand-600">Login</Link>
      </p>
    </div>
  );
}
