"use client";

import { useState } from "react";

type Checkin = {
  id: string;
  created_at: string;
  workouts_completed: number;
  energy: number;
  hunger: number;
  sleep: number;
  stress: number;
  adherence: number;
  notes: string | null;
};

export function CheckinForm({ clientId, initialCheckins }: { clientId: string; initialCheckins: Checkin[] }) {
  const [checkins, setCheckins] = useState(initialCheckins);
  const [form, setForm] = useState({
    workouts_completed: 0,
    energy: 5,
    hunger: 5,
    sleep: 5,
    stress: 5,
    adherence: 5,
    notes: ""
  });
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = async () => {
    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, ...form })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to submit check-in");
      return;
    }

    setCheckins([data.checkin, ...checkins]);
    setStatus("Weekly check-in submitted");
  };

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 md:grid-cols-2">
        <input
          className="input"
          type="number"
          min={0}
          max={14}
          value={form.workouts_completed}
          onChange={(e) => setForm({ ...form, workouts_completed: Number(e.target.value) })}
          placeholder="Workouts completed"
        />
        {(["energy", "hunger", "sleep", "stress", "adherence"] as const).map((metric) => (
          <div key={metric}>
            <label className="label capitalize">{metric}</label>
            <input
              className="input"
              type="number"
              min={1}
              max={10}
              value={form[metric]}
              onChange={(e) => setForm({ ...form, [metric]: Number(e.target.value) })}
            />
          </div>
        ))}
        <textarea className="input md:col-span-2" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <button className="btn-primary" onClick={onSubmit}>
        Submit Check-in
      </button>
      {status && <p className="text-sm text-slate-700">{status}</p>}

      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">Previous Check-ins</h3>
        <div className="space-y-2">
          {checkins.map((entry) => (
            <article key={entry.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">{new Date(entry.created_at).toLocaleDateString()}</p>
              <p>
                Workouts {entry.workouts_completed} | Energy {entry.energy} | Sleep {entry.sleep} | Stress {entry.stress} | Adherence {entry.adherence}
              </p>
              {entry.notes && <p className="mt-1 text-slate-700">{entry.notes}</p>}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
