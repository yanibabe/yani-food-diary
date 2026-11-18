// Round 67: the words sent to the AI for meal pictures. No server code here, so the tests can read it.
import type { Lang } from "./i18n.ts";

export const PICTURE_STYLE =
  "Overhead top-down food photo shot straight down, tight close-up so the dish fills most of the frame, on a smooth solid pastel background in a color that suits the dish, soft even studio light, gentle soft shadow, bright clean minimal appetizing. Show ONLY the foods described, add no extra foods or garnishes (no eggs, no sides unless described). No text, no hands, no people.";

export type PictureInput = {
  title: string;
  items: { name: string; amount: number; unit: string }[];
  hint?: string;
  visual?: string;
  lang: Lang;
};
export type PictureOut = { image: string; visual: string };

export const VISUAL_SYSTEM = `You describe how a dish looks, for an image generator.
Reply with ONLY a JSON object: {"visual": "<ONE short English sentence>"}.
Rules:
- One short sentence: what the dish is and what it looks like on the plate or in the bowl.
- Keep the Thai name too, e.g. "Thai น้ำปลาพริก (prik nam pla): small bowl of fish sauce with sliced chilies and garlic".
- Mention ONLY foods that are in the items list. Do not add foods that were not logged (for example no fried egg if none is listed).
- If a correction hint from the user is given (it may be Thai), follow it.`;

/** What the text model is asked. Kept as a function so tests can look at it. */
export function visualPrompt(input: Pick<PictureInput, "title" | "items" | "hint">): string {
  const items = input.items.map((i) => `${i.name} ${i.amount} ${i.unit}`.trim()).join("; ");
  return [`Dish name: ${input.title}`, `Items logged: ${items || "(none)"}`, input.hint?.trim() ? `User's correction: ${input.hint.trim()}` : ""].filter(Boolean).join("\n");
}

/** The prompt sent to the image model. */
export function imagePrompt(visual: string): string {
  return `${visual.trim()} ${PICTURE_STYLE}`;
}

