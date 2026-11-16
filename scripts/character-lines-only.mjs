// Makes public/character-lines.png = Yani's black lines ONLY, everything else see-through.
// Source: public/character.png (her own file). Her lines are never changed: dark pixels stay
// exactly as drawn; every light pixel (paper, body, spoon, fork, eye) becomes see-through.
// Run: node scripts/character-lines-only.mjs

import sharp from "sharp";

const SRC = "public/character.png";
const OUT = "public/character-lines.png";

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
  // Darkness becomes how solid the pixel is, so soft line edges stay smooth.
  data[i] = data[i + 1] = data[i + 2] = 0;
  data[i + 3] = Math.round(255 - lum);
}
await sharp(data, { raw: info }).png().toFile(OUT);
console.log(`Wrote ${OUT} (${info.width}x${info.height}), lines only.`);
