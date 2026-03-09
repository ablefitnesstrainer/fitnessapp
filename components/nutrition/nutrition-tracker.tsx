"use client";

import { useMemo, useState } from "react";

type Target = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Meal = {
  id: string;
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
};

type QuickMeal = {
  id: string;
  client_id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
};

function dayKey(dateValue: string) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function pct(value: number, target: number) {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function MacroRing({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const progress = pct(value, target);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div
        className="relative h-14 w-14 rounded-full"
        style={{
          background: `conic-gradient(${color} ${progress * 3.6}deg, #e2e8f0 0deg)`
        }}
      >
        <div className="absolute inset-1 grid place-items-center rounded-full bg-white text-[11px] font-semibold text-slate-700">{progress}%</div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900">
          {value} / {target}
        </p>
      </div>
    </div>
  );
}

export function NutritionTracker({
  clientId,
  target,
  initialMeals,
  initialQuickMeals
}: {
  clientId: string;
  target: Target | null;
  initialMeals: Meal[];
  initialQuickMeals: QuickMeal[];
}) {
  const [meals, setMeals] = useState(initialMeals);
  const [quickMeals, setQuickMeals] = useState(initialQuickMeals);
  const [form, setForm] = useState({ food_name: "", calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [targetForm, setTargetForm] = useState<Target>(target || { calories: 2200, protein: 160, carbs: 220, fat: 70 });
  const [status, setStatus] = useState<string | null>(null);
  const [savingTargets, setSavingTargets] = useState(false);

  const dailyTotalsMap = useMemo(() => {
    const map = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
    for (const meal of meals) {
      const key = dayKey(meal.created_at);
      const current = map.get(key) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
      current.calories += meal.calories;
      current.protein += meal.protein;
      current.carbs += meal.carbs;
      current.fat += meal.fat;
      map.set(key, current);
    }
    return map;
  }, [meals]);

  const todayKey = dayKey(new Date().toISOString());
  const todayTotals = dailyTotalsMap.get(todayKey) || { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const weeklyAverages = useMemo(() => {
    const days: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(dayKey(d.toISOString()));
    }

    const totals = days.reduce(
      (acc, key) => {
        const day = dailyTotalsMap.get(key) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        acc.calories += day.calories;
        acc.protein += day.protein;
        acc.carbs += day.carbs;
        acc.fat += day.fat;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      calories: Math.round(totals.calories / 7),
      protein: Math.round(totals.protein / 7),
      carbs: Math.round(totals.carbs / 7),
      fat: Math.round(totals.fat / 7)
    };
  }, [dailyTotalsMap]);

  const addMeal = async (payload?: { food_name: string; calories: number; protein: number; carbs: number; fat: number }) => {
    const mealPayload = payload || form;
    const response = await fetch("/api/nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, ...mealPayload })
    });

    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Failed to log meal");
      return;
    }

    setMeals([data.meal, ...meals]);
    setForm({ food_name: "", calories: 0, protein: 0, carbs: 0, fat: 0 });
    setStatus("Meal logged.");
  };

  const saveQuickMeal = async () => {
    if (!form.food_name.trim()) {
      setStatus("Add a food name before saving quick meal.");
      return;
    }

    const response = await fetch("/api/nutrition/quick-meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, name: form.food_name, calories: form.calories, protein: form.protein, carbs: form.carbs, fat: form.fat })
    });

    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Failed to save quick meal");
      return;
    }

    setQuickMeals([data.quickMeal, ...quickMeals]);
    setStatus("Quick meal saved.");
  };

  const deleteQuickMeal = async (id: string) => {
    const response = await fetch(`/api/nutrition/quick-meals?id=${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Failed to delete quick meal");
      return;
    }

    setQuickMeals((prev) => prev.filter((item) => item.id !== id));
    setStatus("Quick meal removed.");
  };

  const saveTargets = async () => {
    setSavingTargets(true);
    setStatus(null);
    const response = await fetch("/api/nutrition/targets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, ...targetForm })
    });

    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Failed to update targets");
      setSavingTargets(false);
      return;
    }

    setTargetForm(data.target);
    setStatus("Nutrition targets updated.");
    setSavingTargets(false);
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Today Progress</h2>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Macro target rings</p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <MacroRing label="Calories" value={todayTotals.calories} target={targetForm.calories} color="#0f6adf" />
          <MacroRing label="Protein" value={todayTotals.protein} target={targetForm.protein} color="#16a34a" />
          <MacroRing label="Carbs" value={todayTotals.carbs} target={targetForm.carbs} color="#f59e0b" />
          <MacroRing label="Fat" value={todayTotals.fat} target={targetForm.fat} color="#ef4444" />
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">7-Day Daily Averages</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="text-slate-500">Calories</p><p className="text-xl font-bold">{weeklyAverages.calories}</p></div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="text-slate-500">Protein</p><p className="text-xl font-bold">{weeklyAverages.protein}</p></div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="text-slate-500">Carbs</p><p className="text-xl font-bold">{weeklyAverages.carbs}</p></div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="text-slate-500">Fat</p><p className="text-xl font-bold">{weeklyAverages.fat}</p></div>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Nutrition Targets</h3>
          <button className="btn-primary" onClick={saveTargets} disabled={savingTargets}>
            {savingTargets ? "Saving..." : "Save Targets"}
          </button>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <input className="input" type="number" value={targetForm.calories} onChange={(e) => setTargetForm({ ...targetForm, calories: Number(e.target.value) })} placeholder="Calories" />
          <input className="input" type="number" value={targetForm.protein} onChange={(e) => setTargetForm({ ...targetForm, protein: Number(e.target.value) })} placeholder="Protein" />
          <input className="input" type="number" value={targetForm.carbs} onChange={(e) => setTargetForm({ ...targetForm, carbs: Number(e.target.value) })} placeholder="Carbs" />
          <input className="input" type="number" value={targetForm.fat} onChange={(e) => setTargetForm({ ...targetForm, fat: Number(e.target.value) })} placeholder="Fat" />
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="text-lg font-semibold">Add Meal</h3>
        <div className="grid gap-2 md:grid-cols-5">
          <input className="input" placeholder="Food" value={form.food_name} onChange={(e) => setForm({ ...form, food_name: e.target.value })} />
          <input className="input" type="number" placeholder="Calories" value={form.calories} onChange={(e) => setForm({ ...form, calories: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Protein" value={form.protein} onChange={(e) => setForm({ ...form, protein: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Carbs" value={form.carbs} onChange={(e) => setForm({ ...form, carbs: Number(e.target.value) })} />
          <input className="input" type="number" placeholder="Fat" value={form.fat} onChange={(e) => setForm({ ...form, fat: Number(e.target.value) })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => addMeal()}>
            Add Meal
          </button>
          <button className="btn-secondary" onClick={saveQuickMeal}>
            Save as Quick Meal
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="text-lg font-semibold">Quick Meals</h3>
        {quickMeals.length === 0 && <p className="text-sm text-slate-600">No quick meals saved yet.</p>}
        <div className="grid gap-2 md:grid-cols-2">
          {quickMeals.map((meal) => (
            <div key={meal.id} className="rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">{meal.name}</p>
              <p className="text-slate-600">{meal.calories} kcal | P {meal.protein} C {meal.carbs} F {meal.fat}</p>
              <div className="mt-2 flex gap-2">
                <button className="btn-secondary" onClick={() => addMeal({ food_name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat })}>
                  Quick Add
                </button>
                <button className="btn-secondary" onClick={() => deleteQuickMeal(meal.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {status && <p className="text-sm text-slate-700">{status}</p>}

      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">Meal Log</h3>
        <div className="space-y-2">
          {meals.map((meal) => (
            <div key={meal.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{meal.food_name}</p>
                <p className="text-xs text-slate-500">{formatDate(meal.created_at)}</p>
              </div>
              <span>
                {meal.calories} kcal | P {meal.protein} C {meal.carbs} F {meal.fat}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
