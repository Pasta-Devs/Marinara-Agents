import {
  SAUCELING_EVOLVE_PATHS,
  type SaucelingEvolveAura,
  type SaucelingEvolveColour,
  type SaucelingEvolveExtra,
  type SaucelingEvolveMove,
  type SaucelingSpeciesId,
  type SaucelingStage,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { loadImage } from "./image-canvas.js";

// An evolved sauceling's signature moves and its evolution moment, drawn on a canvas over the sprite one 100 ms step
// at a time. Positions are art pixels inside the sprite's 52 x 52 cell facing right, the floor at y = 52; facing left
// mirrors them. Nothing here touches the page until it is called.

const CELL = 52;
/** How long one step of a move or the moment shows. */
export const STEP_MS = 100;
const ICICLE_H = [4, 6, 8, 10, 12, 14, 16, 19, 22];

type HatchedStage = Exclude<SaucelingStage, "egg">;
type Anchor = { t: number; l: number; r: number; m: number };
type Point = [number, number];

/** Art-pixel anchors for reaction effects, measured on the shipped frames: head top, left and right
 *  sides, and mouth height. */
// ponytail: one anchor per stage, not per frame, so effects sit a pixel or two off on the narrowest and
// widest species. Upgrade path: per-frame bounds written into sprites/atlas.json by the sprite pipeline.
export const ANCHORS: Record<HatchedStage, Anchor> = {
  hatchling: { t: 21, l: 12, r: 39, m: 30 },
  juvenile: { t: 13, l: 9, r: 42, m: 25 },
  adult: { t: 5, l: 7, r: 44, m: 19 },
  elder: { t: 4, l: 7, r: 44, m: 19 },
};

/** How each aura's particles move: embers, wisps and bubbles rise, snow, leaves and petals fall, the rest twinkle. */
export const AURA_MOTION: Record<SaucelingEvolveAura, "rise" | "fall" | "twinkle"> = {
  embers: "rise",
  wisps: "rise",
  bubbles: "rise",
  snow: "fall",
  leaves: "fall",
  petals: "fall",
  stars: "twinkle",
  glints: "twinkle",
  sparks: "twinkle",
};

/** Each path's colour ramp, darkest to lightest. The picture turns to grey by brightness and each grey takes its place
 *  along the ramp, so shading, eyes and outline survive the recolour; the grey aura and extra strips take it too.
 *  Spark is Storm's aura and extra. */
export const RAMPS: Record<SaucelingEvolveColour | "spark", string[]> = {
  ember: ["#2a0f0a", "#8a2a12", "#d9581e", "#ff9a3c", "#ffe08a"],
  frost: ["#0f1a33", "#2c5a9a", "#5fa0e0", "#a8dcff", "#f2fbff"],
  moss: ["#10220f", "#2f5e1e", "#5c9a2e", "#9fd35a", "#e4f7a8"],
  dusk: ["#170f2e", "#46287a", "#7d4fc4", "#b58cff", "#ecdcff"],
  gilded: ["#2a1a05", "#7a5410", "#c99a1e", "#ffd84a", "#fff6c2"],
  shade: ["#0e0c14", "#2e2a3c", "#575070", "#8f86ad", "#cfc8e6"],
  bloom: ["#2e0f1e", "#8a3060", "#d9609a", "#ff9fcb", "#ffe6f2"],
  storm: ["#12141f", "#2e3550", "#56607f", "#8d96b5", "#d6dcef"],
  tide: ["#08202a", "#145a6a", "#2a9a9a", "#6ad8c8", "#d8fff4"],
  spark: ["#2a1f05", "#8a6a10", "#e0c020", "#fff050", "#ffffe0"],
};
/** Smoke, dust, shadows and scorch marks take this instead of the path's colour. */
const NEUTRAL = ["#1c1917", "#57534e", "#a8a29e", "#e7e5e4", "#fafaf9"];
/** Each path's glow: the outline, afterimages and the light a move washes the stage with. */
const GLOW: Record<SaucelingEvolveColour, string> = {
  ember: "#ff7a3d",
  frost: "#8fd8ff",
  moss: "#7fd35a",
  dusk: "#b58cff",
  gilded: "#ffd84a",
  shade: "#a99cc8",
  bloom: "#ff9fcb",
  storm: "#f5ec5a",
  tide: "#5fe0d0",
};

/** The effect pieces the moves draw from sprites/fx-moves.webp (the aura particles are there too). */
export const MOVE_PIECES = [
  "flamepuff",
  "smokering",
  "frostpatch",
  "coin",
  "coinflat",
  "shockring",
  "waterring",
  "burstring",
  "bolt",
  "scorch",
  "bubble",
  "pop",
  "droplet",
  "crown",
  "sprout",
  "flower",
  "icicle",
  "shard",
  "bigstar",
  "glint",
  "petal",
  "leaf",
  "shadow",
  "speck",
  "dust",
  "wisp",
  "bang",
] as const;

/** A known mouth for a species sheet whose measured one is wrong (only on its own, unflipped art). */
export const MOUTH_FIXES: Record<string, Point> = { "webbit:elder": [42, 33] }; // its front leg reaches past its face

// ---- Pixels -----------------------------------------------------------------------------------------------------

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No 2D canvas.");
  context.imageSmoothingEnabled = false;
  return [canvas, context] as const;
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const memos = new WeakMap<object, Map<string, HTMLCanvasElement>>();
function memo(source: object, key: string, make: () => HTMLCanvasElement) {
  let made = memos.get(source);
  if (!made) memos.set(source, (made = new Map()));
  let value = made.get(key);
  if (!value) made.set(key, (value = make()));
  return value;
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The same gradient map as the sprite's SVG ramp filter: brightness, then a 5-stop table per channel. */
function tint(img: HTMLCanvasElement, ramp: string, boost = 0) {
  return memo(img, `t|${ramp}|${boost}`, () => {
    const stops = (ramp === "neutral" ? NEUTRAL : RAMPS[ramp as keyof typeof RAMPS]).map(rgb);
    const [c, x] = canvasOf(img.width, img.height);
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const C = Math.min(1, (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255 + boost);
      const k = Math.min(3, Math.floor(C * 4));
      const f = (C - k / 4) * 4;
      for (let j = 0; j < 3; j++) p[i + j] = Math.round(stops[k][j] + f * (stops[k + 1][j] - stops[k][j]));
    }
    x.putImageData(d, 0, 0);
    return c;
  });
}

/** A cell's silhouette grown by d pixels (4-neighbour, like the sprite's drop-shadow outline) in one colour. */
function sil(img: HTMLCanvasElement, sx: number, sy: number, d: number, color: string) {
  return memo(img, `s|${sx}|${sy}|${d}|${color}`, () => {
    const a = img.getContext("2d")!.getImageData(sx, sy, CELL, CELL).data;
    const w = CELL + 2 * d;
    const h = CELL + 2 * d;
    let m = new Uint8Array(w * h);
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++) m[(y + d) * w + x + d] = a[(y * CELL + x) * 4 + 3] ? 1 : 0;
    for (let i = 0; i < d; i++) {
      const n = m.slice();
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const j = y * w + x;
          if (
            !m[j] &&
            ((x > 0 && m[j - 1]) || (x < w - 1 && m[j + 1]) || (y > 0 && m[j - w]) || (y < h - 1 && m[j + w]))
          )
            n[j] = 1;
        }
      m = n;
    }
    const [c, x] = canvasOf(w, h);
    const out = x.createImageData(w, h);
    const [r, g, b] = rgb(color);
    for (let i = 0; i < m.length; i++) if (m[i]) out.data.set([r, g, b, 255], i * 4);
    x.putImageData(out, 0, 0);
    return c;
  });
}

