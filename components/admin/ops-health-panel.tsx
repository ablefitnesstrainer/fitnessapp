"use client";

import { useEffect, useState } from "react";

type Payload = {
  summary: {
    failed_webhooks_24h: number;
    warning_or_failed_provisioning_24h: number;
    open_support_tickets: number;
  };
  security_ops: {
    key_rotation_last_completed: string;
    key_rotation_next_due: string;
    backup_restore_last_test: string;
    backup_restore_next_due: string;
  };
  webhook_events: Array<{
    event_type: string;
    status: string;
    processed_at: string;
    error_message?: string | null;
  }>;
  ops_alerts: Array<{
    alert_key: string;
    severity: string;
    status: string;
    last_seen_at: string;
    last_sent_at: string | null;
    message: string;
    occurrences: number;
  }>;
};

export function OpsHealthPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/ops-health", { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Unable to load ops health");
      return;
    }
    setData(payload);
  }

  useEffect(() => {
    void load();
  }, []);

  if (!data) return <section className="card">{status || "Loading ops health..."}</section>;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Failed webhooks (24h)</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.summary.failed_webhooks_24h}</p>
        </article>
        <article className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provisioning warnings (24h)</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.summary.warning_or_failed_provisioning_24h}</p>
        </article>
        <article className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open support tickets</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.summary.open_support_tickets}</p>
        </article>
      </section>

      <section className="card space-y-1 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Security Ops Cadence</h2>
        <p>Key rotation last completed: {data.security_ops.key_rotation_last_completed || "-"}</p>
        <p>Key rotation next due: {data.security_ops.key_rotation_next_due || "-"}</p>
        <p>Backup restore last test: {data.security_ops.backup_restore_last_test || "-"}</p>
        <p>Backup restore next due: {data.security_ops.backup_restore_next_due || "-"}</p>
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">Recent Stripe Webhook Events</h2>
        {(data.webhook_events || []).length === 0 && <p className="text-sm text-slate-600">No webhook events.</p>}
        {(data.webhook_events || []).map((row, idx) => (
          <div key={`${row.event_type}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">
              {row.event_type} <span className="text-slate-500">• {row.status}</span>
            </p>
            <p className="text-slate-600">{new Date(row.processed_at).toLocaleString()}</p>
            {row.error_message && <p className="text-red-600">{row.error_message}</p>}
          </div>
        ))}
      </section>

      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">Recent Ops Alerts</h2>
        {(data.ops_alerts || []).length === 0 && <p className="text-sm text-slate-600">No ops alerts.</p>}
        {(data.ops_alerts || []).map((row) => (
          <div key={row.alert_key} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">
              {row.alert_key} <span className="text-slate-500">• {row.severity} • {row.status}</span>
            </p>
            <p className="text-slate-600">{row.message}</p>
            <p className="text-xs text-slate-500">
              Seen: {new Date(row.last_seen_at).toLocaleString()} • Sent: {row.last_sent_at ? new Date(row.last_sent_at).toLocaleString() : "-"} •
              Count: {row.occurrences}
            </p>
          </div>
        ))}
      </section>

      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}

