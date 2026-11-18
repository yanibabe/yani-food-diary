"use client";
// All diary data, recipes and goals live on this device (localStorage),
// so closing and reopening the app keeps everything.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Entry, Goals, Recipe } from "./types.ts";
import { upsertLog, type BodyLog } from "./body.ts";
import { setGlasses, type WaterLog } from "./water.ts";
import { upgradeSlot } from "./date.ts";
import { drawInBackground } from "./mealPicClient.ts";
import { recipePictureItems } from "./mealPics.ts";

const KEY = {
  entries: "yfd:v1:entries",
  recipes: "yfd:v1:recipes",
  goals: "yfd:v1:goals",
  body: "yfd:v1:body",
  water: "yfd:v1:water",
};

export const DEFAULT_GOALS: Goals = {
  targetKcal: 1800,
  targetSource: "default",
  profile: null,
  maintenanceKcal: null,
  skippedEstimate: false,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): string | null {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "save failed";
  }
}

type Store = {
  ready: boolean;
  saveError: string | null;
  entries: Entry[];
  recipes: Recipe[];
  goals: Goals;
  upsertEntry: (e: Entry) => void;
  deleteEntry: (id: string) => void;
  upsertRecipe: (r: Recipe) => void;
  deleteRecipe: (id: string) => void;
  setGoals: (g: Goals) => void;
  bodyLogs: BodyLog[];
  /** Save weight and/or steps for one day (null clears that part). */
  setBody: (date: string, patch: Partial<Pick<BodyLog, "weightKg" | "steps">>) => void;
  waterLogs: WaterLog[];
  /** Save how many glasses of water she drank on one day. */
  setWater: (date: string, glasses: number) => void;
};

const Ctx = createContext<Store | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [goals, setGoalsState] = useState<Goals>(DEFAULT_GOALS);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);

  useEffect(() => {
    // Load once on the device (localStorage is not available on the server).
    const saved = read<Entry[]>(KEY.entries, []);
    const upgraded = saved.map((e) => ({ ...e, slot: upgradeSlot(e.slot, e.createdAt) }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(upgraded);
    // Old "brunch" meals were split into breakfast / lunch: save that once.
    if (upgraded.some((e, i) => e.slot !== saved[i].slot)) setSaveError(write(KEY.entries, upgraded));
    setRecipes(read(KEY.recipes, []));
    setGoalsState({ ...DEFAULT_GOALS, ...read(KEY.goals, DEFAULT_GOALS) });
    setBodyLogs(read(KEY.body, []));
    setWaterLogs(read(KEY.water, []));
    setReady(true);
  }, []);

  // Round 67: a NEW meal (not an edit) gets its AI picture drawn in the background if its dish has none.
  const entriesRef = useRef<Entry[]>([]);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);
  const upsertEntry = useCallback((e: Entry) => {
    if (!entriesRef.current.some((x) => x.id === e.id)) drawInBackground(e.title, e.items);
    setEntries((prev) => {
      const next = prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [...prev, e];
      setSaveError(write(KEY.entries, next));
      return next;
    });
  }, []);
  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((x) => x.id !== id);
      setSaveError(write(KEY.entries, next));
      return next;
    });
  }, []);
  // Round 70: a NEW recipe gets its AI cover drawn in the background (same dish key as a meal of the same name).
  const recipesRef = useRef<Recipe[]>([]);
  useEffect(() => {
    recipesRef.current = recipes;
  }, [recipes]);
  const upsertRecipe = useCallback((r: Recipe) => {
    if (!recipesRef.current.some((x) => x.id === r.id)) drawInBackground(r.name, recipePictureItems(r.ingredients));
    setRecipes((prev) => {
      const next = prev.some((x) => x.id === r.id) ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r];
      setSaveError(write(KEY.recipes, next));
      return next;
    });
  }, []);
  const deleteRecipe = useCallback((id: string) => {
    setRecipes((prev) => {
      const next = prev.filter((x) => x.id !== id);
      setSaveError(write(KEY.recipes, next));
      return next;
    });
  }, []);
  const setGoals = useCallback((g: Goals) => {
    setGoalsState(g);
    setSaveError(write(KEY.goals, g));
  }, []);

  const setBody = useCallback((date: string, patch: Partial<Pick<BodyLog, "weightKg" | "steps">>) => {
    setBodyLogs((prev) => {
      const next = upsertLog(prev, date, patch);
      setSaveError(write(KEY.body, next));
      return next;
    });
  }, []);

  const setWater = useCallback((date: string, glasses: number) => {
    setWaterLogs((prev) => {
      const next = setGlasses(prev, date, glasses);
      setSaveError(write(KEY.water, next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ ready, saveError, entries, recipes, goals, upsertEntry, deleteEntry, upsertRecipe, deleteRecipe, setGoals, bodyLogs, setBody, waterLogs, setWater }),
    [ready, saveError, entries, recipes, goals, upsertEntry, deleteEntry, upsertRecipe, deleteRecipe, setGoals, bodyLogs, setBody, waterLogs, setWater],
  );
  // Draw screens only after the saved data is loaded on the device, so the
  // first paint always matches (avoids React "hydration mismatch").
  return <Ctx.Provider value={value}>{ready ? children : <div className="min-h-dvh bg-cream" />}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside DataProvider");
  return s;
}
