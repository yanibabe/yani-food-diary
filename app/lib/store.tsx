"use client";
// All diary data, recipes and goals live on this device (localStorage),
// so closing and reopening the app keeps everything.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Entry, Goals, Recipe } from "./types.ts";
import { upsertLog, type BodyLog } from "./body.ts";

const KEY = {
  entries: "yfd:v1:entries",
  recipes: "yfd:v1:recipes",
  goals: "yfd:v1:goals",
  body: "yfd:v1:body",
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
};

const Ctx = createContext<Store | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [goals, setGoalsState] = useState<Goals>(DEFAULT_GOALS);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);

  useEffect(() => {
    // Load once on the device (localStorage is not available on the server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(read(KEY.entries, []));
    setRecipes(read(KEY.recipes, []));
    setGoalsState({ ...DEFAULT_GOALS, ...read(KEY.goals, DEFAULT_GOALS) });
    setBodyLogs(read(KEY.body, []));
    setReady(true);
  }, []);

  const upsertEntry = useCallback((e: Entry) => {
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
  const upsertRecipe = useCallback((r: Recipe) => {
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

  const value = useMemo(
    () => ({ ready, saveError, entries, recipes, goals, upsertEntry, deleteEntry, upsertRecipe, deleteRecipe, setGoals, bodyLogs, setBody }),
    [ready, saveError, entries, recipes, goals, upsertEntry, deleteEntry, upsertRecipe, deleteRecipe, setGoals, bodyLogs, setBody],
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
