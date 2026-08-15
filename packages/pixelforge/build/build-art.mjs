// Tier-1 art generator: deterministic, dependency-free, build-time.
// Produces the shipped tile atlas + 4-direction × 4-frame walk-cycle sprite
// sheets as real PNGs under assets/, richer than the runtime Tier-0 painters
// (shading, edge highlights, full walk cycles). Runs from build.mjs.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Raster } from "./png.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "assets");

const T = 16;
const PAL = {
  grass1: "#3e7a44", grass2: "#356b3c", grass3: "#4b8a4f", grassHi: "#5fae64",
  leaf: "#2c5a33", leafHi: "#5aa25e", leafShadow: "#1f4126", trunk: "#5b4432", trunkHi: "#75593f",
  path1: "#b39764", path2: "#a3875a", pathFleck: "#c7ab74", pathEdge: "#8a7350",
  dirt: "#7a5f43", crop: "#7fae52", cropRipe: "#d9a03c",
  water1: "#2e5f8a", water2: "#39719e", waterHi: "#6fa3c8", waterDeep: "#254e73",
  wall: "#8a7561", wallDark: "#6e5c4b", plaster: "#cfc3a8", plasterShadow: "#b5a98e", beam: "#6b4f38",
  roof1: "#9e4a3f", roof2: "#8a3f36", roofHi: "#b85e4d",
  floor1: "#8a6a4a", floor2: "#7d5f41", floorHi: "#9c7a55", rug: "#93404a", rugHi: "#b85e4d",
  stone: "#8d8d94", stoneDark: "#73737a", stoneHi: "#a5a5ac",
  fence: "#7d6142", fenceHi: "#97794f", door: "#5d4530", doorKnob: "#d9c07a",
  well: "#6f6f78", counter: "#725539",
  ink: "#22261f", white: "#f3efe2",
};

const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const hash = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};

const dither = (g, rnd, hex, n) => { for (let i = 0; i < n; i++) g.px((rnd() * T) | 0, (rnd() * T) | 0, hex); };

