// Round 69: builds app/data/food-db.json, the small local food table the SERVER uses so the AI never invents numbers.
//
//   node scripts/build-food-db.mjs
//
// Downloads three free USDA FoodData Central files (public domain, CC0) into a fresh temp folder
// (never into the repo), keeps per 100 g: kcal, protein, carbs, fat, fiber, sugar, sodium + a few
// household portions, and writes one compact JSON file. Needs the `unzip` command (macOS has it).
//
// Source: USDA FoodData Central (public domain). https://fdc.nal.usda.gov/download-datasets/

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, createWriteStream, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const BASE = "https://fdc.nal.usda.gov/fdc-datasets/";
const FILES = [
  { code: "f", label: "Foundation Foods", zip: "FoodData_Central_foundation_food_json_2026-10-29.zip", key: "FoundationFoods" },
  { code: "s", label: "SR Legacy", zip: "FoodData_Central_sr_legacy_food_json_2018-04.zip", key: "SRLegacyFoods" },
  { code: "n", label: "FNDDS (survey foods)", zip: "FoodData_Central_survey_food_json_2024-10-31.zip", key: "SurveyFoods" },
];

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "data", "food-db.json");

// Same nutrient ids and energy order as app/lib/food/usdaNutrients.ts.
const r2 = (n) => Math.round(n * 100) / 100;
function pick(nutrients, ids, unitWant) {
  for (const id of ids) {
    const row = nutrients.find((n) => (n.nutrient?.id ?? n.nutrientId) === id);
    const v = row?.amount ?? row?.value;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const unit = String(row.nutrient?.unitName ?? row.unitName ?? "").toLowerCase();
    if (unitWant === "kcal") { if (unit === "kcal") return v; continue; }
    if (unitWant === "kj") { if (unit === "kj") return v; continue; }
    const toG = { g: 1, mg: 0.001, ug: 0.000001, "µg": 0.000001 }[unit];
    if (toG == null) continue;
    return unitWant === "g" ? v * toG : v * toG * 1000; // g or mg
  }
  return null;
}
function kcalOf(nutrients) {
  const direct = pick(nutrients, [1008, 2048, 2047], "kcal");
  if (direct != null) return direct;
  const kj = pick(nutrients, [1062], "kj");
  return kj != null ? kj / 4.184 : null;
}
const cleanName = (s) => String(s).replace(/\s+/g, " ").trim();

function portionsOf(food) {
  const out = [];
  for (const p of food.foodPortions ?? []) {
    const g = p.gramWeight;
    if (!(g > 0)) continue;
    let name = p.portionDescription;
    if (!name) {
      const unit = p.measureUnit?.name;
      const u = unit && unit !== "undetermined" ? unit : "";
      name = cleanName(`${p.amount ?? 1} ${u} ${p.modifier ?? ""}`);
    }
    name = cleanName(name);
    if (!name || /quantity not specified|^\d*\s*undetermined$/i.test(name)) continue;
    if (out.some((o) => o[0] === name)) continue;
    out.push([name.slice(0, 60), r2(g)]);
    if (out.length >= 5) break;
  }
  return out;
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status}: ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
}

const tmp = mkdtempSync(join(tmpdir(), "fdc-"));
console.log("temp folder:", tmp);
const rows = [];
try {
  for (const f of FILES) {
    const zip = join(tmp, f.zip);
    console.log("downloading", f.label);
    await download(BASE + f.zip, zip);
    const dir = join(tmp, f.code);
    execFileSync("unzip", ["-q", zip, "-d", dir]);
    const jsonName = execFileSync("ls", [dir]).toString().trim().split("\n")[0];
    const data = JSON.parse(readFileSync(join(dir, jsonName), "utf8"));
    let kept = 0;
    for (const food of data[f.key]) {
      const nu = food.foodNutrients ?? [];
      const kcal = kcalOf(nu);
      const protein = pick(nu, [1003], "g");
      const fat = pick(nu, [1004], "g");
      const carbs = pick(nu, [1005, 1050], "g");
      if (kcal == null || kcal < 0) continue; // no energy = not usable
      const fiber = pick(nu, [1079], "g");
      const sugar = pick(nu, [2000, 1063], "g");
      const sodium = pick(nu, [1093], "mg");
      // [fdcId, source, description, kcal, protein, carbs, fat, fiber, sugar, sodiumMg, portions[[name, grams]]]
      rows.push([food.fdcId, f.code, cleanName(food.description), ...[kcal, protein, carbs, fat, fiber, sugar, sodium].map((v) => (v == null ? null : r2(v))), portionsOf(food)]);
      kept++;
    }
    console.log(" ", f.label, "kept", kept, "of", data[f.key].length);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const db = {
  credit: "USDA FoodData Central (public domain, CC0). https://fdc.nal.usda.gov/",
  built: new Date().toISOString().slice(0, 10),
  sources: { f: "Foundation Foods 2026-10", s: "SR Legacy 2018-04", n: "FNDDS 2024-10" },
  // per 100 g; null = USDA did not give it
  columns: ["id", "src", "description", "kcal", "protein", "carbs", "fat", "fiber", "sugar", "sodiumMg", "portions"],
  foods: rows,
};
writeFileSync(OUT, JSON.stringify(db));
console.log("wrote", OUT, (statSync(OUT).size / 1024 / 1024).toFixed(2), "MB,", rows.length, "foods");
