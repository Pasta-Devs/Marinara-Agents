// ──────────────────────────────────────────────
// Otome Hearth: the Tarot deck's own art (#2151): one gold line-art emblem per Major Arcana card
// ──────────────────────────────────────────────
// What a card shows when nothing is painted (no image connection, or until its picture is ready): small path builders
// composed into one stroke-only path per card, drawn in a 100×100 box (C/components/TarotCard.tsx places and colours
// it). Pure: no DOM, no randomness, so a card always looks the same.
import type { Arcana } from "../shared/tarot";

const n = (value: number) => Math.round(value * 10) / 10;
const pt = (x: number, y: number) => `${n(x)} ${n(y)}`;

/** A full circle as two arcs. */
export const circle = (cx: number, cy: number, r: number) =>
  `M${pt(cx - r, cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0`;

export const line = (x1: number, y1: number, x2: number, y2: number) => `M${pt(x1, y1)}L${pt(x2, y2)}`;

/** A star of `points` points (an inner radius of `inner` × r), its first point at `turn` degrees. */
export function star(cx: number, cy: number, r: number, points = 5, inner = 0.45, turn = -90): string {
  const corners = Array.from({ length: points * 2 }, (_, index) => {
    const angle = ((turn + (index * 180) / points) * Math.PI) / 180;
    const radius = index % 2 ? r * inner : r;
    return pt(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  });
  return `M${corners.join("L")}Z`;
}

/** A crescent bulging left (`facing` 1) or right (-1). */
export function crescent(cx: number, cy: number, r: number, facing: 1 | -1 = 1): string {
  const [outer, inner] = facing > 0 ? [0, 1] : [1, 0];
  return `M${pt(cx, cy - r)}A${n(r)} ${n(r)} 0 1 ${outer} ${pt(cx, cy + r)}A${n(r * 0.62)} ${n(r)} 0 1 ${inner} ${pt(cx, cy - r)}Z`;
}

/** `count` soft waves from x to x + w. */
export function wave(x: number, y: number, w: number, amp: number, count: number): string {
  const step = w / count;
  let d = `M${pt(x, y)}`;
  for (let index = 0; index < count; index += 1) {
    d += `q${n(step / 2)} ${n(index % 2 ? amp : -amp)} ${n(step)} 0`;
  }
  return d;
}

/** A disc with `rays` rays. */
export function sun(cx: number, cy: number, r: number, rays = 12): string {
  const spokes = Array.from({ length: rays }, (_, index) => {
    const angle = (index / rays) * Math.PI * 2;
    return line(
      cx + r * 1.3 * Math.cos(angle),
      cy + r * 1.3 * Math.sin(angle),
      cx + r * (index % 2 ? 1.6 : 1.85) * Math.cos(angle),
      cy + r * (index % 2 ? 1.6 : 1.85) * Math.sin(angle),
    );
  });
  return circle(cx, cy, r) + spokes.join("");
}

export const heart = (cx: number, cy: number, s: number) =>
  `M${pt(cx, cy + s * 0.9)}C${pt(cx - s * 1.25, cy + s * 0.05)} ${pt(cx - s * 0.6, cy - s * 0.85)} ${pt(cx, cy - s * 0.25)}C${pt(cx + s * 0.6, cy - s * 0.85)} ${pt(cx + s * 1.25, cy + s * 0.05)} ${pt(cx, cy + s * 0.9)}Z`;

/** A goblet: bowl, stem and foot. */
export const cup = (cx: number, cy: number, s: number) =>
  `M${pt(cx - s, cy - s)}Q${pt(cx - s, cy + s * 0.2)} ${pt(cx, cy + s * 0.25)}Q${pt(cx + s, cy + s * 0.2)} ${pt(cx + s, cy - s)}Z` +
  line(cx, cy + s * 0.25, cx, cy + s) +
  line(cx - s * 0.55, cy + s, cx + s * 0.55, cy + s);

/** A staff with a bud at its tip. */
export const wand = (x1: number, y1: number, x2: number, y2: number) => line(x1, y1, x2, y2) + circle(x2, y2, 2.4);

/** A sword point up, from `top`, `len` long. */
export const sword = (cx: number, top: number, len: number) =>
  `M${pt(cx, top)}L${pt(cx + 3, top + 6)}L${pt(cx + 3, top + len * 0.72)}L${pt(cx - 3, top + len * 0.72)}L${pt(cx - 3, top + 6)}Z` +
  line(cx - 10, top + len * 0.72, cx + 10, top + len * 0.72) +
  line(cx, top + len * 0.72, cx, top + len) +
  circle(cx, top + len + 2.5, 2.5);

/** Level scales: post, beam, two strings each side and two pans. */
export function scales(cx: number, cy: number, s: number): string {
  const pan = (x: number) =>
    line(x, cy - s * 0.7, x - s * 0.35, cy) +
    line(x, cy - s * 0.7, x + s * 0.35, cy) +
    `M${pt(x - s * 0.42, cy)}Q${pt(x, cy + s * 0.32)} ${pt(x + s * 0.42, cy)}Z`;
  return (
    line(cx, cy - s, cx, cy + s * 0.9) +
    line(cx - s, cy - s * 0.7, cx + s, cy - s * 0.7) +
    line(cx - s * 0.4, cy + s * 0.9, cx + s * 0.4, cy + s * 0.9) +
    pan(cx - s) +
    pan(cx + s)
  );
}

/** A crenellated tower standing on `base`, with a door and a window. */
export function tower(cx: number, base: number, w: number, h: number): string {
  const left = cx - w / 2;
  const top = base - h;
  const notch = w / 5;
  let crown = `M${pt(left, base)}L${pt(left, top)}`;
  for (let index = 0; index < 5; index += 1) {
    const x = left + index * notch;
    crown += index % 2 ? `L${pt(x, top + 4)}L${pt(x + notch, top + 4)}` : `L${pt(x + notch, top)}`;
    if (index < 4) crown += `L${pt(x + notch, index % 2 ? top : top + 4)}`;
  }
  crown += `L${pt(left + w, base)}`;
  return (
    crown +
    `M${pt(cx - 3, base)}L${pt(cx - 3, base - 8)}Q${pt(cx, base - 11)} ${pt(cx + 3, base - 8)}L${pt(cx + 3, base)}` +
    circle(cx, top + h * 0.35, 2.2)
  );
}

/** Two peaks on a base line from x to x + w. */
export const mountain = (x: number, base: number, w: number, h: number) =>
  `M${pt(x, base)}L${pt(x + w * 0.32, base - h)}L${pt(x + w * 0.5, base - h * 0.6)}L${pt(x + w * 0.7, base - h * 0.85)}L${pt(x + w, base)}`;

/** A lemniscate, `w` wide. */
export function infinity(cx: number, cy: number, w: number): string {
  const a = w / 2;
  const h = w / 4;
  return `M${pt(cx, cy)}C${pt(cx + a * 0.5, cy - h)} ${pt(cx + a, cy - h)} ${pt(cx + a, cy)}C${pt(cx + a, cy + h)} ${pt(cx + a * 0.5, cy + h)} ${pt(cx, cy)}C${pt(cx - a * 0.5, cy - h)} ${pt(cx - a, cy - h)} ${pt(cx - a, cy)}C${pt(cx - a, cy + h)} ${pt(cx - a * 0.5, cy + h)} ${pt(cx, cy)}Z`;
}

/** A wheel: rim, hub and spokes. */
export function wheel(cx: number, cy: number, r: number, spokes = 8): string {
  const lines = Array.from({ length: spokes }, (_, index) => {
    const angle = (index / spokes) * Math.PI * 2;
    return line(
      cx + r * 0.22 * Math.cos(angle),
      cy + r * 0.22 * Math.sin(angle),
      cx + r * Math.cos(angle),
      cy + r * Math.sin(angle),
    );
  });
  return circle(cx, cy, r) + circle(cx, cy, r * 0.72) + circle(cx, cy, r * 0.22) + lines.join("");
}

/** A lantern with a star inside. */
export const lantern = (cx: number, cy: number, s: number) =>
  `M${pt(cx - s * 0.6, cy - s)}L${pt(cx + s * 0.6, cy - s)}L${pt(cx + s * 0.75, cy + s)}L${pt(cx - s * 0.75, cy + s)}Z` +
  `M${pt(cx - s * 0.4, cy - s)}Q${pt(cx, cy - s * 1.9)} ${pt(cx + s * 0.4, cy - s)}` +
  star(cx, cy, s * 0.5, 6, 0.5);

/** A crown of points with a band, `w` wide, its band at cy. */
export const crown = (cx: number, cy: number, w: number) =>
  `M${pt(cx - w / 2, cy)}L${pt(cx - w / 2, cy - w * 0.4)}L${pt(cx - w / 4, cy - w * 0.18)}L${pt(cx, cy - w * 0.5)}L${pt(cx + w / 4, cy - w * 0.18)}L${pt(cx + w / 2, cy - w * 0.4)}L${pt(cx + w / 2, cy)}Z` +
  line(cx - w / 2, cy + 3, cx + w / 2, cy + 3);

/** A pillar from `top`, `h` tall, with a capital and a base. */
export const pillar = (x: number, top: number, h: number, w = 8) =>
  `M${pt(x - w / 2, top + 3)}L${pt(x - w / 2, top + h - 3)}M${pt(x + w / 2, top + 3)}L${pt(x + w / 2, top + h - 3)}` +
  line(x - w / 2 - 2, top, x + w / 2 + 2, top) +
  line(x - w / 2 - 2, top + 3, x + w / 2 + 2, top + 3) +
  line(x - w / 2 - 2, top + h - 3, x + w / 2 + 2, top + h - 3) +
  line(x - w / 2 - 2, top + h, x + w / 2 + 2, top + h);

/** A lightning bolt from (x, y), `s` tall. */
export const bolt = (x: number, y: number, s: number) =>
  `M${pt(x, y)}L${pt(x - s * 0.25, y + s * 0.45)}L${pt(x + s * 0.05, y + s * 0.42)}L${pt(x - s * 0.2, y + s)}`;

/** An oval wreath with leaves along it. */
export function wreath(cx: number, cy: number, rx: number, ry: number): string {
  const leaves = Array.from({ length: 14 }, (_, index) => {
    const angle = (index / 14) * Math.PI * 2;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    return line(x, y, x + 4 * Math.cos(angle + 0.9), y + 4 * Math.sin(angle + 0.9));
  });
  return (
    `M${pt(cx - rx, cy)}a${n(rx)} ${n(ry)} 0 1 0 ${n(2 * rx)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-2 * rx)} 0` +
    leaves.join("")
  );
}

/** A rose seen from above: petals round a heart. */
export const rose = (cx: number, cy: number, r: number) =>
  circle(cx, cy, r) +
  [0, 1, 2, 3, 4]
    .map((index) => {
      const angle = (index / 5) * Math.PI * 2 - Math.PI / 2;
      return circle(cx + r * 0.5 * Math.cos(angle), cy + r * 0.5 * Math.sin(angle), r * 0.42);
    })
    .join("") +
  circle(cx, cy, r * 0.22);

/** A long horn, its bell at (x + len, y). */
export const trumpet = (x: number, y: number, len: number) =>
  line(x, y - 1, x + len * 0.8, y - 2) +
  line(x, y + 1, x + len * 0.8, y + 2) +
  `M${pt(x + len * 0.8, y - 2)}L${pt(x + len, y - 7)}L${pt(x + len, y + 7)}L${pt(x + len * 0.8, y + 2)}`;

/** Two links of a chain. */
export const chain = (cx: number, cy: number, s: number) =>
  `M${pt(cx - s, cy)}a${n(s * 0.6)} ${n(s * 0.35)} 0 1 0 ${n(s * 1.2)} 0a${n(s * 0.6)} ${n(s * 0.35)} 0 1 0 ${n(-s * 1.2)} 0` +
  `M${pt(cx - s * 0.1, cy)}a${n(s * 0.6)} ${n(s * 0.35)} 0 1 0 ${n(s * 1.2)} 0a${n(s * 0.6)} ${n(s * 0.35)} 0 1 0 ${n(-s * 1.2)} 0`;

/** Each card's emblem: one stroke-only path in a 100×100 box. */
export const TAROT_EMBLEMS: Record<Arcana, string> = {
  fool: sun(74, 22, 7) + mountain(8, 82, 54, 34) + wave(50, 60, 40, 4, 3) + rose(28, 30, 6),
  magician: infinity(50, 14, 30) + wand(50, 90, 50, 28) + cup(24, 72, 7) + star(76, 72, 8, 5),
  "high-priestess": pillar(20, 18, 68) + pillar(80, 18, 68) + crescent(50, 52, 16) + line(34, 88, 66, 88),
  empress: crown(50, 30, 34) + heart(50, 60, 15) + line(16, 92, 16, 64) + line(84, 92, 84, 64) + star(50, 8, 4, 5),
  emperor: crown(50, 24, 30) + `M30 40L70 40L70 86L30 86Z` + circle(50, 62, 9) + line(50, 53, 50, 47),
  hierophant: pillar(16, 14, 74) + pillar(84, 14, 74) + crown(50, 26, 22) + line(36, 58, 64, 84) + line(64, 58, 36, 84),
  lovers: heart(36, 60, 13) + heart(64, 60, 13) + sun(50, 20, 7, 10),
  chariot:
    star(30, 14, 5) +
    star(50, 10, 5) +
    star(70, 14, 5) +
    `M26 32L74 32L74 64L26 64Z` +
    wheel(32, 76, 10, 6) +
    wheel(68, 76, 10, 6),
  strength: infinity(50, 14, 30) + sun(50, 56, 12, 16) + heart(50, 56, 6),
  hermit: lantern(56, 36, 14) + line(30, 18, 30, 94) + mountain(4, 96, 92, 22),
  wheel: wheel(50, 50, 38, 8) + star(50, 50, 6, 4, 0.4),
  justice: scales(50, 44, 26) + sword(50, 70, 22),
  "hanged-man":
    line(14, 14, 86, 14) +
    line(28, 14, 28, 6) +
    line(72, 14, 72, 6) +
    line(50, 14, 50, 40) +
    circle(50, 64, 14) +
    sun(50, 64, 6, 8),
  death: rose(50, 34, 16) + tower(18, 92, 14, 30) + tower(82, 92, 14, 30) + sun(50, 88, 7, 8),
  temperance: cup(28, 34, 10) + cup(72, 64, 10) + wave(30, 50, 40, 6, 2) + triangleOf(50, 90, 10),
  devil: star(50, 26, 18, 5, 0.42, 90) + chain(36, 74, 10) + chain(64, 74, 10),
  tower: tower(50, 94, 30, 70) + bolt(84, 6, 34) + crown(50, 18, 18),
  star:
    star(50, 34, 18, 8, 0.38) +
    star(18, 14, 4, 8, 0.4) +
    star(82, 14, 4, 8, 0.4) +
    star(16, 52, 4, 8, 0.4) +
    star(84, 52, 4, 8, 0.4) +
    wave(14, 84, 72, 4, 4),
  moon: crescent(50, 30, 18) + tower(14, 90, 14, 30) + tower(86, 90, 14, 30) + wave(30, 80, 40, 5, 3),
  sun: sun(50, 40, 18, 16) + line(10, 88, 90, 88) + line(10, 80, 90, 80) + heart(50, 40, 6),
  judgement: trumpet(14, 22, 52) + sun(80, 20, 6, 8) + mountain(6, 92, 88, 30) + line(50, 52, 50, 70),
  world:
    wreath(50, 50, 24, 36) +
    star(10, 10, 4) +
    star(90, 10, 4) +
    star(10, 90, 4) +
    star(90, 90, 4) +
    infinity(50, 50, 18),
};

/** A small triangle pointing up, centred on (cx, cy): the sign of fire Temperance stands on. */
function triangleOf(cx: number, cy: number, s: number): string {
  return `M${pt(cx, cy - s)}L${pt(cx + s, cy + s * 0.7)}L${pt(cx - s, cy + s * 0.7)}Z`;
}

/** A card's number as the deck prints it: 0 for the Fool, Roman numerals after. */
export function arcanaNumeral(index: number): string {
  if (index <= 0) return "0";
  const marks: Array<[number, string]> = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = index;
  let numeral = "";
  for (const [value, mark] of marks) {
    while (rest >= value) {
      numeral += mark;
      rest -= value;
    }
  }
  return numeral;
}
