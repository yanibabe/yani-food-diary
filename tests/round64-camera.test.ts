import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Round 64: the barcode camera is switched off for real the moment the scanner closes (so the iPhone's camera /
// recording indicator does not stay on), and "product not found" offers a photo for the AI.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

function fakeStream() {
  const track = { readyState: "live", enabled: true, stopped: 0, stop() { this.stopped++; this.readyState = "ended"; } };
  return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream };
}

test("releaseCamera stops every track at once (no keep-warm timer)", async () => {
  const { track, stream } = fakeStream();
  Object.defineProperty(globalThis, "navigator", { value: { mediaDevices: { getUserMedia: async () => stream } }, configurable: true });
  const cam = await import("../app/lib/cameraStream.ts");
  const got = await cam.getCamera();
  assert.equal(got, stream);
  assert.equal(track.stopped, 0);
  cam.releaseCamera();
  assert.equal(track.stopped, 1, "the track is stopped right away");
});

test("after release, the next scan opens a fresh camera", async () => {
  let opened = 0;
  Object.defineProperty(globalThis, "navigator", {
    value: { mediaDevices: { getUserMedia: async () => { opened++; return fakeStream().stream; } } },
    configurable: true,
  });
  const cam = await import("../app/lib/cameraStream.ts");
  cam.stopCamera();
  await cam.getCamera();
  cam.releaseCamera();
  await cam.getCamera();
  assert.equal(opened, 2);
  cam.stopCamera();
});

test("the source has no keep-warm timer any more", () => {
  const src = read("../app/lib/cameraStream.ts");
  assert.equal(src.includes("KEEP_MS"), false);
  assert.equal(src.includes("setTimeout"), false);
});

test("the barcode screen switches the camera off when it is left", () => {
  const src = read("../app/components/BarcodeLookup.tsx");
  assert.ok(src.includes("() => stopCamera()"));
});

test("not found: a take-a-photo button and an enter-by-hand button, wired through AddFlow and Today", () => {
  const look = read("../app/components/BarcodeLookup.tsx");
  assert.ok(look.includes('data-testid="barcode-use-photo-ai"') && look.includes('data-testid="barcode-not-found-manual"'));
  assert.ok(read("../app/components/AddFlow.tsx").includes('onSwitchMode("photo"'));
  const page = read("../app/page.tsx");
  assert.ok(page.includes("onSwitchMode") && page.includes("key={layer.kind}"));
  assert.ok(read("../app/add/[mode]/page.tsx").includes("key={mode}"));
});
