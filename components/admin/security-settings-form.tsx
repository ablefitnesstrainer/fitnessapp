"use client";

import { useEffect, useState } from "react";

type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
};

type LockoutPolicy = {
  threshold: number;
  baseSeconds: number;
  maxSeconds: number;
};

type Payload = {
  rateLimits: Record<string, RateLimitPolicy>;
  lockoutPolicy: LockoutPolicy;
};

function isPayload(value: unknown): value is Payload {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    "rateLimits" in (value as Record<string, unknown>) &&
    "lockoutPolicy" in (value as Record<string, unknown>)
  );
}

const labels: Record<string, string> = {
  "auth.login.ip": "Login attempts per IP",
  "auth.login.email": "Login attempts per email",
  "messages.send": "Messages sent",
  "messages.upload": "Message attachment uploads",
  "admin.set_password": "Admin password resets",
  "exercises.import_csv": "Exercise CSV imports",
  "programs.generate": "Program generations"
};

export function SecuritySettingsForm() {
  const [settings, setSettings] = useState<Payload | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await fetch("/api/admin/security-settings");
      const payload = (await res.json().catch(() => null)) as Payload | { error?: string } | null;
      if (!active) return;
      if (!res.ok || !isPayload(payload)) {
        const errorPayload = payload as { error?: string } | null;
        setStatus(errorPayload?.error || "Failed to load settings");
        setLoading(false);
        return;
      }
      setSettings(payload);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  function updateRate(scope: string, key: keyof RateLimitPolicy, value: number) {
    if (!settings) return;
    setSettings({
      ...settings,
      rateLimits: {
        ...settings.rateLimits,
        [scope]: {
          ...settings.rateLimits[scope],
          [key]: Number.isFinite(value) ? value : 1
        }
      }
    });
  }

  function updateLockout(key: keyof LockoutPolicy, value: number) {
    if (!settings) return;
    setSettings({
      ...settings,
      lockoutPolicy: {
        ...settings.lockoutPolicy,
        [key]: Number.isFinite(value) ? value : 1
      }
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setStatus(null);

    const res = await fetch("/api/admin/security-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    const payload = (await res.json().catch(() => null)) as Payload | { error?: string } | null;
    if (!res.ok || !isPayload(payload)) {
      const errorPayload = payload as { error?: string } | null;
      setStatus(errorPayload?.error || "Failed to save settings");
      setSaving(false);
      return;
    }

    setSettings(payload);
    setStatus("Security settings saved.");
    setSaving(false);
  }

  if (loading) {
    return <section className="card">Loading security settings...</section>;
  }

  if (!settings) {
    return <section className="card text-sm text-red-600">{status || "Unable to load settings"}</section>;
  }

  const scopes = Object.keys(settings.rateLimits);

  return (
    <form className="card space-y-6" onSubmit={onSubmit}>
      <div>
        <h2 className="text-lg font-semibold">Rate Limits</h2>
        <p className="text-sm text-slate-600">Tune request ceilings and windows for high-risk actions.</p>
      </div>

      <div className="space-y-3">
        {scopes.map((scope) => (
          <div key={scope} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{labels[scope] || scope}</p>
              <p className="text-xs text-slate-500">{scope}</p>
            </div>
            <div>
              <label className="label">Limit</label>
              <input
                className="input"
                type="number"
                min={1}
                value={settings.rateLimits[scope].limit}
                onChange={(e) => updateRate(scope, "limit", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Window (seconds)</label>
              <input
                className="input"
                type="number"
                min={1}
                value={settings.rateLimits[scope].windowSeconds}
                onChange={(e) => updateRate(scope, "windowSeconds", Number(e.target.value))}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold">Login Lockout Policy</h2>
        <p className="text-sm text-slate-600">Progressive lockout after repeated failed login attempts.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="label">Failure threshold</label>
          <input
            className="input"
            type="number"
            min={1}
            value={settings.lockoutPolicy.threshold}
            onChange={(e) => updateLockout("threshold", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Base lockout (seconds)</label>
          <input
            className="input"
            type="number"
            min={1}
            value={settings.lockoutPolicy.baseSeconds}
            onChange={(e) => updateLockout("baseSeconds", Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Maximum lockout (seconds)</label>
          <input
            className="input"
            type="number"
            min={1}
            value={settings.lockoutPolicy.maxSeconds}
            onChange={(e) => updateLockout("maxSeconds", Number(e.target.value))}
          />
        </div>
      </div>

      {status && <p className="text-sm text-slate-700">{status}</p>}

      <button className="btn-primary" type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save Security Settings"}
      </button>
    </form>
  );
}
