"use client";
// Full-screen live camera. Reads the barcode by itself while she points the phone — no photo button.
// Everything runs on the phone (free reader). Nothing is recorded or sent anywhere.

import { useEffect, useRef, useState } from "react";
import { scanBarcodeFrame, warmUpBarcodeReader } from "../lib/barcodeScan";
import { getCamera, releaseCamera, stopCamera } from "../lib/cameraStream";
import { cameraErrorKind, makeConfirmer, scanArea } from "../lib/liveScan";
import { useLang } from "../lib/lang";
import { Icon } from "./Icon";

const SLOW_HINT_MS = 12000;

export function LiveBarcodeScanner({
  onFound,
  onClose,
  onUsePhoto,
}: {
  onFound: (code: string) => void;
  onClose: () => void;
  onUsePhoto: () => void;
}) {
  const { tr } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [slow, setSlow] = useState(false);
  const foundRef = useRef(onFound);
  useEffect(() => {
    foundRef.current = onFound;
  }, [onFound]);

  useEffect(() => {
    warmUpBarcodeReader();
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const slowTimer = setTimeout(() => setSlow(true), SLOW_HINT_MS);
    const confirm = makeConfirmer();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function tick() {
      if (stopped) return;
      const v = videoRef.current;
      if (v && ctx && v.readyState >= 2 && v.videoWidth > 0) {
        const a = scanArea(v.videoWidth, v.videoHeight);
        canvas.width = a.outW;
        canvas.height = a.outH;
        ctx.drawImage(v, a.x, a.y, a.w, a.h, 0, 0, a.outW, a.outH);
        let code: string | null = null;
        try {
          code = await scanBarcodeFrame(ctx.getImageData(0, 0, a.outW, a.outH));
        } catch (e) {
          console.warn("[barcode] live read failed", e);
        }
        const sure = confirm(code);
        if (sure && !stopped) {
          stopped = true;
          releaseCamera();
          foundRef.current(sure);
          return;
        }
      }
      timer = setTimeout(tick, 120);
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(tr("เครื่องนี้เปิดกล้องสดในแอปไม่ได้ ใช้ถ่ายรูปแทนนะ", "This phone can't open the live camera here. Please take a photo instead."));
        setStarting(false);
        return;
      }
      try {
        stream = await getCamera();
        if (stopped) {
          releaseCamera();
          return;
        }
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        setStarting(false);
        tick();
      } catch (e) {
        const kind = cameraErrorKind(e);
        setError(
          kind === "denied"
            ? tr(
                "แอปยังไม่ได้รับอนุญาตให้ใช้กล้อง ลองปิดแล้วเปิดแอปใหม่ แล้วกด “อนุญาต” หรือใช้ถ่ายรูปแทน",
                "The app isn't allowed to use the camera. Close and reopen the app and tap “Allow”, or take a photo instead.",
              )
            : kind === "none"
              ? tr("หากล้องไม่เจอ ใช้ถ่ายรูปแทนนะ", "No camera found. Please take a photo instead.")
              : `${tr("เปิดกล้องไม่ได้", "Couldn't open the camera")}: ${e instanceof Error ? e.message : String(e)}`,
        );
        setStarting(false);
      }
    }

    start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(slowTimer);
      const v = videoRef.current;
      if (v) {
        // Let go of the picture completely so the phone can switch its camera light off.
        v.pause();
        v.srcObject = null;
        v.removeAttribute("src");
        v.load();
      }
      stream = null;
      stopCamera(); // always, even if the camera was still opening
    };
  }, [tr]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={tr("สแกนบาร์โค้ด", "Scan barcode")} data-testid="live-scanner">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted autoPlay />
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[28%] w-[80%] rounded-2xl border-[3px] border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 px-5 pt-[calc(20px+env(safe-area-inset-top))] text-center text-[17px] font-medium drop-shadow">
          {starting ? tr("กำลังเปิดกล้อง…", "Opening the camera…") : !error && tr("เล็งบาร์โค้ดให้อยู่ในกรอบ", "Point the barcode into the box")}
        </div>
        {error && (
          <div className="absolute inset-x-5 top-1/3 rounded-2xl bg-white px-4 py-3 text-[15px] text-danger" role="alert" data-testid="live-scanner-error">
            {error}
          </div>
        )}
      </div>
      <div className="space-y-3 bg-black px-5 pt-4 pb-[calc(20px+env(safe-area-inset-bottom))]">
        {(slow || error) && (
          <button className="btn-primary w-full" onClick={onUsePhoto} data-testid="live-scanner-photo">
            <Icon name="camera" className="mr-1.5 inline-block h-5 w-5 align-[-4px]" />{slow && !error ? tr("อ่านไม่ได้? ใช้รูปแทน", "Not reading? Use a photo instead") : tr("ใช้รูปแทน", "Use a photo instead")}
          </button>
        )}
        <button className="w-full rounded-2xl bg-white/15 py-3 text-[17px] font-medium" onClick={onClose} data-testid="live-scanner-close">
          {tr("ยกเลิก", "Cancel")}
        </button>
      </div>
    </div>
  );
}
