"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export function ProfileForm({
  initialFullName,
  email,
  initialPhotoUrl
}: {
  initialFullName: string;
  email: string;
  initialPhotoUrl?: string | null;
}) {
  const [fullName, setFullName] = useState(initialFullName);
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl || "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const uploadPhoto = async () => {
    if (!photoFile) {
      setStatus("Select a profile photo first.");
      return;
    }

    setUploadingPhoto(true);
    setStatus(null);
    const formData = new FormData();
    formData.append("file", photoFile);

    const res = await fetch("/api/profile/photo", {
      method: "POST",
      body: formData
    });

    const payload = (await res.json().catch(() => null)) as { error?: string; photo_url?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Failed to upload profile photo.");
      setUploadingPhoto(false);
      return;
    }

    setPhotoUrl(payload?.photo_url || "");
    setPhotoFile(null);
    setStatus("Profile photo updated.");
    setUploadingPhoto(false);
  };

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

    const syncRes = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName.trim() })
    });

    if (!syncRes.ok) {
      const payload = await syncRes.json();
      setStatus(payload.error || "Profile saved in auth but failed to sync roster name.");
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

      <div className="space-y-2">
        <label className="label">Profile photo</label>
        <div className="flex flex-wrap items-center gap-3">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Profile"
              className="h-16 w-16 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-500">
              No photo
            </div>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            className="text-sm text-slate-700"
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void uploadPhoto()}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? "Uploading..." : "Upload Photo"}
          </button>
        </div>
        <p className="text-xs text-slate-500">JPG, PNG, or WEBP up to 5MB.</p>
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
