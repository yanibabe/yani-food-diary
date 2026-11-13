"use client";
// Free barcode reader that runs ON the phone (zxing-wasm, open source). No AI, no cost.
// It reads the black-and-white stripes in a photo. The reader file
// (public/zxing_reader.wasm) is served by this app, so nothing is fetched from elsewhere.

import { cleanBarcode } from "./food/provider";

let ready: Promise<typeof import("zxing-wasm/reader")> | null = null;

function loadReader() {
  ready ??= import("zxing-wasm/reader").then((z) => {
    z.prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path) },
    });
    return z;
  });
  return ready;
}

/** Start loading the reader early (e.g. when the barcode page opens) so the first photo is quick. */
export function warmUpBarcodeReader() {
  loadReader().catch(() => {
    ready = null; // try again on the next photo
  });
}

/** Barcode number in one live camera frame (already cropped to the guide box), or null. Fast settings. */
export async function scanBarcodeFrame(frame: ImageData): Promise<string | null> {
  const z = await loadReader();
  const results = await z.readBarcodes(frame, {
    formats: ["EAN13", "EAN8", "UPCA", "UPCE"],
    tryHarder: false,
    tryRotate: true,
    tryInvert: false,
    maxNumberOfSymbols: 1,
  });
  for (const r of results) {
    const code = r.isValid ? cleanBarcode(r.text) : null;
    if (code) return code;
  }
  return null;
}

/** The barcode number in this photo, or null if the stripes can't be read. */
export async function scanBarcodePhoto(file: Blob): Promise<string | null> {
  const z = await loadReader();
  const results = await z.readBarcodes(file, {
    formats: ["EAN13", "EAN8", "UPCA", "UPCE"],
    tryHarder: true,
    tryRotate: true,
    tryInvert: false,
    maxNumberOfSymbols: 1,
  });
  for (const r of results) {
    const code = r.isValid ? cleanBarcode(r.text) : null;
    if (code) return code;
  }
  return null;
}
