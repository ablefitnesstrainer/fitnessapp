"use client";

import { CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export function CoachDashboard({
  clients,
  templates,
  checkins
}: {
  clients: number;
  templates: number;
  checkins: { created_at: string; adherence: number }[];
}) {
  const chartData = {
    labels: checkins.map((c) => new Date(c.created_at).toLocaleDateString()),
    datasets: [
      {
        label: "Adherence",
        data: checkins.map((c) => c.adherence),
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
    </div>
  );
}
