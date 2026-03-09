"use client";

import Link from "next/link";
import { CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export function CoachDashboard({
  clients,
  templates,
  checkins,
  priorityQueue
}: {
  clients: number;
  templates: number;
  checkins: { created_at: string; adherence: number | null; nutrition_adherence_percent?: number | null }[];
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

  return (
    <div className="space-y-6">
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
      </div>
      <div className="card">
        <h2 className="mb-4 text-xl font-bold">Adherence Trend</h2>
        <Line data={chartData} options={{ plugins: { legend: { display: false } } }} />
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
