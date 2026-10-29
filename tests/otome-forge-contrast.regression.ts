// Otome Forge's two looks (C/theme/tokens.ts) against WCAG AA: every text token keeps 4.5:1 and the focus ring 3:1
// wherever it can sit on the stage. The stage is drawn as styles.ts draws it (FRAME_RULES): the look's `bg` (its linear
// gradient under three radial glows), the scene's two drifting glows, and its veil (the floor, then the vignette),
// sampled over a 41 × 41 grid of a 9:16 stage. Text sits on that bare, on one layer of glass (surface, surface-strong,
// surface-solid, input-bg) or on a hover fill over glass; the accent and the body text also sit on the rose tints of
// badges, chips and picked cards. Glass blur and saturation are left out, so the check reads each pixel as it is.
// Dark ink on the rose and champagne fills (on-accent) keeps 4.5:1 too.
import assert from "node:assert/strict";
import test from "node:test";
import {
  LOOK_TOKENS,
  PALETTE,
  type Look,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/theme/tokens.ts";

type Rgba = [number, number, number, number];

function parse(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/iu.exec(value);
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16);
    return [n >> 16, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/u.exec(value);
  assert.ok(rgb, `a colour token: ${value}`);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
}

const over = ([r, g, b, a]: Rgba, [ur, ug, ub]: Rgba): Rgba => [
  r * a + ur * (1 - a),
  g * a + ug * (1 - a),
  b * a + ub * (1 - a),
  1,
];
const channel = (value: number) => {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgba) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function contrast(a: Rgba, b: Rgba): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Every pixel of the bare stage on a grid, as styles.ts paints it for `look`. */
function stagePixels(look: Look): Rgba[] {
  const tokens = LOOK_TOKENS[look];
  const layers = tokens.bg!.split(/, (?=(?:radial|linear)-gradient)/u);
  const linear = layers.pop()!;
  const stops = linear
    .replace(/^linear-gradient\(180deg, |\)$/gu, "")
    .split(", ")
    .map((stop) => {
      const [colour, at] = stop.split(" ");
      return { colour: parse(colour!), at: Number.parseFloat(at!) / 100 };
    });
  const radials = layers.map((layer) => {
    const m =
      /^radial-gradient\(([\d.]+)% ([\d.]+)% at ([-\d.]+)% ([-\d.]+)%, (rgb\([^)]+\)), transparent ([\d.]+)%\)$/u.exec(
        layer,
      );
    assert.ok(m, `a radial glow of ${look}'s bg: ${layer}`);
    return {
      rx: Number(m[1]) / 100,
      ry: Number(m[2]) / 100,
      cx: Number(m[3]) / 100,
      cy: Number(m[4]) / 100,
      colour: parse(m[5]!),
      end: Number(m[6]) / 100,
    };
  });
  // The scene's glows (.of-scene-glow): squares 85% of the stage's width, a circle fading out at 68% of the way to its
  // corner, at 0.55 and 0.4 opacity; the second is champagne whatever the look.
  const aspect = 16 / 9;
  const glowReach = 0.425 * Math.SQRT2 * 0.68;
  const glows = [
    { cx: -0.3 + 0.425, cy: 0.06 + 0.425 / aspect, colour: parse(tokens.glow!), opacity: 0.55 },
    { cx: 1.34 - 0.425, cy: 0.48 + 0.425 / aspect, colour: parse("rgb(230 201 138 / 0.5)"), opacity: 0.4 },
  ];
  const floor = parse(tokens.floor!);
  const vignette = parse(tokens.vignette!);
  const pixels: Rgba[] = [];
  for (let i = 0; i <= 40; i += 1) {
    for (let j = 0; j <= 40; j += 1) {
      const [x, y] = [i / 40, j / 40];
      let k = 0;
      while (k < stops.length - 2 && y > stops[k + 1]!.at) k += 1;
      const [from, to] = [stops[k]!, stops[k + 1]!];
      const f = Math.min(1, Math.max(0, (y - from.at) / (to.at - from.at)));
      let pixel: Rgba = [0, 1, 2].map((n) => from.colour[n]! + (to.colour[n]! - from.colour[n]!) * f) as Rgba;
      pixel[3] = 1;
      // The first background layer is on top: paint the radials from the last one up.
      for (const glow of [...radials].reverse()) {
        const d = Math.hypot((x - glow.cx) / glow.rx, (y - glow.cy) / glow.ry);
        const [r, g, b, a] = glow.colour;
        pixel = over([r, g, b, a * Math.max(0, 1 - d / glow.end)], pixel);
      }
      for (const glow of glows) {
        const d = Math.hypot(x - glow.cx, (y - glow.cy) * aspect);
        const [r, g, b, a] = glow.colour;
        pixel = over([r, g, b, a * glow.opacity * Math.max(0, 1 - d / glowReach)], pixel);
      }
      pixel = over([floor[0], floor[1], floor[2], floor[3] * Math.max(0, 1 - (1 - y) / 0.26)], pixel);
      const v = Math.hypot((x - 0.5) / 1.3, (y - 0.42) / 0.85);
      pixel = over(
        [vignette[0], vignette[1], vignette[2], vignette[3] * Math.min(1, Math.max(0, (v - 0.58) / 0.42))],
        pixel,
      );
      pixels.push(pixel);
    }
  }
  return pixels;
}