/** The white cocoon of the moment with n cracks of the path's colour. */
const CRACKS: Point[][] = [
  [
    [0, 0],
    [-1, -1],
    [-1, -2],
    [-2, -3],
    [-2, -4],
    [-3, -5],
    [-3, -6],
    [-4, -7],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
    [6, 3],
    [7, 3],
  ],
  [
    [0, 0],
    [0, 1],
    [-1, 2],
    [-1, 3],
    [0, 4],
    [-1, 5],
    [-1, 6],
    [-2, 7],
  ],
];
function cracked(img: HTMLCanvasElement, sx: number, sy: number, n: number, A: Spot, color: string) {
  return memo(img, `c|${sx}|${sy}|${n}|${color}|${A.cx}|${A.mid}`, () => {
    const [c, x] = canvasOf(CELL, CELL);
    x.drawImage(sil(img, sx, sy, 0, "#ffffff"), 0, 0);
    x.globalCompositeOperation = "source-atop";
    x.fillStyle = color;
    for (let i = 0; i < n; i++) for (const [dx, dy] of CRACKS[i]) x.fillRect(A.cx + dx, A.mid + dy, 1, 1);
    return c;
  });
}

/** Draws img (or its sub-rect src) at whole pixels, mirrored inside its own box when flip is set. */
function blit(
  x: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  wx: number,
  wy: number,
  flip: boolean,
  alpha = 1,
  w?: number,
  src?: [number, number, number, number],
) {
  if (alpha <= 0) return;
  const sw = src ? src[2] : img.width;
  const sh = src ? src[3] : img.height;
  const width = w ?? sw;
  x.save();
  x.globalAlpha *= alpha;
  if (flip) {
    x.translate(2 * wx + width, 0);
    x.scale(-1, 1);
  }
  if (src) x.drawImage(img, src[0], src[1], sw, sh, wx, wy, width, sh);
  else x.drawImage(img, wx, wy, width, sh);
  x.restore();
}

type Spot = Anchor & { cx: number; mid: number };
const spotOf = (stage: HatchedStage): Spot => {
  const a = ANCHORS[stage];
  return { ...a, cx: (a.l + a.r) >> 1, mid: (a.t + 51) >> 1 };
};

// ---- One step's drawing instructions ----------------------------------------------------------------------------

type Ramp = "neutral" | null;
type Fx = {
  name: string;
  frame: number;
  x: number;
  y: number;
  /** tl (default), c, bc, bl or cl. */
  anchor?: "tl" | "c" | "bc" | "bl" | "cl";
  layer?: "front" | "back" | "floor";
  /** Moves with the sprite's dx and dy. */
  follow?: boolean;
  /** Canvas coordinates, never mirrored. */
  world?: boolean;
  /** Neutral greys, or null for the piece's own colours; the path's colour when left out. */
  ramp?: Ramp;
  alpha?: number;
};
type Mark = Fx & { life: number };

class Step {
  view: "happy" | "side" = "happy";
  col = 0;
  dx = 0;
  dy = 0;
  flip = false;
  alpha = 1;
  hide = false;
  boost = 0;
  white = 0;
  crack = 0;
  ringA: number | null = null;
  evo: boolean | null = null;
  body: "old" | "new" | null = null;
  fadeNew = 0;
  aura = true;
  extra = true;
  extraDy = 0;
  dim = 0;
  shake = 0;
  /** A thread hanging from the top of the canvas down to this height in the cell; none when null. */
  thread: number | null = null;
  list: Fx[] = [];
  marks: Mark[] = [];
  after: Array<{ dx: number; alpha: number }> = [];
  rings: Array<{ d: number; a: number; c: string }> = [];
  fx(name: string, frame: number, x: number, y: number, o: Partial<Fx> = {}) {
    this.list.push({ name, frame, x, y, ...o });
  }
  /** A floor mark: stays after the move and fades out at the end of its life (steps). */
  mark(name: string, frame: number, x: number, y: number, o: Partial<Mark> = {}) {
    this.marks.push({ name, frame, x, y, life: 16, anchor: "bc", ...o });
  }
}

function place(it: Fx, img: HTMLCanvasElement): Point {
  const w = img.width;
  const h = img.height;
  switch (it.anchor) {
    case "c":
      return [it.x - (w >> 1), it.y - (h >> 1)];
    case "bc":
      return [it.x - (w >> 1), it.y - h];
    case "bl":
      return [it.x, it.y - h];
    case "cl":
      return [it.x, it.y - (h >> 1)];
    default:
      return [it.x, it.y];
  }
}
const at = (k: number, a: number, b: number) => k >= a && k < b;
const turnSide = (f: Step, k: number, n: number) => {
  f.view = k >= 1 && k < n - 1 ? "side" : "happy";
};
const around = (cx: number, cy: number, r: number, a: number, squash = 1): Point => [
  cx + Math.round(Math.cos(a) * r),
  cy + Math.round(Math.sin(a) * r * squash),
];
/** Particles drawn in from three points ahead of the mouth (a breath in). */
function inhale(f: Step, k: number, name: string, mx: number, my: number) {
  const d = [9, 6, 3][k - 2];
  for (const [ox, oy] of [
    [1, -1],
    [1.3, 0],
    [1, 1],
  ])
    f.fx(name, k, mx + Math.round(d * ox), my + Math.round(d * oy), { anchor: "c" });
}

// ---- The moves --------------------------------------------------------------------------------------------------

type Ctx = Spot & { mouth: Point[]; E: boolean; spot: boolean; n: number; travel: number };
type MoveDef = {
  /** The step the aura flares, the extra pops and the light washes the stage (`light` moves the wash). */
  hit: number;
  light?: number;
  /** Turns to face the open side first. */
  dir?: boolean;
  /** Length in steps; E is an encore, the rarer bigger version. */
  steps: (E: boolean) => number;
  /** How far along the floor it ends up; none on the spot (a tile or a preview). */
  travel?: (E: boolean, spot: boolean) => number;
  run: (f: Step, k: number, c: Ctx) => void;
};

