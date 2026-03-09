"use client";

import { useEffect, useState } from "react";

type Checkin = {
  id: string;
  created_at: string;
  workouts_completed: number;
  workouts_scheduled?: number | null;
  overall_week_rating?: number | null;
  nutrition_adherence_percent?: number | null;
  energy: number;
  hunger: number;
  sleep: number;
  stress: number;
  adherence: number;
  biggest_win?: string | null;
  biggest_challenge?: string | null;
  support_needed?: string | null;
  notes: string | null;
};

export function CheckinForm({ clientId, initialCheckins }: { clientId: string; initialCheckins: Checkin[] }) {
  const [checkins, setCheckins] = useState(initialCheckins);
  const [recentPhotos, setRecentPhotos] = useState<Array<{ id: string; photo_url: string; taken_at: string; caption?: string | null }>>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [form, setForm] = useState({
    workouts_completed: 0,
    workouts_scheduled: 4,
    overall_week_rating: 7,
    biggest_win: "",
    biggest_challenge: "",
    average_body_weight: "",
    progress_photos_uploaded: "no",
    cycle_status: "",
    energy: 7,
    hunger: 7,
    sleep: 7,
    stress: 4,
    nutrition_adherence_percent: 85,
    protein_goal_hit: true,
    hydration_goal_hit: true,
    digestion_notes: "",
    training_performance: "",
    recovery_status: "",
    confidence_next_week: 8,
    support_needed: "",
    notes: ""
  });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const loadPhotos = async () => {
      const res = await fetch(`/api/clients/progress?client_id=${encodeURIComponent(clientId)}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) return;
      setRecentPhotos((payload.photos || []).slice(0, 6));
    };
    void loadPhotos();
  }, [clientId]);

  const uploadProgressPhoto = async () => {
    if (!photoFile) {
      setStatus("Choose a progress photo first.");
      return;
    }

    setPhotoUploading(true);
    const formData = new FormData();
    formData.append("client_id", clientId);
    formData.append("file", photoFile);
    formData.append("taken_at", new Date().toISOString().slice(0, 10));
    formData.append("caption", "Client check-in upload");

    const res = await fetch("/api/clients/progress/upload", {
      method: "POST",
      body: formData
    });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to upload progress photo");
      setPhotoUploading(false);
      return;
    }

    setRecentPhotos((prev) => [payload.photo, ...prev].slice(0, 6));
    setPhotoFile(null);
    setForm((prev) => ({ ...prev, progress_photos_uploaded: "yes" }));
    setStatus("Progress photo uploaded.");
    setPhotoUploading(false);
  };

  const onSubmit = async () => {
    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        ...form,
        adherence: form.nutrition_adherence_percent,
        average_body_weight: form.average_body_weight === "" ? null : Number(form.average_body_weight)
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to submit check-in");
      return;
    }

    setCheckins([data.checkin, ...checkins]);
    setStatus("Weekly check-in submitted.");
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Weekly Client Check-In Questionnaire</h2>
          <p className="text-sm text-slate-600">Consistency is key to progress. Take 5-10 minutes and reflect so we can adjust your plan.</p>
        </div>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Section 1: The Big Picture</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Overall week rating (1-10)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                value={form.overall_week_rating}
                onChange={(e) => setForm({ ...form, overall_week_rating: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Confidence for upcoming week (1-10)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                value={form.confidence_next_week}
                onChange={(e) => setForm({ ...form, confidence_next_week: Number(e.target.value) })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Biggest win</label>
              <textarea className="input" value={form.biggest_win} onChange={(e) => setForm({ ...form, biggest_win: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Biggest challenge or obstacle</label>
              <textarea className="input" value={form.biggest_challenge} onChange={(e) => setForm({ ...form, biggest_challenge: e.target.value })} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Section 2: The Data</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">Average body weight</label>
              <input className="input" type="number" step="0.1" value={form.average_body_weight} onChange={(e) => setForm({ ...form, average_body_weight: e.target.value })} />
            </div>
            <div>
              <label className="label">Progress photos uploaded?</label>
              <select
                className="input"
                value={form.progress_photos_uploaded}
                onChange={(e) => setForm({ ...form, progress_photos_uploaded: e.target.value })}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="na">N/A</option>
              </select>
            </div>
            <div>
              <label className="label">Menstrual cycle note (if applicable)</label>
              <input className="input" value={form.cycle_status} onChange={(e) => setForm({ ...form, cycle_status: e.target.value })} />
            </div>
            <div className="md:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">Upload progress photo</p>
              <p className="text-xs text-slate-500">Upload from phone/computer. Your coach can view this in your profile timeline.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="input max-w-xs"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="environment"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                />
                <button className="btn-secondary" onClick={uploadProgressPhoto} disabled={photoUploading}>
                  {photoUploading ? "Uploading..." : "Upload Photo"}
                </button>
              </div>
              {recentPhotos.length > 0 && (
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {recentPhotos.map((photo) => (
                    <img key={photo.id} src={photo.photo_url} alt={photo.caption || "Progress photo"} className="h-24 w-full rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Section 3: Biofeedback (1-10)</h3>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="label">Sleep quality</label>
              <input className="input" type="number" min={1} max={10} value={form.sleep} onChange={(e) => setForm({ ...form, sleep: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Daily energy</label>
              <input className="input" type="number" min={1} max={10} value={form.energy} onChange={(e) => setForm({ ...form, energy: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Stress</label>
              <input className="input" type="number" min={1} max={10} value={form.stress} onChange={(e) => setForm({ ...form, stress: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Hunger/cravings</label>
              <input className="input" type="number" min={1} max={10} value={form.hunger} onChange={(e) => setForm({ ...form, hunger: Number(e.target.value) })} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Section 4: Nutrition & Hydration</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">Nutrition adherence (%)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={form.nutrition_adherence_percent}
                onChange={(e) => setForm({ ...form, nutrition_adherence_percent: Number(e.target.value) })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.protein_goal_hit}
                onChange={(e) => setForm({ ...form, protein_goal_hit: e.target.checked })}
              />
              Hit protein goal
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.hydration_goal_hit}
                onChange={(e) => setForm({ ...form, hydration_goal_hit: e.target.checked })}
              />
              Hit hydration target
            </label>
            <div className="md:col-span-3">
              <label className="label">Digestion notes</label>
              <textarea className="input" value={form.digestion_notes} onChange={(e) => setForm({ ...form, digestion_notes: e.target.value })} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Section 5: Training & Recovery</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Workouts completed</label>
              <input
                className="input"
                type="number"
                min={0}
                max={14}
                value={form.workouts_completed}
                onChange={(e) => setForm({ ...form, workouts_completed: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Workouts scheduled</label>
              <input
                className="input"
                type="number"
                min={1}
                max={14}
                value={form.workouts_scheduled}
                onChange={(e) => setForm({ ...form, workouts_scheduled: Number(e.target.value) })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Training performance</label>
              <textarea className="input" value={form.training_performance} onChange={(e) => setForm({ ...form, training_performance: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Recovery / soreness</label>
              <textarea className="input" value={form.recovery_status} onChange={(e) => setForm({ ...form, recovery_status: e.target.value })} />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900">Section 6: Mindset & Support</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Support needed this week</label>
              <textarea className="input" value={form.support_needed} onChange={(e) => setForm({ ...form, support_needed: e.target.value })} />
            </div>
            <div>
              <label className="label">Additional notes</label>
              <textarea className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </section>

        <button className="btn-primary" onClick={onSubmit}>
          Submit Weekly Check-In
        </button>
      </div>

      {status && <p className="text-sm text-slate-700">{status}</p>}

      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">Previous Check-ins</h3>
        <div className="space-y-2">
          {checkins.map((entry) => (
            <article key={entry.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">{new Date(entry.created_at).toLocaleDateString()}</p>
              <p>
                Week {entry.overall_week_rating ?? "-"}/10 | Workouts {entry.workouts_completed}
                {entry.workouts_scheduled ? `/${entry.workouts_scheduled}` : ""} | Adherence {entry.nutrition_adherence_percent ?? entry.adherence}%
              </p>
              {entry.biggest_win && <p className="mt-1 text-slate-700">Win: {entry.biggest_win}</p>}
              {entry.biggest_challenge && <p className="text-slate-700">Challenge: {entry.biggest_challenge}</p>}
              {entry.support_needed && <p className="text-slate-700">Support: {entry.support_needed}</p>}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