// ── Tile painters (id order defines atlas layout) ────────────────────────────
const PAINTERS = {
  grass(g, rnd) {
    g.rect(0, 0, T, T, PAL.grass1);
    dither(g, rnd, PAL.grass2, 16); dither(g, rnd, PAL.grass3, 10); dither(g, rnd, PAL.grassHi, 4);
    for (let i = 0; i < 3; i++) { const x = (rnd() * 14) | 0, y = 2 + ((rnd() * 12) | 0); g.px(x, y, PAL.grass3); g.px(x, y - 1, PAL.grassHi); }
  },
  grass2(g, rnd) {
    g.rect(0, 0, T, T, PAL.grass2);
    dither(g, rnd, PAL.grass1, 14); dither(g, rnd, PAL.leaf, 6); dither(g, rnd, PAL.grass3, 4);
  },
  path(g, rnd) {
    g.rect(0, 0, T, T, PAL.path1);
    dither(g, rnd, PAL.path2, 14); dither(g, rnd, PAL.pathFleck, 8);
    g.rect(0, 0, T, 1, PAL.pathEdge); g.rect(0, T - 1, T, 1, PAL.pathEdge);
    for (let i = 0; i < 3; i++) { const x = 1 + ((rnd() * 13) | 0), y = 2 + ((rnd() * 11) | 0); g.rect(x, y, 2, 1, PAL.pathEdge); }
  },
  dirt(g, rnd) { g.rect(0, 0, T, T, PAL.dirt); dither(g, rnd, PAL.path2, 10); dither(g, rnd, PAL.pathEdge, 5); },
  crop(g, rnd) {
    g.rect(0, 0, T, T, PAL.dirt);
    for (let r = 2; r < T; r += 5) g.rect(1, r, T - 2, 1, PAL.path2);
    for (let c = 2; c < T; c += 4) { g.px(c, 3 + ((rnd() * 2) | 0), PAL.crop); g.px(c, 8, PAL.crop); g.px(c + 1, 8 + ((rnd() * 2) | 0), PAL.cropRipe); g.px(c, 13, PAL.crop); }
  },
  water(g, rnd) {
    g.rect(0, 0, T, T, PAL.water1);
    dither(g, rnd, PAL.water2, 14); dither(g, rnd, PAL.waterDeep, 6);
    g.rect((rnd() * 9) | 0, 3, 5, 1, PAL.waterHi); g.rect((rnd() * 9) | 0, 11, 4, 1, PAL.waterHi);
  },
  stone(g, rnd) {
    g.rect(0, 0, T, T, PAL.stone);
    dither(g, rnd, PAL.stoneDark, 10); dither(g, rnd, PAL.stoneHi, 5);
    g.rect(0, T - 1, T, 1, PAL.stoneDark); g.rect(0, 0, T, 1, PAL.stoneHi);
  },
  wall(g) {
    g.rect(0, 0, T, T, PAL.plaster);
    g.rect(0, 12, T, 4, PAL.plasterShadow);
    g.rect(0, 0, T, 2, PAL.beam); g.rect(0, T - 2, T, 2, PAL.beam); g.rect(7, 2, 2, T - 4, PAL.beam);
  },
  wallStone(g, rnd) {
    g.rect(0, 0, T, T, PAL.wallDark);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 2; c++) {
        const x = c * 8 + (r % 2) * 4;
        g.rect(x, r * 4, 7, 3, rnd() > 0.5 ? PAL.wall : PAL.wallDark);
        g.px(x, r * 4, PAL.stoneHi);
      }
  },
  window(g) {
    PAINTERS.wall(g);
    g.rect(3, 4, 10, 8, PAL.beam);
    g.rect(4, 5, 8, 6, PAL.water2);
    g.rect(4, 5, 8, 2, PAL.waterHi);
    g.rect(7, 5, 1, 6, PAL.beam); g.rect(4, 7, 8, 1, PAL.beam);
  },
  door(g) {
    g.rect(0, 0, T, T, PAL.wallDark);
    g.rect(2, 1, 12, 15, PAL.door);
    g.rect(3, 2, 10, 13, PAL.beam);
    g.rect(4, 3, 8, 11, PAL.door);
    g.rect(11, 8, 2, 2, PAL.doorKnob);
  },
  roof(g, rnd) {
    g.rect(0, 0, T, T, PAL.roof1);
    for (let r = 0; r < T; r += 4) { g.rect(0, r, T, 1, PAL.roof2); g.rect(((r / 4) % 2) * 8, r + 2, 3, 1, PAL.roofHi); }
    dither(g, rnd, PAL.roofHi, 3);
  },
  roofEdge(g, rnd) { PAINTERS.roof(g, rnd); g.rect(0, T - 3, T, 3, PAL.beam); g.rect(0, T - 3, T, 1, PAL.trunkHi); },
  floor(g, rnd) {
    g.rect(0, 0, T, T, PAL.floor1);
    for (let r = 0; r < T; r += 4) { g.rect(0, r, T, 1, PAL.floor2); g.rect(0, r + 1, T, 1, PAL.floorHi); }
    dither(g, rnd, PAL.floor2, 4);
  },
  rug(g, rnd) {
    PAINTERS.floor(g, rnd);
    g.rect(1, 1, T - 2, T - 2, PAL.rug);
    g.rect(2, 2, T - 4, T - 4, PAL.rugHi);
    g.rect(3, 3, T - 6, T - 6, PAL.rug);
    g.px(1, 1, PAL.rugHi); g.px(T - 2, T - 2, PAL.rugHi);
  },
  counter(g) {
    g.rect(0, 0, T, T, PAL.counter);
    g.rect(0, 0, T, 3, PAL.path1); g.rect(0, 0, T, 1, PAL.pathFleck); g.rect(0, 3, T, 1, PAL.beam);
  },
  fence(g) {
    g.rect(0, 0, T, T, PAL.grass1);
    g.rect(2, 4, 2, 10, PAL.fence); g.px(2, 4, PAL.fenceHi);
    g.rect(12, 4, 2, 10, PAL.fence); g.px(12, 4, PAL.fenceHi);
    g.rect(0, 6, T, 2, PAL.fence); g.rect(0, 6, T, 1, PAL.fenceHi);
  },
  well(g) {
    g.rect(0, 0, T, T, PAL.grass1);
    g.rect(2, 4, 12, 10, PAL.well); g.rect(2, 4, 12, 1, PAL.stoneHi);
    g.rect(4, 6, 8, 6, PAL.ink);
    g.rect(2, 2, 12, 2, PAL.beam); g.px(7, 1, PAL.beam); g.px(8, 1, PAL.beam);
  },
  trunk(g) {
    g.rect(0, 0, T, T, PAL.grass1);
    g.rect(6, 2, 4, 14, PAL.trunk); g.rect(6, 2, 1, 14, PAL.trunkHi);
    g.rect(5, 12, 6, 2, PAL.leaf);
  },
  canopy(g, rnd) {
    g.rect(2, 2, 12, 12, PAL.leaf);
    g.rect(1, 4, 14, 8, PAL.leaf);
    g.rect(4, 1, 8, 14, PAL.leaf);
    dither(g, rnd, PAL.leafHi, 12); dither(g, rnd, PAL.leafShadow, 6);
    g.px(3, 3, PAL.leafHi); g.px(11, 4, PAL.leafHi);
  },
  table(g) {
    g.rect(0, 0, T, T, PAL.floor1);
    g.rect(2, 3, 12, 9, PAL.counter); g.rect(2, 3, 12, 1, PAL.path1);
    g.rect(3, 4, 10, 7, PAL.path1);
    g.rect(3, 12, 2, 3, PAL.beam); g.rect(11, 12, 2, 3, PAL.beam);
  },
};

