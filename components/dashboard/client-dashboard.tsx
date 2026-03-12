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
type UpcomingChallenge = {
  id: string;
  name: string;
  description: string | null;
  starts_on: string;
  ends_on: string;
  status: "draft" | "active" | "closed";
};

export function ClientDashboard({
  workoutLogs,
  mealLogs,
  checkins,
  upcomingChallenge,
  welcomeVideo
}: {
  workoutLogs: WorkoutLog[];
  mealLogs: MealLog[];
  checkins: Checkin[];
  upcomingChallenge?: UpcomingChallenge | null;
  welcomeVideo?: { url?: string; title?: string } | null;
}) {
  const toYouTubeEmbed = (url: string | undefined) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}`;
      if (parsed.hostname.includes("youtube.com") && parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (parsed.hostname.includes("youtube.com") && parsed.pathname.startsWith("/embed/")) return url;
      return null;
    } catch {
      return null;
    }
  };

  const welcomeEmbed = toYouTubeEmbed(welcomeVideo?.url);

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
      {upcomingChallenge && (
        <div className="card border-blue-200 bg-blue-50">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Next Month Challenge</p>
          <h2 className="mt-1 text-xl font-bold text-blue-900">{upcomingChallenge.name}</h2>
          <p className="mt-1 text-sm text-blue-800">
            Starts {new Date(`${upcomingChallenge.starts_on}T00:00:00`).toLocaleDateString()} • Ends{" "}
            {new Date(`${upcomingChallenge.ends_on}T00:00:00`).toLocaleDateString()}
          </p>
          {upcomingChallenge.description && <p className="mt-2 text-sm text-blue-900">{upcomingChallenge.description}</p>}
          <a href="/challenges" className="mt-3 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">
            View Challenge Details
          </a>
        </div>
      )}

      {welcomeVideo?.url && (
        <div className="card space-y-2">
          <h2 className="text-xl font-bold">{welcomeVideo.title || "Welcome Video"}</h2>
          {welcomeEmbed ? (
            <iframe
              title={welcomeVideo.title || "Welcome video"}
              src={welcomeEmbed}
              className="h-72 w-full rounded-xl border border-slate-200"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <a href={welcomeVideo.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
              Watch welcome video
            </a>
          )}
        </div>
      )}

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
