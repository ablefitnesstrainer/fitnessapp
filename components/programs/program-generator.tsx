"use client";

import { useState } from "react";
import Link from "next/link";

type Template = { id: string; name: string };
type Client = { id: string; user_id: string; user_name: string };

export function ProgramGenerator({ templates, clients }: { templates: Template[]; clients: Client[] }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [startOn, setStartOn] = useState(new Date().toISOString().slice(0, 10));
  const [weeks, setWeeks] = useState(8);
  const [repProgression, setRepProgression] = useState(1);
  const [setProgressionEvery, setSetProgressionEvery] = useState(4);
  const [deloadWeek, setDeloadWeek] = useState(7);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onGenerate = async () => {
    setLoading(true);
    setStatus(null);

    const res = await fetch("/api/programs/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: templateId,
        client_id: clientId || null,
        start_on: startOn,
        weeks,
        rep_progression: repProgression,
        set_progression_every: setSetProgressionEvery,
        deload_week: deloadWeek
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to generate program");
      setLoading(false);
      return;
    }

    setStatus(`Generated ${data.createdWeeks} weeks from template.`);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="card bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white/20 p-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"><path d="M4 12h16M12 4l8 8-8 8" stroke="currentColor" strokeWidth="1.8"/></svg>
          </div>
          <div>
            <h2 className="text-xl font-bold">Program Generator</h2>
            <p className="mt-1 text-sm text-blue-50">
              Clones week 1 from a template, applies rep/set progression over time, inserts a deload week, and can assign the final program to a client.
            </p>
            <p className="mt-2 text-xs text-blue-100">
              Need to tweak specific weeks after generation? Use{" "}
              <Link href="/programs/editor" className="font-semibold underline underline-offset-2">
                Program Editor
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="card grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Template</label>
          <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Assign to client (optional)</label>
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">No assignment</option>
            <option value="__self__">Assign to me</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.user_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Program start date</label>
          <input className="input" type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} />
        </div>
        <div className="flex gap-2 self-end">
          <button className="btn-secondary" type="button" onClick={() => setStartOn(new Date().toISOString().slice(0, 10))}>
            Start Today
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => {
              const now = new Date();
              const day = now.getDay();
              const delta = (8 - day) % 7 || 7;
              const monday = new Date(now);
              monday.setDate(now.getDate() + delta);
              setStartOn(monday.toISOString().slice(0, 10));
            }}
          >
            Next Monday
          </button>
        </div>

        <div>
          <label className="label">Total weeks</label>
          <input className="input" type="number" min={1} max={24} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />
        </div>

        <div>
          <label className="label">Rep progression / week</label>
          <input className="input" type="number" min={0} max={3} value={repProgression} onChange={(e) => setRepProgression(Number(e.target.value))} />
        </div>

        <div>
          <label className="label">Add 1 set every N weeks</label>
          <input
            className="input"
            type="number"
            min={2}
            max={8}
            value={setProgressionEvery}
            onChange={(e) => setSetProgressionEvery(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="label">Deload week</label>
          <input className="input" type="number" min={1} max={24} value={deloadWeek} onChange={(e) => setDeloadWeek(Number(e.target.value))} />
        </div>
      </div>

      {status && <p className="text-sm font-medium text-slate-700">{status}</p>}
      <button className="btn-primary" onClick={onGenerate} disabled={loading || !templateId}>
        {loading ? "Generating..." : "Generate Program"}
      </button>
    </div>
  );
}
