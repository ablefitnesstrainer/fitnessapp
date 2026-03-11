"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type IntakePayload = {
  sex_at_birth: "male" | "female";
  age: number;
  height: number;
  current_weight: number;
  primary_goal: string;
  training_experience: string;
  injuries_or_limitations: string;
  equipment_access: string;
  days_per_week: number;
  session_length_minutes: number;
  nutrition_preferences: string;
  dietary_restrictions: string;
  stress_level: number;
  sleep_hours: number;
  readiness_to_change: number;
  support_notes: string;
  liability_acknowledged: boolean;
};

export function IntakeForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<IntakePayload>({
    sex_at_birth: "male",
    age: 30,
    height: 68,
    current_weight: 170,
    primary_goal: "",
    training_experience: "",
    injuries_or_limitations: "",
    equipment_access: "",
    days_per_week: 3,
    session_length_minutes: 60,
    nutrition_preferences: "",
    dietary_restrictions: "",
    stress_level: 5,
    sleep_hours: 7,
    readiness_to_change: 7,
    support_notes: "",
    liability_acknowledged: false
  });
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!form.primary_goal.trim()) {
      setStatus("Primary goal is required.");
      return;
    }
    if (!form.liability_acknowledged) {
      setStatus("You must acknowledge the safety and liability disclaimer to continue.");
      return;
    }

    setSubmitting(true);
    setStatus(null);

    const res = await fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, ...form })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Failed to submit intake");
      setSubmitting(false);
      return;
    }

    setStatus("Intake submitted successfully.");
    setSubmitting(false);
    router.refresh();
  };

  return (
    <div className="card space-y-4 border-2 border-blue-200">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Initial Client Intake (Required)</h2>
        <p className="text-sm text-slate-600">Complete this once before continuing to the rest of the app.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Sex at birth</label>
          <select className="input" value={form.sex_at_birth} onChange={(e) => setForm({ ...form, sex_at_birth: e.target.value as "male" | "female" })}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className="label">Age</label>
          <input className="input" type="number" min={12} max={99} value={form.age} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Height (inches)</label>
          <input className="input" type="number" min={48} max={90} value={form.height} onChange={(e) => setForm({ ...form, height: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Current body weight</label>
          <input
            className="input"
            type="number"
            min={70}
            max={600}
            step={0.1}
            value={form.current_weight}
            onChange={(e) => setForm({ ...form, current_weight: Number(e.target.value) })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Primary goal</label>
          <input className="input" value={form.primary_goal} onChange={(e) => setForm({ ...form, primary_goal: e.target.value })} />
        </div>
        <div>
          <label className="label">Training experience</label>
          <input className="input" value={form.training_experience} onChange={(e) => setForm({ ...form, training_experience: e.target.value })} />
        </div>
        <div>
          <label className="label">Equipment access</label>
          <input className="input" value={form.equipment_access} onChange={(e) => setForm({ ...form, equipment_access: e.target.value })} />
        </div>
        <div>
          <label className="label">Days per week</label>
          <input className="input" type="number" min={1} max={7} value={form.days_per_week} onChange={(e) => setForm({ ...form, days_per_week: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Session length (minutes)</label>
          <input
            className="input"
            type="number"
            min={15}
            max={180}
            step={5}
            value={form.session_length_minutes}
            onChange={(e) => setForm({ ...form, session_length_minutes: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Stress level (1-10)</label>
          <input className="input" type="number" min={1} max={10} value={form.stress_level} onChange={(e) => setForm({ ...form, stress_level: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Average sleep hours</label>
          <input
            className="input"
            type="number"
            min={3}
            max={12}
            step={0.5}
            value={form.sleep_hours}
            onChange={(e) => setForm({ ...form, sleep_hours: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Readiness to change (1-10)</label>
          <input
            className="input"
            type="number"
            min={1}
            max={10}
            value={form.readiness_to_change}
            onChange={(e) => setForm({ ...form, readiness_to_change: Number(e.target.value) })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Injuries or limitations</label>
          <textarea
            className="input"
            value={form.injuries_or_limitations}
            onChange={(e) => setForm({ ...form, injuries_or_limitations: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Nutrition preferences</label>
          <textarea className="input" value={form.nutrition_preferences} onChange={(e) => setForm({ ...form, nutrition_preferences: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Dietary restrictions</label>
          <textarea className="input" value={form.dietary_restrictions} onChange={(e) => setForm({ ...form, dietary_restrictions: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Support notes</label>
          <textarea className="input" value={form.support_notes} onChange={(e) => setForm({ ...form, support_notes: e.target.value })} />
        </div>
      </div>

      <button className="btn-primary" onClick={onSubmit} disabled={submitting}>
        {submitting ? "Submitting..." : "Submit Intake"}
      </button>
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-semibold">Exercise & Nutrition Safety Acknowledgment</p>
        <p className="mt-1">
          I understand that physical exercise and dietary changes involve inherent risks, including risk of injury, illness, or other adverse outcomes.
          I confirm I should consult a qualified physician before beginning or changing any exercise or nutrition program.
          I voluntarily participate and assume personal responsibility for my choices and outcomes.
        </p>
        <label className="mt-2 flex items-start gap-2">
          <input
            type="checkbox"
            checked={form.liability_acknowledged}
            onChange={(e) => setForm({ ...form, liability_acknowledged: e.target.checked })}
          />
          <span>
            I have read and agree to the safety disclaimer above, the{" "}
            <Link href="/terms" className="font-semibold text-blue-700 hover:text-blue-800">
              Terms of Service
            </Link>
            , and the{" "}
            <Link href="/privacy" className="font-semibold text-blue-700 hover:text-blue-800">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
      </div>
      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}
