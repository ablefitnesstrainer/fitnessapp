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
  servingSize?: number | null;
  servingSizeUnit?: string | null;
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

type UsdaFoodNutrient = {
  name?: string;
  number?: string;
  amount?: number | null;
  value?: number | null;
  nutrient?: {
    name?: string;
    number?: string;
  } | null;
};

type UsdaLabelNutrients = {
  calories?: { value?: number | null } | null;
  protein?: { value?: number | null } | null;
  carbohydrates?: { value?: number | null } | null;
  fat?: { value?: number | null } | null;
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

function macroFromNutrients(nutrients: UsdaFoodNutrient[] | undefined) {
  const list = nutrients || [];

  const find = (pred: (n: { name?: string; number?: string }) => boolean) => {
    const match = list.find(pred);
    const amount = match?.amount ?? match?.value;
    return Math.max(0, Math.round(parseNumber(amount)));
  };

  const normalized = list.map((item) => ({
    number: item.number || item.nutrient?.number,
    name: item.name || item.nutrient?.name,
    amount: item.amount ?? item.value
  }));

  const calories = find((n) => n.number === "208" || (n.name || "").toLowerCase().includes("energy"));
  const protein = find((n) => n.number === "203" || (n.name || "").toLowerCase().includes("protein"));
  const carbs = find((n) => n.number === "205" || (n.name || "").toLowerCase().includes("carbohydrate"));
  const fat = find((n) => n.number === "204" || (n.name || "").toLowerCase().includes("total lipid") || (n.name || "").toLowerCase() === "fat");

  // If find() on raw list fails for nested nutrient payloads, retry from normalized.
  const findNormalized = (pred: (n: { name?: string; number?: string }) => boolean) => {
    const match = normalized.find(pred);
    return Math.max(0, Math.round(parseNumber(match?.amount)));
  };

  return {
    calories: calories || findNormalized((n) => n.number === "208" || (n.name || "").toLowerCase().includes("energy")),
    protein: protein || findNormalized((n) => n.number === "203" || (n.name || "").toLowerCase().includes("protein")),
    carbs: carbs || findNormalized((n) => n.number === "205" || (n.name || "").toLowerCase().includes("carbohydrate")),
    fat: fat || findNormalized((n) => n.number === "204" || (n.name || "").toLowerCase().includes("total lipid") || (n.name || "").toLowerCase() === "fat")
  };
}

function macroFromLabelNutrients(labelNutrients: UsdaLabelNutrients | undefined) {
  const label = labelNutrients || {};
  return {
    calories: Math.max(0, Math.round(parseNumber(label.calories?.value))),
    protein: Math.max(0, Math.round(parseNumber(label.protein?.value))),
    carbs: Math.max(0, Math.round(parseNumber(label.carbohydrates?.value))),
    fat: Math.max(0, Math.round(parseNumber(label.fat?.value)))
  };
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

  const fromNutrients = macroFromNutrients(json?.foodNutrients);
  const fromLabel = macroFromLabelNutrients(json?.labelNutrients);
  const macros = {
    calories: fromNutrients.calories || fromLabel.calories,
    protein: fromNutrients.protein || fromLabel.protein,
    carbs: fromNutrients.carbs || fromLabel.carbs,
    fat: fromNutrients.fat || fromLabel.fat
  };
  return {
    description: String(json?.description || "Unknown food"),
    servingText: servingTextFromAny(json || {}),
    servingSize: json?.servingSize ? parseNumber(json.servingSize) : null,
    servingSizeUnit: json?.servingSizeUnit ? String(json.servingSizeUnit) : null,
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat
  };
}
