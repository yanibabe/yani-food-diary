// Shared data shapes for the whole app. Everything here is saved on the device.

export type Macros = {
  kcal: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
};

export type MealSlot = "brunch" | "dinner" | "snack";

export const SLOT_LABEL: Record<MealSlot, string> = {
  brunch: "มื้อสาย",
  dinner: "มื้อเย็น",
  snack: "ของว่าง",
};

export const SLOTS: MealSlot[] = ["brunch", "dinner", "snack"];

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
};

export type IngredientUnit = "g" | "ml" | "egg" | "piece";

export const UNIT_LABEL: Record<IngredientUnit, string> = {
  g: "กรัม",
  ml: "มล.",
  egg: "ฟอง",
  piece: "ชิ้น",
};

export type LabelInfo = Macros & {
  /** per100 = per 100 g (or 100 ml). perUnit = per 1 egg / 1 piece. */
  basis: "per100" | "perUnit";
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
  source: "photo" | "text" | "recipe" | "manual";
  photoId: string | null;
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
};
