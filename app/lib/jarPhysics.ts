// Round 74: the physics of ONE daily jar (matter-js). Only loaded with a dynamic import() from DailyJars,
// so the first page load never downloads the physics library.

import Matter from "matter-js";
import { JAR_COLORS, JAR_SHAPES, type JarMacro } from "./jar";
import { gramsToY, pileTop, DAILY_STEPS } from "./dailyJars";
import { drawJarShape } from "./jarShapes";

const { Engine, Bodies, Composite, Body } = Matter;

const PAD = 7;
const WALL = 60;
const LINE: Record<JarMacro, string> = { p: "#4f8db3", c: "#c86f00", f: "#c79400" };

export type JarGuide = { goal?: number; range?: [number, number]; full: number };

export type DailyJarController = {
  /** Make the jar hold `total` pieces. `settled` of the new ones appear at once; the rest drop in (when `animate`). */
  set(total: number, settled: number, animate: boolean, reset?: boolean): void;
  destroy(): void;
};

function makeEngine(W: number, H: number) {
  const eng = Engine.create();
  eng.gravity.y = 1.1;
  const o = { isStatic: true };
  Composite.add(eng.world, [
    Bodies.rectangle(W / 2, H - PAD + WALL / 2, W * 2, WALL, o),
    Bodies.rectangle(PAD - WALL / 2, H / 2, WALL, H * 6, o),
    Bodies.rectangle(W - PAD + WALL / 2, H / 2, WALL, H * 6, o),
  ]);
  return eng;
}

const pieceOpts = { restitution: 0.2, friction: 0.45, density: 0.002 };

function runUntilCalm(eng: Matter.Engine, bodies: Matter.Body[], maxSteps = 900) {
  for (let i = 0; i < maxSteps; i++) {
    Engine.update(eng, 1000 / 60);
    if (i > 40 && i % 15 === 0 && bodies.every((b) => b.speed < 0.05)) break;
  }
}

/** Radius of the drawn shape and of its body for a jar this wide. Circles use ~0.98r so they do not overlap. */
export function jarSizes(W: number, k: JarMacro) {
  const r = Math.min(10, W / 9.5);
  return { r, br: JAR_SHAPES[k] === "circle" ? r * 0.98 : r * 0.86 };
}

/** Y of the top of a pile of 20 pieces: the mean of five settled test runs (different drop positions). */
export function calibratePileTop(W: number, H: number, k: JarMacro): number {
  const { r, br } = jarSizes(W, k);
  const runs: number[][] = [];
  for (let run = 0; run < 5; run++) {
    const eng = makeEngine(W, H);
    const bodies: Matter.Body[] = [];
    for (let i = 0; i < DAILY_STEPS; i++) {
      const fx = ((i * 37 + run * 53 + run * run * 11) % 100) / 100;
      const b = Bodies.circle(PAD + r + fx * (W - 2 * PAD - 2 * r), -i * r * 2.2, br, pieceOpts);
      bodies.push(b);
      Composite.add(eng.world, b);
    }
    runUntilCalm(eng, bodies);
    runs.push(bodies.map((b) => b.position.y));
    Composite.clear(eng.world, false);
    Engine.clear(eng);
  }
  return pileTop(runs, 3, br);
}

export function createDailyJar(opts: { canvas: HTMLCanvasElement; k: JarMacro; guide: JarGuide }): DailyJarController {
  const { canvas, k, guide } = opts;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = Math.max(40, canvas.clientWidth);
  const H = Math.max(40, canvas.clientHeight);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const { r, br } = jarSizes(W, k);
  const floorY = H - PAD;
  const topY = calibratePileTop(W, H, k);
  const eng = makeEngine(W, H);
  const pieces: Matter.Body[] = [];
  let pending = 0;
  let generation = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let raf = 0;
  let dead = false;
  let visible = true;
  let calmFrames = 0;
  const color = JAR_COLORS[k];
  const shape = JAR_SHAPES[k];
  const yOf = (g: number) => gramsToY(g, guide.full, floorY, topY);

  function drawGuides() {
    ctx.save();
    if (guide.range) {
      const y1 = yOf(guide.range[1]);
      const y2 = yOf(guide.range[0]);
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = color;
      ctx.fillRect(4, y1, W - 8, y2 - y1);
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = LINE[k];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(9, y1);
      ctx.lineTo(W - 9, y1);
      ctx.moveTo(9, y2);
      ctx.lineTo(W - 9, y2);
      ctx.stroke();
    } else if (guide.goal != null) {
      const y = yOf(guide.goal);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = LINE[k];
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(9, y);
      ctx.lineTo(W - 9, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const b of pieces) {
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);
      drawJarShape(ctx, shape, r, color);
      ctx.restore();
    }
    drawGuides();
  }

  function frame() {
    raf = 0;
    if (dead || !visible) return;
    Engine.update(eng, 1000 / 60);
    draw();
    calmFrames = pending === 0 && pieces.every((b) => b.speed < 0.08) ? calmFrames + 1 : 0;
    if (calmFrames < 45) raf = requestAnimationFrame(frame);
  }
  function wake() {
    calmFrames = 0;
    if (!raf && visible && !dead) raf = requestAnimationFrame(frame);
  }

  function add(x: number, y: number) {
    const b = Bodies.circle(x, y, br, pieceOpts);
    Body.setAngle(b, Math.random() * 6);
    pieces.push(b);
    Composite.add(eng.world, b);
    return b;
  }
  const randX = () => PAD + r + Math.random() * (W - 2 * PAD - 2 * r);

  /** Pieces that are already there: poured above the pile and settled out of sight, like the calibration. */
  function settleN(n: number) {
    const fresh: Matter.Body[] = [];
    const base = Math.min(...pieces.map((b) => b.position.y), 0);
    for (let i = 0; i < n; i++) fresh.push(add(randX(), base - r * 2 - i * r * 2.2));
    runUntilCalm(eng, pieces);
  }

  function clear() {
    generation++;
    for (const t of timers) clearTimeout(t);
    timers = [];
    pending = 0;
    for (const b of pieces.splice(0)) Composite.remove(eng.world, b);
  }

  const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting) && !document.hidden;
    if (visible) wake();
  }) : null;
  io?.observe(canvas);
  const onVis = () => {
    visible = !document.hidden;
    if (visible) wake();
  };
  document.addEventListener("visibilitychange", onVis);

  draw();

  return {
    set(total, settled, animate, reset) {
      if (dead) return;
      if (reset) clear();
      const have = pieces.length + pending;
      if (total < pieces.length) {
        for (const b of pieces.splice(total)) Composite.remove(eng.world, b);
        pending = 0;
      } else if (total > have) {
        const need = total - have;
        const now = animate ? Math.max(0, Math.min(need, settled - have)) : need;
        if (now > 0) settleN(now);
        const rest = need - now;
        const gap = Math.min(110, 2400 / Math.max(1, rest));
        const gen = generation;
        for (let i = 0; i < rest; i++) {
          pending++;
          timers.push(
            setTimeout(() => {
              if (dead || gen !== generation) return;
              pending = Math.max(0, pending - 1);
              add(randX(), -r * 2);
              wake();
            }, 150 + i * gap),
          );
        }
      }
      draw();
      wake();
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      clear();
      Composite.clear(eng.world, false);
      Engine.clear(eng);
    },
  };
}
