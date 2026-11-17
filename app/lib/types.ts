// Shared data shapes for the whole app. Everything here is saved on the device.

import type { L } from "./i18n.ts";

export type Macros = {
  kcal: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
};

export type MacroKey = "protein" | "carbs" | "fat";

// ---- Round 39: where a nutrition number came from, and how sure we are ----

/**
 * WHERE the numbers came from.
 * label     = printed on the pack (read from a photo, or the AI saw a printed label)
 * user      = typed by her (never counts as verified by itself)
 * database  = an outside food database (Open Food Facts now)
 * reference = the app's own small reference table (rough typical values)
 * ai        = the AI's own estimate
 * recipe    = worked out from a saved recipe's ingredients
 * unknown   = saved before the app recorded this, and it can't be told for sure
 */
export type NutrientSource = "label" | "user" | "database" | "reference" | "ai" | "recipe" | "unknown";

/**
 * HOW sure we are.
 * verified   = checked against a trusted source (nothing is marked verified yet — kept for later rounds)
 * unverified = real numbers from somewhere (label, database, her typing) that nobody has checked
 * estimated  = typical values or a guess
 * unknown    = can't be told
 */
export type Verification = "verified" | "unverified" | "estimated" | "unknown";

export type Provenance = {
  source: NutrientSource;
  verification: Verification;
  /** Extra detail, e.g. "off", "photo", "typed", "edited", "exact-amount". */
  via?: string | null;
};

/** The preparation state a value is for. Raw rice and cooked rice are very different per 100 g. */
export type FoodState = "raw" | "cooked" | "dried" | "prepared";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export const SLOT_LABEL: Record<MealSlot, L> = {
  breakfast: { th: "มื้อเช้า", en: "Breakfast" },
  lunch: { th: "มื้อกลางวัน", en: "Lunch" },
  dinner: { th: "มื้อเย็น", en: "Dinner" },
  snack: { th: "ของว่าง", en: "Snack" },
};

export const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

/** A box on the photo, in 0..1 fractions of the image width/height. */
export type Box = { x: number; y: number; w: number; h: number };

export type FoodItem = Macros & {
  id: string;
  name: string;
  amount: number;
  unit: string;
  /** true when the numbers are a guess (portion or oil/sauce not clear). */
  estimated: boolean;
  /** "extra" = oil, sauce, or an add-on the user mentioned. */
  kind: "food" | "extra";
  note: string | null;
  box: Box | null;
  /** May contain milk / dairy. Missing on old items (then the name is checked). */
  dairy?: boolean;
  /** Which dairy, e.g. "นมข้นหวาน". From the AI. */
  dairySource?: string | null;
  /** OLD items only (before Round 40): true = the old automatic +15% is already inside ALL the numbers.
   *  New items never set it. See app/lib/calorieBuffer.ts. */
  margin?: boolean;
  /** Round 40: the AI's own kcal for this amount, before any buffer. Only on new AI guesses.
   *  When set, `kcal` above = the kcal the diary counts (tracking kcal). Missing on old items. */
  aiKcal?: number;
  /** Round 40: the calorie buffer % used for `kcal` (0, 5, 10, 15 or 20). kcal only, never macros. */
  bufferPct?: number;
  /** true = numbers read from a printed nutrition label / kcal on the pack (no margin). */
  fromLabel?: boolean;
  /** Where the numbers came from, when it was an outside food database (e.g. Open Food Facts).
   *  The amount/unit above is the quantity; the macros above are the snapshot. */
  ref?: FoodRef | null;
  /** Round 39: where the numbers came from. Missing on older items (then it is worked out, or "unknown"). */
  prov?: Provenance;
  /** Round 39: nutrients the source did NOT give. They are stored as 0 but shown as unknown, never as a real 0. */
  missing?: MacroKey[];
  /** Round 41: the USDA food she confirmed for this item (a frozen copy of its values per 100 g). */
  usda?: UsdaSnap | null;
};

// ---- Round 41: USDA FoodData Central ----

/** Which USDA data set a food is from. Branded foods are packaged products, kept apart from generic ones. */
export type UsdaDataType = "foundation" | "sr" | "fndds" | "branded";

