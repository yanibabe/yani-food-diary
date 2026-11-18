// Round 74 (part B): settle the weekly jar's pieces into a pile, headless (no animation).
// matter-js is loaded only when this runs (dynamic import), so it never weighs on the other pages.

import { packFallback, seededRandom, WEEK_JAR_PAD, type Placed, type WeekCard, type WeekCmd } from "./shareWeek.ts";
import type { JarMacro } from "./jar.ts";

/** Drop the pieces (in the given order) into a jar of W x H and let them settle. Same seed = same pile. */
export async function settlePieces(order: JarMacro[], W: number, H: number, r: number, seed: number): Promise<Placed[]> {
  if (!order.length) return [];
  try {
    const mod = await import("matter-js");
    const M = (mod as unknown as { default?: typeof import("matter-js") }).default ?? (mod as unknown as typeof import("matter-js"));
    const { Engine, Bodies, Body, Composite } = M;
    const rnd = seededRandom(seed ^ 0x51ed270b);
    const eng = Engine.create();
    eng.gravity.y = 1.1;
    const pad = WEEK_JAR_PAD;
    const wall = 200;
    Composite.add(eng.world, [
      Bodies.rectangle(W / 2, H - pad + wall / 2, W * 2, wall, { isStatic: true }),
      Bodies.rectangle(pad - wall / 2, 0, wall, H * 20, { isStatic: true }),
      Bodies.rectangle(W - pad + wall / 2, 0, wall, H * 20, { isStatic: true }),
    ]);
    // Start in a loose grid above the jar so nothing overlaps at the start.
    const cols = Math.max(1, Math.floor((W - 2 * pad) / (r * 2.1)));
    const bodies = order.map((k, i) => {
      const row = Math.floor(i / cols);
      const c = i % cols;
      const x = pad + r + ((W - 2 * pad - 2 * r) * (c + 0.5)) / cols + (rnd() - 0.5) * r * 0.4;
      const b = Bodies.circle(x, -r - row * r * 2.2, r * 0.86, { restitution: 0.25, friction: 0.4, density: 0.002 });
      Body.setAngle(b, rnd() * 6);
      return { k, b };
    });
    Composite.add(eng.world, bodies.map((x) => x.b));
    for (let step = 0; step < 1400; step++) {
      Engine.update(eng, 1000 / 60);
      if (step > 60 && step % 20 === 0 && bodies.every((x) => x.b.speed < 0.08 && Math.abs(x.b.angularVelocity) < 0.01)) break;
    }
    const out = bodies.map(({ k, b }) => ({ k, x: b.position.x, y: b.position.y, a: b.angle }));
    // Safety: if anything escaped the jar, use the tidy pile instead.
    const ok = out.every((p) => p.x > pad && p.x < W - pad && p.y > 0 && p.y < H - pad + 1);
    return ok ? out : packFallback(order, W, H, r, seed);
  } catch {
    return packFallback(order, W, H, r, seed);
  }
}

/** Fill the jar command of a laid-out card with the settled pile (returns the same card). */
export async function settleWeekCard(card: WeekCard): Promise<WeekCard> {
  const jar = card.cmds.find((c): c is Extract<WeekCmd, { t: "jar" }> => c.t === "jar");
  if (jar && !jar.placed) jar.placed = await settlePieces(jar.order, jar.w, jar.h, jar.pieceR, jar.seed);
  return card;
}
