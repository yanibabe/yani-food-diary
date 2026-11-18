"use client";
// Round 67: the phone side of AI meal pictures. A tiny shared store (no context needed), so the
// Today rows, the meal page and the "save a meal" code all see the same pictures and the same
// "drawing…" state. Pure helpers live in mealPics.ts.

import { useEffect, useState, useSyncExternalStore } from "react";
import { aiFetch } from "./aiFetch";
import { PASSCODE_HEADER, PASSCODE_KEY, passcodeHeaderValue } from "./passcode";
import { deletePhoto, getPhoto, savePhoto, shrinkDataUrl } from "./photos";
import { MEAL_PICS_KEY, PIC_QUALITY, PIC_SIZE, copyPic, dishKey, findPic, newPicId, orphanPicId, parseMealPics, pictureRequest, planEarlyClaim, shouldDraw, withPic, type MealPic, type MealPics } from "./mealPics";
import type { Lang } from "./i18n";
import type { FoodItem } from "./types";

let pics: MealPics = {};
let loaded = false;
const inflight = new Set<string>();
const failed = new Set<string>();
/** The AI's own picture description for a photo meal, kept from "read my photo" until the meal is saved. */
const visuals = new Map<string, string>();
const srcCache = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

function bump() {
  version++;
  for (const l of listeners) l();
}

function currentLang(): Lang {
  try {
    return localStorage.getItem("yfd:v1:lang") === "en" ? "en" : "th";
  } catch {
    return "th";
  }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    pics = parseMealPics(localStorage.getItem(MEAL_PICS_KEY));
  } catch {
    pics = {};
  }
}

function persist() {
  try {
    localStorage.setItem(MEAL_PICS_KEY, JSON.stringify(pics));
  } catch {
    /* the picture still shows this time, it just is not remembered */
  }
}