/** Which USDA number the kcal came from. 1008 = Energy (kcal); 2048 / 2047 = Atwater specific / general; kj = 1062 ÷ 4.184. */
export type UsdaEnergyBasis = "1008" | "2048" | "2047" | "kj";

/** One USDA nutrient exactly as USDA sent it (kept so the numbers can always be traced back). */
export type UsdaRawNutrient = { id: number; unit: string; value: number };

/** A USDA food she confirmed, frozen at the moment she picked it. Values are per 100 g (or 100 ml when per = "ml"). */
export type UsdaSnap = {
  fdcId: number;
  description: string;
  dataType: UsdaDataType;
  brand?: string | null;
  per100: Macros;
  per: "g" | "ml";
  /** Nutrients USDA did not give (stored as 0, shown as unknown). */
  missing?: MacroKey[];
  energy: UsdaEnergyBasis;
  state?: FoodState | null;
  /** Other nutrients per 100, only when USDA gave them. Shown, never added to the diary totals. */
  extra?: { fiber?: number; sugar?: number; sodiumMg?: number; satFat?: number };
  raw?: UsdaRawNutrient[];
  fetchedAt: number;
};

/** A household measure from USDA, e.g. "1 cup, chopped" = 160 g. */
export type UsdaPortion = { label: string; grams: number; ml?: number | null };

/** A USDA food picked for a recipe ingredient. Only used while the ingredient name stays the same. */
export type UsdaPick = UsdaSnap & {
  /** The ingredient name it was confirmed for. If she renames the ingredient, it is not used. */
  name: string;
  portions?: UsdaPortion[];
  /** grams in 1 ml, worked out from USDA's own cup / spoon weights. null = unknown. */
  gPerMl?: number | null;
};

/** source + id in that database. "off" = Open Food Facts (id = barcode). */
export type FoodRef = { source: "off" | "usda" | "fatsecret"; sourceId: string };

/** How a unit turns into grams: "mass" × factor = grams; "volume" × factor = ml;
 *  "count" (egg, clove, can…) needs the weight of one unit. */
export type UnitKind = "mass" | "volume" | "count";

type UnitDef = L & { kind: UnitKind; factor: number };

/** Every unit people use for food. The ORDER here is the order in the picker. */
export const UNITS = {
  // weight
  g: { th: "กรัม", en: "g", kind: "mass", factor: 1 },
  kg: { th: "กิโลกรัม", en: "kg", kind: "mass", factor: 1000 },
  mg: { th: "มิลลิกรัม", en: "mg", kind: "mass", factor: 0.001 },
  oz: { th: "ออนซ์", en: "oz", kind: "mass", factor: 28.35 },
  lb: { th: "ปอนด์", en: "lb", kind: "mass", factor: 453.6 },
  // volume
  ml: { th: "มล.", en: "ml", kind: "volume", factor: 1 },
  l: { th: "ลิตร", en: "liter", kind: "volume", factor: 1000 },
  tsp: { th: "ช้อนชา", en: "teaspoon", kind: "volume", factor: 5 },
  tbsp: { th: "ช้อนโต๊ะ", en: "tablespoon", kind: "volume", factor: 15 },
  cup: { th: "ถ้วยตวง", en: "cup", kind: "volume", factor: 240 },
  floz: { th: "ออนซ์น้ำ (fl oz)", en: "fl oz", kind: "volume", factor: 29.57 },
  // counted
  egg: { th: "ฟอง", en: "egg", kind: "count", factor: 1 },
  piece: { th: "ชิ้น", en: "piece", kind: "count", factor: 1 },
  fruit: { th: "ลูก / ผล", en: "whole fruit", kind: "count", factor: 1 },
  clove: { th: "กลีบ", en: "clove", kind: "count", factor: 1 },
  seed: { th: "เม็ด", en: "grain / small one", kind: "count", factor: 1 },
  leaf: { th: "ใบ", en: "leaf", kind: "count", factor: 1 },
  stalk: { th: "ต้น", en: "stalk", kind: "count", factor: 1 },
  pod: { th: "ฝัก", en: "pod / cob", kind: "count", factor: 1 },
  head: { th: "หัว", en: "head / bulb", kind: "count", factor: 1 },
  slice: { th: "แผ่น", en: "slice", kind: "count", factor: 1 },
  strip: { th: "เส้น", en: "strip", kind: "count", factor: 1 },
  cube: { th: "ก้อน", en: "cube / block", kind: "count", factor: 1 },
  stick: { th: "ไม้", en: "skewer", kind: "count", factor: 1 },
  ladle: { th: "ทัพพี", en: "ladle", kind: "count", factor: 1 },
  bowl: { th: "ถ้วย / ชาม", en: "bowl", kind: "count", factor: 1 },
  handful: { th: "กำมือ", en: "handful", kind: "count", factor: 1 },
  pinch: { th: "หยิบมือ", en: "pinch", kind: "count", factor: 1 },
  sachet: { th: "ซอง", en: "sachet", kind: "count", factor: 1 },
  pack: { th: "แพ็ค", en: "pack", kind: "count", factor: 1 },
  bag: { th: "ถุง", en: "bag", kind: "count", factor: 1 },
  box: { th: "กล่อง", en: "box / carton", kind: "count", factor: 1 },
  can: { th: "กระป๋อง", en: "can", kind: "count", factor: 1 },
  bottle: { th: "ขวด", en: "bottle", kind: "count", factor: 1 },
} as const satisfies Record<string, UnitDef>;

