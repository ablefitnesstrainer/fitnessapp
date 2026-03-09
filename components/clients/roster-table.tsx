"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type RosterRow = {
  id: string;
  clientUserId: string;
  clientName: string;
  coachId: string | null;
  coachName: string;
  goal: string;
  equipment: string;
  age: string;
  height: string;
  weight: string;
  hasActiveProgram: boolean;
  createdAt: string;
  intakeSubmitted: boolean;
  intakeSummary: {
    primaryGoal: string;
    trainingExperience: string;
    injuriesOrLimitations: string;
    equipmentAccess: string;
    daysPerWeek: number | null;
    sessionLengthMinutes: number | null;
    nutritionPreferences: string;
    dietaryRestrictions: string;
    stressLevel: number | null;
    sleepHours: number | null;
    readinessToChange: number | null;
    supportNotes: string;
    updatedAt: string;
  } | null;
};

type CoachOption = { id: string; name: string };
type TemplateOption = { id: string; name: string };

export function RosterTable({
  rows,
  coaches,
  templates,
  isAdmin
}: {
  rows: RosterRow[];
  coaches: CoachOption[];
  templates: TemplateOption[];
  isAdmin: boolean;
}) {
  const [localRows, setLocalRows] = useState(rows);
  const [coachSelections, setCoachSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, row.coachId ?? ""]))
  );
  const [templateSelections, setTemplateSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, templates[0]?.id ?? ""]))
  );
  const [assignedProgramIds, setAssignedProgramIds] = useState<Set<string>>(new Set(rows.filter((r) => r.hasActiveProgram).map((r) => r.id)));
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const coachNameById = useMemo(() => new Map(coaches.map((coach) => [coach.id, coach.name])), [coaches]);

  const assignCoach = async (clientId: string) => {
    setPending(`coach-${clientId}`);
    setStatus(null);

    const res = await fetch("/api/clients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        coach_id: coachSelections[clientId] || null
      })
    });

    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to assign coach");
      setPending(null);
      return;
    }

    setStatus("Coach assignment updated.");
    setPending(null);
  };

  const deleteClient = async (clientId: string, clientName: string) => {
    const confirmed = window.confirm(`Delete ${clientName} from roster? This removes their client profile and related logs.`);
    if (!confirmed) return;

    setPending(`delete-${clientId}`);
    setStatus(null);

    const res = await fetch(`/api/clients?client_id=${clientId}`, {
      method: "DELETE"
    });

    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to delete client");
      setPending(null);
      return;
    }

    setLocalRows((prev) => prev.filter((row) => row.id !== clientId));
    setStatus("Client deleted.");
    setPending(null);
  };

  const assignProgram = async (clientId: string) => {
    const templateId = templateSelections[clientId];
    if (!templateId) {
      setStatus("Select a template first.");
      return;
    }

    setPending(`program-${clientId}`);
    setStatus(null);

    const res = await fetch("/api/clients/assign-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        template_id: templateId
      })
    });

    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to assign program");
      setPending(null);
      return;
    }

    setAssignedProgramIds((prev) => new Set(prev).add(clientId));
    setStatus("Program assigned.");
    setPending(null);
  };

  return (
    <div className="space-y-3">
      {status && <p className="text-sm text-slate-700">{status}</p>}
      <div className="card overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.14em] text-slate-500">
              <th className="px-2 py-3 font-semibold">Client</th>
              <th className="px-2 py-3 font-semibold">Coach</th>
              <th className="px-2 py-3 font-semibold">Goal</th>
              <th className="px-2 py-3 font-semibold">Equipment</th>
              <th className="px-2 py-3 font-semibold">Age</th>
              <th className="px-2 py-3 font-semibold">Height</th>
              <th className="px-2 py-3 font-semibold">Weight</th>
              <th className="px-2 py-3 font-semibold">Program</th>
              <th className="px-2 py-3 font-semibold">Intake</th>
              <th className="px-2 py-3 font-semibold">Created</th>
              <th className="px-2 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {localRows.map((row) => {
              const selectedCoachId = coachSelections[row.id] || "";
              const selectedTemplateId = templateSelections[row.id] || "";
              return (
                <tr key={row.id} className="border-b border-slate-100 text-slate-700 align-top">
                  <td className="px-2 py-3 font-semibold text-slate-900">{row.clientName}</td>
                  <td className="px-2 py-3">{coachNameById.get(selectedCoachId) || row.coachName}</td>
                  <td className="px-2 py-3">{row.goal}</td>
                  <td className="px-2 py-3">{row.equipment}</td>
                  <td className="px-2 py-3">{row.age}</td>
                  <td className="px-2 py-3">{row.height}</td>
                  <td className="px-2 py-3">{row.weight}</td>
                  <td className="px-2 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${assignedProgramIds.has(row.id) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {assignedProgramIds.has(row.id) ? "Assigned" : "Unassigned"}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    {row.intakeSubmitted && row.intakeSummary ? (
                      <details className="max-w-[320px]">
                        <summary className="cursor-pointer text-xs font-semibold text-emerald-700">Submitted</summary>
                        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                          <p><span className="font-semibold">Primary goal:</span> {row.intakeSummary.primaryGoal}</p>
                          <p><span className="font-semibold">Training experience:</span> {row.intakeSummary.trainingExperience}</p>
                          <p><span className="font-semibold">Injuries/limitations:</span> {row.intakeSummary.injuriesOrLimitations}</p>
                          <p><span className="font-semibold">Equipment access:</span> {row.intakeSummary.equipmentAccess}</p>
                          <p><span className="font-semibold">Days/week:</span> {row.intakeSummary.daysPerWeek ?? "-"}</p>
                          <p><span className="font-semibold">Session length:</span> {row.intakeSummary.sessionLengthMinutes ?? "-"} min</p>
                          <p><span className="font-semibold">Nutrition preferences:</span> {row.intakeSummary.nutritionPreferences}</p>
                          <p><span className="font-semibold">Dietary restrictions:</span> {row.intakeSummary.dietaryRestrictions}</p>
                          <p><span className="font-semibold">Stress:</span> {row.intakeSummary.stressLevel ?? "-"}/10</p>
                          <p><span className="font-semibold">Sleep:</span> {row.intakeSummary.sleepHours ?? "-"}</p>
                          <p><span className="font-semibold">Readiness:</span> {row.intakeSummary.readinessToChange ?? "-"}/10</p>
                          <p><span className="font-semibold">Support notes:</span> {row.intakeSummary.supportNotes}</p>
                          <p><span className="font-semibold">Updated:</span> {row.intakeSummary.updatedAt}</p>
                        </div>
                      </details>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Not submitted</span>
                    )}
                  </td>
                  <td className="px-2 py-3">{row.createdAt}</td>
                  <td className="px-2 py-3">
                    <div className="flex min-w-[280px] flex-col gap-2">
                      <Link href={`/clients/${row.id}`} className="btn-secondary text-center">
                        Edit Profile
                      </Link>
                      <Link href={`/messages?peer_id=${row.clientUserId}`} className="btn-secondary text-center">
                        Message
                      </Link>

                      <div className="flex gap-2">
                        <select
                          className="input"
                          value={selectedCoachId}
                          onChange={(e) => setCoachSelections((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          disabled={!isAdmin && row.coachId !== null}
                        >
                          <option value="">Unassigned</option>
                          {coaches.map((coach) => (
                            <option key={coach.id} value={coach.id}>
                              {coach.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn-secondary"
                          onClick={() => assignCoach(row.id)}
                          disabled={pending === `coach-${row.id}` || (!isAdmin && row.coachId !== null)}
                        >
                          {pending === `coach-${row.id}` ? "..." : "Set Coach"}
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <select
                          className="input"
                          value={selectedTemplateId}
                          onChange={(e) => setTemplateSelections((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        >
                          <option value="">Select template</option>
                          {templates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                        <button className="btn-primary" onClick={() => assignProgram(row.id)} disabled={pending === `program-${row.id}`}>
                          {pending === `program-${row.id}` ? "..." : "Assign Program"}
                        </button>
                      </div>

                      <button className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100" onClick={() => deleteClient(row.id, row.clientName)} disabled={pending === `delete-${row.id}`}>
                        {pending === `delete-${row.id}` ? "Deleting..." : "Delete Client"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