const MOVES: Record<SaucelingEvolveMove, MoveDef> = {
  // Turns to the open side, breathes in embers, puffs a flame; a smoke ring drifts away.
  firepuff: {
    dir: true,
    hit: 5,
    steps: (E) => (E ? 17 : 15),
    run(f, k, c) {
      turnSide(f, k, c.n);
      const puff = c.E ? [0, 1, 2, 4, 4, 3] : [0, 1, 2, 3];
      if (at(k, 2, 5)) f.col = 1;
      if (at(k, 5, 7)) {
        f.col = 2;
        f.dx = -1;
      }
      const [mx, my] = c.mouth[f.col];
      if (at(k, 2, 5)) inhale(f, k, "embers", mx, my);
      if (at(k, 5, 5 + puff.length))
        f.fx("flamepuff", puff[k - 5], mx + (k - 5 === puff.length - 1 ? 2 : 0), my, { anchor: "cl", follow: k < 7 });
      for (const s0 of c.E ? [4 + puff.length, 6 + puff.length] : [4 + puff.length]) {
        const s = k - s0;
        if (at(s, 0, 4)) f.fx("smokering", s, mx + 20 + 3 * s, my - 3 - 2 * s, { anchor: "c", ramp: "neutral" });
      }
    },
  },
  // Crouches, roars with a shake; embers rise from its feet.
  roar: {
    hit: 6,
    steps: (E) => (E ? 18 : 15),
    run(f, k, c) {
      const end = c.E ? 15 : 12;
      if (at(k, 3, 6)) f.col = 1;
      if (at(k, 6, end)) {
        f.col = 2;
        f.dx = k % 2 ? 2 : -2;
        f.shake = k % 2 ? 1 : -1;
        f.fx("bang", 0, c.r + 2, c.m - 8, { follow: true, ramp: null });
      }
      if (at(k, 6, 10))
        f.fx("burstring", k - 6, c.r + 4 + 3 * (k - 6), c.m, { anchor: "c", alpha: [1, 0.7, 0.45, 0.25][k - 6] });
      const feet = [c.l + 3, c.r - 3, c.cx, c.l + 8, c.r - 8, c.cx - 5];
      for (let i = 0; i < (c.E ? 6 : 3); i++) {
        const s = k - 6 - i;
        if (at(s, 0, 7)) f.fx("wisp", s >> 1, feet[i] + (s % 2), 49 - 3 * s, { anchor: "c", alpha: s >= 5 ? 0.5 : 1 });
      }
    },
  },
  // Turns, rears up and stamps; a row of icicles bursts up from the floor, each taller, then crumbles to frost.
  icicles: {
    dir: true,
    hit: 4,
    steps: (E) => (E ? 21 : 17),
    run(f, k, c) {
      turnSide(f, k, c.n);
      const seq = [
        [0, 0],
        [2, -1],
        [2, -2],
        [2, -3],
        [1, 0],
        [1, 0],
      ];
      if (k < seq.length) [f.col, f.dy] = seq[k];
      const tall = c.E ? [2, 4, 5, 7, 8] : [2, 4, 6];
      const crumble = c.E ? 16 : 13;
      if (at(k, 4, 6)) f.fx("snow", k - 4, c.r + 2, 50, { anchor: "c" });
      tall.forEach((T, i) => {
        const x = c.r + 7 + 9 * i;
        const s = k - 4 - 2 * i;
        if (at(s, 0, 3) && k < crumble) f.fx("icicle", T - 2 + s, x, 52, { anchor: "bc" });
        else if (s >= 3 && k < crumble) f.fx("icicle", T, x, 52, { anchor: "bc" });
        if (k === crumble) f.fx("icicle", T, x, 52, { anchor: "bc", alpha: 0.5 });
        if (i === tall.length - 1 && at(s, 3, 7)) f.fx("glint", s - 3, x - 1, 55 - ICICLE_H[T], { anchor: "c" });
        for (let j = 0; j < 3 && at(k - crumble, 0, 3); j++) {
          const u = k - crumble;
          const h = ICICLE_H[T];
          f.fx("shard", (i + j) % 4, x + (j - 1) * (2 + 2 * u), 52 - h + 4 * j + u * u + 2 * u, {
            anchor: "c",
            alpha: u === 2 ? 0.5 : 1,
          });
        }
      });
      if (k === crumble) f.mark("frostpatch", 1, c.r + 4, 52, { anchor: "bl", life: 18 });
      if (c.E && k === crumble) f.mark("frostpatch", 1, c.r + 22, 52, { anchor: "bl", life: 18 });
    },
  },
  // Spins on the spot; snowflakes fly off.
  twirl: {
    hit: 4,
    steps: (E) => (E ? 16 : 12),
    run(f, k, c) {
      const seq = c.E
        ? [
            [1, 0],
            [1, 0],
            [2, -2],
            [2, -3],
            [0, -4],
            [0, -5],
            [0, -5],
            [0, -5],
            [0, -4],
            [0, -3],
            [2, -2],
            [2, -1],
            [1, 0],
            [1, 0],
          ]
        : [
            [1, 0],
            [1, 0],
            [2, -2],
            [2, -2],
            [0, -3],
            [0, -3],
            [0, -3],
            [0, -2],
            [2, -2],
            [1, 0],
          ];
      if (k < seq.length) [f.col, f.dy] = seq[k];
      if (at(k, 2, seq.length - 1)) {
        f.view = (k - 2) % 2 ? "side" : "happy";
        f.flip = ((k - 2) >> 1) % 2 === 1;
      }
      const n = c.E ? 6 : 4;
      const s = k - 4;
      for (let i = 0; i < n && at(s, 0, 8); i++) {
        const [x, y] = around(c.cx, c.mid, 6 + 3 * s, (i / n) * 2 * Math.PI + 0.4, 0.5);
        f.fx("snow", s + i, x, y + s, { anchor: "c" });
      }
    },
  },
  // Lifts 2 px while leaves circle it, passing in front and behind.
  leafwhirl: {
    hit: 3,
    steps: (E) => (E ? 22 : 18),
    run(f, k, c) {
      const end = c.n - 4;
      if (at(k, 1, 3)) f.col = 1;
      if (at(k, 3, end)) {
        f.col = k === 3 ? 2 : 0;
        f.dy = k === 3 ? -1 : c.E ? -3 : -2;
      }
      if (k === end) f.dy = -1;
      if (k === end + 1) f.col = 1;
      const N = c.E ? 8 : 6;
      const R = (c.r - c.l) / 2 + 4;
      const span = end - 3;
      for (let i = 0; i < N && at(k, 3, end + 3); i++) {
        const a = (k - 3) * (Math.PI / 3.5) + (i / N) * 2 * Math.PI;
        const h = Math.max(0, Math.min(1, (k - 3 - i * 0.5) / (span - 2)));
        const cy = 50 - Math.round(h * (50 - c.t + 6));
        const s = k - end;
        let [x, y] = around(c.cx, cy, R, a, 0.25);
        if (s >= 0) [x, y] = [x + Math.round(Math.cos(a) * 6 * (s + 1)), y - 2 * (s + 1) + s * s];
        f.fx("leaf", (k + i) % 3, x, y, {
          anchor: "c",
          follow: s < 0,
          alpha: s >= 1 ? 0.5 : 1,
          layer: Math.sin(a) < 0 && s < 0 ? "back" : "front",
        });
      }
    },
  },
  // Wiggles; a sprout pops up beside it.
  wiggle: {
    hit: 4,
    steps: (E) => (E ? 16 : 12),
    run(f, k, c) {
      if (at(k, 2, c.n - 2)) {
        f.dx = k % 2 ? 1 : -1;
        f.col = k % 2 ? 1 : 0;
      }
      const spots = c.E ? [c.r + 7, c.l - 7] : [c.r + 7];
      spots.forEach((x, j) => {
        const s = k - 4 - 2 * j;
        if (at(s, 0, 2)) f.fx("sprout", s, x, 52, { anchor: "bc" });
        if (s === 2) f.mark("sprout", 2, x, 52, { life: 18 });
      });
    },
  },
  // Petals burst up and drift down; a flower is left at its feet.
  petalshower: {
    hit: 3,
    steps: (E) => (E ? 28 : 25),
    run(f, k, c) {
      if (at(k, 1, 3)) f.col = 1;
      if (at(k, 3, 5)) {
        f.col = 2;
        f.dy = k === 3 ? -1 : 0;
      }
      const n = c.E ? 12 : 8;
      const s = k - 3;
      const top = c.t - 3;
      for (let i = 0; i < n && s >= 0; i++) {
        const way = i % 2 ? 1 : -1;
        const v = way * (4 + 2 * ((i >> 1) % 3));
        const hi = ((i >> 1) % 2) * 3;
        let x: number;
        let y: number;
        if (s <= 3) [x, y] = [c.cx + v * s, top - [0, 5, 9, 11][s] - hi];
        else {
          const u = s - 3;
          [x, y] = [c.cx + v * 3 + way * Math.floor(u / 3) + ((u >> 1) % 2 ? 2 : -2), top - 11 - hi + 3 * u];
        }
        if (y < 49) f.fx("petal", (s + i) % 3, x, y, { anchor: "c" });
      }
      if (k === 9) f.mark("flower", 0, c.r + 7, 52, { life: 20 });
      if (c.E && k === 11) f.mark("flower", 0, c.l - 7, 52, { life: 18 });
    },
  },
  // Three hops, each higher, with a puff of petals on each landing.
  triplehop: {
    hit: 13,
    steps: () => 18,
    run(f, k, c) {
      const hops = c.E ? [5, 9, 14] : [4, 7, 11];
      const seq: Point[] = [[1, 0]];
      const lands: number[] = [];
      for (const h of hops) {
        const a = Math.ceil(h / 2);
        seq.push([2, -a], [2, -h], [0, -h], [0, -a], [1, 0]);
        lands.push(seq.length - 1);
      }
      if (k < seq.length) [f.col, f.dy] = seq[k];
      lands.forEach((L, j) => {
        const s = k - L;
        const n = j === 2 ? 8 : 4;
        for (let i = 0; i < n && at(s, 0, 4); i++) {
          const left = i % 2 === 0;
          const far = i >> 1;
          f.fx(
            "petal",
            (s + i) % 3,
            left ? c.l + 1 - 2 * s - 4 * far : c.r - 1 + 2 * s + 4 * far,
            49 - 2 * s - 2 * far + ((s * s) >> 1),
            { anchor: "c", alpha: s === 3 ? 0.5 : 1 },
          );
        }
        if (at(s, 0, 2)) for (const x of [c.l, c.r]) f.fx("dust", s, x, 52, { anchor: "bc", ramp: "neutral" });
      });
    },
  },
  // Stars gather in, then six burst out.
  starburst: {
    hit: 6,
    steps: (E) => (E ? 16 : 14),
    run(f, k, c) {
      if (at(k, 3, 6)) f.col = 1;
      if (at(k, 6, 8)) f.col = 2;
      if (k < 6)
        for (let i = 0; i < 6; i++) {
          const [x, y] = around(c.cx, c.mid, [28, 23, 18, 13, 9, 5][k], ((i + 0.5) / 6) * 2 * Math.PI + k * 0.15);
          f.fx("bigstar", ((k + i) % 2) + 1, x, y, { anchor: "c" });
        }
      const rings = c.E
        ? [
            [6, 0, 7],
            [8, 0.5, 9],
          ]
        : [[6, 0, 7]];
      for (const [s0, off, v] of rings) {
        const s = k - s0;
        for (let i = 0; i < 6 && at(s, 0, 6); i++) {
          const [x, y] = around(c.cx, c.mid, 8 + v * s, ((i + off) / 6) * 2 * Math.PI);
          f.fx("bigstar", [2, 3, 2, 3, 1, 0][s], x, y, { anchor: "c", alpha: s >= 4 ? 0.5 : 1 });
        }
      }
    },
  },
  // Floats up and hovers, leaving a trail of little stars.
  float: {
    hit: 4,
    steps: (E) => (E ? 18 : 16),
    run(f, k, c) {
      const top = c.E ? -14 : -10;
      const rise = [0, -1, -4, -8];
      const end = c.n - 4;
      if (k < 4) f.dy = Math.max(top, rise[k]);
      else if (k < end) f.dy = top + (Math.floor((k - 4) / 3) % 2);
      else f.dy = [-6, -2, 0, 0][k - end];
      if (f.dy < 0)
        f.fx("shadow", Math.min(3, Math.floor(-f.dy / 3)), c.cx, 51, {
          anchor: "c",
          layer: "floor",
          ramp: "neutral",
          alpha: 0.5,
        });
      if (k === c.n - 2) f.col = 1;
      for (let j = 0; j < 5; j++) {
        const born = 4 + 2 * j;
        const s = k - born;
        if (born >= end || !at(s, 0, 5)) continue;
        f.fx("bigstar", [1, 2, 1, 0, 0][s], c.cx + [-8, 6, -3, 9, 1][j], 50 + top + 2 * s, {
          anchor: "c",
          alpha: s === 4 ? 0.5 : 1,
        });
      }
    },
  },
  // Coins arc out, bounce once, glint, and lie on the floor for a moment.
  coinshower: {
    hit: 3,
    steps: (E) => (E ? 24 : 22),
    run(f, k, c) {
      if (at(k, 1, 3)) f.col = 1;
      if (at(k, 3, 5)) {
        f.col = 2;
        f.dy = k === 3 ? -1 : 0;
      }
      const vxs = c.E ? [-2.6, -2, -1.5, 1.5, 2, 2.6, -3.2, 3.2] : [-2.4, -1.7, 1.7, 2.4];
      vxs.forEach((v, i) => {
        const s = k - 3 - (i % 3);
        if (s < 0) return;
        let x = c.cx + Math.sign(v) * 6;
        let y = c.t + 4;
        let vx = v;
        let vy = -4 - (i % 2);
        let bounced = false;
        let landed = -1;
        for (let j = 0; j < s && landed < 0; j++) {
          x += vx;
          vy += 1;
          y += vy;
          if (y >= 47) {
            y = 47;
            if (bounced) landed = j + 1;
            vy = bounced ? 0 : -3;
            vx /= 2;
            bounced = true;
          }
        }
        const X = Math.round(x);
        if (landed < 0) f.fx("coin", s, X, y, { anchor: "c" });
        else {
          if (landed === s) f.mark("coinflat", 0, X, 52, { life: 14 });
          if (s - landed < 4) f.fx("glint", s - landed, X + 3, 45, { anchor: "c" });
        }
      });
    },
  },
  // Glints sparkle around it.
  sparkle: {
    hit: 2,
    steps: (E) => (E ? 18 : 14),
    run(f, k, c) {
      if (k === 1) f.col = 1;
      if (k === 2) f.col = 2;
      const spots: Point[] = [
        [c.l - 6, c.t + 4],
        [c.r + 5, c.t + 9],
        [c.l - 3, c.m + 13],
        [c.r + 3, c.m + 18],
        [c.cx + 4, c.t - 6],
        [c.l - 9, c.m + 2],
        [c.r + 8, c.m],
        [c.cx - 7, c.m + 24],
      ];
      spots.slice(0, c.E ? 8 : 4).forEach(([x, y], i) => {
        const s = k - 4 - 2 * (i % 4) - (i >= 4 ? 1 : 0);
        if (at(s, 0, 5)) f.fx("glint", s, x, y, { anchor: "c" });
      });
      for (let i = 0; i < 6 && at(k, 2, 5); i++) {
        const [x, y] = around(c.cx, c.mid, 10 + 7 * (k - 2), ((i + 0.5) / 6) * 2 * Math.PI);
        f.fx("bigstar", [1, 2, 0][k - 2], x, y, { anchor: "c", alpha: k === 4 ? 0.5 : 1 });
      }
    },
  },
  // Glows bright twice.
  shine: {
    hit: 2,
    steps: (E) => (E ? 18 : 14),
    run(f, k, c) {
      for (const p of c.E ? [2, 7, 12] : [2, 8]) {
        const s = k - p;
        if (at(s, 0, 3)) {
          f.boost = 0.25;
          f.ringA = s === 1 ? 0.8 : 0.35;
        }
        if (at(s, 0, 4)) f.fx("glint", [1, 2, 3, 4][s], c.r - 4, c.t + 3, { anchor: "c" });
        for (let i = 0; i < 8 && at(s, 0, 3); i++) {
          const [x, y] = around(c.cx, c.mid, (c.r - c.l) / 2 + 3 + 3 * s, (i / 8) * 2 * Math.PI, 0.9);
          f.fx("bigstar", [0, 1, 0][s], x, y, { anchor: "c", alpha: s === 2 ? 0.5 : 1 });
        }
      }
      if (k === 1) f.col = 1;
      if (k === 2) f.col = 2;
    },
  },
  // Jumps and stomps; a dark ring rolls across the floor and the stage dims.
  shockwave: {
    hit: 5,
    steps: (E) => (E ? 17 : 14),
    run(f, k, c) {
      const seq = [
        [0, 0],
        [1, 0],
        [2, -1],
        [2, -3],
        [2, -4],
        [1, 0],
        [1, 0],
      ];
      if (k < seq.length) [f.col, f.dy] = seq[k];
      if (k === 5) f.shake = 1;
      if (k === 6) f.shake = -1;
      for (const s0 of c.E ? [5, 7] : [5])
        if (at(k - s0, 0, 6)) f.fx("shockring", k - s0, c.cx, 51, { anchor: "c", layer: "floor" });
      if (at(k, 5, 8))
        for (const [x, d] of [
          [c.l - 3, -1],
          [c.r + 3, 1],
        ])
          f.fx("dust", Math.min(1, k - 5), x + 3 * d * (k - 5), 52, {
            anchor: "bc",
            ramp: "neutral",
            alpha: k === 7 ? 0.5 : 1,
          });
    },
  },
  // Melts into wisps, drifts along, and reappears a little way along.
  vanish: {
    hit: 10,
    steps: () => 14,
    travel: (E, spot) => (spot ? 0 : E ? 40 : 24),
    run(f, k, c) {
      const T = c.travel;
      if (at(k, 1, 4)) f.col = 1;
      f.alpha = ({ 2: 0.66, 3: 0.33, 9: 0.33, 10: 0.66 } as Record<number, number>)[k] ?? 1;
      if (at(k, 4, 9)) f.hide = true;
      if (k >= 9) f.dx = T;
      if (at(k, 10, 12)) f.col = 2;
      for (let i = 0; i < (c.E ? 8 : 6); i++) {
        const ox = [-8, 8, -3, 4, -12, 11, 0, -6][i];
        const oy = [2, 0, 8, 12, 10, 6, -2, 16][i];
        let x: number;
        let y: number;
        if (at(k, 2, 5)) [x, y] = [c.cx + ox, c.mid + oy - 2 * (k - 2)];
        else if (at(k, 5, 9)) {
          const s = k - 5;
          const circle = T ? 0 : Math.round(4 * Math.cos(((s + i) * Math.PI) / 2));
          [x, y] = [c.cx + ox + Math.round((T * (s + 1)) / 5) + circle, c.mid + oy - 6 + ((s + i) % 2)];
        } else if (at(k, 9, 11)) [x, y] = [c.cx + T + Math.round(ox * (1 - (k - 9) / 2)), c.mid + oy - 4 + 2 * (k - 9)];
        else continue;
        f.fx(i % 2 ? "wisps" : "wisp", k + i, x, y, { anchor: "c" });
      }
    },
  },
  // Turns, gathers sparks; a bolt strikes from the top of the stage and scorches the floor.
  zap: {
    dir: true,
    hit: 6,
    steps: (E) => (E ? 15 : 12),
    run(f, k, c) {
      turnSide(f, k, c.n);
      if (at(k, 2, 6))
        for (let i = 0; i < 4; i++) {
          const [x, y] = around(c.cx, c.t - 1, [20, 15, 10, 5][k - 2], ((i + 0.5) / 4) * 2 * Math.PI + k * 0.3, 0.6);
          f.fx("bigstar", ((k + i) % 2) + 1, x, y, { anchor: "c" });
        }
      if (at(k, 4, 6)) f.col = 1;
      if (at(k, 6, 8)) f.col = 2;
      const strikes: Point[] = c.E
        ? [
            [6, c.r + 16],
            [9, c.r + 34],
          ]
        : [[6, c.r + 16]];
      for (const [s0, tx] of strikes) {
        const s = k - s0;
        if (at(s, 0, 3)) f.fx("bolt", s === 1 ? 1 : 0, tx, 52, { anchor: "bc", alpha: s === 2 ? 0.5 : 1 });
        if (s === 1) f.mark("scorch", 0, tx, 52, { ramp: "neutral", life: 18 });
        for (let i = 0; i < 6 && at(s, 1, 5); i++)
          f.fx(
            "bigstar",
            [2, 1, 1, 0][s - 1],
            tx + (i % 2 ? 1 : -1) * (3 + 3 * s + 2 * (i >> 1)),
            50 - 2 * s - (i >> 1) * 3 + ((s * s) >> 1),
            { anchor: "c" },
          );
      }
    },
  },
  // Turns, dashes with afterimages, skids to a stop in sparks.
  dash: {
    dir: true,
    hit: 4,
    steps: () => 13,
    travel: (E, spot) => (spot ? 0 : E ? 44 : 30),
    run(f, k, c) {
      turnSide(f, k, c.n);
      const T = c.travel;
      const run = T ? [0, Math.round(T * 0.3), Math.round(T * 0.65), T] : [1, 2, 3, 3];
      if (at(k, 2, 4)) {
        f.col = 1;
        f.dx = -1;
      }
      if (at(k, 4, 8)) {
        const s = k - 4;
        f.col = s < 2 ? 2 : 0;
        f.dx = run[s];
        for (let j = 1; j <= (c.E ? 3 : 2); j++) {
          const px = T ? run[s - j] : run[s] - 3 * j;
          if (px !== undefined && px !== run[s]) f.after.push({ dx: px, alpha: [0.5, 0.3, 0.15][j - 1] });
        }
      }
      if (at(k, 8, 10)) {
        f.col = 1;
        f.dx = (T || 3) + 1;
        f.fx("dust", k - 8, c.l - 3, 52, { anchor: "bc", follow: true, ramp: "neutral" });
        f.fx("dust", k - 8, c.l - 11 - 2 * (k - 8), 52, { anchor: "bc", follow: true, ramp: "neutral", alpha: 0.6 });
        for (let i = 0; i < 3; i++)
          f.fx("bigstar", (k - 8 + i) % 3, c.r + 3 + 3 * i, 49 - 3 * i - 2 * (k - 8), { anchor: "c", follow: true });
      }
      if (k >= 10) f.dx = T || [1, 0][k - 10] || 0;
    },
  },
  // Turns, blows a bubble that floats off and pops into droplets.
  bubbleblow: {
    dir: true,
    hit: 10,
    light: 17,
    steps: (E) => (E ? 30 : 23),
    run(f, k, c) {
      turnSide(f, k, c.n);
      if (at(k, 2, 4)) f.col = 1;
      if (at(k, 4, 10)) f.col = 2;
      const [mx, my] = c.mouth[2];
      if (at(k, 4, 10)) f.fx("bubble", k - 4, mx, my, { anchor: "cl" });
      const bubbles = c.E
        ? [
            [10, 6, 2],
            [13, 5, 3],
            [16, 4, 2],
          ]
        : [[10, 6, 2]];
      for (const [s0, size, rise] of bubbles) {
        const s = k - s0;
        const bx = mx + 9 + 2 * s;
        const by = my - rise * s + (s % 2);
        if (at(s, 0, 7)) f.fx("bubble", size, bx, by, { anchor: "c" });
        if (at(s, 7, 9)) f.fx("pop", s - 7, bx, by, { anchor: "c" });
        for (let i = 0; i < 6 && at(s, 8, 14); i++) {
          const u = s - 8;
          const vx = [-3, -2, -1, 1, 2, 3][i];
          f.fx("droplet", 0, bx + vx * (u + 2), by + u * u - 3 * u - 1 + (i % 2) * 2, {
            anchor: "c",
            alpha: u >= 5 ? 0.5 : 1,
          });
        }
      }
    },
  },
  // A big hop, then a ring of water and a splash.
  splash: {
    hit: 8,
    steps: (E) => (E ? 18 : 15),
    run(f, k, c) {
      const ups = c.E ? [-5, -11, -16, -18, -18, -16, -11, -5] : [-4, -9, -13, -15, -13, -9, -4];
      const seq: Point[] = [
        [1, 0],
        [1, 0],
        ...ups.map((dy, i): Point => [i < 2 || i === ups.length - 1 ? 2 : 0, dy]),
        [1, 0],
        [1, 0],
      ];
      const land = 2 + ups.length;
      if (k < seq.length) [f.col, f.dy] = seq[k];
      for (const s0 of c.E ? [land, land + 2] : [land])
        if (at(k - s0, 0, 5)) f.fx("waterring", k - s0, c.cx, 51, { anchor: "c", layer: "floor" });
      const s = k - land;
      if (at(s, 0, 3)) f.fx("crown", s, c.cx, 52, { anchor: "bc" });
      for (let i = 0; i < (c.E ? 10 : 8) && at(s, 0, 8); i++) {
        const vx = [-5, -3, -2, -1, 1, 2, 3, 5, -4, 4][i];
        const up = 6 - (Math.abs(vx) % 3);
        f.fx("droplet", 0, c.cx + vx * (s + 2), 46 - up * s + s * s, { anchor: "c", alpha: s >= 6 ? 0.5 : 1 });
      }
    },
  },
};

