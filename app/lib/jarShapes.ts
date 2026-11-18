// Round 73: the three jar shapes, drawn flat (no shine, no shade) exactly like the approved prototype.
// Used by the small card on Today (plain canvas) and by the full jar (physics). No physics library in here.

export type JarShape = "heart" | "cloud" | "circle";

/** Draw one flat shape centred on (0,0) with "radius" r. */
export function drawJarShape(ctx: CanvasRenderingContext2D, t: JarShape, r: number, col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  if (t === "heart") {
    const k = r * 1.05;
    ctx.moveTo(0, k * 0.85);
    ctx.bezierCurveTo(-k * 1.1, k * 0.1, -k * 0.85, -k * 0.9, 0, -k * 0.4);
    ctx.bezierCurveTo(k * 0.85, -k * 0.9, k * 1.1, k * 0.1, 0, k * 0.85);
  } else if (t === "cloud") {
    const parts: [number, number, number][] = [
      [-0.42, 0.12, 0.5],
      [0.42, 0.12, 0.5],
      [0, -0.25, 0.58],
      [0, 0.3, 0.5],
    ];
    for (const [a, b, c] of parts) {
      ctx.moveTo(a * r + c * r, b * r);
      ctx.arc(a * r, b * r, c * r, 0, 7);
    }
  } else {
    ctx.arc(0, 0, r, 0, 7);
  }
  ctx.fill();
}
