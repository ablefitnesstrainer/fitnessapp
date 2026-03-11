"use client";

import Link from "next/link";
import { CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import { useState } from "react";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export function CoachDashboard({
  clients,
  templates,
  contractFunnel,
  coachDigest,
  checkins,
  contractQueue,
  priorityQueue,
  overdueCheckins
}: {
  clients: number;
  templates: number;
  contractFunnel: {
    sent: number;
    opened: number;
    completed: number;
    sentRate: number;
    openRate: number;
    completionRate: number;
  };
  coachDigest: {
    contractsPending: number;
    overdueCheckins: number;
    unreadMessages: number;
    lowAdherenceClients: number;
    checkinsThisWeek: number;
  };
  checkins: { created_at: string; adherence: number | null; nutrition_adherence_percent?: number | null }[];
  contractQueue: {
    clientId: string;
    clientUserId: string;
    clientName: string;
    status: string;
    contractId: string | null;
    documentId: number | null;
    documentSlug: string | null;
    sentAt: string | null;
    openedAt: string | null;
    completedAt: string | null;
  }[];
  priorityQueue: {
    clientId: string;
    clientUserId: string;
    clientName: string;
    risk: "red" | "yellow" | "green";
    score: number;
    lastCheckinAt: string;
    adherencePercent: number | null;
    reasons: string[];
  }[];
  overdueCheckins: {
    clientId: string;
    clientUserId: string;
    clientName: string;
    daysSinceCheckin: number | null;
  }[];
}) {
  const chartData = {
    labels: checkins.map((c) => new Date(c.created_at).toLocaleDateString()),
    datasets: [
      {
        label: "Adherence",
        data: checkins.map((c) => c.nutrition_adherence_percent ?? c.adherence ?? 0),
        borderColor: "#0f6adf",
        pointBackgroundColor: "#0f6adf",
        backgroundColor: "rgba(15,106,223,0.18)",
        fill: true,
        tension: 0.35
      }
    ]
  };
  const [localContractQueue, setLocalContractQueue] = useState(contractQueue);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const sendContract = async (clientId: string, clientName: string) => {
    setPending(`send-${clientId}`);
    setQueueStatus(null);

    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId })
    });
    const payload = await res.json();
    if (!res.ok) {
      setQueueStatus(payload.error || `Failed to send contract to ${clientName}`);
      setPending(null);
      return;
    }

    setLocalContractQueue((prev) =>
      prev.map((item) =>
        item.clientId === clientId
          ? {
              ...item,
              status: payload.contract?.status || "sent",
              contractId: payload.contract?.id || item.contractId,
              documentId: payload.contract?.document_id ?? item.documentId,
              documentSlug: payload.contract?.document_slug ?? item.documentSlug,
              sentAt: payload.contract?.sent_at ?? item.sentAt,
              openedAt: payload.contract?.opened_at ?? item.openedAt,
              completedAt: payload.contract?.completed_at ?? item.completedAt
            }
          : item
      )
    );
    setQueueStatus(`Contract sent to ${clientName}.`);
    setPending(null);
  };

  const refreshContract = async (clientId: string, clientName: string) => {
    setPending(`refresh-${clientId}`);
    setQueueStatus(null);

    const res = await fetch(`/api/contracts?client_id=${encodeURIComponent(clientId)}&refresh=1`, { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      setQueueStatus(payload.error || `Failed to refresh contract for ${clientName}`);
      setPending(null);
      return;
    }

    if (!payload.contract) {
      setPending(null);
      return;
    }

    setLocalContractQueue((prev) =>
      prev
        .map((item) =>
          item.clientId === clientId
            ? {
                ...item,
                status: payload.contract?.status || "sent",
                contractId: payload.contract?.id || item.contractId,
                documentId: payload.contract?.document_id ?? item.documentId,
                documentSlug: payload.contract?.document_slug ?? item.documentSlug,
                sentAt: payload.contract?.sent_at ?? item.sentAt,
                openedAt: payload.contract?.opened_at ?? item.openedAt,
                completedAt: payload.contract?.completed_at ?? item.completedAt
              }
            : item
        )
        .filter((item) => item.status !== "completed")
    );

    setQueueStatus(`Contract status refreshed for ${clientName}.`);
    setPending(null);
  };

  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 text-white">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Weekly Coach Digest</h2>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">
            Last 7 days
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Link href="/dashboard" className="rounded-xl border border-white/20 bg-white/10 p-3 transition hover:bg-white/15">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">Check-ins</p>
            <p className="mt-1 text-2xl font-bold">{coachDigest.checkinsThisWeek}</p>
          </Link>
          <Link href="/clients" className="rounded-xl border border-white/20 bg-white/10 p-3 transition hover:bg-white/15">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">Contracts Pending</p>
            <p className="mt-1 text-2xl font-bold">{coachDigest.contractsPending}</p>
          </Link>
          <Link href="/checkins" className="rounded-xl border border-white/20 bg-white/10 p-3 transition hover:bg-white/15">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">Overdue Check-ins</p>
            <p className="mt-1 text-2xl font-bold">{coachDigest.overdueCheckins}</p>
          </Link>
          <Link href="/messages" className="rounded-xl border border-white/20 bg-white/10 p-3 transition hover:bg-white/15">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">Unread Messages</p>
            <p className="mt-1 text-2xl font-bold">{coachDigest.unreadMessages}</p>
          </Link>
          <Link href="/clients" className="rounded-xl border border-white/20 bg-white/10 p-3 transition hover:bg-white/15">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-100">Low Adherence</p>
            <p className="mt-1 text-2xl font-bold">{coachDigest.lowAdherenceClients}</p>
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Active Clients</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{clients}</p>
          <p className="mt-2 text-sm text-slate-600">Clients currently managed inside your coaching roster.</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Program Templates</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{templates}</p>
          <p className="mt-2 text-sm text-slate-600">Reusable structures available for client assignment.</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contracts Sent</p>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">{contractFunnel.sentRate}% of roster</span>
          </div>
          <p className="mt-1 text-4xl font-bold text-slate-900">{contractFunnel.sent}</p>
          <p className="mt-2 text-sm text-slate-600">Latest contract created for each client.</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contracts Opened</p>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{contractFunnel.openRate}% open rate</span>
          </div>
          <p className="mt-1 text-4xl font-bold text-slate-900">{contractFunnel.opened}</p>
          <p className="mt-2 text-sm text-slate-600">Opened or completed from sent contracts.</p>
        </div>
        <div className="card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contracts Completed</p>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">{contractFunnel.completionRate}% completion rate</span>
          </div>
          <p className="mt-1 text-4xl font-bold text-slate-900">{contractFunnel.completed}</p>
          <p className="mt-2 text-sm text-slate-600">Signed and complete in BreezeDoc.</p>
        </div>
        <div className="card md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Overdue Check-ins (7+ days)</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{overdueCheckins.length}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {overdueCheckins.slice(0, 6).map((item) => (
              <Link key={item.clientId} href={`/messages?peer_id=${item.clientUserId}&preset=checkin_nudge`} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                {item.clientName} {item.daysSinceCheckin === null ? "(No check-in)" : `(${item.daysSinceCheckin}d)`}
              </Link>
            ))}
            {overdueCheckins.length === 0 && <p className="text-sm text-slate-600">No overdue check-ins right now.</p>}
          </div>
        </div>
      </div>
      <div className="card">
        <h2 className="mb-4 text-xl font-bold">Adherence Trend</h2>
        <Line data={chartData} options={{ plugins: { legend: { display: false } } }} />
      </div>
      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Needs Contract</h2>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Unsigned clients</p>
        </div>
        {queueStatus && <p className="mb-3 text-sm text-slate-700">{queueStatus}</p>}
        <div className="space-y-3">
          {localContractQueue.length === 0 && <p className="text-sm text-slate-600">All contracts are complete.</p>}
          {localContractQueue.map((item) => {
            const badgeClass =
              item.status === "opened" || item.status === "viewed"
                ? "bg-blue-100 text-blue-700"
                : item.status === "sent"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-700";
            const statusLabel = item.status.replaceAll("_", " ");
            const contractUrl = item.documentSlug
              ? `https://breezedoc.com/documents/${item.documentSlug}/view`
              : item.documentId
                ? `https://breezedoc.com/documents/${item.documentId}/view`
                : null;

            return (
              <article key={item.clientId} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{item.clientName}</p>
                    <p className="text-xs text-slate-600">
                      {item.sentAt ? `Sent ${new Date(item.sentAt).toLocaleDateString()}` : "Not sent yet"}
                      {item.openedAt ? ` | Opened ${new Date(item.openedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${badgeClass}`}>{statusLabel}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-secondary" onClick={() => sendContract(item.clientId, item.clientName)} disabled={pending === `send-${item.clientId}`}>
                    {pending === `send-${item.clientId}` ? "Sending..." : item.contractId ? "Resend" : "Send"}
                  </button>
                  <button className="btn-secondary" onClick={() => refreshContract(item.clientId, item.clientName)} disabled={pending === `refresh-${item.clientId}`}>
                    {pending === `refresh-${item.clientId}` ? "Refreshing..." : "Refresh"}
                  </button>
                  {contractUrl && (
                    <a href={contractUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                      Open
                    </a>
                  )}
                  <Link href={`/clients/${item.clientId}`} className="btn-secondary">
                    Open Profile
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Priority Queue</h2>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">High-risk follow-up first</p>
        </div>
        <div className="space-y-3">
          {priorityQueue.length === 0 && <p className="text-sm text-slate-600">No urgent client risks detected.</p>}
          {priorityQueue.map((item) => (
            <article key={item.clientId} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{item.clientName}</p>
                  <p className="text-xs text-slate-600">
                    Last check-in: {item.lastCheckinAt} {item.adherencePercent !== null ? `| Adherence: ${item.adherencePercent}%` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    item.risk === "red" ? "bg-rose-100 text-rose-700" : item.risk === "yellow" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {item.risk.toUpperCase()}
                </span>
              </div>
              {item.reasons.length > 0 && <p className="mt-2 text-sm text-slate-700">{item.reasons.join(" | ")}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/messages?peer_id=${item.clientUserId}`} className="btn-secondary">
                  Message
                </Link>
                <Link href={`/messages?peer_id=${item.clientUserId}&preset=checkin_nudge`} className="btn-secondary">
                  Send Nudge
                </Link>
                <Link href={`/clients/${item.clientId}`} className="btn-secondary">
                  Open Profile
                </Link>
                <Link href="/clients" className="btn-secondary">
                  Assign Program
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
