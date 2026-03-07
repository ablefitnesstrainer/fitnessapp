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

export function NutritionTracker({ clientId, target, initialMeals }: { clientId: string; target: Target | null; initialMeals: Meal[] }) {
  const [meals, setMeals] = useState(initialMeals);
  const [form, setForm] = useState({ food_name: "", calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [status, setStatus] = useState<string | null>(null);

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, meal) => {
        acc.calories += meal.calories;
        acc.protein += meal.protein;
        acc.carbs += meal.carbs;
        acc.fat += meal.fat;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [meals]);

  const addMeal = async () => {
    const response = await fetch("/api/nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, ...form })
    });

    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Failed to log meal");
      return;
    }

    setMeals([data.meal, ...meals]);
    setForm({ food_name: "", calories: 0, protein: 0, carbs: 0, fat: 0 });
    setStatus("Meal logged");
  };

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 md:grid-cols-4">
        <div>
          <p className="text-sm text-slate-500">Calories</p>
          <p className="text-xl font-bold">
            {totals.calories} {target ? `/ ${target.calories}` : ""}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Protein</p>
          <p className="text-xl font-bold">
            {totals.protein} {target ? `/ ${target.protein}` : ""}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Carbs</p>
          <p className="text-xl font-bold">
            {totals.carbs} {target ? `/ ${target.carbs}` : ""}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Fat</p>
          <p className="text-xl font-bold">
            {totals.fat} {target ? `/ ${target.fat}` : ""}
          </p>
        </div>
      </div>

      <div className="card grid gap-2 md:grid-cols-5">
        <input className="input" placeholder="Food" value={form.food_name} onChange={(e) => setForm({ ...form, food_name: e.target.value })} />
        <input
          className="input"
          type="number"
          placeholder="Calories"
          value={form.calories}
          onChange={(e) => setForm({ ...form, calories: Number(e.target.value) })}
        />
        <input
          className="input"
          type="number"
          placeholder="Protein"
          value={form.protein}
          onChange={(e) => setForm({ ...form, protein: Number(e.target.value) })}
        />
        <input
          className="input"
          type="number"
          placeholder="Carbs"
          value={form.carbs}
          onChange={(e) => setForm({ ...form, carbs: Number(e.target.value) })}
        />
        <input className="input" type="number" placeholder="Fat" value={form.fat} onChange={(e) => setForm({ ...form, fat: Number(e.target.value) })} />
      </div>

      <button className="btn-primary" onClick={addMeal}>
        Add Meal
      </button>

      {status && <p className="text-sm text-slate-700">{status}</p>}

      <div className="card">
        <h3 className="mb-3 text-lg font-semibold">Meal Log</h3>
        <div className="space-y-2">
          {meals.map((meal) => (
            <div key={meal.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
              <span>{meal.food_name}</span>
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
