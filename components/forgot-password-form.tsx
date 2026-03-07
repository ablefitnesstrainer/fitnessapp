"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setStatus("Reset link sent. Check your email.");
    setLoading(false);
  };

  return (
    <form className="card w-full max-w-md space-y-4" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">Forgot Password</h1>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {status && <p className="text-sm text-slate-700">{status}</p>}
      <button className="btn-primary w-full" type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
