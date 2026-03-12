"use client";

import { useState } from "react";

export function ReauthForm() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setStatus("Enter your password.");
      return;
    }

    setLoading(true);
    setStatus(null);

    const res = await fetch("/api/auth/reauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;

    if (!res.ok) {
      setStatus(payload?.error || "Re-authentication failed");
      setLoading(false);
      return;
    }

    setPassword("");
    setStatus("Re-authentication confirmed for sensitive actions.");
    setLoading(false);
  };

  return (
    <form className="card max-w-xl space-y-3" onSubmit={onConfirm}>
      <h2 className="text-lg font-semibold">Confirm Identity</h2>
      <p className="text-sm text-slate-600">
        For sensitive actions (security settings, password resets, contract sending, client deletion), confirm your password.
      </p>
      <div>
        <label className="label">Current password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {status && <p className="text-sm text-slate-700">{status}</p>}
      <button className="btn-secondary" type="submit" disabled={loading}>
        {loading ? "Confirming..." : "Confirm Password"}
      </button>
    </form>
  );
}

