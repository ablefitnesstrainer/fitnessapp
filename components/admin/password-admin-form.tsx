"use client";

import { useState } from "react";

export function PasswordAdminForm() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (newPassword.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/admin/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, new_password: newPassword })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to set password");
      setLoading(false);
      return;
    }

    setStatus("Password updated.");
    setNewPassword("");
    setLoading(false);
  };

  return (
    <form className="card max-w-xl space-y-4" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold">Admin Password Reset</h2>
      <p className="text-sm text-slate-600">Set a new password for any user by email.</p>
      <div>
        <label className="label">User email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="label">New password</label>
        <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
      </div>
      {status && <p className="text-sm text-slate-700">{status}</p>}
      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? "Updating..." : "Set password"}
      </button>
    </form>
  );
}
