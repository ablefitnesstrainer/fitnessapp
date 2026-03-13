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

type AlertPolicy = {
  enabled: boolean;
  recipientEmail: string | null;
  fromEmail: string | null;
  notifyOnNewIp: boolean;
  notifyOnNewDevice: boolean;
  minimumReasons: number;
};

type Payload = {
  rateLimits: Record<string, RateLimitPolicy>;
  lockoutPolicy: LockoutPolicy;
  alertPolicy: AlertPolicy;
};

function isPayload(value: unknown): value is Payload {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    "rateLimits" in (value as Record<string, unknown>) &&
    "lockoutPolicy" in (value as Record<string, unknown>) &&
    "alertPolicy" in (value as Record<string, unknown>)
  );
}

const labels: Record<string, string> = {
  "auth.login.ip": "Login attempts per IP",
  "auth.login.email": "Login attempts per email",
  "auth.reauth": "Re-auth attempts",
  "messages.send": "Messages sent",
  "messages.upload": "Message attachment uploads",
  "clients.progress.upload": "Progress photo uploads",
  "admin.set_password": "Admin password resets",
  "exercises.import_csv": "Exercise CSV imports",
  "programs.generate": "Program generations",
  "contracts.send": "Contract sends",
  "challenges.create": "Challenge creates",
  "challenges.bulk_enroll": "Challenge bulk enroll",
  "funnel.club_checkout": "Funnel club checkouts",
  "community.posts.create": "Community posts",
  "community.comments.create": "Community comments",
  "community.reports.create": "Community reports"
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

  function updateAlert<K extends keyof AlertPolicy>(key: K, value: AlertPolicy[K]) {
    if (!settings) return;
    setSettings({
      ...settings,
      alertPolicy: {
        ...settings.alertPolicy,
        [key]: value
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

      <div>
        <h2 className="text-lg font-semibold">Anomaly Email Alerts</h2>
        <p className="text-sm text-slate-600">Email alerts for sensitive actions from new IP/device patterns.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={settings.alertPolicy.enabled}
            onChange={(e) => updateAlert("enabled", e.target.checked)}
          />
          Enable anomaly email alerts
        </label>
        <div>
          <label className="label">Minimum anomaly reasons to alert</label>
          <input
            className="input"
            type="number"
            min={1}
            max={2}
            value={settings.alertPolicy.minimumReasons}
            onChange={(e) => updateAlert("minimumReasons", Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div>
          <label className="label">Alert Recipient Email</label>
          <input
            className="input"
            type="email"
            value={settings.alertPolicy.recipientEmail || ""}
            onChange={(e) => updateAlert("recipientEmail", e.target.value || null)}
            placeholder="alerts@yourdomain.com"
          />
        </div>
        <div>
          <label className="label">Alert From Email</label>
          <input
            className="input"
            type="email"
            value={settings.alertPolicy.fromEmail || ""}
            onChange={(e) => updateAlert("fromEmail", e.target.value || null)}
            placeholder="security@yourdomain.com"
          />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={settings.alertPolicy.notifyOnNewIp}
            onChange={(e) => updateAlert("notifyOnNewIp", e.target.checked)}
          />
          Alert on new IP
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={settings.alertPolicy.notifyOnNewDevice}
            onChange={(e) => updateAlert("notifyOnNewDevice", e.target.checked)}
          />
          Alert on new device profile
        </label>
      </div>

      {status && <p className="text-sm text-slate-700">{status}</p>}

      <button className="btn-primary" type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save Security Settings"}
      </button>
    </form>
  );
}
