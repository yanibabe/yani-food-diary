// One shared camera for the live barcode scanner.
// iPhone home-screen apps ask "Allow camera?" again every time the camera is switched off and on.
// So after a scan we keep the camera quietly open for a short while (it is not shown or recorded),
// and the next scan reuses it with no question. It switches off for real when:
//   - nobody scanned for KEEP_MS, or
//   - the app goes to the background / the phone locks.

const KEEP_MS = 3 * 60 * 1000;

let stream: MediaStream | null = null;
let pending: Promise<MediaStream> | null = null;
let offTimer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

function isLive(s: MediaStream | null): s is MediaStream {
  return !!s && s.getVideoTracks().some((t) => t.readyState === "live");
}

/** Switch the camera off now. */
export function stopCamera() {
  clearTimeout(offTimer);
  offTimer = undefined;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

function listenForBackground() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") stopCamera();
  });
  window.addEventListener("pagehide", stopCamera);
}

/** Get the camera. Reuses the open one if there is one, so the phone does not ask again. */
export async function getCamera(): Promise<MediaStream> {
  clearTimeout(offTimer);
  offTimer = undefined;
  if (isLive(stream)) {
    stream.getVideoTracks().forEach((t) => (t.enabled = true));
    return stream;
  }
  if (pending) return pending;
  listenForBackground();
  pending = navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    })
    .then((s) => {
      stream = s;
      return s;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** The scanner screen closed. Keep the camera ready for a little while, then switch it off. */
export function releaseCamera() {
  if (!stream) return;
  stream.getVideoTracks().forEach((t) => (t.enabled = false));
  clearTimeout(offTimer);
  offTimer = setTimeout(stopCamera, KEEP_MS);
}
