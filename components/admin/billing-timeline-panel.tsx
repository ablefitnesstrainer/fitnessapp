"use client";

import { useEffect, useMemo, useState } from "react";

type AppUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "coach" | "client";
  subscription_status: string;
  subscription_price_id: string | null;
  subscription_current_period_end: string | null;
  billing_updated_at: string | null;
};

type ClubEvent = {
  id: string;
  app_user_id: string | null;
  event_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  last_error: string | null;
};

type WebhookEvent = {
  id: string;
  event_id: string;
  event_type: string;
  status: string;
  processed_at: string;
  error_message: string | null;
};

export function BillingTimelinePanel() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [clubEvents, setClubEvents] = useState<ClubEvent[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(nextUserId?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (nextUserId) params.set("app_user_id", nextUserId);
    const res = await fetch(`/api/admin/billing/timeline?${params.toString()}`, { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Unable to load billing timeline");
      setLoading(false);
      return;
    }
    setUsers(payload.users || []);
    setClubEvents(payload.club_events || []);
    setWebhookEvents(payload.webhook_events || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId) || null, [users, selectedUserId]);

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label className="label">Filter by user</label>
            <select
              className="input"
              value={selectedUserId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedUserId(id);
                void load(id || undefined);
              }}
            >
              <option value="">All users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {(user.full_name || user.email) + ` (${user.role})`}
                </option>
              ))}
            </select>
          </div>
          <div className="self-end">
            <button className="btn-secondary" onClick={() => void load(selectedUserId || undefined)}>
              Refresh
            </button>
          </div>
        </div>

        {selectedUser && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p>
              <span className="font-semibold">Member:</span> {selectedUser.full_name || selectedUser.email}
            </p>
            <p>
              <span className="font-semibold">Subscription status:</span> {selectedUser.subscription_status || "inactive"}
            </p>
            <p>
              <span className="font-semibold">Price ID:</span> {selectedUser.subscription_price_id || "-"}
            </p>
            <p>
              <span className="font-semibold">Period end:</span>{" "}
              {selectedUser.subscription_current_period_end ? new Date(selectedUser.subscription_current_period_end).toLocaleString() : "-"}
            </p>
            <p>
              <span className="font-semibold">Last sync:</span>{" "}
              {selectedUser.billing_updated_at ? new Date(selectedUser.billing_updated_at).toLocaleString() : "-"}
            </p>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Provisioning Events</h2>
        {loading && <p className="text-sm text-slate-600">Loading...</p>}
        {!loading && clubEvents.length === 0 && <p className="text-sm text-slate-600">No provisioning events found.</p>}
        <div className="space-y-2">
          {clubEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">
                {event.event_type} <span className="text-slate-500">• {event.status}</span>
              </p>
              <p className="text-slate-600">{new Date(event.created_at).toLocaleString()}</p>
              {event.notes && <p className="mt-1 text-slate-700">{event.notes}</p>}
              {event.last_error && <p className="mt-1 text-red-600">{event.last_error}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Stripe Webhook Events</h2>
        {loading && <p className="text-sm text-slate-600">Loading...</p>}
        {!loading && webhookEvents.length === 0 && <p className="text-sm text-slate-600">No webhook events found.</p>}
        <div className="space-y-2">
          {webhookEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">
                {event.event_type} <span className="text-slate-500">• {event.status}</span>
              </p>
              <p className="text-slate-600">{new Date(event.processed_at).toLocaleString()}</p>
              {event.error_message && <p className="mt-1 text-red-600">{event.error_message}</p>}
            </div>
          ))}
        </div>
      </section>

      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}

