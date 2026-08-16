// Regenerates artwork/agent-covers/pixelforge.png (512x512 catalog cover).
// Deterministic: draws a 64x64 pixel-art village vignette and upscales it x8
// with nearest-neighbor. Run manually: node packages/pixelforge/build/cover.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Raster } from "./png.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "../../../artwork/agent-covers/pixelforge.png");

const S = 64;
const SCALE = 8;
const art = new Raster(S, S);

const rng = (() => {
  let a = 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

// Grass base with mottling.
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const r = rng();
    art.px(x, y, r < 0.08 ? "#4b8a4f" : r < 0.16 ? "#356b3c" : "#3e7a44");
  }
}
// Dirt path: vertical spine and horizontal cross.
for (let y = 0; y < S; y++) for (let x = 28; x < 36; x++) art.px(x, y, rng() < 0.15 ? "#c7ab74" : "#b39764");
for (let x = 0; x < S; x++) for (let y = 40; y < 46; y++) art.px(x, y, rng() < 0.15 ? "#c7ab74" : "#b39764");

// House: plaster walls, timber beams, red roof.
const houseX = 6, houseY = 8, houseW = 18, houseH = 14;
art.rect(houseX, houseY + 6, houseW, houseH - 6, "#cfc3a8");
art.rect(houseX, houseY + 6, houseW, 1, "#b5a98e");
art.rect(houseX + 4, houseY + 6, 1, houseH - 6, "#6b4f38");
art.rect(houseX + 13, houseY + 6, 1, houseH - 6, "#6b4f38");
for (let row = 0; row < 6; row++) {
  art.rect(houseX - 1 + row, houseY + row, houseW + 2 - row * 2, 1, row % 2 ? "#8a3f36" : "#9e4a3f");
}
art.rect(houseX + 1, houseY + 5, houseW - 2, 1, "#b85e4d");
art.rect(houseX + 8, houseY + 9, 4, 5, "#5d4530"); // door
art.px(houseX + 11, houseY + 11, "#d9c07a"); // knob
art.rect(houseX + 2, houseY + 9, 3, 3, "#2e5f8a"); // window
art.rect(houseX + 14, houseY + 9, 3, 3, "#2e5f8a");

// Tree: trunk + leafy crown.
const treeX = 48, treeY = 12;
art.rect(treeX + 2, treeY + 8, 3, 5, "#5b4432");
for (let y = -1; y < 9; y++) {
  for (let x = -2; x < 9; x++) {
    const dx = x - 3, dy = y - 3.5;
    if (dx * dx + dy * dy / 1.3 < 17) {
      art.px(treeX + x, treeY + y, rng() < 0.2 ? "#5aa25e" : "#2c5a33");
    }
  }
}

// Well by the crossroads.
art.rect(44, 48, 8, 6, "#6f6f78");
art.rect(45, 49, 6, 4, "#254e73");
art.rect(43, 47, 10, 1, "#8d8d94");

// Player character on the path facing forward.
const px = 30, py = 47;
art.rect(px, py, 4, 2, "#22261f"); // hair
art.rect(px, py + 2, 4, 2, "#e0b48a"); // face
art.px(px + 1, py + 3, "#22261f"); // eyes
art.px(px + 2, py + 3, "#22261f");
art.rect(px - 1, py + 4, 6, 4, "#93404a"); // tunic
art.rect(px, py + 8, 1, 3, "#5d4530"); // legs
art.rect(px + 3, py + 8, 1, 3, "#5d4530");

// Frame: thick ink border.
art.rect(0, 0, S, 2, "#22261f");
art.rect(0, S - 2, S, 2, "#22261f");
art.rect(0, 0, 2, S, "#22261f");
art.rect(S - 2, 0, 2, S, "#22261f");

// Nearest-neighbor upscale to 512.
const cover = new Raster(S * SCALE, S * SCALE);
for (let y = 0; y < S * SCALE; y++) {
  for (let x = 0; x < S * SCALE; x++) {
    const i = (Math.floor(y / SCALE) * S + Math.floor(x / SCALE)) * 4;
    const j = (y * cover.w + x) * 4;
    cover.data[j] = art.data[i];
    cover.data[j + 1] = art.data[i + 1];
    cover.data[j + 2] = art.data[i + 2];
    cover.data[j + 3] = 255;
  }
}

writeFileSync(outPath, cover.toPng());
console.log(`wrote ${outPath} (${cover.w}x${cover.h})`);
