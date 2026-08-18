// Tier-1 art generator: deterministic, dependency-free, build-time.
// Produces the shipped tile atlas + 4-direction × 4-frame walk-cycle sprite
// sheets as real PNGs under assets/, richer than the runtime Tier-0 painters
// (shading, edge highlights, full walk cycles). Runs from
// scripts/build-pixelforge-package.mjs. Pixel data is deterministic for a given
// Node.js build; the PNG container bytes depend on its zlib (see png.mjs).
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Raster } from "./png.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "assets");

const T = 16;
// Painters read PAL by reference; themed atlases swap it in place per emission
// (same mechanism as the runtime Tier-0 layer in src/10-art.js).
const BASE_PAL = {
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
const PAL = { ...BASE_PAL };

// Themed atlases: palette overrides + shape overrides where a recolour can't
// carry the meaning — the atlas-grade mirror of src/10-art.js's THEMES. The
// cozy atlas keeps its legacy filename (tiles.png); others emit
// tiles-<theme>.png with the SAME id→index map (one atlas.json serves all).
const THEME_ART = {
  "cozy-village": { file: "tiles.png", palette: {}, painters: {} },
  "sci-fi-colony": {
    file: "tiles-sci-fi-colony.png",
    palette: {
      grass1: "#5a4a44", grass2: "#4e403b", grass3: "#6a5850", grassHi: "#7d6a60",
      leaf: "#3e6d74", leafHi: "#7fd4d4", leafShadow: "#2a4d52", trunk: "#8e99a6", trunkHi: "#b3bdc9",
      path1: "#7d8894", path2: "#6b7580", pathFleck: "#9aa5b1", pathEdge: "#59626d",
      dirt: "#4a3f3a", crop: "#59c08a", cropRipe: "#b6e86a",
      water1: "#1f8a8a", water2: "#2aa3a0", waterHi: "#8ff0e8", waterDeep: "#166a6c",
      wall: "#8b95a3", wallDark: "#5d6672", plaster: "#aeb7c2", plasterShadow: "#97a0ac", beam: "#3f4854",
      roof1: "#4a6a8a", roof2: "#3d5871", roofHi: "#7fb0d4",
      floor1: "#59616c", floor2: "#4d545e", floorHi: "#6a727e", rug: "#2a6a8a", rugHi: "#4d8cab",
      stone: "#767e88", stoneDark: "#5a626c", stoneHi: "#939ba6",
      fence: "#5d6672", fenceHi: "#7d8894", door: "#3f4854", doorKnob: "#8ff0e8",
      well: "#4d545e", counter: "#3f4854",
    },
    painters: {
      // Hab panel: smooth plating, one vertical seam, corner rivets.
      wall(g) {
        g.rect(0, 0, T, T, PAL.plaster);
        g.rect(0, 11, T, 5, PAL.plasterShadow);
        g.rect(0, 0, T, 1, PAL.beam); g.rect(0, T - 1, T, 1, PAL.beam);
        g.rect(7, 1, 1, T - 2, PAL.wallDark);
        for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) { g.px(x, y, PAL.wallDark); g.px(x + 1, y, PAL.stoneHi); }
      },
      // Porthole with a bright upper arc.
      window(g) {
        THEME_ART["sci-fi-colony"].painters.wall(g);
        g.rect(4, 3, 8, 10, PAL.beam);
        g.rect(5, 4, 6, 8, PAL.water2);
        g.rect(5, 4, 6, 2, PAL.waterHi);
        g.px(5, 4, PAL.beam); g.px(10, 4, PAL.beam); g.px(5, 11, PAL.beam); g.px(10, 11, PAL.beam);
      },
      // Pressure door: split panels + light strip.
      door(g) {
        g.rect(0, 0, T, T, PAL.wallDark);
        g.rect(2, 1, 12, 15, PAL.door);
        g.rect(3, 2, 10, 13, PAL.beam);
        g.rect(4, 3, 8, 11, PAL.door);
        g.rect(7, 2, 2, 13, PAL.wallDark);
        g.rect(4, 7, 8, 2, PAL.doorKnob);
      },
      // Solar-cell roof: grid with a specular sweep.
      roof(g, rnd) {
        g.rect(0, 0, T, T, PAL.roof1);
        for (let r = 0; r < T; r += 4) g.rect(0, r, T, 1, PAL.roof2);
        for (let c = 0; c < T; c += 4) g.rect(c, 0, 1, T, PAL.roof2);
        g.rect(1, 1, 2, 2, PAL.roofHi); g.rect(9, 5, 2, 2, PAL.roofHi);
        dither(g, rnd, PAL.roofHi, 2);
      },
      roofEdge(g, rnd) {
        THEME_ART["sci-fi-colony"].painters.roof(g, rnd);
        g.rect(0, T - 3, T, 3, PAL.beam); g.rect(0, T - 3, T, 1, PAL.trunkHi);
      },
      // Comms mast on regolith.
      trunk(g) {
        g.rect(0, 0, T, T, PAL.grass1);
        g.rect(7, 2, 2, 14, PAL.trunk); g.rect(7, 2, 1, 14, PAL.trunkHi);
        g.rect(5, 4, 6, 1, PAL.trunk);
        g.rect(6, 12, 4, 2, PAL.wallDark);
      },
      // Antenna array / dome cap as the overhead layer.
      canopy(g, rnd) {
        g.rect(5, 0, 6, 2, PAL.leafHi);
        g.rect(7, 2, 2, 3, PAL.trunk);
        g.rect(3, 4, 10, 2, PAL.trunk);
        g.rect(3, 4, 10, 1, PAL.trunkHi);
        g.rect(2, 5, 2, 1, PAL.leafHi); g.rect(12, 5, 2, 1, PAL.leafHi);
        dither(g, rnd, PAL.leaf, 4);
      },
      // Hydroponics tray rows under grow light.
      crop(g, rnd) {
        g.rect(0, 0, T, T, PAL.floor2);
        g.rect(1, 2, T - 2, 5, PAL.beam); g.rect(1, 9, T - 2, 5, PAL.beam);
        g.rect(2, 3, T - 4, 3, PAL.dirt); g.rect(2, 10, T - 4, 3, PAL.dirt);
        for (let c = 3; c < T - 2; c += 3) { g.px(c, 4, PAL.crop); g.px(c + 1, 4 + ((rnd() * 2) | 0), PAL.cropRipe); g.px(c, 11, PAL.crop); }
        g.rect(1, 2, T - 2, 1, PAL.leafHi);
      },
      // Atmosphere recycler where the village well stood.
      well(g) {
        g.rect(0, 0, T, T, PAL.grass1);
        g.rect(3, 3, 10, 11, PAL.well); g.rect(3, 3, 10, 1, PAL.stoneHi);
        g.rect(4, 4, 8, 2, PAL.leafHi);
        for (const y of [7, 9, 11]) g.rect(4, y, 8, 1, PAL.wallDark);
      },
      // Guard rail instead of a wooden fence.
      fence(g) {
        g.rect(0, 0, T, T, PAL.grass1);
        g.rect(2, 4, 2, 10, PAL.fence); g.px(2, 4, PAL.fenceHi);
        g.rect(12, 4, 2, 10, PAL.fence); g.px(12, 4, PAL.fenceHi);
        g.rect(0, 6, T, 1, PAL.trunk); g.rect(0, 9, T, 1, PAL.trunk);
        g.px(0, 6, PAL.trunkHi);
      },
    },
  },
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
  // Appended, never inserted: the id order IS the atlas index map, so a new tile
  // goes on the end or every shipped index shifts under it.
  altar(g) {
    g.rect(0, 0, T, T, PAL.floor1);
    g.rect(0, 2, T, 11, PAL.stone); g.rect(0, 2, T, 1, PAL.stoneHi);
    g.rect(0, 3, T, 2, PAL.white); g.rect(0, 5, T, 1, PAL.plasterShadow);
    g.rect(0, 7, T, 1, PAL.doorKnob);
    g.rect(0, 13, T, 1, PAL.stoneDark);
  },
  bed(g, rnd) {
    PAINTERS.floor(g, rnd);
    g.rect(2, 1, 12, 14, PAL.beam);
    g.rect(3, 2, 10, 12, PAL.wall);
    g.rect(3, 2, 10, 4, PAL.white); g.rect(3, 5, 10, 1, PAL.plasterShadow);
    g.rect(3, 8, 10, 6, PAL.rug); g.rect(3, 8, 10, 1, PAL.rugHi);
    g.px(2, 1, PAL.trunkHi); g.px(13, 1, PAL.trunkHi);
  },
  shelf(g) {
    g.rect(0, 0, T, T, PAL.counter);
    g.rect(0, 0, T, 1, PAL.beam); g.rect(0, T - 1, T, 1, PAL.beam);
    for (const shelfY of [1, 9]) {
      for (let c = 2; c < 14; c += 4) {
        g.rect(c, shelfY + 1, 3, 4, PAL.path1);
        g.rect(c, shelfY + 1, 3, 1, PAL.doorKnob);
        g.px(c, shelfY + 4, PAL.pathEdge);
      }
      g.rect(1, shelfY + 5, 14, 1, PAL.beam);
    }
  },
  // One berth of a bunk: the compiler lays TWO of these one above the other and
  // stands a sleeper on each, so the frame runs edge to edge top and bottom and
  // a stacked pair reads as one two-berth unit. Ladder up the west rail.
  bunk(g, rnd) {
    PAINTERS.floor(g, rnd);
    g.rect(2, 0, 12, T, PAL.beam);
    g.rect(3, 0, 10, T, PAL.wall);
    g.rect(3, 1, 10, 4, PAL.white); g.rect(3, 4, 10, 1, PAL.plasterShadow);
    g.rect(3, 7, 10, 8, PAL.rug); g.rect(3, 7, 10, 1, PAL.rugHi);
    g.rect(2, 0, 1, T, PAL.trunk); g.rect(13, 0, 1, T, PAL.trunk);
    for (let rung = 1; rung < T; rung += 4) { g.rect(1, rung, 3, 1, PAL.trunkHi); g.px(3, rung, PAL.doorKnob); }
  },
  // A flight going UP, receding north so the tile says which way it goes without
  // an arrow. Non-solid where the compiler lays it: a stair is a portal.
  stairsUp(g, rnd) {
    PAINTERS.floor(g, rnd);
    for (let step = 0; step < 4; step++) {
      const inset = step;
      g.rect(1 + inset, T - 4 - step * 4, T - 2 - inset * 2, 4, PAL.beam);
      g.rect(1 + inset, T - 4 - step * 4, T - 2 - inset * 2, 1, PAL.plaster);
      g.rect(1 + inset, T - 3 - step * 4, T - 2 - inset * 2, 1, PAL.plasterShadow);
    }
  },
  // The way DOWN is a hole in the floor rather than the same steps mirrored: the
  // dark mouth is what tells the two apart standing over them.
  stairsDown(g, rnd) {
    PAINTERS.floor(g, rnd);
    g.rect(1, 2, T - 2, T - 3, PAL.ink);
    for (let step = 0; step < 3; step++) {
      const inset = step + 1;
      g.rect(1 + inset, 3 + step * 4, T - 2 - inset * 2, 3, PAL.beam);
      g.rect(1 + inset, 3 + step * 4, T - 2 - inset * 2, 1, PAL.wallDark);
    }
  },
  // The one thing in a belfry, with floor all the way round it. Solid — the bell
  // is what the climb is for. No themed override, for the altar's reason: the
  // colony palette makes the same silhouette a struck alarm plate.
  bell(g) {
    g.rect(0, 0, T, T, PAL.floor1);
    g.rect(2, 1, 12, 2, PAL.beam);
    g.rect(2, 1, 12, 1, PAL.trunkHi);
    g.rect(5, 3, 6, 2, PAL.stoneDark);
    g.rect(4, 5, 8, 6, PAL.doorKnob);
    g.rect(5, 6, 2, 4, PAL.white);
    g.rect(3, 11, 10, 2, PAL.doorKnob);
    g.rect(3, 11, 10, 1, PAL.white);
    g.rect(3, 12, 10, 1, PAL.pathEdge);
    g.rect(7, 13, 2, 2, PAL.stoneDark);
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

  // Atlases: 8 columns, one per theme, all sharing the SAME id→index map so a
  // single atlas.json serves every theme's sheet.
  const tileIds = Object.keys(PAINTERS);
  const cols = 8;
  const rows = Math.ceil(tileIds.length / cols);
  const tileMap = {};
  tileIds.forEach((id, index) => {
    tileMap[id] = index;
  });
  const atlasFiles = [];
  for (const [themeId, themeArt] of Object.entries(THEME_ART)) {
    for (const key of Object.keys(PAL)) delete PAL[key];
    Object.assign(PAL, BASE_PAL, themeArt.palette);
    const atlas = new Raster(cols * T, rows * T);
    tileIds.forEach((id, index) => {
      const tile = new Raster(T, T);
      (themeArt.painters[id] || PAINTERS[id])(tile, rng(hash(`tier1:${themeId}:${id}`)));
      atlas.blit(tile, (index % cols) * T, Math.floor(index / cols) * T);
    });
    writeFileSync(join(outDir, themeArt.file), atlas.toPng());
    atlasFiles.push(themeArt.file);
  }
  // Restore the base palette for the actor sheets below.
  for (const key of Object.keys(PAL)) delete PAL[key];
  Object.assign(PAL, BASE_PAL);
  writeFileSync(
    join(outDir, "atlas.json"),
    JSON.stringify({ tileSize: T, columns: cols, tiles: tileMap }, null, 2),
  );

  // Actors: player + the three villagers, hues matching the runtime tokens
  const actors = { player: 158, mira: 8, tam: 96, rook: 210, fen: 140 };
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
    files: [...atlasFiles, "atlas.json", "sprites.json", ...Object.keys(actors).map((n) => `sprites/${n}.png`)],
  };
}
