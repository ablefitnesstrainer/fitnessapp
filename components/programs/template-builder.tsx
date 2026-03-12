"use client";

import { useState } from "react";
import type { Exercise } from "@/types/db";

type DayExercise = {
  exercise_id: string;
  sets: number;
  reps: number;
  warmup_sets: number[];
};

type DayPlan = {
  day_number: number;
  exercises: DayExercise[];
};

export function TemplateBuilder({ exercises }: { exercises: Exercise[] }) {
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState("hypertrophy");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [equipmentType, setEquipmentType] = useState("full gym");
  const [totalWeeks, setTotalWeeks] = useState(8);
  const [repProgression, setRepProgression] = useState(1);
  const [setProgressionEvery, setSetProgressionEvery] = useState(4);
  const [deloadWeek, setDeloadWeek] = useState(7);
  const [days, setDays] = useState<DayPlan[]>([
    {
      day_number: 1,
      exercises: [{ exercise_id: "", sets: 3, reps: 10, warmup_sets: [10, 8] }]
    }
  ]);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState<Record<string, string>>({});

  const getRowKey = (dayIndex: number, exIndex: number) => `${dayIndex}-${exIndex}`;
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  const setDaysCount = (count: number) => {
    setDaysPerWeek(count);
    setDays((prev) => {
      const existing = [...prev];
      while (existing.length < count) {
        existing.push({
          day_number: existing.length + 1,
          exercises: [{ exercise_id: "", sets: 3, reps: 10, warmup_sets: [10, 8] }]
        });
      }
      return existing.slice(0, count).map((day, idx) => ({ ...day, day_number: idx + 1 }));
    });
  };

  const addExercise = (dayIndex: number) => {
    setDays((prev) => {
      const copy = [...prev];
      copy[dayIndex].exercises.push({ exercise_id: "", sets: 3, reps: 10, warmup_sets: [10, 8] });
      return copy;
    });
  };

  const updateExercise = (dayIndex: number, exIndex: number, field: keyof DayExercise, value: string) => {
    setDays((prev) => {
      const copy = [...prev];
      const target = copy[dayIndex].exercises[exIndex];
      if (field === "warmup_sets") {
        target.warmup_sets = value
          .split("|")
          .map((v) => Number(v.trim()))
          .filter((v) => !Number.isNaN(v));
      } else if (field === "sets" || field === "reps") {
        target[field] = Number(value);
      } else {
        target[field] = value as never;
      }
      return copy;
    });
  };

  const onSave = async () => {
    setSaving(true);
    setStatus(null);

    const payload = {
      name,
      goal_type: goalType,
      days_per_week: daysPerWeek,
      experience_level: experienceLevel,
      equipment_type: equipmentType,
      days: days.map((day) => ({
        ...day,
        exercises: day.exercises.filter((exercise) => exercise.exercise_id)
      }))
    };

    const res = await fetch("/api/programs/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to save template");
      setSaving(false);
      return;
    }

    if (totalWeeks > 1) {
      const generateRes = await fetch("/api/programs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: data.template.id,
          weeks: totalWeeks,
          rep_progression: repProgression,
          set_progression_every: setProgressionEvery,
          deload_week: deloadWeek
        })
      });
      const generatePayload = await generateRes.json();
      if (!generateRes.ok) {
        setStatus(`Template saved, but week auto-population failed: ${generatePayload.error || "Unknown error"}`);
        setSaving(false);
        return;
      }
      setStatus(`Saved template ${data.template.name} and auto-populated to ${totalWeeks} weeks.`);
    } else {
      setStatus(`Saved template ${data.template.name}.`);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 md:grid-cols-2">
        <input className="input" placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Goal type" value={goalType} onChange={(e) => setGoalType(e.target.value)} />
        <select className="input" value={daysPerWeek} onChange={(e) => setDaysCount(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <option key={d} value={d}>
              {d} days/week
            </option>
          ))}
        </select>
        <input className="input" placeholder="Experience level" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} />
        <input className="input" placeholder="Equipment type" value={equipmentType} onChange={(e) => setEquipmentType(e.target.value)} />
        <select className="input" value={totalWeeks} onChange={(e) => setTotalWeeks(Number(e.target.value))}>
          {[1, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((wk) => (
            <option key={wk} value={wk}>
              {wk === 1 ? "1 week (no auto-population)" : `${wk} weeks total`}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="number"
          min={0}
          max={3}
          value={repProgression}
          onChange={(e) => setRepProgression(Number(e.target.value))}
          placeholder="Rep progression / week"
        />
        <input
          className="input"
          type="number"
          min={2}
          max={8}
          value={setProgressionEvery}
          onChange={(e) => setSetProgressionEvery(Number(e.target.value))}
          placeholder="Add 1 set every N weeks"
        />
        <input
          className="input"
          type="number"
          min={1}
          max={24}
          value={deloadWeek}
          onChange={(e) => setDeloadWeek(Number(e.target.value))}
          placeholder="Deload week"
        />
      </div>
      <p className="text-sm text-slate-600">
        Build Week 1 here. On save, the app can auto-populate Weeks 2-{totalWeeks} using your progression settings.
      </p>

      {days.map((day, dayIndex) => (
        <section key={day.day_number} className="card space-y-3">
          <h3 className="text-lg font-semibold">Day {day.day_number}</h3>
          {day.exercises.map((exercise, exIndex) => (
            <div key={`${day.day_number}-${exIndex}`} className="grid gap-2 md:grid-cols-4">
              <div>
                <label className="label">Exercise</label>
                <input
                  className="input mb-2"
                  placeholder="Search exercise..."
                  value={exerciseSearch[getRowKey(dayIndex, exIndex)] ?? ""}
                  onChange={(e) =>
                    setExerciseSearch((prev) => ({
                      ...prev,
                      [getRowKey(dayIndex, exIndex)]: e.target.value
                    }))
                  }
                />
                <select
                  className="input"
                  value={exercise.exercise_id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    updateExercise(dayIndex, exIndex, "exercise_id", nextId);
                    const selected = exerciseById.get(nextId);
                    if (selected) {
                      setExerciseSearch((prev) => ({
                        ...prev,
                        [getRowKey(dayIndex, exIndex)]: selected.name
                      }));
                    }
                  }}
                >
                  <option value="">Select exercise</option>
                  {(() => {
                    const search = (exerciseSearch[getRowKey(dayIndex, exIndex)] || "").trim().toLowerCase();
                    const selected = exerciseById.get(exercise.exercise_id);
                    const filtered = exercises
                      .filter((option) => {
                        if (!search) return true;
                        const haystack = `${option.name} ${option.primary_muscle || ""} ${option.equipment || ""}`.toLowerCase();
                        return haystack.includes(search);
                      })
                      .slice(0, 100);

                    const options = selected && !filtered.some((option) => option.id === selected.id) ? [selected, ...filtered] : filtered;
                    return options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                        {option.primary_muscle ? ` • ${option.primary_muscle}` : ""}
                        {option.equipment ? ` • ${option.equipment}` : ""}
                      </option>
                    ));
                  })()}
                </select>
                <p className="mt-1 text-xs text-slate-500">Type to filter. Showing up to 100 matches.</p>
              </div>
              <div>
                <label className="label">Sets</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  placeholder="e.g. 3"
                  value={exercise.sets}
                  onChange={(e) => updateExercise(dayIndex, exIndex, "sets", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Reps</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  placeholder="e.g. 10"
                  value={exercise.reps}
                  onChange={(e) => updateExercise(dayIndex, exIndex, "reps", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Warm-up reps</label>
                <input
                  className="input"
                  placeholder="10|8"
                  value={exercise.warmup_sets.join("|")}
                  onChange={(e) => updateExercise(dayIndex, exIndex, "warmup_sets", e.target.value)}
                />
              </div>
            </div>
          ))}

          <button className="btn-secondary" onClick={() => addExercise(dayIndex)}>
            Add Exercise
          </button>
        </section>
      ))}

      {status && <p className="text-sm text-slate-700">{status}</p>}
      <button className="btn-primary" onClick={onSave} disabled={saving || !name.trim()}>
        {saving ? "Saving..." : "Save Template"}
      </button>
    </div>
  );
}