/** A layer of glass (or a fill over glass) by its token names, bottom last: "surface-hover/surface". */
function underlay(look: Look, layer: string) {
  const tokens = LOOK_TOKENS[look];
  if (layer === "bare") return (pixel: Rgba) => pixel;
  return (pixel: Rgba) =>
    layer
      .split("/")
      .reverse()
      .reduce((under, name) => over(parse(tokens[name]!), under), pixel);
}

const GLASS = ["bare", "surface", "surface-strong", "surface-solid", "input-bg", "surface-hover/surface"];
const TINTS = ["tint/surface", "tint-strong/surface"];
const TEXT = [
  "text",
  "text-soft",
  "text-faint",
  "accent-text",
  "champagne-text",
  "rarity-silver-ink",
  "rarity-violet-ink",
  "rarity-gold-ink",
  "danger",
];
const PAIRS: Array<{ token: string; on: string[]; least: number }> = [
  ...TEXT.map((token) => ({ token, on: GLASS, least: 4.5 })),
  { token: "accent-text", on: TINTS, least: 4.5 },
  { token: "text", on: TINTS, least: 4.5 },
  // The focus ring is a non-text mark (WCAG 1.4.11): 3:1.
  { token: "focus", on: [...GLASS, ...TINTS], least: 3 },
];

for (const look of ["midnight", "pearl"] as const) {
  test(`Otome Forge ${look === "midnight" ? "Midnight" : "Pearl"}: text tokens keep 4.5:1 and the focus ring 3:1 wherever they sit`, () => {
    const pixels = stagePixels(look);
    const tokens = LOOK_TOKENS[look];
    const failures: string[] = [];
    for (const { token, on, least } of PAIRS) {
      const ink = parse(tokens[token]!);
      for (const layer of on) {
        const under = underlay(look, layer);
        const lowest = Math.min(...pixels.map((pixel) => under(pixel)).map((back) => contrast(over(ink, back), back)));
        if (lowest < least) failures.push(`${token} on ${layer}: ${lowest.toFixed(2)}:1 (needs ${least}:1)`);
      }
    }
    assert.deepEqual(failures, []);
  });
}

test("Otome Forge's dark ink keeps 4.5:1 on the rose and champagne fills, in both looks", () => {
  for (const look of ["midnight", "pearl"] as const) {
    const ink = parse(LOOK_TOKENS[look]["on-accent"]!);
    for (const fill of [PALETTE.rose, PALETTE.champagne]) {
      assert.ok(contrast(ink, parse(fill)) >= 4.5, `${look} on-accent on ${fill}`);
    }
  }
});

test("Otome Forge's stage model reads the looks as drawn: the night is brightest under its rose glow, Pearl darkest low", () => {
  // A guard on the model itself: if tokens.ts changes how `bg` is written, the parse above fails rather than passing
  // on an empty or flat stage.
  const night = stagePixels("midnight").map(luminance);
  const pearl = stagePixels("pearl").map(luminance);
  assert.equal(night.length, 41 * 41);
  assert.ok(Math.max(...night) > 0.06 && Math.min(...night) < 0.01, "Midnight spans its glow and its depth");
  assert.ok(Math.min(...pearl) < 0.75 && Math.max(...pearl) > 0.9, "Pearl spans its glows and its light");
});
