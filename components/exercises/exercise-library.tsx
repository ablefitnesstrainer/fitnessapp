"use client";

import { useMemo, useState } from "react";
import type { Exercise } from "@/types/db";

export function ExerciseLibrary({ initialExercises, canImport }: { initialExercises: Exercise[]; canImport: boolean }) {
  const [exercises, setExercises] = useState(initialExercises);
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return exercises.filter((exercise) => {
      const matchesSearch = exercise.name.toLowerCase().includes(search.toLowerCase());
      const matchesMuscle = muscle ? exercise.primary_muscle === muscle : true;
      const matchesEquipment = equipment ? exercise.equipment === equipment : true;
      return matchesSearch && matchesMuscle && matchesEquipment;
    });
  }, [exercises, search, muscle, equipment]);

  const muscleOptions = Array.from(new Set(exercises.map((e) => e.primary_muscle).filter(Boolean))).sort();
  const equipmentOptions = Array.from(new Set(exercises.map((e) => e.equipment).filter(Boolean))).sort();

  const onCsvUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    setImporting(true);
    setStatus(null);

    const response = await fetch("/api/exercises/import", {
      method: "POST",
      body: formData
    });

    const payload = await response.json();

    if (!response.ok) {
      setStatus(payload.error || "Import failed");
      setImporting(false);
      return;
    }

    setExercises(payload.exercises);
    setStatus(`Imported ${payload.inserted} exercises`);
    setImporting(false);
  };

  return (
    <div className="space-y-4">
      <div className="card grid gap-4 md:grid-cols-4">
        <input className="input" placeholder="Search exercise" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">All muscles</option>
          {muscleOptions.map((option) => (
            <option key={option} value={option || ""}>
              {option}
            </option>
          ))}
        </select>
        <select className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          <option value="">All equipment</option>
          {equipmentOptions.map((option) => (
            <option key={option} value={option || ""}>
              {option}
            </option>
          ))}
        </select>
        {canImport ? (
          <label className="btn-secondary cursor-pointer text-center">
            {importing ? "Importing..." : "Import CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={importing}
              onChange={(e) => e.target.files?.[0] && onCsvUpload(e.target.files[0])}
            />
          </label>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-medium text-slate-500">Read-only</div>
        )}
      </div>

      {status && <p className="text-sm text-slate-700">{status}</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((exercise) => (
          <article key={exercise.id} className="card space-y-2">
            <h3 className="font-semibold">{exercise.name}</h3>
            <p className="text-sm text-slate-600">
              {exercise.primary_muscle} | {exercise.equipment} | {exercise.difficulty}
            </p>
            {exercise.video_url && (
              <a className="text-sm text-brand-600" href={exercise.video_url} target="_blank" rel="noreferrer">
                Demo Video
              </a>
            )}
            {exercise.instructions && <p className="text-sm text-slate-700">{exercise.instructions}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}