/** What the sprite's canvas is playing: a signature move (an `encore` is the rarer bigger one; `travel` is how far
 *  along the floor it ends up, `spot` keeps it in place for a tile), the evolution moment, or a special hatching.
 *  `colour` tints a hatchling's moment and moves, as it has no look yet. `at` is when it began. */
export type MoveAct =
  | {
      kind: "move";
      move: SaucelingEvolveMove;
      encore: boolean;
      travel: number;
      spot: boolean;
      at: number;
      colour?: SaucelingEvolveColour;
    }
  | { kind: "moment"; reduced: boolean; at: number }
  | { kind: "hatch"; how: "crack" | "thread"; colour: SaucelingEvolveColour; at: number };

export const moveSteps = (move: SaucelingEvolveMove, encore: boolean) => MOVES[move].steps(encore);
export const moveTravel = (move: SaucelingEvolveMove, encore: boolean, spot: boolean) =>
  MOVES[move].travel?.(encore, spot) ?? 0;
/** The move turns to face the open side of the stage before it plays. */
export const moveTurns = (move: SaucelingEvolveMove) => Boolean(MOVES[move].dir || MOVES[move].travel);

// ---- The evolution moment (about 5 s), then the path's first move ---------------------------------------------

export const MOMENT_STEPS = 54;
/** With reduced effects the moment is a crossfade from the old look to the new one. */
export const REDUCED_STEPS = 16;
export const actSteps = (act: MoveAct) =>
  act.kind === "move"
    ? moveSteps(act.move, act.encore)
    : act.kind === "hatch"
      ? HATCH_STEPS
      : act.reduced
        ? REDUCED_STEPS
        : MOMENT_STEPS;

