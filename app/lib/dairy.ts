// Dairy (milk) warnings. She avoids ALL milk products (milk, cream, cheese,
// yogurt, butter, condensed milk, ice cream...), so the app warns when a food
// may have milk in it. The AI marks each item; for names typed by hand (manual
// items, recipe ingredients) a simple word check is used instead.

import type { FoodItem, Goals, Ingredient } from "./types.ts";

/** Milk warnings are switched OFF for now (2026-11-13: she said she doesn't need them yet).
 *  Set to true to bring back the Profile switch and the warnings. Saved data is kept. */
export const MILK_WARNING_ON = false;

/** true when the app should warn about milk. */
export function warnDairy(goals: Pick<Goals, "avoidDairy">): boolean {
  return MILK_WARNING_ON && goals.avoidDairy === true;
}

/** Words that look like milk but are NOT dairy. Removed before checking. */
const NOT_DAIRY = [
  "ขนม", // "ขนม" (snack) contains "นม"
  "นมถั่วเหลือง",
  "น้ำนมถั่วเหลือง",
  "นมอัลมอนด์",
  "นมข้าวโอ๊ต",
  "นมโอ๊ต",
  "นมมะพร้าว",
  "นมข้าวโพด",
  "น้ำนมข้าวโพด",
  "นมข้าว",
  "เนยถั่วลิสง",
  "เนยถั่ว",
  "เนยโกโก้",
  "soy milk",
  "soymilk",
  "almond milk",
  "oat milk",
  "coconut milk",
  "rice milk",
  "peanut butter",
  "almond butter",
  "cocoa butter",
  "nut butter",
];

const DAIRY_WORDS =
  /นม|ครีม|ชีส|เนย|โยเกิร์ต|โยเกิต|ไอศกรีม|ไอศครีม|ไอติม|ลาเต้|คาปูชิโน|ชาเย็น|ชาไทย|เวย์|มอสซาเรลล่า|พาร์เมซาน|milk|cream|cheese|butter|yogh?urt|latte|cappuccino|whey|ghee|mozzarella|parmesan|condensed/i;

/** true when a food name sounds like it has milk in it. */
export function looksDairy(name: string): boolean {
  let s = name.toLowerCase();
  for (const w of NOT_DAIRY) s = s.split(w).join(" ");
  return DAIRY_WORDS.test(s);
}

/** An item counts as dairy if it was marked (by the AI or by her), else by its name. */
export function isDairy(item: Pick<FoodItem, "name" | "dairy">): boolean {
  return item.dairy ?? looksDairy(item.name);
}

/** Turn the AI's answer into the saved flag: the AI's yes, or a dairy-sounding name. */
export function aiDairy(name: string, aiSays: unknown): boolean {
  return aiSays === true || looksDairy(name);
}

export function dairyItems(items: FoodItem[]): FoodItem[] {
  return items.filter(isDairy);
}

export function dairyIngredients(ings: Ingredient[]): Ingredient[] {
  return ings.filter((i) => looksDairy(i.name));
}
