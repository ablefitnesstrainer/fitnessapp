"use client";

import { useMemo, useState } from "react";

type WorkoutExercise = {
  program_exercise_id: string;
  exercise_id: string;
  name: string;
  primary_muscle: string | null;
  equipment: string | null;
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

type SetEntry = {
  reps: number;
  weight: number;
};

export function WorkoutLogger({
  clientId,
  dayId,
  exercises,
  exerciseOptions
}: {
  clientId: string;
  dayId: string;
  exercises: WorkoutExercise[];
  exerciseOptions: ExerciseOption[];
}) {
  const [activeExercises, setActiveExercises] = useState(exercises);
  const [logSets, setLogSets] = useState<Record<string, SetEntry[]>>(() =>
    Object.fromEntries(
      exercises.map((exercise) => [
        exercise.program_exercise_id,
        Array.from({ length: exercise.sets }).map(() => ({ reps: exercise.reps, weight: 0 }))
      ])
    )
  );
  const [restTime, setRestTime] = useState(90);
  const [timer, setTimer] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const updateSet = (programExerciseId: string, setIdx: number, field: keyof SetEntry, value: number) => {
    setLogSets((prev) => {
      const copy = { ...prev };
      copy[programExerciseId] = [...(copy[programExerciseId] || [])];
      copy[programExerciseId][setIdx] = {
        ...copy[programExerciseId][setIdx],
        [field]: value
      };
      return copy;
    });
  };

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

  const totalVolume = useMemo(() => {
    return Object.entries(logSets).reduce((sum, [, sets]) => {
      return sum + sets.reduce((exerciseSum, set) => exerciseSum + set.reps * set.weight, 0);
    }, 0);
  }, [logSets]);

  const submitWorkout = async () => {
    setLoading(true);
    setStatus(null);

    const payload = activeExercises.flatMap((exercise) =>
      (logSets[exercise.program_exercise_id] || []).map((entry, idx) => ({
        exercise_id: exercise.exercise_id,
        set_number: idx + 1,
        reps: entry.reps,
        weight: entry.weight
      }))
    );

    const response = await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        day_id: dayId,
        total_volume: totalVolume,
        sets: payload
      })
    });

    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Failed to submit workout");
      setLoading(false);
      return;
    }

    setStatus(`Workout saved. Duration ${data.duration_minutes} min | Volume ${Math.round(totalVolume)}`);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3">
        <label className="label">Rest timer (seconds)</label>
        <input className="input max-w-24" type="number" value={restTime} onChange={(e) => setRestTime(Number(e.target.value))} />
        <button className="btn-secondary" onClick={startTimer}>
          Start Timer
        </button>
        <p className="text-sm text-slate-600">Total volume: {Math.round(totalVolume)}</p>
      </div>

      {activeExercises.map((exercise) => (
        <article key={exercise.program_exercise_id} className="card space-y-3">
          <h3 className="text-lg font-semibold">{exercise.name}</h3>
          <p className="text-sm text-slate-600">
            Target: {exercise.sets} x {exercise.reps} | Warmup: {exercise.warmup_sets.join(", ") || "none"}
          </p>

          <div className="grid gap-2 md:grid-cols-2">
            {(logSets[exercise.program_exercise_id] || []).map((set, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm">Set {idx + 1}</span>
                <input
                  className="input"
                  type="number"
                  value={set.reps}
                  onChange={(e) => updateSet(exercise.program_exercise_id, idx, "reps", Number(e.target.value))}
                />
                <input
                  className="input"
                  type="number"
                  value={set.weight}
                  onChange={(e) => updateSet(exercise.program_exercise_id, idx, "weight", Number(e.target.value))}
                />
              </div>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
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
                if (select?.value) permanentSwap(exercise.program_exercise_id, select.value);
              }}
            >
              Save Permanent Swap
            </button>
            <button className="btn-secondary" onClick={startTimer}>
              Rest
            </button>
          </div>
        </article>
      ))}

      {status && <p className="text-sm text-slate-700">{status}</p>}
      <button className="btn-primary" disabled={loading} onClick={submitWorkout}>
        {loading ? "Saving..." : "Complete Workout"}
      </button>
    </div>
  );
}
