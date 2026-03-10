"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HabitManager } from "@/components/habits/habit-manager";

type Props = {
  clientId: string;
  clientName: string;
  clientEmail: string;
  initialContract: {
    id: string;
    documentId: number;
    documentSlug: string | null;
    status: string;
    sentAt: string | null;
    openedAt: string | null;
    completedAt: string | null;
  } | null;
  initial: {
    age: number | null;
    height: number | null;
    goal: string;
    equipment: string;
    currentWeight: number | null;
    sexAtBirth: "male" | "female";
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
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
};

export function ClientProfileEditor({ clientId, clientName, clientEmail, initialContract, initial }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [contract, setContract] = useState(initialContract);
  const [contractStatus, setContractStatus] = useState<string | null>(null);
  const [contractBusy, setContractBusy] = useState(false);
  const [form, setForm] = useState(initial);

  const contractUrl = contract?.documentSlug
    ? `https://breezedoc.com/documents/${contract.documentSlug}/view`
    : contract?.documentId
      ? `https://breezedoc.com/documents/${contract.documentId}/view`
      : null;

  const save = async () => {
    setSaving(true);
    setStatus(null);

    const res = await fetch("/api/clients/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        age: form.age,
        height: form.height,
        goal: form.goal,
        equipment: form.equipment,
        current_weight: form.currentWeight,
        sex_at_birth: form.sexAtBirth,
        primary_goal: form.primaryGoal,
        training_experience: form.trainingExperience,
        injuries_or_limitations: form.injuriesOrLimitations,
        equipment_access: form.equipmentAccess,
        days_per_week: form.daysPerWeek,
        session_length_minutes: form.sessionLengthMinutes,
        nutrition_preferences: form.nutritionPreferences,
        dietary_restrictions: form.dietaryRestrictions,
        stress_level: form.stressLevel,
        sleep_hours: form.sleepHours,
        readiness_to_change: form.readinessToChange,
        support_notes: form.supportNotes,
        calories: form.calories,
        protein: form.protein,
        carbs: form.carbs,
        fat: form.fat
      })
    });

    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to save client profile");
      setSaving(false);
      return;
    }

    setStatus("Client profile updated.");
    setSaving(false);
    router.refresh();
  };

  const recalculateTargets = async () => {
    setSaving(true);
    setStatus(null);

    const res = await fetch("/api/clients/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        age: form.age,
        height: form.height,
        current_weight: form.currentWeight,
        sex_at_birth: form.sexAtBirth,
        goal: form.goal,
        primary_goal: form.primaryGoal,
        days_per_week: form.daysPerWeek,
        auto_calculate_targets: true
      })
    });

    const payload = await res.json();
    if (!res.ok) {
      setStatus(payload.error || "Failed to recalculate targets");
      setSaving(false);
      return;
    }

    setStatus("Targets recalculated with Mifflin-St Jeor.");
    setSaving(false);
    router.refresh();
  };

  const sendContract = async () => {
    setContractBusy(true);
    setContractStatus(null);
    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId })
    });
    const payload = await res.json();
    if (!res.ok) {
      setContractStatus(payload.error || "Failed to send contract");
      setContractBusy(false);
      return;
    }
    setContract(payload.contract || null);
    setContractStatus("Contract sent.");
    setContractBusy(false);
  };

  const refreshContract = async () => {
    setContractBusy(true);
    setContractStatus(null);
    const res = await fetch(`/api/contracts?client_id=${encodeURIComponent(clientId)}&refresh=1`, { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      setContractStatus(payload.error || "Failed to refresh contract");
      setContractBusy(false);
      return;
    }
    setContract(payload.contract || null);
    setContractStatus("Contract status refreshed.");
    setContractBusy(false);
  };

  return (
    <section className="space-y-4">
      <div className="card bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Client Editor</p>
        <h1 className="mt-2 text-3xl font-bold">{clientName}</h1>
        <p className="mt-2 text-sm text-blue-100">Manually update key data for programming, nutrition targets, and coaching decisions.</p>
      </div>

      <div className="card space-y-5">
        <div>
          <h2 className="text-lg font-semibold">At-a-Glance Metrics</h2>
          <p className="text-sm text-slate-600">These values power calorie and macro planning.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">Sex at birth</label>
            <select className="input" value={form.sexAtBirth} onChange={(e) => setForm({ ...form, sexAtBirth: e.target.value as "male" | "female" })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="label">Age</label>
            <input className="input" type="number" min={12} max={99} value={form.age ?? ""} onChange={(e) => setForm({ ...form, age: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Height (inches)</label>
            <input className="input" type="number" min={48} max={90} value={form.height ?? ""} onChange={(e) => setForm({ ...form, height: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Current weight</label>
            <input
              className="input"
              type="number"
              min={70}
              max={600}
              step={0.1}
              value={form.currentWeight ?? ""}
              onChange={(e) => setForm({ ...form, currentWeight: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Coaching Contract (BreezeDoc)</h2>
          <p className="text-sm text-slate-600">Send and track e-signatures for this client contract.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="text-slate-700">
            Recipient: <span className="font-semibold text-slate-900">{clientName}</span> ({clientEmail})
          </p>
          <p className="text-slate-700">
            Status: <span className="font-semibold text-slate-900">{contract?.status || "Not sent"}</span>
          </p>
          {contract?.sentAt && <p className="text-slate-600">Sent: {new Date(contract.sentAt).toLocaleString()}</p>}
          {contract?.openedAt && <p className="text-slate-600">Opened: {new Date(contract.openedAt).toLocaleString()}</p>}
          {contract?.completedAt && <p className="text-slate-600">Completed: {new Date(contract.completedAt).toLocaleString()}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={sendContract} disabled={contractBusy}>
            {contractBusy ? "Sending..." : contract ? "Resend Contract" : "Send Contract"}
          </button>
          <button className="btn-secondary" onClick={refreshContract} disabled={contractBusy}>
            Refresh Status
          </button>
          {contractUrl && (
            <a href={contractUrl} target="_blank" rel="noreferrer" className="btn-secondary">
              Open in BreezeDoc
            </a>
          )}
        </div>
        {contractStatus && <p className="text-sm text-slate-700">{contractStatus}</p>}
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Nutrition Targets</h2>
          <p className="text-sm text-slate-600">Auto-calculate with Mifflin-St Jeor or edit manually.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="label">Calories</label>
            <input className="input" type="number" min={1000} max={7000} value={form.calories ?? ""} onChange={(e) => setForm({ ...form, calories: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Protein</label>
            <input className="input" type="number" min={30} max={400} value={form.protein ?? ""} onChange={(e) => setForm({ ...form, protein: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Carbs</label>
            <input className="input" type="number" min={20} max={900} value={form.carbs ?? ""} onChange={(e) => setForm({ ...form, carbs: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Fat</label>
            <input className="input" type="number" min={10} max={250} value={form.fat ?? ""} onChange={(e) => setForm({ ...form, fat: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
        </div>
        <button className="btn-secondary" onClick={recalculateTargets} disabled={saving}>
          Recalculate with Mifflin-St Jeor
        </button>
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Habit Plan</h2>
          <p className="text-sm text-slate-600">Set accountability habits for this client. They can add personal habits in their own portal.</p>
        </div>
        <HabitManager clientId={clientId} mode="coach" />
      </div>

      <div className="card space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Profile & Intake</h2>
          <p className="text-sm text-slate-600">Update goals, training context, and lifestyle constraints.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Goal</label>
            <input className="input" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
          </div>
          <div>
            <label className="label">Equipment</label>
            <input className="input" value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Primary goal (intake)</label>
            <input className="input" value={form.primaryGoal} onChange={(e) => setForm({ ...form, primaryGoal: e.target.value })} />
          </div>
          <div>
            <label className="label">Training experience</label>
            <input className="input" value={form.trainingExperience} onChange={(e) => setForm({ ...form, trainingExperience: e.target.value })} />
          </div>
          <div>
            <label className="label">Equipment access</label>
            <input className="input" value={form.equipmentAccess} onChange={(e) => setForm({ ...form, equipmentAccess: e.target.value })} />
          </div>
          <div>
            <label className="label">Days per week</label>
            <input className="input" type="number" min={1} max={7} value={form.daysPerWeek ?? ""} onChange={(e) => setForm({ ...form, daysPerWeek: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Session length (minutes)</label>
            <input
              className="input"
              type="number"
              min={15}
              max={180}
              step={5}
              value={form.sessionLengthMinutes ?? ""}
              onChange={(e) => setForm({ ...form, sessionLengthMinutes: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Stress level (1-10)</label>
            <input className="input" type="number" min={1} max={10} value={form.stressLevel ?? ""} onChange={(e) => setForm({ ...form, stressLevel: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Sleep hours</label>
            <input className="input" type="number" min={3} max={12} step={0.5} value={form.sleepHours ?? ""} onChange={(e) => setForm({ ...form, sleepHours: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Readiness (1-10)</label>
            <input className="input" type="number" min={1} max={10} value={form.readinessToChange ?? ""} onChange={(e) => setForm({ ...form, readinessToChange: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Injuries or limitations</label>
            <textarea className="input" value={form.injuriesOrLimitations} onChange={(e) => setForm({ ...form, injuriesOrLimitations: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Nutrition preferences</label>
            <textarea className="input" value={form.nutritionPreferences} onChange={(e) => setForm({ ...form, nutritionPreferences: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Dietary restrictions</label>
            <textarea className="input" value={form.dietaryRestrictions} onChange={(e) => setForm({ ...form, dietaryRestrictions: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Support notes</label>
            <textarea className="input" value={form.supportNotes} onChange={(e) => setForm({ ...form, supportNotes: e.target.value })} />
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Client"}
          </button>
          <Link href="/clients" className="btn-secondary">
            Back to Roster
          </Link>
        </div>
        {status && <p className="text-sm text-slate-700">{status}</p>}
      </div>
    </section>
  );
}
