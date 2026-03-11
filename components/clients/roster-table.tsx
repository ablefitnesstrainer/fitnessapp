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
  lastCheckinAt: string;
  adherencePercent: number | null;
  adherenceTrend: "up" | "down" | "flat" | "na";
  sevenDayHitPercent: number | null;
  hasActiveProgram: boolean;
  createdAt: string;
  contract: {
    id: string;
    documentId: number;
    documentSlug: string | null;
    status: string;
    sentAt: string | null;
    openedAt: string | null;
    completedAt: string | null;
    createdAt: string;
  } | null;
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
  const [startDateSelections, setStartDateSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, new Date().toISOString().slice(0, 10)]))
  );
  const [assignedProgramIds, setAssignedProgramIds] = useState<Set<string>>(new Set(rows.filter((r) => r.hasActiveProgram).map((r) => r.id)));
  const [contractsByClientId, setContractsByClientId] = useState<Record<string, RosterRow["contract"]>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, row.contract]))
  );
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
        template_id: templateId,
        start_on: startDateSelections[clientId] || new Date().toISOString().slice(0, 10)
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

  const sendContract = async (clientId: string, clientName: string) => {
    setPending(`contract-send-${clientId}`);
    setStatus(null);

    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId })
    });

    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || `Failed to send contract for ${clientName}`);
      setPending(null);
      return;
    }

    const updated = payload.contract
      ? {
          id: payload.contract.id as string,
          documentId: Number(payload.contract.document_id),
          documentSlug: (payload.contract.document_slug as string | null) ?? null,
          status: (payload.contract.status as string) ?? "sent",
          sentAt: (payload.contract.sent_at as string | null) ?? null,
          openedAt: (payload.contract.opened_at as string | null) ?? null,
          completedAt: (payload.contract.completed_at as string | null) ?? null,
          createdAt: (payload.contract.created_at as string) ?? new Date().toISOString()
        }
      : null;

    setContractsByClientId((prev) => ({ ...prev, [clientId]: updated }));
    setStatus(`Contract sent to ${clientName}.`);
    setPending(null);
  };

  const refreshContract = async (clientId: string, clientName: string) => {
    setPending(`contract-refresh-${clientId}`);
    setStatus(null);

    const res = await fetch(`/api/contracts?client_id=${encodeURIComponent(clientId)}&refresh=1`, { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || `Failed to refresh contract for ${clientName}`);
      setPending(null);
      return;
    }

    const updated = payload.contract
      ? {
          id: payload.contract.id as string,
          documentId: Number(payload.contract.document_id),
          documentSlug: (payload.contract.document_slug as string | null) ?? null,
          status: (payload.contract.status as string) ?? "sent",
          sentAt: (payload.contract.sent_at as string | null) ?? null,
          openedAt: (payload.contract.opened_at as string | null) ?? null,
          completedAt: (payload.contract.completed_at as string | null) ?? null,
          createdAt: (payload.contract.created_at as string) ?? new Date().toISOString()
        }
      : null;

    setContractsByClientId((prev) => ({ ...prev, [clientId]: updated }));
    setStatus(`Contract status refreshed for ${clientName}.`);
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
              <th className="px-2 py-3 font-semibold">Last Check-in</th>
              <th className="px-2 py-3 font-semibold">Adherence Trend</th>
              <th className="px-2 py-3 font-semibold">7d Nutrition Hit</th>
              <th className="px-2 py-3 font-semibold">Program</th>
              <th className="px-2 py-3 font-semibold">Intake</th>
              <th className="px-2 py-3 font-semibold">Contract</th>
              <th className="px-2 py-3 font-semibold">Created</th>
              <th className="px-2 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {localRows.map((row) => {
              const selectedCoachId = coachSelections[row.id] || "";
              const selectedTemplateId = templateSelections[row.id] || "";
              const contract = contractsByClientId[row.id] ?? null;
              const contractStatus = contract?.status || "not_sent";
              const contractBadgeClass =
                contractStatus === "completed"
                  ? "bg-emerald-100 text-emerald-700"
                  : contractStatus === "opened" || contractStatus === "viewed"
                    ? "bg-blue-100 text-blue-700"
                    : contractStatus === "sent"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600";
              const contractLabel = contractStatus.replaceAll("_", " ");
              const contractUrl = contract?.documentSlug
                ? `https://breezedoc.com/documents/${contract.documentSlug}/view`
                : contract?.documentId
                  ? `https://breezedoc.com/documents/${contract.documentId}/view`
                  : null;
              return (
                <tr key={row.id} className="border-b border-slate-100 text-slate-700 align-top">
                  <td className="px-2 py-3 font-semibold text-slate-900">{row.clientName}</td>
                  <td className="px-2 py-3">{coachNameById.get(selectedCoachId) || row.coachName}</td>
                  <td className="px-2 py-3">{row.goal}</td>
                  <td className="px-2 py-3">{row.equipment}</td>
                  <td className="px-2 py-3">{row.age}</td>
                  <td className="px-2 py-3">{row.height}</td>
                  <td className="px-2 py-3">{row.weight}</td>
                  <td className="px-2 py-3">{row.lastCheckinAt}</td>
                  <td className="px-2 py-3">
                    {row.adherencePercent === null ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">No data</span>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.adherenceTrend === "up"
                            ? "bg-emerald-100 text-emerald-700"
                            : row.adherenceTrend === "down"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {row.adherenceTrend === "up" ? "↑" : row.adherenceTrend === "down" ? "↓" : "→"} {row.adherencePercent}%
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {row.sevenDayHitPercent === null ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">No target</span>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.sevenDayHitPercent >= 80
                            ? "bg-emerald-100 text-emerald-700"
                            : row.sevenDayHitPercent >= 50
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {row.sevenDayHitPercent}%
                      </span>
                    )}
                  </td>
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
                  <td className="px-2 py-3">
                    <div className="space-y-1 text-xs">
                      <span className={`inline-flex rounded-full px-2 py-1 font-semibold capitalize ${contractBadgeClass}`}>{contractLabel}</span>
                      {contract?.completedAt && <p className="text-slate-500">Completed {new Date(contract.completedAt).toLocaleDateString()}</p>}
                      {!contract?.completedAt && contract?.sentAt && <p className="text-slate-500">Sent {new Date(contract.sentAt).toLocaleDateString()}</p>}
                    </div>
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
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="btn-secondary"
                          onClick={() =>
                            setStartDateSelections((prev) => ({
                              ...prev,
                              [row.id]: new Date().toISOString().slice(0, 10)
                            }))
                          }
                        >
                          Start Today
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            const now = new Date();
                            const day = now.getDay();
                            const delta = (8 - day) % 7 || 7;
                            const monday = new Date(now);
                            monday.setDate(now.getDate() + delta);
                            setStartDateSelections((prev) => ({
                              ...prev,
                              [row.id]: monday.toISOString().slice(0, 10)
                            }));
                          }}
                        >
                          Next Monday
                        </button>
                      </div>
                      <input
                        className="input"
                        type="date"
                        value={startDateSelections[row.id] || new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setStartDateSelections((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      />

                      <button className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100" onClick={() => deleteClient(row.id, row.clientName)} disabled={pending === `delete-${row.id}`}>
                        {pending === `delete-${row.id}` ? "Deleting..." : "Delete Client"}
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button className="btn-secondary" onClick={() => sendContract(row.id, row.clientName)} disabled={pending === `contract-send-${row.id}`}>
                          {pending === `contract-send-${row.id}` ? "Sending..." : contract ? "Resend Contract" : "Send Contract"}
                        </button>
                        <button className="btn-secondary" onClick={() => refreshContract(row.id, row.clientName)} disabled={pending === `contract-refresh-${row.id}`}>
                          {pending === `contract-refresh-${row.id}` ? "Refreshing..." : "Refresh Status"}
                        </button>
                      </div>
                      {contractUrl && (
                        <a href={contractUrl} target="_blank" rel="noreferrer" className="btn-secondary text-center">
                          Open Contract
                        </a>
                      )}
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
