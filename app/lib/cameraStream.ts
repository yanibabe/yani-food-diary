// The camera for the live barcode scanner.
// Round 64: it is switched OFF for real the moment the scanner closes (a scan was read, she tapped Cancel, or she went
// to another screen). Before, it was kept quietly open for 3 minutes so the iPhone would not ask "Allow camera?" again,
// but that left iPhone's own camera/recording indicator (the red pill at the top) on after she had left the scanner.
// Trade-off: on an iPhone home-screen app the "Allow camera?" question can come back each time the scanner opens.
// It also switches off when the app goes to the background / the phone locks.

let stream: MediaStream | null = null;
let pending: Promise<MediaStream> | null = null;
let listening = false;

function isLive(s: MediaStream | null): s is MediaStream {
  return !!s && s.getVideoTracks().some((t) => t.readyState === "live");
}

/** Switch the camera off now. */
export function stopCamera() {
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

/** The scanner screen closed: switch the camera off now (so the phone's camera indicator goes away). */
export function releaseCamera() {
  stopCamera();
}
