export type LeaderboardConfig = {
  ranking_slot: number;
  label: string;
  workouts_weight: number;
  checkins_weight: number;
  nutrition_weight: number;
  habits_weight: number;
  tie_breaker: string;
};

export type ClientMetrics = {
  clientId: string;
  workoutsRatio: number;
  checkinsRatio: number;
  nutritionRatio: number;
  habitsRatio: number;
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function computeScore(metrics: ClientMetrics, config: LeaderboardConfig) {
  const workoutsComponent = clamp01(metrics.workoutsRatio) * Number(config.workouts_weight || 0);
  const checkinsComponent = clamp01(metrics.checkinsRatio) * Number(config.checkins_weight || 0);
  const nutritionComponent = clamp01(metrics.nutritionRatio) * Number(config.nutrition_weight || 0);
  const habitsComponent = clamp01(metrics.habitsRatio) * Number(config.habits_weight || 0);

  const totalWeight =
    Number(config.workouts_weight || 0) +
    Number(config.checkins_weight || 0) +
    Number(config.nutrition_weight || 0) +
    Number(config.habits_weight || 0);

  const normalized = totalWeight > 0 ? ((workoutsComponent + checkinsComponent + nutritionComponent + habitsComponent) / totalWeight) * 100 : 0;

  return {
    score: Math.round(normalized * 100) / 100,
    workoutsComponent: Math.round(workoutsComponent * 10000) / 100,
    checkinsComponent: Math.round(checkinsComponent * 10000) / 100,
    nutritionComponent: Math.round(nutritionComponent * 10000) / 100,
    habitsComponent: Math.round(habitsComponent * 10000) / 100
  };
}

export function publicMemberName(input: { fullName?: string | null; userId: string }) {
  const fullName = input.fullName?.trim();
  if (fullName) return fullName;
  return `Member ${input.userId.slice(0, 6)}`;
}

