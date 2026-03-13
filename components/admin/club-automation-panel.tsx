"use client";

import { useEffect, useState } from "react";

type ClubSettings = {
  enabled: boolean;
  fallbackMode: "next_upcoming" | "none";
  welcomeEmailEnabled: boolean;
  welcomeFromEmail: string | null;
  welcomeSupportEmail: string | null;
  welcomeSubject: string;
  welcomeHeading: string;
  welcomeBodyNew: string;
  welcomeBodyExisting: string;
  welcomeButtonLabel: string;
};

type ClubEvent = {
  id: string;
  event_type: string;
  status: "processed" | "warning" | "failed" | "pending";
  notes: string | null;
  payload: Record<string, unknown>;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  challenge_id: string | null;
  template_id: string | null;
};

function formatDate(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function ClubAutomationPanel() {
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function loadAll() {
    const [settingsRes, eventsRes] = await Promise.all([
      fetch("/api/admin/club-automation/settings", { cache: "no-store" }),
      fetch("/api/admin/club-automation/events", { cache: "no-store" })
    ]);

    const settingsPayload = await settingsRes.json();
    const eventsPayload = await eventsRes.json();

    if (settingsRes.ok) setSettings(settingsPayload as ClubSettings);
    if (eventsRes.ok) setEvents((eventsPayload.events || []) as ClubEvent[]);

    if (!settingsRes.ok) setStatus(settingsPayload.error || "Failed to load club settings");
    if (!eventsRes.ok) setStatus(eventsPayload.error || "Failed to load club events");
  }

  useEffect(() => {
    let active = true;
    (async () => {
      await loadAll();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setStatus(null);

    const res = await fetch("/api/admin/club-automation/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to save settings");
      setSaving(false);
      return;
    }

    setSettings(payload as ClubSettings);
    setStatus("Club automation settings saved.");
    setSaving(false);
  }

  async function retryEvent(id: string, action: "email" | "assignment") {
    setStatus(null);
    const res = await fetch(`/api/admin/club-automation/events/${id}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Retry failed");
      return;
    }

    setStatus(action === "email" ? "Welcome email retry succeeded." : "Assignment retry succeeded.");
    await loadAll();
  }

  if (loading) return <section className="card">Loading club automation...</section>;
  if (!settings) return <section className="card text-sm text-red-600">{status || "Unable to load club settings."}</section>;

  return (
    <div className="space-y-6">
      <form className="card space-y-4" onSubmit={saveSettings}>
        <h2 className="text-lg font-semibold">Club Automation Settings</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, enabled: e.target.checked } : prev))}
            />
            Enable auto-provisioning from funnel purchases
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={settings.welcomeEmailEnabled}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, welcomeEmailEnabled: e.target.checked } : prev))}
            />
            Send welcome email automatically
          </label>

          <div>
            <label className="label">No active challenge fallback</label>
            <select
              className="input"
              value={settings.fallbackMode}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, fallbackMode: e.target.value as ClubSettings["fallbackMode"] } : prev))}
            >
              <option value="next_upcoming">Enroll next upcoming challenge</option>
              <option value="none">Do not auto-enroll</option>
            </select>
          </div>

          <div>
            <label className="label">Welcome sender email</label>
            <input
              className="input"
              type="email"
              placeholder="no-reply@yourdomain.com"
              value={settings.welcomeFromEmail || ""}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, welcomeFromEmail: e.target.value || null } : prev))}
            />
          </div>

          <div>
            <label className="label">Support contact email</label>
            <input
              className="input"
              type="email"
              placeholder="support@yourdomain.com"
              value={settings.welcomeSupportEmail || ""}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, welcomeSupportEmail: e.target.value || null } : prev))}
            />
          </div>

          <div>
            <label className="label">Welcome email subject</label>
            <input
              className="input"
              value={settings.welcomeSubject}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, welcomeSubject: e.target.value } : prev))}
            />
          </div>

          <div>
            <label className="label">Welcome email heading</label>
            <input
              className="input"
              value={settings.welcomeHeading}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, welcomeHeading: e.target.value } : prev))}
            />
          </div>

          <div>
            <label className="label">CTA button label</label>
            <input
              className="input"
              value={settings.welcomeButtonLabel}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, welcomeButtonLabel: e.target.value } : prev))}
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">Body copy for new members</label>
            <textarea
              className="input min-h-[90px]"
              value={settings.welcomeBodyNew}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, welcomeBodyNew: e.target.value } : prev))}
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">Body copy for existing members</label>
            <textarea
              className="input min-h-[90px]"
              value={settings.welcomeBodyExisting}
              onChange={(e) => setSettings((prev) => (prev ? { ...prev, welcomeBodyExisting: e.target.value } : prev))}
            />
          </div>
        </div>

        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Club Settings"}
        </button>
      </form>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Membership Events</h2>
        <p className="text-sm text-slate-600">Review processing results and retry welcome emails or assignments for failed/warning events.</p>
        <div className="space-y-2">
          {events.length === 0 && <p className="text-sm text-slate-600">No events yet.</p>}
          {events.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {event.event_type} <span className="text-slate-500">• {event.status}</span>
                </p>
                <p className="text-xs text-slate-500">{formatDate(event.created_at)}</p>
              </div>
              {event.notes && <p className="mt-1 text-sm text-slate-700">{event.notes}</p>}
              {event.last_error && <p className="mt-1 text-sm text-red-600">{event.last_error}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-secondary" type="button" onClick={() => retryEvent(event.id, "email")}>
                  Retry Email
                </button>
                <button className="btn-secondary" type="button" onClick={() => retryEvent(event.id, "assignment")}>
                  Re-run Assignment
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}
