"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type WorkoutExercise = {
  program_exercise_id: string;
  exercise_id: string;
  name: string;
  primary_muscle: string | null;
  equipment: string | null;
  video_url: string | null;
  sets: number;
  reps: number;
  warmup_sets: number[];
};

type ExerciseOption = {
  id: string;
  name: string;
  primary_muscle: string | null;
  equipment: string | null;
};

type SaveStatus = "idle" | "saving" | "saved" | "pending" | "error";

type SetEntry = {
  reps: number;
  weight: number;
  status: SaveStatus;
  savedAt: string | null;
  manualWeight?: boolean;
};

type ExerciseState = {
  warmups: SetEntry[];
  working: SetEntry[];
};

type PendingCommit = {
  programExerciseId: string;
  exercise_id: string;
  is_warmup: boolean;
  set_number: number;
  reps: number;
  weight: number;
};

const normalizeEquipment = (equipment: string | null) => (equipment || "").trim().toLowerCase();
const isBodyweightExercise = (equipment: string | null) => {
  const normalized = normalizeEquipment(equipment);
  return normalized.includes("bodyweight") || normalized === "none" || normalized === "body weight";
};

const toRoundedWeight = (value: number) => Math.max(0, Math.round(value * 10) / 10);

const suggestedWarmupFactor = (warmupIndex: number, warmupCount: number) => {
  if (warmupIndex === 0) return 0.5;
  if (warmupIndex === 1) return 0.7;
  if (warmupCount <= 2) return 0.7;
  const start = 0.5;
  const end = 0.85;
  const ratio = warmupIndex / Math.max(1, warmupCount - 1);
  return start + ratio * (end - start);
};

const toYouTubeEmbed = (url: string | null) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (parsed.pathname.startsWith("/embed/")) return url;
      if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.split("/").filter(Boolean)[1];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
    return null;
  } catch {
    return null;
  }
};

const setKey = (programExerciseId: string, isWarmup: boolean, setNumber: number) => `${programExerciseId}:${isWarmup ? "w" : "s"}:${setNumber}`;