/** Where the specks of the new colour drift in from, around a 176 x 99 stage with the sprite at x = 62. */
const SPECKS: Point[] = (() => {
  const r = rng(7);
  return Array.from({ length: 16 }, () => {
    const e = (r() * 4) | 0;
    const u = r();
    const from: Point[] = [
      [u * 176, -2],
      [178, u * 99 * 0.8],
      [u * 176, -2],
      [-2, u * 99 * 0.8],
    ];
    return from[e];
  });
})();
/** The heartbeats while it glows white. */
const BEATS = [12, 20, 27, 33, 38, 42];

// The stage dims and specks of the new colour drift in; it curls up and glows white as the heartbeat speeds up; it
// flickers between its old and new colours, faster and faster; the light cracks and bursts: shards and a ring fly
// out, the aura comes on and the extra drops in.
function moment(f: Step, k: number, A: Spot, X: number, Y0: number, reduced: boolean) {
  if (reduced) {
    f.evo = k >= 12;
    f.body = k >= 12 ? "new" : "old";
    if (at(k, 4, 12)) f.fadeNew = [0.25, 0.5, 0.75, 1][(k - 4) >> 1];
    return;
  }
  f.evo = k >= 44;
  f.aura = f.extra = k >= 46;
  f.dim = k < 10 ? (k + 1) * 0.06 : k < 44 ? 0.6 : ([0.4, 0.25, 0.1][k - 44] ?? 0);
  const tx = X + 26;
  const ty = Y0 + A.mid;
  if (k < 21)
    SPECKS.forEach(([px, py], i) => {
      const sx = px + X - 62;
      const sy = py + Y0 - 39;
      const t = Math.min(1, (k + 1 + (i % 4)) / 22) ** 1.5;
      if (t < 0.92)
        f.fx(i % 3 ? "speck" : "bigstar", 0, Math.round(sx + (tx - sx) * t), Math.round(sy + (ty - sy) * t), {
          world: true,
        });
    });
  if (at(k, 10, 44)) f.col = 1;
  if (at(k, 44, 46)) f.col = 2;
  if (at(k, 10, 22)) f.white = [0.33, 0.66][k - 10] ?? (BEATS.includes(k) ? 1 : 0.75);
  f.body = k < 28 ? "old" : k < 33 ? "new" : k < 37 ? "old" : k < 41 ? "new" : k < 44 ? "old" : "new";
  if (at(k, 41, 44)) {
    f.white = 1;
    f.crack = k - 40;
  }
  for (const b of BEATS)
    if (at(k - b, 0, 3)) f.rings.push({ d: [2, 4, 6][k - b], a: [0.9, 0.5, 0.25][k - b], c: "#ffffff" });
  if (at(k, 44, 49)) f.fx("burstring", k - 44, A.cx, A.mid, { anchor: "c" });
  for (let i = 0; i < 8 && at(k, 44, 52); i++) {
    const s = k - 44;
    const [x, y] = around(A.cx, A.mid, 4 + 5 * s, ((i + 0.5) / 8) * 2 * Math.PI);
    f.fx("shard", i, x, y + ((s * s) >> 1), { anchor: "c", alpha: s >= 6 ? 0.5 : 1 });
  }
  if (at(k, 46, 53)) f.extraDy = [-20, -14, -8, -3, 0, -2, 0][k - 46];
}

