export type SexAtBirth = "male" | "female";

export type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Input = {
  sexAtBirth: SexAtBirth;
  age: number;
  heightInches: number;
  weightLbs: number;
  daysPerWeek?: number | null;
  goalText?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function activityMultiplier(daysPerWeek?: number | null) {
  const days = daysPerWeek ?? 3;
  if (days <= 0) return 1.2;
  if (days <= 2) return 1.375;
  if (days <= 4) return 1.55;
  if (days <= 6) return 1.725;
  return 1.9;
}

function goalAdjustment(goalText?: string | null) {
  const goal = (goalText || "").toLowerCase();
  if (goal.includes("lose") || goal.includes("fat") || goal.includes("cut")) return -500;
  if (goal.includes("gain") || goal.includes("bulk") || goal.includes("muscle")) return 250;
  return 0;
}

export function calculateMifflinStJeorTargets(input: Input): MacroTargets {
  const weightKg = input.weightLbs * 0.45359237;
  const heightCm = input.heightInches * 2.54;
  const sexOffset = input.sexAtBirth === "male" ? 5 : -161;

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * input.age + sexOffset;
  const tdee = bmr * activityMultiplier(input.daysPerWeek);
  const adjustedCalories = clamp(Math.round(tdee + goalAdjustment(input.goalText)), 1200, 5000);

  const isGain = goalAdjustment(input.goalText) > 0;
  const proteinPerLb = isGain ? 0.85 : 1;
  const protein = Math.round(clamp(input.weightLbs * proteinPerLb, 80, 300));

  const fat = Math.round(clamp(input.weightLbs * 0.3, 40, 130));
  const remainingCalories = adjustedCalories - protein * 4 - fat * 9;
  const carbs = Math.round(clamp(remainingCalories / 4, 50, 700));

  return {
    calories: adjustedCalories,
    protein,
    carbs,
    fat
  };
}
