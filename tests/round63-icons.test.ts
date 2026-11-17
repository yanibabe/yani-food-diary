import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Round 63: the phone icon is her character (option C, dark). iPhone fills a see-through icon with black and rounds the
// corners itself, so the files must be square, the right size, and have NO alpha channel (PNG colour type 2, not 6).
function png(p: string) {
  const b = readFileSync(new URL(`../public/${p}`, import.meta.url));
  assert.equal(b.subarray(1, 4).toString("latin1"), "PNG", `${p} is a PNG`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bitDepth: b[24], colorType: b[25] };
}

for (const [file, size] of [["apple-touch-icon.png", 180], ["icon-192.png", 192], ["icon-512.png", 512]] as const) {
  test(`${file} is ${size}x${size} with no see-through channel`, () => {
    const i = png(file);
    assert.equal(i.width, size);
    assert.equal(i.height, size);
    assert.equal(i.colorType, 2, "RGB without alpha");
  });
}

test("the page still points at those files", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.ok(layout.includes('"/apple-touch-icon.png"') && layout.includes('"/icon-192.png"'));
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));
  const srcs = manifest.icons.map((x: { src: string }) => x.src);
  assert.ok(srcs.includes("/icon-192.png") && srcs.includes("/icon-512.png"));
});
