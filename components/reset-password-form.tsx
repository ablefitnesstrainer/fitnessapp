"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setStatus("Password updated. Redirecting to login...");
    setLoading(false);
    setTimeout(() => {
      router.push("/login");
    }, 1000);
  };

  return (
    <form className="card w-full max-w-md space-y-4" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">Reset Password</h1>
      <div>
        <label className="label">New password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div>
        <label className="label">Confirm new password</label>
        <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </div>
      {status && <p className="text-sm text-slate-700">{status}</p>}
      <button className="btn-primary w-full" type="submit" disabled={loading}>
        {loading ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
