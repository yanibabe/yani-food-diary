// Turns Yani's character drawing (public/character.png, her own file, only cropped) into layers for the app.
// Her lines are NEVER changed: we only make the paper around them see-through.
//   public/character-lines.png  her drawing; outside paper and the body inside are see-through
//   public/character-body.png   a mask of the body inside (the app paints the chosen color through it)
// Run: node scripts/character-layers.mjs        (add --list to print the white areas found)
// No extra packages: PNG read/write with Node's own zlib.

import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const SRC = "public/character.png";

function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const CRC = crcTable();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function readPng(file) {
  const b = readFileSync(file);
  let p = 8;
  let w, h, ct, idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString("ascii", p + 4, p + 8);
    const data = b.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error("Only 8-bit, non-interlaced PNG");
      ct = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct];
  if (!bpp) throw new Error(`Unsupported color type ${ct}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const pp = a + up - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  // Brightness 0..255 per pixel.
  const lum = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * bpp;
    lum[i] = bpp >= 3 ? Math.round(0.299 * out[o] + 0.587 * out[o + 1] + 0.114 * out[o + 2]) : out[o];
  }
  return { w, h, lum };
}

function writeRgba(file, w, h, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  writeFileSync(
    file,
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]),
  );
}

const { w, h, lum } = readPng(SRC);
const LIGHT = 128;

// Label every connected light area (4-neighbours).
const label = new Int32Array(w * h).fill(-1);
const comps = [];
for (let s = 0; s < w * h; s++) {
  if (lum[s] < LIGHT || label[s] !== -1) continue;
  const id = comps.length;
  const c = { id, size: 0, x0: w, y0: h, x1: 0, y1: 0, edge: false };
  const stack = [s];
  label[s] = id;
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    c.size++;
    c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x);
    c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y);
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) c.edge = true;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j >= 0 && label[j] === -1 && lum[j] >= LIGHT) {
        label[j] = id;
        stack.push(j);
      }
    }
  }
  comps.push(c);
}

if (process.argv.includes("--list")) {
  for (const c of comps.filter((c) => c.size > 20).sort((a, b) => b.size - a.size)) console.log(JSON.stringify(c));
  process.exit(0);
}

// Which light areas are "body" (get the chosen color). Chosen by looking at the --list output:
// the big body, both hands and both feet. Spoon, fork, monocle and mouth stay white.
const BODY_IDS = JSON.parse(process.env.BODY_IDS ?? "[1,5,6,8,9]"); // body, right hand, left hand, two feet
if (!BODY_IDS.length) throw new Error("Set BODY_IDS (see --list)");
const outside = new Set(comps.filter((c) => c.edge).map((c) => c.id));
const body = new Set(BODY_IDS);

// Body mask, grown 3px so the color tucks under her lines with no white gap.
const inBody = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) if (body.has(label[i])) inBody[i] = 1;
let grown = inBody;
for (let r = 0; r < 3; r++) {
  const g = new Uint8Array(grown);
  for (let i = 0; i < w * h; i++) {
    if (grown[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if ((x > 0 && grown[i - 1]) || (x < w - 1 && grown[i + 1]) || (y > 0 && grown[i - w]) || (y < h - 1 && grown[i + w])) {
      if (!outside.has(label[i])) g[i] = 1; // never grow out into the paper
    }
  }
  grown = g;
}

const lines = Buffer.alloc(w * h * 4);
const mask = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) {
  const o = i * 4;
  const l = lum[i];
  const id = label[i];
  if (id !== -1 && !outside.has(id) && !body.has(id)) {
    // White inside parts (spoon, fork, monocle, mouth): exactly as drawn, solid.
    lines[o] = lines[o + 1] = lines[o + 2] = l;
    lines[o + 3] = 255;
  } else {
    // Her ink: kept black, its darkness becomes how solid it is (soft edges stay soft).
    lines[o] = lines[o + 1] = lines[o + 2] = 0;
    lines[o + 3] = 255 - l;
  }
  if (grown[i]) {
    mask[o] = mask[o + 1] = mask[o + 2] = 255;
    mask[o + 3] = 255;
  }
}
writeRgba("public/character-lines.png", w, h, lines);
writeRgba("public/character-body.png", w, h, mask);
console.log(`Wrote character-lines.png and character-body.png (${w}x${h}), body areas ${[...body].join(",")}`);
