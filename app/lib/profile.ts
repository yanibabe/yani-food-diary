// Profile helpers: blank values, upgrading old saved profiles, and the
// "has she finished first-run setup?" check used by the onboarding gate.

import type { Goals, Profile, Reason } from "./types.ts";

export const EMPTY_PROFILE: Profile = {
  name: "",
  reason: undefined,
  age: 0,
  heightCm: 0,
  weightKg: 0,
  sex: "female",
  daily: "sitting",
  exercise: "none",
  targetWeightKg: 0,
  duration: 3,
  durationUnit: "month",
  pregnant: false,
  breastfeeding: false,
};

/** Guess the reason from an old profile's target weight (used only to pre-fill). */
export function inferReason(p: Pick<Profile, "weightKg" | "targetWeightKg">): Reason {
  const diff = (p.targetWeightKg || p.weightKg) - p.weightKg;
  if (diff <= -0.3) return "lose";
  if (diff >= 0.3) return "gain";
  return "maintain";
}

/** Old saved profiles get sensible values for fields added later. */
export function fillProfile(pr: Profile | null): Profile | null {
  if (!pr) return null;
  const old = pr as Partial<Profile>;
  const targetWeightKg = old.targetWeightKg ?? pr.weightKg;
  return {
    ...EMPTY_PROFILE,
    ...pr,
    name: old.name ?? "",
    targetWeightKg,
    duration: old.duration ?? 3,
    durationUnit: old.durationUnit ?? "month",
    reason: old.reason ?? (pr.weightKg > 0 ? inferReason({ weightKg: pr.weightKg, targetWeightKg }) : undefined),
  };
}

/** Setup is done once a profile with a name and a reason is saved. */
export function isOnboarded(g: Goals): boolean {
  const p = g.profile as Partial<Profile> | null;
  return !!(p && p.name && p.name.trim() && p.reason);
}
