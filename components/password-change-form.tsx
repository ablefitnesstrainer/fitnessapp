"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (newPassword.length < 8) {
      setStatus("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus("New passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setStatus("Unable to verify current user.");
      setLoading(false);
      return;
    }

    const signInCheck = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (signInCheck.error) {
      setStatus("Current password is incorrect.");
      setLoading(false);
      return;
    }

    const update = await supabase.auth.updateUser({ password: newPassword });

    if (update.error) {
      setStatus(update.error.message);
      setLoading(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setStatus("Password updated successfully.");
    setLoading(false);
  };

  return (
    <form className="card max-w-xl space-y-4" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold">Change Password</h2>
      <div>
        <label className="label">Current password</label>
        <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
      </div>
      <div>
        <label className="label">New password</label>
        <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
      </div>
      <div>
        <label className="label">Confirm new password</label>
        <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </div>

      {status && <p className="text-sm text-slate-700">{status}</p>}

      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