/** Call after restoring a backup: read everything again from the phone. */
export function reloadMealPics() {
  loaded = false;
  srcCache.clear();
  load();
  bump();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Remember the AI's picture description for the meal she is about to save (photo meals). */
export function rememberVisual(title: string, visual: string | null | undefined) {
  const k = dishKey(title);
  if (k && visual?.trim()) visuals.set(k, visual.trim());
}

export type PicState = { pic: MealPic | null; drawing: boolean; failed: boolean };

function useVersion() {
  load();
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

/** The picture state for one dish name (re-renders when it changes). */
export function useMealPic(title: string): PicState {
  useVersion();
  const k = dishKey(title);
  return { pic: findPic(pics, title), drawing: !!k && inflight.has(k), failed: !!k && failed.has(k) };
}

/** Round 78: does this dish already have a picture on this phone? (not a hook) */
export function hasMealPic(title: string): boolean {
  load();
  return findPic(pics, title) !== null;
}

/** The picture's data URL (loaded from the phone's storage). undefined = still loading; null = no picture / file missing. */
export function usePicSrc(pic: MealPic | null): string | null | undefined {
  const id = pic?.photoId ?? null;
  const [got, setGot] = useState<{ id: string; src: string | null } | null>(null);
  useEffect(() => {
    if (!id || srcCache.has(id)) return;
    let live = true;
    getPhoto(id).then((src) => {
      if (src) srcCache.set(id, src);
      if (live) setGot({ id, src });
    });
    return () => {
      live = false;
    };
  }, [id]);
  if (!id) return null;
  return srcCache.get(id) ?? (got?.id === id ? got.src : undefined);
}

async function sendQuietly(body: unknown): Promise<Response> {
  // In the background we never open the passcode box: with no (or a wrong) passcode it just quietly gives up.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const code = localStorage.getItem(PASSCODE_KEY);
    if (code) headers[PASSCODE_HEADER] = passcodeHeaderValue(code);
  } catch {
    /* no passcode */
  }
  return fetch("/api/meal-picture", { method: "POST", headers, body: JSON.stringify(body) });
}

export type DrawOpts = { title: string; items: Pick<FoodItem, "name" | "amount" | "unit">[]; hint?: string; visual?: string; /** true = she pressed a button (may ask for the passcode, replaces an existing picture, reports errors) */ manual?: boolean };
export type DrawResult = { ok: true } | { ok: false; message: string };

/** Draw (or redraw) the picture for a dish and save it. One request per dish at a time. */
export async function drawPicture(o: DrawOpts): Promise<DrawResult> {
  load();
  const k = dishKey(o.title);
  const lang = currentLang();
  if (!k) return { ok: false, message: "" };
  if (inflight.has(k)) return { ok: false, message: "" };
  if (!o.manual && !shouldDraw(pics, o.title, inflight)) return { ok: false, message: "" };
  inflight.add(k);
  failed.delete(k);
  bump();
  try {
    const body = pictureRequest(o.title, o.items, { hint: o.hint, visual: o.visual, lang });
    const res = o.manual ? await aiFetch("/api/meal-picture", body, lang) : await sendQuietly(body);
    const data = await res.json().catch(() => null);
    if (!res.ok || typeof data?.image !== "string") throw new Error(data?.message ?? `HTTP ${res.status}`);
    const small = await shrinkDataUrl(data.image, PIC_SIZE, PIC_QUALITY, true);
    const photoId = newPicId();
    await savePhoto(photoId, small);
    srcCache.set(photoId, small);
    const old = pics[k]?.photoId;
    pics = withPic(pics, o.title, { photoId, visual: typeof data.visual === "string" ? data.visual : "", createdAt: Date.now() });
    persist();
    const orphan = orphanPicId(pics, old);
    if (orphan) {
      srcCache.delete(orphan);
      void deletePhoto(orphan);
    }
    return { ok: true };
  } catch (e) {
    failed.add(k);
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  } finally {
    inflight.delete(k);
    bump();
  }
}

/** Round 68: dishes whose picture was started EARLY (right after the AI read the photo or text), and saves waiting for one. */
const earlyStarted = new Set<string>();
const claims = new Map<string, { from: string; title: string; items: FoodItem[] }>();

function settleClaims(fromKey: string, ok: boolean) {
  for (const [nk, c] of [...claims]) {
    if (c.from !== fromKey) continue;
    claims.delete(nk);
    if (ok) {
      if (pics[fromKey] && !pics[nk]) {
        pics = withPic(pics, c.title, pics[fromKey]);
        persist();
        bump();
      }
    } else {
      void drawPicture({ title: c.title, items: c.items }); // the early try failed: one normal try under the new name
    }
  }
}

/** The AI has just read the meal: start drawing its picture right away (quietly, keyed by the title now). One call per dish. */
export function startEarlyDraw(title: string, items: FoodItem[], visual?: string | null) {
  load();
  if (!shouldDraw(pics, title, inflight)) return;
  const k = dishKey(title);
  earlyStarted.add(k);
  void drawPicture({ title, items, visual: visual?.trim() || undefined }).then((r) => settleClaims(k, r.ok));
}

/** She is saving the meal. If she renamed it, the early picture follows the new name (now, or when it arrives). No second AI call. */
export function claimEarlyPicture(earlyTitle: string | null, newTitle: string, items: FoodItem[]) {
  if (!earlyTitle) return;
  load();
  const plan = planEarlyClaim(pics, earlyTitle, newTitle, inflight, earlyStarted);
  if (plan === "attach") {
    pics = copyPic(pics, earlyTitle, newTitle);
    persist();
    bump();
  } else if (plan === "wait") {
    claims.set(dishKey(newTitle), { from: dishKey(earlyTitle), title: newTitle, items });
  }
}

/** A meal was just saved: draw its picture in the background if the dish has none. Never blocks, never shows errors. */
export function drawInBackground(title: string, items: Pick<FoodItem, "name" | "amount" | "unit">[]) {
  load();
  if (claims.has(dishKey(title))) return; // an early picture is on its way to this name
  if (!shouldDraw(pics, title, inflight)) return;
  const k = dishKey(title);
  const visual = visuals.get(k);
  visuals.delete(k);
  void drawPicture({ title, items, visual });
}

/** Use her own photo (a data URL) as this dish's picture. */
export async function chooseOwnPhoto(title: string, photoDataUrl: string): Promise<DrawResult> {
  load();
  const k = dishKey(title);
  if (!k) return { ok: false, message: "" };
  try {
    const small = await shrinkDataUrl(photoDataUrl, PIC_SIZE, PIC_QUALITY, true);
    const photoId = newPicId();
    await savePhoto(photoId, small);
    srcCache.set(photoId, small);
    const old = pics[k]?.photoId;
    pics = withPic(pics, title, { photoId, visual: "", createdAt: Date.now(), own: true });
    persist();
    const orphan = orphanPicId(pics, old);
    if (orphan) {
      srcCache.delete(orphan);
      void deletePhoto(orphan);
    }
    failed.delete(k);
    bump();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
