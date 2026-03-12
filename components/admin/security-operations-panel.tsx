"use client";

import { useEffect, useState } from "react";

type Payload = {
  keyRotation: {
    lastCompletedOn: string | null;
    nextDueOn: string | null;
  };
  backupRestore: {
    lastTestOn: string | null;
    nextTestOn: string | null;
  };
};

function plusNinetyDays(iso: string | null) {
  const base = iso ? new Date(`${iso}T00:00:00`) : new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + 90);
  return next.toISOString().slice(0, 10);
}

export function SecurityOperationsPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/security-operations", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as Payload | { error?: string } | null;
      if (!res.ok || !payload || !("keyRotation" in payload)) {
        setStatus((payload as any)?.error || "Unable to load security operations.");
        return;
      }
      setData(payload as Payload);
    })();
  }, []);

  async function save(next: Payload) {
    setSaving(true);
    const res = await fetch("/api/admin/security-operations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyRotationLastCompletedOn: next.keyRotation.lastCompletedOn,
        keyRotationNextDueOn: next.keyRotation.nextDueOn,
        backupRestoreLastTestOn: next.backupRestore.lastTestOn,
        backupRestoreNextTestOn: next.backupRestore.nextTestOn
      })
    });

    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setStatus(payload?.error || "Failed to save operations checklist");
      setSaving(false);
      return;
    }

    setData(next);
    setStatus("Security operations checklist updated.");
    setSaving(false);
  }

  if (!data) {
    return <section className="card">Loading security operations...</section>;
  }

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Quarterly Rotation Checklist</h2>
        <p className="text-sm text-slate-600">Track your key rotation and backup restore dry-runs every 90 days.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="label">Key rotation - last completed</span>
          <input
            className="input"
            type="date"
            value={data.keyRotation.lastCompletedOn || ""}
            onChange={(e) => setData({ ...data, keyRotation: { ...data.keyRotation, lastCompletedOn: e.target.value || null } })}
          />
        </label>
        <label>
          <span className="label">Key rotation - next due</span>
          <input
            className="input"
            type="date"
            value={data.keyRotation.nextDueOn || ""}
            onChange={(e) => setData({ ...data, keyRotation: { ...data.keyRotation, nextDueOn: e.target.value || null } })}
          />
        </label>
        <label>
          <span className="label">Backup restore test - last completed</span>
          <input
            className="input"
            type="date"
            value={data.backupRestore.lastTestOn || ""}
            onChange={(e) => setData({ ...data, backupRestore: { ...data.backupRestore, lastTestOn: e.target.value || null } })}
          />
        </label>
        <label>
          <span className="label">Backup restore test - next due</span>
          <input
            className="input"
            type="date"
            value={data.backupRestore.nextTestOn || ""}
            onChange={(e) => setData({ ...data, backupRestore: { ...data.backupRestore, nextTestOn: e.target.value || null } })}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-secondary"
          type="button"
          onClick={() => {
            const today = new Date().toISOString().slice(0, 10);
            setData({
              ...data,
              keyRotation: {
                lastCompletedOn: today,
                nextDueOn: plusNinetyDays(today)
              }
            });
          }}
        >
          Mark key rotation complete (+90d)
        </button>
        <button
          className="btn-secondary"
          type="button"
          onClick={() => {
            const today = new Date().toISOString().slice(0, 10);
            setData({
              ...data,
              backupRestore: {
                lastTestOn: today,
                nextTestOn: plusNinetyDays(today)
              }
            });
          }}
        >
          Mark restore dry-run complete (+90d)
        </button>
        <button className="btn-primary" type="button" disabled={saving} onClick={() => void save(data)}>
          {saving ? "Saving..." : "Save Operations"}
        </button>
      </div>

      {status && <p className="text-sm text-slate-700">{status}</p>}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Runbook</p>
        <p className="mt-1">Follow `/docs/security/key-rotation-runbook.md` each quarter to rotate keys and verify backup restore.</p>
      </div>
    </section>
  );
}
