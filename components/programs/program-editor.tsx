"use client";

import { useEffect, useMemo, useState } from "react";
import type { Exercise } from "@/types/db";

type TemplateOption = { id: string; name: string };

type EditorExercise = {
  id?: string;
  exercise_id: string;
  exercise_name?: string;
  primary_muscle?: string | null;
  equipment?: string | null;
  sets: number;
  reps: number;
  warmup_sets: number[];
  block_type: "standard" | "circuit";
  circuit_label: string | null;
  circuit_rounds: number | null;
  order_index: number;
};

type EditorDay = {
  id: string;
  day_number: number;
  exercises: EditorExercise[];
};

type EditorWeek = {
  week_number: number;
  days: EditorDay[];
};

type EditorPayload = {
  template: { id: string; name: string; coach_id: string };
  weeks: EditorWeek[];
};

export function ProgramEditor({ templates, exercises }: { templates: TemplateOption[]; exercises: Exercise[] }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [payload, setPayload] = useState<EditorPayload | null>(null);
  const [weekNumber, setWeekNumber] = useState<number>(1);
  const [dayNumber, setDayNumber] = useState<number>(1);
  const [rows, setRows] = useState<EditorExercise[]>([]);
  const [searchByRow, setSearchByRow] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const exerciseMap = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);

  const loadTemplate = async (nextTemplateId: string) => {
    if (!nextTemplateId) {
      setPayload(null);
      setRows([]);
      return;
    }

    setLoading(true);
    setStatus(null);
    const res = await fetch(`/api/programs/editor?template_id=${encodeURIComponent(nextTemplateId)}`, { cache: "no-store" });
    const data = (await res.json()) as EditorPayload | { error?: string };
    if (!res.ok || !("weeks" in data)) {
      setPayload(null);
      setRows([]);
      setStatus((data as { error?: string }).error || "Failed to load template.");
      setLoading(false);
      return;
    }

    setPayload(data);
    const firstWeek = data.weeks[0];
    const firstDay = firstWeek?.days[0];
    setWeekNumber(firstWeek?.week_number || 1);
    setDayNumber(firstDay?.day_number || 1);
    setRows(firstDay?.exercises || []);
    setSearchByRow({});
    setLoading(false);
  };

  useEffect(() => {
    loadTemplate(templateId);
  }, [templateId]);

  const selectedWeek = useMemo(() => payload?.weeks.find((week) => week.week_number === weekNumber) || null, [payload, weekNumber]);
  const selectedDay = useMemo(
    () => selectedWeek?.days.find((day) => day.day_number === dayNumber) || null,
    [selectedWeek, dayNumber]
  );

  useEffect(() => {
    if (!selectedDay) {
      setRows([]);
      return;
    }
    setRows(selectedDay.exercises);
    setSearchByRow({});
  }, [selectedDay?.id]);

  const updateRow = (index: number, patch: Partial<EditorExercise>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        exercise_id: "",
        sets: 3,
        reps: 10,
        warmup_sets: [10, 8],
        block_type: "standard",
        circuit_label: null,
        circuit_rounds: 3,
        order_index: prev.length
      }
    ]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index).map((row, idx) => ({ ...row, order_index: idx })));
  };

  const saveDay = async () => {
    if (!templateId || !selectedWeek || !selectedDay) return;

    setSaving(true);
    setStatus(null);

    const normalized = rows.map((row, index) => ({
      exercise_id: row.exercise_id,
      sets: Number(row.sets) || 1,
      reps: Number(row.reps) || 1,
      warmup_sets: Array.isArray(row.warmup_sets) ? row.warmup_sets : [],
      block_type: row.block_type,
      circuit_label: row.circuit_label,
      circuit_rounds: row.circuit_rounds,
      order_index: index
    }));

    const res = await fetch("/api/programs/editor", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: templateId,
        week_number: selectedWeek.week_number,
        day_number: selectedDay.day_number,
        exercises: normalized
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to save day.");
      setSaving(false);
      return;
    }

    setStatus(`Saved Week ${selectedWeek.week_number}, Day ${selectedDay.day_number}.`);
    setSaving(false);
    await loadTemplate(templateId);
  };

  return (
    <div className="space-y-4">
      <div className="card grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">Template</label>
          <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.length === 0 && <option value="">No templates</option>}
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Week</label>
          <select
            className="input"
            value={weekNumber}
            onChange={(e) => {
              const nextWeek = Number(e.target.value);
              setWeekNumber(nextWeek);
              const firstDay = payload?.weeks.find((week) => week.week_number === nextWeek)?.days[0];
              if (firstDay) setDayNumber(firstDay.day_number);
            }}
            disabled={!payload?.weeks.length}
          >
            {(payload?.weeks || []).map((week) => (
              <option key={week.week_number} value={week.week_number}>
                Week {week.week_number}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Day</label>
          <select className="input" value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))} disabled={!selectedWeek?.days.length}>
            {(selectedWeek?.days || []).map((day) => (
              <option key={day.id} value={day.day_number}>
                Day {day.day_number}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-600">Loading template...</p>}

      {!loading && selectedDay && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Edit Week {weekNumber} • Day {dayNumber}
            </h2>
            <div className="flex gap-2">
              <button className="btn-secondary" type="button" onClick={addRow}>
                Add Exercise
              </button>
              <button className="btn-primary" type="button" disabled={saving} onClick={saveDay}>
                {saving ? "Saving..." : "Save Day"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {rows.map((row, index) => {
              const search = (searchByRow[index] || "").trim().toLowerCase();
              const selected = exerciseMap.get(row.exercise_id);
              const filtered = exercises
                .filter((option) => {
                  if (!search) return true;
                  const haystack = `${option.name} ${option.primary_muscle || ""} ${option.equipment || ""}`.toLowerCase();
                  return haystack.includes(search);
                })
                .slice(0, 100);
              const options = selected && !filtered.some((option) => option.id === selected.id) ? [selected, ...filtered] : filtered;

              return (
                <div key={`${row.id || "new"}-${index}`} className="rounded-xl border border-slate-200 p-3">
                  <div className="grid gap-2 md:grid-cols-12">
                    <div className="md:col-span-4">
                      <label className="label">Exercise</label>
                      <input
                        className="input mb-2"
                        placeholder="Search exercise..."
                        value={searchByRow[index] ?? ""}
                        onChange={(e) => setSearchByRow((prev) => ({ ...prev, [index]: e.target.value }))}
                      />
                      <select
                        className="input"
                        value={row.exercise_id}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          updateRow(index, { exercise_id: nextId });
                          const nextExercise = exerciseMap.get(nextId);
                          if (nextExercise) {
                            setSearchByRow((prev) => ({ ...prev, [index]: nextExercise.name }));
                          }
                        }}
                      >
                        <option value="">Select exercise</option>
                        {options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                            {option.primary_muscle ? ` • ${option.primary_muscle}` : ""}
                            {option.equipment ? ` • ${option.equipment}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-1">
                      <label className="label">Sets</label>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={row.sets}
                        onChange={(e) => updateRow(index, { sets: Number(e.target.value) })}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="label">Reps</label>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={row.reps}
                        onChange={(e) => updateRow(index, { reps: Number(e.target.value) })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Warm-up reps</label>
                      <input
                        className="input"
                        placeholder="10|8"
                        value={(row.warmup_sets || []).join("|")}
                        onChange={(e) =>
                          updateRow(index, {
                            warmup_sets: e.target.value
                              .split("|")
                              .map((value) => Number(value.trim()))
                              .filter((value) => !Number.isNaN(value))
                          })
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="label">Structure</label>
                      <select
                        className="input"
                        value={row.block_type}
                        onChange={(e) => updateRow(index, { block_type: e.target.value as "standard" | "circuit" })}
                      >
                        <option value="standard">Standard</option>
                        <option value="circuit">Circuit</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button className="btn-secondary w-full" type="button" onClick={() => removeRow(index)}>
                        Remove
                      </button>
                    </div>

                    {row.block_type === "circuit" && (
                      <>
                        <div className="md:col-span-4">
                          <label className="label">Circuit label</label>
                          <input
                            className="input"
                            placeholder="Circuit A"
                            value={row.circuit_label || ""}
                            onChange={(e) => updateRow(index, { circuit_label: e.target.value })}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="label">Circuit rounds</label>
                          <input
                            className="input"
                            type="number"
                            min={1}
                            value={row.circuit_rounds || 3}
                            onChange={(e) => updateRow(index, { circuit_rounds: Number(e.target.value) })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {status && <p className="text-sm font-medium text-slate-700">{status}</p>}
    </div>
  );
}
