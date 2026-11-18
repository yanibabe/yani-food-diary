// Round 73: the physics of the jar (matter-js). This file is only ever loaded with a dynamic import() from the
// full jar screen, so the Today page never downloads the physics library.

import Matter from "matter-js";
import { JAR_COLORS, JAR_SHAPES, type JarMacro, type JarPour } from "./jar";
import { drawJarShape } from "./jarShapes";

const { Engine, Bodies, Composite, Body, Query, Runner } = Matter;

type PieceBody = Matter.Body & { jk?: JarMacro; born?: number };

export type JarController = {
  /** Empty the jar and pour. Settled pieces appear at the bottom at once; the rest drop one by one. */
  pour(plan: JarPour[], opts: { animate: boolean }): void;
  shake(power?: number): void;
  clearSelection(): void;
  destroy(): void;
};

export function createJar(opts: {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  onSelect: (k: JarMacro | null) => void;
}): JarController {
  const { host, canvas } = opts;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const engine = Engine.create();
  engine.gravity.y = 1.1;
  const runner = Runner.create();
  let W = host.clientWidth;
  let H = host.clientHeight;
  let walls: Matter.Body[] = [];
  const pieces: PieceBody[] = [];
  let timers: ReturnType<typeof setTimeout>[] = [];
  let sel: PieceBody | null = null;
  let radius = 20;
  let raf = 0;
  let dead = false;
  let animateIn = true;
  let generation = 0;

  /** Keep the walls and the picture in step with the jar's size; pull any piece that ended up outside back in. */
  function size() {
    W = host.clientWidth;
    H = host.clientHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Composite.remove(engine.world, walls);
    const t = 60;
    const o = { isStatic: true, friction: 0.3, restitution: 0.2 };
    walls = [
      Bodies.rectangle(W / 2, H + t / 2, W * 2, t, o),
      Bodies.rectangle(-t / 2, H / 2, t, H * 4, o),
      Bodies.rectangle(W + t / 2, H / 2, t, H * 4, o),
    ];
    Composite.add(engine.world, walls);
    for (const b of pieces) {
      const r = b.circleRadius ?? radius;
      if (b.position.y > H - r || b.position.x < r || b.position.x > W - r) {
        Body.setPosition(b, {
          x: Math.min(W - r, Math.max(r, b.position.x)),
          y: Math.min(H - r, b.position.y) - Math.random() * 40,
        });
        Body.setVelocity(b, { x: 0, y: 0 });
      }
    }
  }
  size();
  const ro = new ResizeObserver(size);
  ro.observe(host);

  function addPiece(k: JarMacro, x: number, y: number, r: number): PieceBody {
    const b = Bodies.circle(x, y, r, { restitution: 0.3, friction: 0.08, frictionAir: 0.012, density: 0.0015 }) as PieceBody;
    b.jk = k;
    b.born = performance.now();
    Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.2);
    pieces.push(b);
    Composite.add(engine.world, b);
    return b;
  }

  function clear() {
    for (const t of timers) clearTimeout(t);
    timers = [];
    for (const b of pieces.splice(0)) Composite.remove(engine.world, b);
    sel = null;
  }

  function draw() {
    if (dead) return;
    ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    for (const b of pieces) {
      const r = b.circleRadius ?? radius;
      const k = b.jk as JarMacro;
      const pop = animateIn ? Math.min(1, (now - (b.born ?? 0)) / 250) : 1;
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);
      const s = 0.6 + 0.4 * pop;
      ctx.scale(s, s);
      drawJarShape(ctx, JAR_SHAPES[k], r * 0.86, JAR_COLORS[k]);
      if (b === sel) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#2b2622";
        ctx.stroke();
      }
      ctx.restore();
    }
    raf = requestAnimationFrame(draw);
  }

  /** Settle some pieces at once: lay them in rows from the floor, then let physics run a little in the background. */
  function settle(ks: JarMacro[], r: number) {
    const step = r * 2.02;
    const perRow = Math.max(1, Math.floor((W - 2 * r) / step) + 1);
    const jitter = Math.max(0, (W - 2 * r) - (perRow - 1) * step);
    ks.forEach((k, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x = r + (perRow === 1 ? (W - 2 * r) / 2 : col * step) + (row % 2 && jitter > r ? r : 0) + Math.random() * Math.min(jitter, 3);
      const y = H - r - row * step * 0.9 - Math.random() * 2;
      addPiece(k, Math.min(W - r, Math.max(r, x)), y, r);
    });
    // Let the stack relax quickly (not drawn while it runs). Stops early when everything is calm.
    for (let i = 0; i < 240; i++) {
      Engine.update(engine, 1000 / 60);
      if (i > 20 && i % 10 === 0 && pieces.every((b) => b.speed < 0.08)) break;
    }
    for (const b of pieces) b.born = 0; // no pop-in for these
  }

  function drop(k: JarMacro, r: number, delay: number, gen: number) {
    const t = setTimeout(() => {
      if (dead || gen !== generation) return;
      const b = addPiece(k, r + Math.random() * Math.max(0, W - 2 * r), -r - 10, r);
      b.born = performance.now();
    }, delay);
    timers.push(t);
  }

  const ctl: JarController = {
    pour(plan, o) {
      clear();
      generation++;
      animateIn = o.animate;
      opts.onSelect(null);
      if (plan.length === 0) return;
      // Pieces get smaller when there are many, so the pile fits in the jar (about 55% full at most).
      const base = 25 * Math.min(1, W / 360);
      const fit = Math.sqrt((0.55 * W * H) / (plan.length * Math.PI * base * base));
      radius = Math.max(9, base * Math.min(1, fit));
      const settledKs = plan.filter((p) => p.settled || !o.animate).map((p) => p.k);
      const fresh = plan.filter((p) => !p.settled && o.animate);
      if (settledKs.length) settle(settledKs, radius);
      const gap = Math.min(105, 2400 / Math.max(1, fresh.length));
      let tt = 250;
      for (const p of fresh) {
        drop(p.k, radius, tt, generation);
        tt += gap * (0.5 + Math.random());
      }
    },
    shake(power = 1) {
      try {
        navigator.vibrate?.(30);
      } catch {
        /* no buzz here */
      }
      for (const b of pieces) {
        Body.setVelocity(b, { x: (Math.random() - 0.5) * 14 * power, y: -(6 + Math.random() * 12) * power });
        Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.6);
      }
      try {
        host.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-8px) rotate(-1deg)" },
            { transform: "translateX(8px) rotate(1deg)" },
            { transform: "translateX(0)" },
          ],
          { duration: 350 },
        );
      } catch {
        /* older browsers: no wobble */
      }
    },
    clearSelection() {
      sel = null;
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      Runner.stop(runner);
      clear();
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    },
  };

  const onDown = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const hit = Query.point(pieces, { x: e.clientX - r.left, y: e.clientY - r.top })[0] as PieceBody | undefined;
    if (hit) {
      sel = hit;
      Body.setVelocity(hit, { x: 0, y: -6 });
      opts.onSelect(hit.jk ?? null);
    } else {
      sel = null;
      opts.onSelect(null);
    }
  };
  canvas.addEventListener("pointerdown", onDown);

  Runner.run(runner, engine);
  raf = requestAnimationFrame(draw);
  return ctl;
}
