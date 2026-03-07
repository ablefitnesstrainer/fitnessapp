"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export function ProfileForm({ initialFullName, email }: { initialFullName: string; email: string }) {
  const [fullName, setFullName] = useState(initialFullName);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim()
      }
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setStatus("Profile updated. Refreshing...");
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  return (
    <form onSubmit={onSubmit} className="card max-w-xl space-y-4">
      <h2 className="text-xl font-bold">Profile</h2>
      <p className="text-sm text-slate-600">Update how your name appears in the app.</p>

      <div>
        <label className="label">Email</label>
        <input className="input" value={email} disabled />
      </div>

      <div>
        <label className="label">Full name</label>
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your name" required />
      </div>

      {status && <p className="text-sm text-slate-700">{status}</p>}

      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
