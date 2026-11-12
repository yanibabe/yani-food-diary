// The picture shown when the link is shared (WhatsApp, LINE, Messages…).
// Made by Next.js at build time — no extra service needed.

import { ImageResponse } from "next/og";

export const alt = "SnapCal — snap your food, know your calories";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#fbf6ec",
          padding: "0 90px",
          gap: 70,
          fontFamily: "sans-serif",
        }}
      >
        {/* A plate seen from above, with three foods in the app's pastel colours */}
        <div
          style={{
            width: 380,
            height: 380,
            borderRadius: 999,
            background: "#fffdf8",
            border: "14px solid #ece3d1",
            display: "flex",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "absolute", left: 60, top: 150, width: 150, height: 150, borderRadius: 999, background: "#f7ebc6" }} />
          <div style={{ position: "absolute", left: 170, top: 60, width: 140, height: 140, borderRadius: 999, background: "#f6ddd5" }} />
          <div style={{ position: "absolute", left: 200, top: 190, width: 110, height: 110, borderRadius: 999, background: "#e9edd9" }} />
          <div
            style={{
              position: "absolute",
              right: -30,
              bottom: -10,
              width: 120,
              height: 120,
              borderRadius: 999,
              background: "#66763a",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            kcal
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 120, fontWeight: 800, color: "#4f5c2b", letterSpacing: -3 }}>SnapCal</div>
          <div style={{ fontSize: 44, color: "#2f2a22", marginTop: 10 }}>Snap your food.</div>
          <div style={{ fontSize: 44, color: "#2f2a22" }}>Know your calories.</div>
          <div style={{ fontSize: 30, color: "#857c6c", marginTop: 30 }}>Meals · weight · steps</div>
        </div>
      </div>
    ),
    size,
  );
}
