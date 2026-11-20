// Batch 2: Recipes + Ingredients + Profile (screen layout only; no stored shape, formula or goal value changes).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clampGoal, waterGoal, WATER_GOAL_MAX, WATER_GOAL_MIN } from "../app/lib/water.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const profile = read("../app/profile/page.tsx");
const recipe = read("../app/recipes/[id]/edit/page.tsx");

test("Profile: four plain groups, every old row is still there", () => {
  for (const g of ["เป้าหมายรายวัน", "Daily goals", "ร่างกายของฉัน", "My body", "ข้อมูลและแอป", "Data & app", "ขั้นสูง", "Advanced"]) assert.ok(profile.includes(g), g);
  for (const id of ["row-target", "row-water", "row-weight", "row-body", "row-backup", "row-lang", "row-buffer", "row-method"]) assert.ok(profile.includes(`testId="${id}"`), id);
  assert.match(profile, /<BackupCard \/>/);
  assert.match(profile, /<WeightCard \/>/);
  assert.match(profile, /<BufferCard \/>/);
});

test("Profile: advanced things (buffer, foods I avoid, method) sit under Advanced; backup is not buried there", () => {
  const adv = profile.indexOf('data-testid="profile-group-advanced"');
  const data = profile.indexOf('data-testid="profile-group-data"');
  assert.ok(adv > data);
  assert.ok(profile.indexOf('testId="row-buffer"') > adv);
  assert.ok(profile.indexOf('testId="row-method"') > adv);
  assert.ok(profile.indexOf('testId="row-backup"') < adv);
});

test("Profile: weight is the first row of the body group and shows the latest weight", () => {
  const body = profile.indexOf('data-testid="profile-group-body"');
  assert.ok(profile.indexOf('testId="row-weight"') > body && profile.indexOf('testId="row-weight"') < profile.indexOf('testId="row-body"'));
  assert.match(profile, /latestWeight/);
  assert.match(profile, /#weight/);
  assert.match(profile, /#backup/); // the "Back up now" link from Today still opens the backup row
});

test("Water goal on Profile uses the same field and limits as the water card", () => {
  assert.match(profile, /setGoals\(\{ \.\.\.goals, waterGoal: clampGoal\(n\) \}\)/);
  assert.ok(WATER_GOAL_MIN < WATER_GOAL_MAX);
  assert.equal(clampGoal(WATER_GOAL_MAX + 5), WATER_GOAL_MAX);
  assert.equal(clampGoal(WATER_GOAL_MIN - 5), WATER_GOAL_MIN);
  assert.equal(waterGoal(undefined), waterGoal(null));
});

test("Recipe form: category is optional (a recipe without one is already shown under Other)", () => {
  assert.doesNotMatch(recipe, /Pick a category first/);
  assert.match(recipe, /\.\.\.\(category \? \{ category \} : \{\}\)/);
  const types = read("../app/lib/types.ts");
  assert.match(types, /Missing on recipes saved before Round 33 → shown under "Other"/);
});

test("Recipe form: serving stepper, folded optional parts, missing-amount note, per-serving macros, sticky Save", () => {
  for (const id of ["servings-control", "servings-minus", "servings-plus", "more-options", "steps-fold", "missing-amounts", "per-serving-macros", "recipe-actions", "ingredient-tip"]) assert.ok(recipe.includes(`data-testid="${id}"`), id);
  assert.match(recipe, /sticky bottom-0/);
  assert.match(recipe, /i\.name\.trim\(\) && !\(i\.amount > 0\)/);
});

test("Recipe form: maths and stored data untouched (same recipeTotals call, same saved fields)", () => {
  assert.match(recipe, /recipeTotals\(ings, servings \?\? 1, cooked, lang\)/);
  for (const f of ["servings,", "cookedWeight: cooked && cooked > 0 ? cooked : null", "ingredients: clean", "coverPhotoId: cover"]) assert.ok(recipe.includes(f), f);
});

test("Ingredient wording: one name for saving an ingredient, one for creating one", () => {
  const all = [recipe, read("../app/components/AddIngredientSheet.tsx"), read("../app/components/SaveAsMine.tsx")].join("\n");
  assert.doesNotMatch(all, /Save for future use|บันทึกไว้ใช้ครั้งหน้า|Add custom ingredient/);
  assert.match(recipe, /Save to My ingredients/);
  assert.match(read("../app/components/AddIngredientSheet.tsx"), /\+ Create my own ingredient/);
});