// ---- A special hatching (2.4 s), then its moves --------------------------------------------------------------

/** How a built-in special or October species hatches: its moment, the colour it plays in, and the moves after it
 *  (each the bigger encore). Every other species just hatches. */
export const HATCH_MOMENTS: Partial<
  Record<
    SaucelingSpeciesId,
    { how: "crack" | "thread"; colour: SaucelingEvolveColour; moves: readonly SaucelingEvolveMove[] }
  >
> = {
  prismite: { how: "crack", colour: "frost", moves: ["starburst"] },
  thundrake: { how: "crack", colour: "storm", moves: ["zap"] },
  clockrit: { how: "crack", colour: "gilded", moves: ["shockwave"] },
  wickwisp: { how: "crack", colour: "ember", moves: ["firepuff"] },
  cauldrop: { how: "crack", colour: "moss", moves: ["bubbleblow", "splash"] },
  webbit: { how: "thread", colour: "dusk", moves: [] },
};
export const HATCH_STEPS = 24;
const HATCH_BEATS = [2, 7, 11];
/** Where a Webbit's glints twinkle once it has landed, and the step each starts. */
const HATCH_GLINTS = (A: Spot): Array<[number, number, number]> => [
  [15, A.l - 3, A.t + 3],
  [17, A.r + 2, A.m],
  [19, A.cx + 2, A.t - 4],
];

// It hatches curled up and glowing white as its heart beats; three cracks run through the light and it bursts out in
// its own colours with a ring and shards. A Webbit drops in on a thread instead, lands, bobs, the thread is drawn up
// and glints twinkle around it.
function hatch(f: Step, k: number, A: Spot, how: "crack" | "thread") {
  if (how === "thread") {
    f.dy = k < 10 ? -Math.round(92 * (1 - k / 10) ** 2) : ([0, -3, -2, -1][k - 10] ?? 0);
    f.col = k < 10 ? 2 : ([1, 2][k - 10] ?? 0);
    f.dim = k < 10 ? 0.3 : ([0.2, 0.1][k - 10] ?? 0);
    if (k < 14) f.thread = f.dy + A.t + 1;
    else if (k < 18) f.thread = A.t + 1 - 25 * (k - 13);
    for (const [start, gx, gy] of HATCH_GLINTS(A))
      if (at(k, start, start + 3)) f.fx("glint", k - start, gx, gy, { anchor: "c" });
    return;
  }
  f.dim = k < 6 ? (k + 1) * 0.07 : k < 17 ? 0.42 : ([0.28, 0.14][k - 17] ?? 0);
  f.col = k < 14 ? 1 : at(k, 17, 19) ? 2 : 0;
  if (k < 17) f.white = k < 14 && !HATCH_BEATS.includes(k) ? 0.85 : 1;
  if (at(k, 14, 17)) f.crack = k - 13;
  for (const b of HATCH_BEATS)
    if (at(k - b, 0, 3)) f.rings.push({ d: [2, 4, 6][k - b], a: [0.9, 0.5, 0.25][k - b], c: "#ffffff" });
  if (at(k, 17, 22)) f.fx("burstring", k - 17, A.cx, A.mid, { anchor: "c" });
  for (let i = 0; i < 8 && at(k, 17, 24); i++) {
    const s = k - 17;
    const [x, y] = around(A.cx, A.mid, 4 + 5 * s, ((i + 0.5) / 8) * 2 * Math.PI);
    f.fx("shard", i, x, y + ((s * s) >> 1), { anchor: "c", alpha: s >= 5 ? 0.5 : 1 });
  }
}

// ---- Art --------------------------------------------------------------------------------------------------------

/** Every effect piece's frames, cut to art pixels; the extras are `x-<extra>`. `raw` pieces keep their own colours. */
export type MoveArt = { pieces: Record<string, HTMLCanvasElement[]>; raw: Set<string> };
/** The sprite's own frames in art pixels: base, squash and stretch, front above and side below (the front again when
 *  it has no side view), facing right; and the mouth of each side frame, or null without a side view. */