export function WorkoutLogger({
  clientId,
  dayId,
  weekNumber,
  dayNumber,
  dayLabel,
  exercises,
  exerciseOptions
}: {
  clientId: string;
  dayId: string;
  weekNumber: number;
  dayNumber: number;
  dayLabel?: string;
  exercises: WorkoutExercise[];
  exerciseOptions: ExerciseOption[];
}) {
  const initialSetState = useMemo<Record<string, ExerciseState>>(
    () =>
      Object.fromEntries(
        exercises.map((exercise) => [
          exercise.program_exercise_id,
          {
            warmups: exercise.warmup_sets.map((rep) => ({ reps: rep, weight: 0, status: "idle" as SaveStatus, savedAt: null })),
            working: Array.from({ length: exercise.sets }).map(() => ({ reps: exercise.reps, weight: 0, status: "idle" as SaveStatus, savedAt: null }))
          }
        ])
      ),
    [exercises]
  );

  const [activeExercises, setActiveExercises] = useState(exercises);
  const [sessionLogId, setSessionLogId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<"loading" | "in_progress" | "completed">("loading");
  const [setsByExercise, setSetsByExercise] = useState<Record<string, ExerciseState>>(initialSetState);
  const [openVideoFor, setOpenVideoFor] = useState<Record<string, boolean>>({});
  const [restTime, setRestTime] = useState(90);
  const [timer, setTimer] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const queueStorageKey = useMemo(() => {
    if (!sessionLogId) return null;
    return `workout-pending:${clientId}:${dayId}:${sessionLogId}`;
  }, [clientId, dayId, sessionLogId]);

  const startTimer = () => {
    if (timer) window.clearInterval(timer);
    let remaining = restTime;
    setStatus(`Rest: ${remaining}s`);
    const id = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(id);
        setStatus("Rest complete");
        setTimer(null);
      } else {
        setStatus(`Rest: ${remaining}s`);
      }
    }, 1000);
    setTimer(id);
  };

  const updateExerciseRow = (programExerciseId: string, isWarmup: boolean, setIndex: number, patch: Partial<SetEntry>) => {
    setSetsByExercise((prev) => {
      const next = { ...prev };
      const section = isWarmup ? "warmups" : "working";
      const list = [...(next[programExerciseId]?.[section] || [])];
      list[setIndex] = { ...list[setIndex], ...patch };
      next[programExerciseId] = { ...(next[programExerciseId] || { warmups: [], working: [] }), [section]: list };
      return next;
    });
  };

  const queueRead = useCallback((): PendingCommit[] => {
    if (!queueStorageKey) return [];
    try {
      const raw = window.localStorage.getItem(queueStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PendingCommit[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [queueStorageKey]);

  const queueWrite = useCallback(
    (items: PendingCommit[]) => {
      if (!queueStorageKey) return;
      window.localStorage.setItem(queueStorageKey, JSON.stringify(items));
    },
    [queueStorageKey]
  );

  const queuePush = useCallback(
    (item: PendingCommit) => {
      const current = queueRead();
      const filtered = current.filter(
        (entry) =>
          !(
            entry.programExerciseId === item.programExerciseId &&
            entry.is_warmup === item.is_warmup &&
            entry.set_number === item.set_number
          )
      );
      filtered.push(item);
      queueWrite(filtered);
    },
    [queueRead, queueWrite]
  );

  const queueRemove = useCallback(
    (item: PendingCommit) => {
      const current = queueRead();
      const filtered = current.filter(
        (entry) =>
          !(
            entry.programExerciseId === item.programExerciseId &&
            entry.is_warmup === item.is_warmup &&
            entry.set_number === item.set_number
          )
      );
      queueWrite(filtered);
    },
    [queueRead, queueWrite]
  );

  const commitSet = useCallback(
    async (item: PendingCommit) => {
      if (!sessionLogId) throw new Error("Session not started");
      const response = await fetch("/api/workouts/session/commit-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          log_id: sessionLogId,
          program_exercise_id: item.programExerciseId,
          exercise_id: item.exercise_id,
          is_warmup: item.is_warmup,
          set_number: item.set_number,
          reps: item.reps,
          weight: item.weight
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save set");
      }

      return payload.saved_at as string;
    },
    [sessionLogId]
  );

  const flushPendingQueue = useCallback(async () => {
    const pendingItems = queueRead();
    if (!pendingItems.length) return;

    for (const item of pendingItems) {
      try {
        const savedAt = await commitSet(item);
        updateExerciseRow(item.programExerciseId, item.is_warmup, item.set_number - 1, {
          status: "saved",
          savedAt
        });
        queueRemove(item);
      } catch {
        updateExerciseRow(item.programExerciseId, item.is_warmup, item.set_number - 1, {
          status: navigator.onLine ? "error" : "pending"
        });
        if (!navigator.onLine) break;
      }
    }
  }, [commitSet, queueRead, queueRemove]);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      setSessionState("loading");
      const response = await fetch("/api/workouts/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, day_id: dayId })
      });
      const payload = await response.json();
      if (!response.ok) {
        if (mounted) {
          setStatus(payload.error || "Failed to start workout session");
          setSessionState("in_progress");
        }
        return;
      }

      if (!mounted) return;

      setSessionLogId(payload.log_id || null);
      setSessionStartedAt(payload.started_at || null);
      setSetsByExercise((prev) => {
        const next = { ...prev };
        for (const savedSet of payload.restored_sets || []) {
          const programExerciseId = savedSet.program_exercise_id as string | null;
          if (!programExerciseId || !next[programExerciseId]) continue;
          const isWarmup = Boolean(savedSet.is_warmup);
          const section = isWarmup ? "warmups" : "working";
          const idx = Math.max(0, Number(savedSet.set_number) - 1);
          const sectionRows = [...next[programExerciseId][section]];
          if (!sectionRows[idx]) continue;
          sectionRows[idx] = {
            ...sectionRows[idx],
            reps: Number(savedSet.reps) || sectionRows[idx].reps,
            weight: Number(savedSet.weight) || 0,
            status: "saved",
            savedAt: savedSet.created_at as string
          };
          next[programExerciseId] = { ...next[programExerciseId], [section]: sectionRows };
        }
        return next;
      });
      setSessionState("in_progress");
    };

    void boot();
    return () => {
      mounted = false;
    };
  }, [clientId, dayId, initialSetState]);

  useEffect(() => {
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [timer]);

  useEffect(() => {
    if (!sessionLogId) return;
    void flushPendingQueue();
  }, [sessionLogId, flushPendingQueue]);

  useEffect(() => {
    const onOnline = () => {
      void flushPendingQueue();
    };
    const onFocus = () => {
      void flushPendingQueue();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [flushPendingQueue]);

  const totalVolume = useMemo(
    () =>
      Object.values(setsByExercise).reduce((sum, entry) => {
        const workingVolume = entry.working.reduce((inner, set) => inner + set.reps * set.weight, 0);
        const warmupVolume = entry.warmups.reduce((inner, set) => inner + set.reps * set.weight, 0);
        return sum + workingVolume + warmupVolume;
      }, 0),
    [setsByExercise]
  );

  const swapCandidates = (exercise: WorkoutExercise) =>
    exerciseOptions.filter(
      (candidate) =>
        candidate.id !== exercise.exercise_id &&
        candidate.primary_muscle === exercise.primary_muscle &&
        (!exercise.equipment || candidate.equipment === exercise.equipment)
    );

  const temporarySwap = (programExerciseId: string, toExerciseId: string) => {
    const replacement = exerciseOptions.find((option) => option.id === toExerciseId);
    if (!replacement) return;
    setActiveExercises((prev) =>
      prev.map((exercise) =>
        exercise.program_exercise_id === programExerciseId
          ? {
              ...exercise,
              exercise_id: replacement.id,
              name: replacement.name,
              primary_muscle: replacement.primary_muscle,
              equipment: replacement.equipment
            }
          : exercise
      )
    );
  };

  const permanentSwap = async (programExerciseId: string, toExerciseId: string) => {
    const response = await fetch("/api/workouts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "swap_permanent",
        program_exercise_id: programExerciseId,
        exercise_id: toExerciseId
      })
    });

    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Failed to save permanent swap");
      return;
    }

    temporarySwap(programExerciseId, toExerciseId);
    setStatus("Permanent swap saved");
  };

  const commitSetFromUi = async (programExerciseId: string, isWarmup: boolean, setIndex: number) => {
    const exercise = activeExercises.find((entry) => entry.program_exercise_id === programExerciseId);
    if (!exercise) return;
    const section = isWarmup ? "warmups" : "working";
    const row = setsByExercise[programExerciseId]?.[section]?.[setIndex];
    if (!row) return;

    const payload: PendingCommit = {
      programExerciseId,
      exercise_id: exercise.exercise_id,
      is_warmup: isWarmup,
      set_number: setIndex + 1,
      reps: Math.max(0, Math.floor(row.reps)),
      weight: Math.max(0, Number(row.weight))
    };

    updateExerciseRow(programExerciseId, isWarmup, setIndex, { status: "saving" });
    try {
      const savedAt = await commitSet(payload);
      updateExerciseRow(programExerciseId, isWarmup, setIndex, { status: "saved", savedAt });
      queueRemove(payload);
    } catch (error) {
      if (!navigator.onLine) {
        queuePush(payload);
        updateExerciseRow(programExerciseId, isWarmup, setIndex, { status: "pending" });
      } else {
        updateExerciseRow(programExerciseId, isWarmup, setIndex, { status: "error" });
        setStatus(error instanceof Error ? error.message : "Failed to save set");
      }
    }
  };

  const statusPillClass = (statusValue: SaveStatus) => {
    if (statusValue === "saved") return "bg-emerald-100 text-emerald-700";
    if (statusValue === "pending") return "bg-amber-100 text-amber-700";
    if (statusValue === "error") return "bg-rose-100 text-rose-700";
    if (statusValue === "saving") return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-600";
  };

  const statusLabel = (statusValue: SaveStatus) => {
    if (statusValue === "saved") return "Saved";
    if (statusValue === "pending") return "Pending sync";
    if (statusValue === "error") return "Error - retry";
    if (statusValue === "saving") return "Saving...";
    return "Not saved";
  };

  const applyWarmupSuggestions = (programExerciseId: string) => {
    const state = setsByExercise[programExerciseId];
    const exercise = activeExercises.find((item) => item.program_exercise_id === programExerciseId);
    if (!state || !exercise || !state.warmups.length) return;

    if (isBodyweightExercise(exercise.equipment)) {
      setSetsByExercise((prev) => {
        const next = { ...prev };
        const warmups = [...next[programExerciseId].warmups].map((set) => ({ ...set, weight: 0 }));
        next[programExerciseId] = { ...next[programExerciseId], warmups };
        return next;
      });
      return;
    }

    const topSetWeight = Math.max(0, ...state.working.map((set) => Number(set.weight) || 0));
    if (topSetWeight <= 0) return;

    setSetsByExercise((prev) => {
      const next = { ...prev };
      const warmups = [...next[programExerciseId].warmups].map((set, idx) => {
        if (set.manualWeight) return set;
        return {
          ...set,
          weight: toRoundedWeight(topSetWeight * suggestedWarmupFactor(idx, next[programExerciseId].warmups.length))
        };
      });
      next[programExerciseId] = { ...next[programExerciseId], warmups };
      return next;
    });
  };

  const updateWorkingSetWeight = (programExerciseId: string, setIndex: number, weightValue: number) => {
    setSetsByExercise((prev) => {
      const next = { ...prev };
      const state = next[programExerciseId];
      if (!state) return prev;
      const working = [...state.working];
      working[setIndex] = { ...working[setIndex], weight: weightValue };

      let warmups = [...state.warmups];
      const exercise = activeExercises.find((entry) => entry.program_exercise_id === programExerciseId);
      if (exercise && !isBodyweightExercise(exercise.equipment) && warmups.length) {
        const topSetWeight = Math.max(0, ...working.map((set) => Number(set.weight) || 0));
        if (topSetWeight > 0) {
          warmups = warmups.map((set, idx) => {
            if (set.manualWeight) return set;
            return {
              ...set,
              weight: toRoundedWeight(topSetWeight * suggestedWarmupFactor(idx, warmups.length))
            };
          });
        }
      }

      next[programExerciseId] = {
        ...state,
        working,
        warmups
      };
      return next;
    });
  };

  const completeWorkout = async () => {
    if (!sessionLogId) return;
    setCompleting(true);
    setStatus(null);
    await flushPendingQueue();

    const response = await fetch("/api/workouts/session/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_id: sessionLogId })
    });
    const payload = await response.json();

    if (!response.ok) {
      setStatus(payload.error || "Failed to complete workout");
      setCompleting(false);
      return;
    }

    setSessionState("completed");
    setStatus(
      `Workout saved. Duration ${payload.duration_minutes} min | Volume ${Math.round(payload.total_volume || 0)} | Next: Week ${payload.next_week_number ?? weekNumber}, Day ${payload.next_day_number ?? dayNumber}`
    );
    setCompleting(false);
  };

  if (sessionState === "loading") {
    return <p className="text-sm text-slate-600">Preparing workout session...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Current Session</p>
            <h2 className="text-xl font-bold text-slate-900">
              Week {weekNumber} • {dayLabel || `Day ${dayNumber}`}
            </h2>
            <p className="text-sm text-slate-600">
              Status: <span className="font-semibold capitalize">{sessionState.replace("_", " ")}</span>
              {sessionStartedAt ? ` • Started ${new Date(sessionStartedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-700">Total volume: {Math.round(totalVolume)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="label">Rest timer (seconds)</label>
          <input className="input max-w-24" type="number" min={15} value={restTime} onChange={(e) => setRestTime(Number(e.target.value))} />
          <button className="btn-secondary" onClick={startTimer}>
            Start Timer
          </button>
        </div>
      </div>

      {activeExercises.map((exercise) => {
        const state = setsByExercise[exercise.program_exercise_id];
        const youtubeEmbed = toYouTubeEmbed(exercise.video_url);
        const openVideo = openVideoFor[exercise.program_exercise_id] || false;

        return (
          <article key={exercise.program_exercise_id} className="card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{exercise.name}</h3>
                <p className="text-sm text-slate-600">
                  {exercise.primary_muscle || "General"} • {exercise.equipment || "Equipment varies"}
                </p>
              </div>
              <div className="flex gap-2">
                {exercise.video_url && (
                  <button
                    className="btn-secondary"
                    onClick={() => setOpenVideoFor((prev) => ({ ...prev, [exercise.program_exercise_id]: !prev[exercise.program_exercise_id] }))}
                  >
                    {openVideo ? "Hide Demo" : "Watch Demo"}
                  </button>
                )}
                <button className="btn-secondary" onClick={startTimer}>
                  Rest
                </button>
              </div>
            </div>

            {openVideo && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {youtubeEmbed ? (
                  <iframe
                    title={`${exercise.name} demo`}
                    src={youtubeEmbed}
                    className="h-64 w-full rounded-lg border border-slate-200"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <a href={exercise.video_url || "#"} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                    Open demo video
                  </a>
                )}
              </div>
            )}

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Warm-up Sets</h4>
                <button className="btn-secondary" onClick={() => applyWarmupSuggestions(exercise.program_exercise_id)}>
                  Suggest Weights
                </button>
              </div>
              {!state?.warmups?.length && <p className="text-sm text-slate-500">No warm-up sets programmed.</p>}
              <div className="space-y-2">
                {(state?.warmups || []).map((set, idx) => (
                  <div key={setKey(exercise.program_exercise_id, true, idx + 1)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="grid gap-2 md:grid-cols-[140px_1fr_1fr_auto_auto] md:items-end">
                      <p className="text-sm font-semibold text-slate-800">Warm-up {idx + 1}</p>
                      <div>
                        <label className="label">Reps</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          placeholder="Reps"
                          value={set.reps}
                          onChange={(e) => updateExerciseRow(exercise.program_exercise_id, true, idx, { reps: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="label">Weight (lb)</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step={0.5}
                          placeholder={isBodyweightExercise(exercise.equipment) ? "Bodyweight" : "Weight"}
                          value={set.weight}
                          onChange={(e) =>
                            updateExerciseRow(exercise.program_exercise_id, true, idx, {
                              weight: Number(e.target.value),
                              manualWeight: true
                            })
                          }
                        />
                      </div>
                      <button className="btn-secondary" onClick={() => void commitSetFromUi(exercise.program_exercise_id, true, idx)}>
                        Commit Set
                      </button>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusPillClass(set.status)}`}>{statusLabel(set.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Working Sets</h4>
              <div className="space-y-2">
                {(state?.working || []).map((set, idx) => (
                  <div key={setKey(exercise.program_exercise_id, false, idx + 1)} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="grid gap-2 md:grid-cols-[140px_1fr_1fr_auto_auto] md:items-end">
                      <p className="text-sm font-semibold text-slate-800">Set {idx + 1}</p>
                      <div>
                        <label className="label">Reps</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          placeholder="Reps"
                          value={set.reps}
                          onChange={(e) => updateExerciseRow(exercise.program_exercise_id, false, idx, { reps: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="label">Weight (lb)</label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step={0.5}
                          placeholder="Weight"
                          value={set.weight}
                          onChange={(e) => updateWorkingSetWeight(exercise.program_exercise_id, idx, Number(e.target.value))}
                        />
                      </div>
                      <button className="btn-secondary" onClick={() => void commitSetFromUi(exercise.program_exercise_id, false, idx)}>
                        Commit Set
                      </button>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusPillClass(set.status)}`}>{statusLabel(set.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <select
                className="input"
                onChange={(e) => {
                  if (!e.target.value) return;
                  temporarySwap(exercise.program_exercise_id, e.target.value);
                }}
                defaultValue=""
              >
                <option value="">Temporary swap</option>
                {swapCandidates(exercise).map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
              <button
                className="btn-secondary"
                onClick={(e) => {
                  const select = e.currentTarget.parentElement?.querySelector("select") as HTMLSelectElement | null;
                  if (select?.value) void permanentSwap(exercise.program_exercise_id, select.value);
                }}
              >
                Save Permanent Swap
              </button>
            </div>
          </article>
        );
      })}

      {status && <p className="text-sm text-slate-700">{status}</p>}
      <button className="btn-primary" disabled={completing || !sessionLogId || sessionState === "completed"} onClick={() => void completeWorkout()}>
        {completing ? "Completing..." : sessionState === "completed" ? "Workout Completed" : "Complete Workout"}
      </button>
    </div>
  );
}
