"use client";

import { useEffect, useMemo, useState } from "react";

type Habit = {
  id: string;
  client_id: string;
  name: string;
  target_value: number;
  unit: string;
  is_active: boolean;
  created_at: string;
};

type HabitLog = {
  id: string;
  habit_id: string;
  client_id: string;
  log_date: string;
  value: number;
  completed: boolean;
  notes?: string | null;
  created_at: string;
};

type Props = {
  clientId: string;
  mode: "client" | "coach";
};

const presetHabits = [
  { name: "Daily steps", target_value: 7000, unit: "steps" },
  { name: "Water intake", target_value: 8, unit: "glasses" },
  { name: "Sleep", target_value: 7, unit: "hours" },
  { name: "Mobility", target_value: 10, unit: "minutes" }
];

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function getLast7Days() {
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
}

export function HabitManager({ clientId, mode }: Props) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [newHabit, setNewHabit] = useState({ name: "", target_value: 1, unit: "times" });

  const load = async () => {
    setLoading(true);
    const [habitsRes, logsRes] = await Promise.all([
      fetch(`/api/habits?client_id=${encodeURIComponent(clientId)}`, { cache: "no-store" }),
      mode === "client"
        ? fetch(`/api/habits/logs?client_id=${encodeURIComponent(clientId)}&days=7`, { cache: "no-store" })
        : Promise.resolve(new Response(JSON.stringify({ logs: [] }), { status: 200 }))
    ]);

    const habitsPayload = await habitsRes.json();
    if (!habitsRes.ok) {
      setStatus(habitsPayload.error || "Failed to load habits");
      setLoading(false);
      return;
    }

    const logsPayload = await logsRes.json();
    if (!logsRes.ok) {
      setStatus(logsPayload.error || "Failed to load logs");
      setLoading(false);
      return;
    }

    setHabits(habitsPayload.habits || []);
    setLogs(logsPayload.logs || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [clientId, mode]);

  const logsByHabitAndDate = useMemo(() => {
    const map = new Map<string, HabitLog>();
    for (const log of logs) {
      map.set(`${log.habit_id}:${log.log_date}`, log);
    }
    return map;
  }, [logs]);

  const sevenDayCompliance = useMemo(() => {
    if (mode !== "client" || habits.length === 0) return null;
    const days = getLast7Days();
    let totalChecks = 0;
    let completedChecks = 0;
    for (const habit of habits) {
      for (const day of days) {
        totalChecks += 1;
        const log = logsByHabitAndDate.get(`${habit.id}:${day}`);
        if (log?.completed) completedChecks += 1;
      }
    }
    return totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;
  }, [habits, logsByHabitAndDate, mode]);

  const createHabit = async (payload?: { name: string; target_value: number; unit: string }) => {
    const habitInput = payload || newHabit;
    if (!habitInput.name.trim()) {
      setStatus("Habit name is required.");
      return;
    }

    setPending("create");
    setStatus(null);
    const res = await fetch("/api/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, ...habitInput })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to add habit");
      setPending(null);
      return;
    }

    setHabits((prev) => [...prev, data.habit]);
    setNewHabit({ name: "", target_value: 1, unit: "times" });
    setStatus("Habit added.");
    setPending(null);
  };

  const archiveHabit = async (habitId: string) => {
    setPending(`archive-${habitId}`);
    const res = await fetch(`/api/habits?client_id=${encodeURIComponent(clientId)}&habit_id=${encodeURIComponent(habitId)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to remove habit");
      setPending(null);
      return;
    }

    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    setStatus("Habit removed.");
    setPending(null);
  };

  const updateTodayLog = async (habit: Habit, next: { value: number; completed: boolean }) => {
    const date = todayDateKey();
    setPending(`log-${habit.id}`);

    const res = await fetch("/api/habits/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        habit_id: habit.id,
        log_date: date,
        value: next.value,
        completed: next.completed
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to save habit log");
      setPending(null);
      return;
    }

    setLogs((prev) => {
      const filtered = prev.filter((log) => !(log.habit_id === habit.id && log.log_date === date));
      return [data.log, ...filtered];
    });
    setPending(null);
  };

  if (loading) return <div className="card text-sm text-slate-600">Loading habits...</div>;

  return (
    <div className="space-y-4">
      {mode === "client" && (
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">7-Day Habit Compliance</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{sevenDayCompliance ?? 0}%</p>
          <p className="mt-1 text-sm text-slate-600">Completed habit check-offs over the last 7 days.</p>
        </div>
      )}

      <div className="card space-y-3">
        <h3 className="text-lg font-semibold">{mode === "client" ? "Your Habits" : "Client Habits"}</h3>
        <div className="flex flex-wrap gap-2">
          {presetHabits.map((habit) => (
            <button key={habit.name} className="btn-secondary" onClick={() => createHabit(habit)} disabled={pending === "create"}>
              Add {habit.name}
            </button>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <input className="input md:col-span-2" placeholder="Habit name" value={newHabit.name} onChange={(e) => setNewHabit((prev) => ({ ...prev, name: e.target.value }))} />
          <input
            className="input"
            type="number"
            min={1}
            step={1}
            value={newHabit.target_value}
            onChange={(e) => setNewHabit((prev) => ({ ...prev, target_value: Number(e.target.value) || 1 }))}
          />
          <input className="input" placeholder="Unit (steps, glasses, min)" value={newHabit.unit} onChange={(e) => setNewHabit((prev) => ({ ...prev, unit: e.target.value }))} />
        </div>
        <button className="btn-primary" onClick={() => createHabit()} disabled={pending === "create"}>
          {pending === "create" ? "Adding..." : "Add Habit"}
        </button>
      </div>

      <div className="card space-y-2">
        {habits.length === 0 && <p className="text-sm text-slate-600">No habits yet. Add your first one above.</p>}
        {habits.map((habit) => {
          const todayLog = logsByHabitAndDate.get(`${habit.id}:${todayDateKey()}`);
          const currentValue = todayLog?.value ?? 0;
          const completed = todayLog?.completed ?? false;
          return (
            <div key={habit.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{habit.name}</p>
                  <p className="text-xs text-slate-600">
                    Target: {habit.target_value} {habit.unit}
                  </p>
                </div>
                <button className="text-sm font-semibold text-rose-700" onClick={() => archiveHabit(habit.id)} disabled={pending === `archive-${habit.id}`}>
                  {pending === `archive-${habit.id}` ? "..." : "Remove"}
                </button>
              </div>

              {mode === "client" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    className="input w-28"
                    type="number"
                    min={0}
                    step={habit.unit === "steps" ? 100 : 1}
                    value={currentValue}
                    onChange={(e) => {
                      const nextValue = Number(e.target.value) || 0;
                      const autoCompleted = nextValue >= habit.target_value;
                      void updateTodayLog(habit, { value: nextValue, completed: autoCompleted });
                    }}
                  />
                  <span className="text-xs text-slate-600">{habit.unit}</span>
                  <label className="ml-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={(e) => {
                        void updateTodayLog(habit, { value: currentValue, completed: e.target.checked });
                      }}
                    />
                    Completed
                  </label>
                  <span className="text-xs text-slate-500">{pending === `log-${habit.id}` ? "Saving..." : ""}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}