export type MoveBody = { img: HTMLCanvasElement; mouths: Point[] | null };
/** A strip of frames: row `row` of a picture `rows` rows tall, with 3 frames or 1. */
export type MoveStrip = { src: string; row: number; rows: number; frames: 1 | 3 };

type Atlas = {
  scale: number;
  moves: { path: string; raw: string[]; pieces: Record<string, Array<[number, number, number, number]>> };
  extras: { path: string; rows: SaucelingEvolveExtra[]; frames: number; artSize: [number, number] };
};

/** Throws when the browser will not let the page read a picture's pixels back. */
function readable(c: HTMLCanvasElement) {
  c.getContext("2d")!.getImageData(0, 0, 1, 1);
}

function cut(img: HTMLImageElement, [x, y, w, h]: [number, number, number, number], s: number) {
  const [c, ctx] = canvasOf(w, h);
  ctx.drawImage(img, x * s, y * s, w * s, h * s, 0, 0, w, h);
  return c;
}

const arts = new Map<string, Promise<MoveArt>>();
/** The effect pieces, loaded once per package; a failed load is tried again next time. */
export function loadMoveArt(assetUrl: (path: string) => string): Promise<MoveArt> {
  const key = assetUrl("sprites/atlas.json");
  let job = arts.get(key);
  if (!job) {
    job = (async () => {
      const response = await fetch(key);
      if (!response.ok) throw new Error(`atlas ${response.status}`);
      const atlas = (await response.json()) as Atlas;
      const [moves, extras] = await Promise.all([
        loadImage(assetUrl(atlas.moves.path)),
        loadImage(assetUrl(atlas.extras.path)),
      ]);
      const pieces: Record<string, HTMLCanvasElement[]> = {};
      for (const [name, rects] of Object.entries(atlas.moves.pieces))
        pieces[name] = rects.map((rect) => cut(moves, rect, atlas.scale));
      const [w, h] = atlas.extras.artSize;
      atlas.extras.rows.forEach((name, row) => {
        pieces[`x-${name}`] = Array.from({ length: atlas.extras.frames }, (_, i) =>
          cut(extras, [i * w, row * h, w, h], atlas.scale),
        );
      });
      readable(pieces.bang[0]);
      return { pieces, raw: new Set(atlas.moves.raw) };
    })();
    arts.set(key, job);
    job.catch(() => arts.delete(key));
  }
  return job;
}

/** The mouth of a side frame (as the sprite pipeline measures it): the furthest-forward pixel in the middle 40% of
 *  its height, the middle one if several are within a pixel of it. */
function mouthOf(data: Uint8ClampedArray): Point | null {
  const solid = (x: number, y: number) => data[(y * CELL + x) * 4 + 3] > 0;
  const ys: number[] = [];
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++)
      if (solid(x, y)) {
        ys.push(y);
        break;
      }
  if (!ys.length) return null;
  const y0 = ys[0];
  const h = ys[ys.length - 1] - y0 + 1;
  const edge = new Map<number, number>();
  for (let y = y0 + Math.floor(0.3 * h); y <= y0 + Math.floor(0.7 * h); y++)
    for (let x = CELL - 1; x >= 0; x--)
      if (solid(x, y)) {
        edge.set(y, x);
        break;
      }
  if (!edge.size) return null;
  const most = Math.max(...edge.values());
  const near = [...edge].filter(([, x]) => x >= most - 1);
  const [y, x] = near[near.length >> 1];
  return [x + 1, y];
}

const bodies = new Map<string, Promise<MoveBody>>();
/** The sprite's frames for the canvas. A `flipped` sauceling's art faces left, so each frame is mirrored to face
 *  right like the species art. `fix` replaces the measured mouth. */
export function loadMoveBody(
  front: MoveStrip,
  side: MoveStrip | null,
  flipped: boolean,
  fix: Point | null = null,
): Promise<MoveBody> {
  const key = JSON.stringify([front, side, flipped, fix]);
  let job = bodies.get(key);
  if (!job) {
    if (bodies.size > 32) bodies.clear();
    job = (async () => {
      const [c, x] = canvasOf(CELL * 3, CELL * 2);
      for (const [strip, y] of [
        [front, 0],
        [side ?? front, CELL],
      ] as const) {
        const img = await loadImage(strip.src);
        const h = img.naturalHeight / strip.rows;
        for (let col = 0; col < 3; col++) {
          const from = strip.frames === 3 ? (img.naturalWidth / 3) * col : 0;
          const w = strip.frames === 3 ? img.naturalWidth / 3 : img.naturalWidth;
          x.save();
          if (flipped) {
            x.translate((2 * col + 1) * CELL, 0);
            x.scale(-1, 1);
          }
          x.drawImage(img, from, strip.row * h, w, h, col * CELL, y, CELL, CELL);
          x.restore();
        }
      }
      // ponytail: a picture from another origin can't be read back, so it gets no canvas and plays no moves. Upgrade
      // path: serve the form pictures from the package's own origin (they are today).
      readable(c);
      let mouths: Point[] | null = null;
      if (fix) mouths = [fix, fix, fix];
      else if (side) {
        const found = [0, 1, 2].map((col) => mouthOf(x.getImageData(col * CELL, CELL, CELL, CELL).data));
        mouths = found.every(Boolean) ? (found as Point[]) : null;
      }
      return { img: c, mouths };
    })();
    bodies.set(key, job);
    job.catch(() => bodies.delete(key));
  }
  return job;
}

// ---- Drawing ----------------------------------------------------------------------------------------------------

const BREATH = [0, 0.35, 0.8, 0.35];
/** The extra's pop on a move's hit: lift, and width (negative turns it over). */
const POP = [
  [-2, 0.5],
  [-3, -1],
  [-3, -1],
  [-3, 0.5],
  [-2, 1],
  [-1, 1],
];
const AURA_AT: Record<"rise" | "fall" | "twinkle", (a: Spot) => Point[]> = {
  rise: (a) => [
    [a.l - 4, a.m + 12],
    [a.r - 1, a.m + 8],
    [a.r - 6, a.m + 18],
  ],
  fall: (a) => [
    [a.l - 3, a.t - 2],
    [a.r - 2, a.t + 2],
    [a.r + 1, a.m + 2],
  ],
  twinkle: (a) => [
    [a.l - 5, a.t + 2],
    [a.r - 1, a.m + 6],
    [a.l - 3, a.m + 15],
  ],
};
const RISE: Point[] = [
  [0, 0],
  [1, -2],
  [0, -4],
  [-1, -6],
  [0, -8],
  [1, -10],
  [0, -12],
  [-1, -14],
];
const FALL: Point[] = [
  [0, 0],
  [1, 2],
  [2, 4],
  [1, 6],
  [0, 8],
  [1, 10],
  [2, 12],
  [1, 14],
];
function auraStep(motion: "rise" | "fall" | "twinkle", p: number): { frame: number; d: Point } | null {
  const i = Math.floor(p / 3);
  if (motion === "rise") return { frame: [0, 0, 0, 1, 1, 1, 2, 2][i], d: RISE[i] };
  if (motion === "fall") return { frame: [0, 1, 2, 1, 0, 1, 2, 1][i], d: FALL[i] };
  return i < 3 ? { frame: i, d: [0, 0] } : null;
}

type SceneMark = { img: HTMLCanvasElement; wx: number; wy: number; flip: boolean; born: number; life: number };

/** One canvas over a sprite: its art and frames, its look, where its cell's top-left sits on the canvas (X, Y0) and
 *  which way it faces. `lit` lets moves dim and light the area around it (the stage; never a tile). A `plain` sprite
 *  has no look (a hatchling): its own colours, no glow, aura or extra, and `colour` only tints the effects. `marks`
 *  are the floor marks still fading out; `drawn` is the last step that left any. */
export type MoveScene = {
  ctx: CanvasRenderingContext2D;
  art: MoveArt;
  body: MoveBody;
  colour: SaucelingEvolveColour;
  extra: SaucelingEvolveExtra;
  stage: HatchedStage;
  dir: 1 | -1;
  X: number;
  Y0: number;
  lit: boolean;
  plain: boolean;
  marks: SceneMark[];
  drawn: string;
};