export type IngredientUnit = keyof typeof UNITS;

/** Name of a unit to show on screen. Kept for old code. */
export const UNIT_LABEL: Record<IngredientUnit, L> = UNITS;

export const UNIT_GROUPS: { kind: UnitKind; label: L }[] = [
  { kind: "mass", label: { th: "น้ำหนัก", en: "Weight" } },
  { kind: "volume", label: { th: "ปริมาตร", en: "Volume" } },
  { kind: "count", label: { th: "นับเป็นหน่วย", en: "Counted" } },
];

/** Count units where "a typical piece" from the AI / built-in table fits as-is. */
export const PIECE_LIKE: IngredientUnit[] = ["egg", "piece", "fruit"];

export function unitKind(u: IngredientUnit): UnitKind {
  return (UNITS[u] ?? UNITS.g).kind;
}

// ---- Recipe categories (Round 33) ----
export type RecipeCategory = "onedish" | "side" | "soup" | "salad" | "snack" | "drink" | "other";

/** Order here = order on the My recipes page. */
export const RECIPE_CATEGORIES: { key: RecipeCategory; label: L }[] = [
  { key: "onedish", label: { th: "อาหารจานเดียว", en: "One-dish meals" } },
  { key: "side", label: { th: "กับข้าว", en: "Dishes with rice" } },
  { key: "soup", label: { th: "ต้ม · แกง", en: "Soups & curries" } },
  { key: "salad", label: { th: "สลัด · ผัก", en: "Salads & veggies" } },
  { key: "snack", label: { th: "ของว่าง · ขนม", en: "Snacks & sweets" } },
  { key: "drink", label: { th: "เครื่องดื่ม", en: "Drinks" } },
  { key: "other", label: { th: "อื่น ๆ", en: "Other" } },
];

/** How a label's numbers got onto an ingredient. Missing on labels saved before Round 39. */
export type LabelVia = "typed" | "photo" | "off" | "fix-typed" | "fix-photo" | "fix";

export type LabelInfo = Macros & {
  /** per100 = per 100 g (or 100 ml). perUnit = per 1 egg / 1 piece. */
  basis: "per100" | "perUnit";
  /** Round 39: where these numbers came from. */
  via?: LabelVia;
  /** Round 39: "per 100" of grams or of ml. Missing (older labels) = the same kind as the amount. */
  per?: "g" | "ml";
  /** Round 39: nutrients the label / database did not give (stored as 0, shown as unknown). */
  missing?: MacroKey[];
};

