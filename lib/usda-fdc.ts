const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

export type UsdaSearchItem = {
  fdcId: number;
  description: string;
  brandOwner?: string | null;
  servingText?: string | null;
};

export type UsdaDetailItem = {
  description: string;
  servingText?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type UsdaSearchFood = {
  fdcId?: number | string | null;
  description?: string | null;
  brandOwner?: string | null;
  householdServingFullText?: string | null;
  servingSize?: number | null;
  servingSizeUnit?: string | null;
};

function parseNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
}

function servingTextFromAny(source: {
  householdServingFullText?: string | null;
  servingSize?: number | null;
  servingSizeUnit?: string | null;
}) {
  if (source.householdServingFullText) return source.householdServingFullText;
  if (source.servingSize && source.servingSizeUnit) return `${source.servingSize} ${source.servingSizeUnit}`;
  return null;
}

function macroFromNutrients(nutrients: Array<{ name?: string; number?: string; amount?: number | null; value?: number | null }> | undefined) {
  const list = nutrients || [];

  const find = (pred: (n: { name?: string; number?: string }) => boolean) => {
    const match = list.find(pred);
    const amount = match?.amount ?? match?.value;
    return Math.max(0, Math.round(parseNumber(amount)));
  };

  const calories = find((n) => n.number === "208" || (n.name || "").toLowerCase().includes("energy"));
  const protein = find((n) => n.number === "203" || (n.name || "").toLowerCase().includes("protein"));
  const carbs = find((n) => n.number === "205" || (n.name || "").toLowerCase().includes("carbohydrate"));
  const fat = find((n) => n.number === "204" || (n.name || "").toLowerCase().includes("total lipid") || (n.name || "").toLowerCase() === "fat");

  return { calories, protein, carbs, fat };
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`USDA request failed (${res.status}): ${text.slice(0, 160)}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function getApiKey() {
  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing USDA_FDC_API_KEY");
  }
  return apiKey;
}

export async function searchFoods(query: string): Promise<UsdaSearchItem[]> {
  const apiKey = getApiKey();
  const url = `${USDA_BASE_URL}/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&pageSize=12`;
  const json = await fetchJson(url);
  const foods = Array.isArray(json?.foods) ? json.foods : [];

  return foods
    .map((food: UsdaSearchFood) => ({
      fdcId: parseNumber(food?.fdcId),
      description: String(food?.description || "Unknown food"),
      brandOwner: food?.brandOwner ? String(food.brandOwner) : null,
      servingText: servingTextFromAny(food)
    }))
    .filter((food: UsdaSearchItem) => food.fdcId > 0);
}

export async function getFoodDetail(fdcId: string): Promise<UsdaDetailItem> {
  const apiKey = getApiKey();
  const url = `${USDA_BASE_URL}/food/${encodeURIComponent(fdcId)}?api_key=${encodeURIComponent(apiKey)}`;
  const json = await fetchJson(url);

  const macros = macroFromNutrients(json?.foodNutrients);
  return {
    description: String(json?.description || "Unknown food"),
    servingText: servingTextFromAny(json || {}),
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat
  };
}
