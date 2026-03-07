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
  const [days, setDays] = useState<DayPlan[]>([
    {
      day_number: 1,
      exercises: [{ exercise_id: "", sets: 3, reps: 10, warmup_sets: [10, 8] }]
    }
  ]);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

    setStatus(`Saved template ${data.template.name}`);
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
      </div>

      {days.map((day, dayIndex) => (
        <section key={day.day_number} className="card space-y-3">
          <h3 className="text-lg font-semibold">Day {day.day_number}</h3>
          {day.exercises.map((exercise, exIndex) => (
            <div key={`${day.day_number}-${exIndex}`} className="grid gap-2 md:grid-cols-4">
              <select
                className="input"
                value={exercise.exercise_id}
                onChange={(e) => updateExercise(dayIndex, exIndex, "exercise_id", e.target.value)}
              >
                <option value="">Select exercise</option>
                {exercises.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                value={exercise.sets}
                onChange={(e) => updateExercise(dayIndex, exIndex, "sets", e.target.value)}
              />
              <input
                className="input"
                type="number"
                value={exercise.reps}
                onChange={(e) => updateExercise(dayIndex, exIndex, "reps", e.target.value)}
              />
              <input
                className="input"
                placeholder="Warmup reps (10|8)"
                value={exercise.warmup_sets.join("|")}
                onChange={(e) => updateExercise(dayIndex, exIndex, "warmup_sets", e.target.value)}
              />
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