/** Draws step `k` of an act (or, with none, only the floor marks still fading). `g` counts 100 ms steps of the
 *  clock and drives the breathing, the aura and the extra's bob. True while floor marks are left. */
export function drawMoveStep(scene: MoveScene, act: MoveAct | null, k: number, g: number): boolean {
  const { ctx: x, art, body, colour, dir, X, Y0 } = scene;
  const { width: W, height: H } = x.canvas;
  const A = spotOf(scene.stage);
  const fr = colour === "storm" ? "spark" : colour;
  const glow = GLOW[colour];
  const f = new Step();
  let hitK = -99;
  let lightK = -99;
  if (act?.kind === "move") {
    const m = MOVES[act.move];
    const n = m.steps(act.encore);
    const mouth = body.mouths ?? [0, 1, 2].map((): Point => [A.r, A.m]);
    m.run(f, k, { ...A, mouth, E: act.encore, spot: act.spot, n, travel: act.travel });
    hitK = k - m.hit;
    lightK = k - (m.light ?? m.hit);
  } else if (act?.kind === "hatch") {
    hatch(f, k, A, act.how);
    hitK = lightK = k - (act.how === "thread" ? 10 : 17);
  } else if (act) {
    moment(f, k, A, X, Y0, act.reduced);
    hitK = k - 46;
    lightK = k - 44;
  }
  const evo = !scene.plain && (f.evo ?? true);
  const encore = act?.kind === "move" && act.encore;
  const toW = (lx: number, w: number) => (dir > 0 ? X + lx : X + CELL - lx - w);
  const sw = toW(f.dx, CELL);
  const sy0 = Y0 + f.dy;
  const piece = (name: string, frame: number, ramp: string | null, boost = 0) => {
    const fs = art.pieces[name];
    const img = fs[((frame % fs.length) + fs.length) % fs.length];
    return art.raw.has(name) || ramp === null ? img : tint(img, ramp, boost);
  };
  // A soft wash over the area around the sprite, so the canvas never shows an edge.
  const wash = (color: string, a: number, hold: number) => {
    const [r, g2, b] = rgb(color);
    const cx = sw + 26;
    const cy = Y0 + 30;
    const gr = x.createRadialGradient(cx, cy, 4, cx, cy, hold ? 200 : 95);
    gr.addColorStop(0, `rgba(${r},${g2},${b},${a})`);
    if (hold) gr.addColorStop(hold, `rgba(${r},${g2},${b},${a})`);
    gr.addColorStop(1, `rgba(${r},${g2},${b},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, W, H);
  };

  x.save();
  x.clearRect(0, 0, W, H);
  if (f.shake) x.translate(f.shake, 0);
  if (scene.lit && f.dim) wash("#000000", f.dim, 0.55);
  if (scene.lit && act && (evo || scene.plain) && at(lightK, 0, 6)) {
    const a = [1, 1, 0.75, 0.5, 0.3, 0.15][lightK] * (encore ? 1.4 : 1);
    if (colour === "shade") wash("#000000", 0.38 * a, 0);
    else wash(glow, 0.24 * a, 0);
  }
  const drawn = act ? `${act.at}|${k}` : scene.drawn;
  if (drawn !== scene.drawn) {
    scene.drawn = drawn;
    for (const mk of f.marks) {
      const img = piece(mk.name, mk.frame, mk.ramp === undefined ? fr : mk.ramp);
      const [lx, ly] = place(mk, img);
      scene.marks.push({ img, wx: toW(lx, img.width), wy: Y0 + ly, flip: dir < 0, born: g, life: mk.life });
    }
  }
  scene.marks = scene.marks.filter((m) => g - m.born < m.life);
  for (const m of scene.marks) {
    const left = m.life - (g - m.born);
    blit(x, m.img, m.wx, m.wy, m.flip, left <= 3 ? left / 4 : 1);
  }
  if (!act) {
    x.restore();
    return scene.marks.length > 0;
  }
  const drawFx = (it: Fx) => {
    const img = piece(it.name, it.frame, it.ramp === undefined ? fr : it.ramp);
    let [lx, ly] = place(it, img);
    if (it.follow) {
      lx += f.dx;
      ly += f.dy;
    }
    if (it.world) blit(x, img, lx, ly, false, it.alpha ?? 1);
    else blit(x, img, toW(lx, img.width), Y0 + ly, dir < 0, it.alpha ?? 1);
  };
  f.list.filter((i) => i.layer === "floor").forEach(drawFx);
  f.list.filter((i) => i.layer === "back").forEach(drawFx);

  const sx = f.col * CELL;
  const sy = f.view === "side" ? CELL : 0;
  const flip = dir < 0 !== f.flip;
  const sheet = body.img;
  const part: [number, number, number, number] = [sx, sy, CELL, CELL];
  if (f.thread !== null && Y0 + f.thread > 0) {
    x.fillStyle = NEUTRAL[3];
    x.globalAlpha = 0.8;
    x.fillRect(toW(A.cx + f.dx, 1), 0, 1, Y0 + f.thread);
    x.globalAlpha = 1;
  }
  for (const a of f.after) blit(x, sil(sheet, sx, sy, 0, glow), toW(a.dx, CELL), sy0, flip, a.alpha);
  if (!f.hide) {
    for (const r of f.rings) blit(x, sil(sheet, sx, sy, r.d, r.c), sw - r.d, sy0 - r.d, flip, f.alpha * r.a);
    const ringA = f.ringA ?? (evo ? BREATH[((g % 24) / 6) | 0] : 0);
    if (ringA) blit(x, sil(sheet, sx, sy, 2, glow), sw - 2, sy0 - 2, flip, f.alpha * ringA);
    if (evo) blit(x, sil(sheet, sx, sy, 1, glow), sw - 1, sy0 - 1, flip, f.alpha);
    const fresh = (f.body ?? (evo ? "new" : "old")) === "new";
    blit(x, fresh ? tint(sheet, colour, f.boost) : sheet, sw, sy0, flip, f.alpha, CELL, part);
    if (f.fadeNew) blit(x, tint(sheet, colour), sw, sy0, flip, f.fadeNew, CELL, part);
    if (f.white) {
      const white = f.crack ? cracked(sheet, sx, sy, f.crack, A, RAMPS[fr][2]) : sil(sheet, sx, sy, 0, "#ffffff");
      blit(x, white, sw, sy0, flip, f.alpha * f.white);
    }
  }
  f.list.filter((i) => !i.layer || i.layer === "front").forEach(drawFx);

  // The aura and the extra ride on the sprite but are not mirrored, like the sprite's own.
  const ox = dir > 0 ? X + f.dx : X - f.dx;
  if (evo && f.aura && !f.hide) {
    const name = SAUCELING_EVOLVE_PATHS[colour].aura;
    const motion = AURA_MOTION[name];
    const flare = at(hitK, 0, 12);
    for (const [po, mirror] of flare
      ? ([
          [0, false],
          [4, true],
        ] as const)
      : ([[0, false]] as const))
      AURA_AT[motion](A).forEach(([ax, ay], i) => {
        const st = auraStep(motion, (g + i * 8 + po) % 24);
        if (!st) return;
        const img = piece(name, st.frame, fr, flare ? 0.25 : 0);
        const bx = (mirror ? CELL - ax - 7 : ax) + st.d[0] + ((7 - img.width) >> 1);
        const by = ay + st.d[1] + ((7 - img.height) >> 1);
        blit(x, img, ox + bx, sy0 + by, false, f.alpha);
      });
  }
  if (evo && f.extra && !f.hide) {
    let ew = 12;
    let eflip = false;
    let edy = (g % 24 >= 12 ? -1 : 0) + f.extraDy;
    if (act.kind === "move" && at(hitK, 0, 6)) {
      const [d, s] = POP[hitK];
      edy += d;
      ew = Math.round(12 * Math.abs(s));
      eflip = s < 0;
    }
    const img = piece(`x-${scene.extra}`, g % 12 >= 6 ? 1 : 0, fr);
    blit(x, img, ox + 20 + ((12 - ew) >> 1), sy0 + A.t - 13 + edy, eflip, f.alpha, ew);
  }
  x.restore();
  return scene.marks.length > 0;
}