// ── Actors: 4 rows (down, up, left, right) × 4 walk frames, 12×16 ────────────
const hsl = (h, s, l) => {
  const S = s / 100;
  const L = l / 100;
  const C = (1 - Math.abs(2 * L - 1)) * S;
  const X = C * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - C / 2;
  const [r, g, b] =
    h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
  const to = (v) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
};

function drawActorFrame(g, ox, oy, facing, frame, hue) {
  const shirt = hsl(hue, 45, 45);
  const shirtDark = hsl(hue, 45, 32);
  const shirtHi = hsl(hue, 45, 58);
  const pants = "#3b3b4a";
  const pantsHi = "#4c4c5e";
  const skin = "#e8b98a";
  const skinShadow = "#cf9f70";
  const hair = hsl((hue + 140) % 360, 30, 25);
  const hairHi = hsl((hue + 140) % 360, 30, 35);
  // walk cycle: 0 stand, 1 left leg forward, 2 stand, 3 right leg forward
  const stride = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const bob = frame % 2 === 1 ? 1 : 0;
  const y = oy + bob;
  // legs
  g.rect(ox + 3, y + 12 - bob, 2, 4 - Math.max(0, stride) + bob, pants);
  g.rect(ox + 7, y + 12 - bob, 2, 4 + Math.min(0, stride) + bob, pants);
  if (stride === 1) g.px(ox + 3, oy + 15, pantsHi);
  if (stride === -1) g.px(ox + 7, oy + 15, pantsHi);
  // torso
  g.rect(ox + 2, y + 6, 8, 6, shirt);
  g.rect(ox + 2, y + 6, 8, 1, shirtHi);
  g.rect(ox + 2, y + 10, 8, 2, shirtDark);
  // arms swing opposite to legs
  g.rect(ox + 1, y + 7 - stride, 1, 4, shirt);
  g.rect(ox + 10, y + 7 + stride, 1, 4, shirt);
  g.px(ox + 1, y + 10 - stride, skin);
  g.px(ox + 10, y + 10 + stride, skin);
  // head
  g.rect(ox + 3, y + 1, 6, 5, skin);
  g.rect(ox + 3, y + 5, 6, 1, skinShadow);
  g.rect(ox + 2, y + 0, 8, 2, hair);
  g.px(ox + 2, y + 0, hairHi);
  if (facing === 0) { g.px(ox + 4, y + 3, PAL.ink); g.px(ox + 7, y + 3, PAL.ink); }
  else if (facing === 1) { g.rect(ox + 2, y + 1, 8, 3, hair); g.px(ox + 3, y + 1, hairHi); }
  else if (facing === 2) { g.px(ox + 3, y + 3, PAL.ink); g.rect(ox + 8, y + 1, 2, 3, hair); }
  else { g.px(ox + 8, y + 3, PAL.ink); g.rect(ox + 2, y + 1, 2, 3, hair); }
}

export function buildArt() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "sprites"), { recursive: true });

  // Atlas: 8 columns
  const tileIds = Object.keys(PAINTERS);
  const cols = 8;
  const rows = Math.ceil(tileIds.length / cols);
  const atlas = new Raster(cols * T, rows * T);
  const tileMap = {};
  tileIds.forEach((id, index) => {
    const tile = new Raster(T, T);
    PAINTERS[id](tile, rng(hash(`tier1:${id}`)));
    atlas.blit(tile, (index % cols) * T, Math.floor(index / cols) * T);
    tileMap[id] = index;
  });
  writeFileSync(join(outDir, "tiles.png"), atlas.toPng());
  writeFileSync(
    join(outDir, "atlas.json"),
    JSON.stringify({ tileSize: T, columns: cols, tiles: tileMap }, null, 2),
  );

  // Actors: player + the three villagers, hues matching the runtime tokens
  const actors = { player: 158, mira: 8, tam: 96, rook: 210 };
  for (const [name, hue] of Object.entries(actors)) {
    const sheet = new Raster(4 * 12, 4 * 16);
    for (let facing = 0; facing < 4; facing++)
      for (let frame = 0; frame < 4; frame++) drawActorFrame(sheet, frame * 12, facing * 16, facing, frame, hue);
    writeFileSync(join(outDir, "sprites", `${name}.png`), sheet.toPng());
  }
  writeFileSync(
    join(outDir, "sprites.json"),
    JSON.stringify(
      {
        frameWidth: 12,
        frameHeight: 16,
        frames: 4,
        // row order matches the runtime facing indices: 0 down, 1 up, 2 left, 3 right
        rows: ["down", "up", "left", "right"],
        actors: Object.fromEntries(Object.keys(actors).map((n) => [n, `sprites/${n}.png`])),
      },
      null,
      2,
    ),
  );

  // Paths are relative to the generated assets dir; the packager places them at
  // the PACKAGE ROOT (manifest path "tiles.png" → served as /assets/tiles.png —
  // the route's wildcard already namespaces under /assets/).
  return {
    dir: outDir,
    files: ["tiles.png", "atlas.json", "sprites.json", ...Object.keys(actors).map((n) => `sprites/${n}.png`)],
  };
}
