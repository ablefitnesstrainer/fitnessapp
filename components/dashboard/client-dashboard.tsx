"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  ArcElement
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { LeaderboardPanel } from "@/components/challenges/leaderboard-panel";
import { EncouragementBoard } from "@/components/community/encouragement-board";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, ArcElement);

type WorkoutLog = { completed_at: string | null; total_volume: number | null };
type MealLog = { created_at: string; calories: number; protein: number; carbs: number; fat: number };
type Checkin = { created_at: string; energy?: number; sleep?: number; stress?: number; adherence: number };

export function ClientDashboard({
  workoutLogs,
  mealLogs,
  checkins
}: {
  workoutLogs: WorkoutLog[];
  mealLogs: MealLog[];
  checkins: Checkin[];
}) {
  const workoutData = {
    labels: workoutLogs.map((w) => (w.completed_at ? new Date(w.completed_at).toLocaleDateString() : "pending")),
    datasets: [
      {
        label: "Workout Volume",
        data: workoutLogs.map((w) => Number(w.total_volume || 0)),
        borderColor: "#0f6adf",
        backgroundColor: "rgba(15,106,223,0.14)",
        fill: true,
        tension: 0.35
      }
    ]
  };

  const latestMeal = mealLogs[mealLogs.length - 1];
  const macroData = {
    labels: ["Protein", "Carbs", "Fat"],
    datasets: [
      {
        data: [latestMeal?.protein || 0, latestMeal?.carbs || 0, latestMeal?.fat || 0],
        backgroundColor: ["#1f9d65", "#0f6adf", "#f08b35"]
      }
    ]
  };

  const checkinData = {
    labels: checkins.map((c) => new Date(c.created_at).toLocaleDateString()),
    datasets: [
      { label: "Energy", data: checkins.map((c) => c.energy ?? 0), borderColor: "#1f9d65", tension: 0.35 },
      { label: "Sleep", data: checkins.map((c) => c.sleep ?? 0), borderColor: "#0f6adf", tension: 0.35 },
      { label: "Stress", data: checkins.map((c) => c.stress ?? 0), borderColor: "#cc3b4a", tension: 0.35 },
      { label: "Adherence", data: checkins.map((c) => c.adherence), borderColor: "#f08b35", tension: 0.35 }
    ]
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Workouts Logged</p>
          <p className="mt-1 text-4xl font-bold">{workoutLogs.length}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Meals Logged</p>
          <p className="mt-1 text-4xl font-bold">{mealLogs.length}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Check-ins</p>
          <p className="mt-1 text-4xl font-bold">{checkins.length}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-xl font-bold">Workout Trend</h2>
          <Line data={workoutData} options={{ plugins: { legend: { display: false } } }} />
        </div>
        <div className="card">
          <h2 className="mb-3 text-xl font-bold">Latest Macro Split</h2>
          <div className="mx-auto max-w-[280px]">
            <Doughnut data={macroData} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-xl font-bold">Check-in Trend</h2>
        <Line data={checkinData} />
      </div>

      <LeaderboardPanel />
      <EncouragementBoard />
    </div>
  );
}