export type Ingredient = {
  id: string;
  name: string;
  amount: number;
  unit: IngredientUnit;
  label: LabelInfo | null;
  /** Weight of one egg / one piece in grams (or ml), when needed. */
  gramsPerUnit: number | null;
  photoId: string | null;
  /** Nutrition per 100 g the AI looked up for this name (used when there is no label). */
  aiRef?: AiRef | null;
  /** Round 39: she picked one of the app's reference foods for this (unclear) name. Ignored if the name changes. */
  refPick?: { name: string; key: string } | null;
  /** Round 39: grams in 1 ml of this ingredient, typed by her (shown as "weight of 1 tbsp" etc.). */
  gPerMl?: number | null;
  /** Round 41: the USDA food she confirmed for this name. Ignored if the name changes. */
  usda?: UsdaPick | null;
};

export type AiRef = {
  /** The ingredient name it was looked up for. If the name changes, it is not used. */
  name: string;
  per100: Macros;
  /** grams in 1 egg / 1 piece, if that makes sense */
  unitG: number | null;
  /** Which unit unitG is for (Round 33). Missing = a plain piece / egg / fruit. */
  unitFor?: IngredientUnit | null;
  /** grams in 1 ml (density), for liquids */
  gPerMl: number | null;
  /** Round 39: the state these values are for (raw / cooked / dried / prepared). Missing on older answers. */
  state?: FoodState | null;
};

export type Recipe = {
  id: string;
  name: string;
  servings: number;
  /** Total weight after cooking, in grams. Optional. */
  cookedWeight: number | null;
  ingredients: Ingredient[];
  steps: string[];
  coverPhotoId: string | null;
  /** Missing on recipes saved before Round 33 → shown under "Other". */
  category?: RecipeCategory;
  createdAt: number;
  updatedAt: number;
};

export type RecipeLog = {
  recipeId: string;
  recipeName: string;
  mode: "servings" | "grams";
  servings: number | null;
  grams: number | null;
  /** A frozen copy of the ingredients used for THIS meal. */
  ingredients: Ingredient[];
  recipeServings: number;
  recipeCookedWeight: number | null;
};

export type Entry = {
  id: string;
  /** Thai calendar day, "YYYY-MM-DD" in Asia/Bangkok. */
  date: string;
  slot: MealSlot;
  title: string;
  items: FoodItem[];
  source: "photo" | "text" | "recipe" | "manual" | "barcode";
  /** The cover photo (the first one). */
  photoId: string | null;
  /** Round 43: more photos of the same meal (after the cover). Missing on older meals. */
  extraPhotoIds?: string[];
  recipe: RecipeLog | null;
  createdAt: number;
  updatedAt: number;
};

export type Sex = "female" | "male";
export type DailyActivity = "sitting" | "light" | "standing" | "physical";
export type ExerciseFreq = "none" | "1-2" | "3-5" | "6-7" | "twice";
export type DurationUnit = "day" | "week" | "month";
/** Why she uses the app. Decides how the daily target is set. */
export type Reason = "lose" | "muscle" | "gain" | "maintain";

export type Profile = {
  /** Missing on profiles saved before onboarding existed. */
  name?: string;
  reason?: Reason;
  age: number;
  heightCm: number;
  weightKg: number;
  sex: Sex;
  daily: DailyActivity;
  exercise: ExerciseFreq;
  /** The weight the user hopes to reach, and by when. */
  targetWeightKg: number;
  duration: number;
  durationUnit: DurationUnit;
  /** One checkbox on the Profile page sets both ("pregnant or breastfeeding"). */
  pregnant: boolean;
  breastfeeding: boolean;
};

export type Goals = {
  /** The kcal/day target the app uses right now. */
  targetKcal: number;
  targetSource: "default" | "calc" | "manual";
  /** The last profile the user saved (may be null if they skipped). */
  profile: Profile | null;
  /** Maintenance estimate from the last CONFIRMED calculation (kept, no longer shown). */
  maintenanceKcal: number | null;
  skippedEstimate: boolean;
  /** Warn when a food may contain milk or milk products. */
  avoidDairy?: boolean;
  /** Glasses of water per day (250 ml each). Missing = 8. */
  waterGoal?: number;
  /** Round 40: Smart Calorie Buffer % for new AI guesses (0, 5, 10, 15, 20). Missing = 0. */
  calorieBuffer?: number;
};
