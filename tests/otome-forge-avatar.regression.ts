// ──────────────────────────────────────────────
// Regression: Otome Hearth's portrait circles (#2178). A full-body look, its head at the very top, is zoomed to the
// head and shoulders so the circle frames a face; a square or bust avatar (a card's, a persona's) is never zoomed, and
// the zoom is never clamped back to half the circle by the Engine's global `img { max-width: 100% }` reset.
// ──────────────────────────────────────────────
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  FULL_BODY_RATIO,
  isFullBody,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/avatar-frame.ts";

test("only an image much taller than wide is a full-body look", () => {
  assert.equal(isFullBody(832, 1216), true, "a painted look");
  assert.equal(isFullBody(200, 600), true, "a tall sprite");
  assert.equal(isFullBody(512, 512), false, "a square avatar");
  assert.equal(isFullBody(600, 800), false, "a bust (3:4)");
  assert.equal(isFullBody(1216, 832), false, "a wide image");
  assert.equal(isFullBody(0, 0), false, "an image not yet read");
  assert.equal(isFullBody(100, 100 * FULL_BODY_RATIO), true, "the threshold itself counts");
});

test("the face zoom is anchored at the top and never clamped by the host's img reset", () => {
  const css = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/theme/styles.ts",
    ),
    "utf8",
  );
  const rule = /\.of-avatar img\.of-avatar-face \{([^}]*)\}/u.exec(css)?.[1] ?? "";
  assert.ok(rule, "the face rule exists");
  assert.match(rule, /top: 0;/u);
  assert.match(rule, /width: 200%; height: 200%;/u);
  assert.match(rule, /max-width: none; max-height: none;/u, "the zoom is not clamped to half the circle");
  assert.match(css, /\.of-avatar img \{[^}]*object-position: 50% 0;/u, "every circle is anchored at the top");
});

test("every hand-drawn portrait circle frames its image through FaceImage, never a bare img", () => {
  const client = join(
    dirname(fileURLToPath(import.meta.url)),
    "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge",
  );
  // 0.21.0: the top bar's Home chip draws a house, no portrait (checked below).
  for (const file of ["screens/wardrobe/Wardrobe.tsx"]) {
    const source = readFileSync(join(client, file), "utf8");
    const circles = [...source.matchAll(/<span className="of-avatar[^"]*"[^>]*>\s*\{[^}]*\?\s*(<[A-Za-z]+)/gu)];
    assert.ok(circles.length > 0, `${file} draws a circle`);
    for (const [, tag] of circles) assert.equal(tag, "<FaceImage", `${file}: a circle's image is framed at the face`);
  }
  const topBar = readFileSync(join(client, "components/TopBar.tsx"), "utf8");
  assert.match(topBar, /<House size=/u, "the Home chip is a house");
  assert.doesNotMatch(topBar, /FaceImage|<img/u, "never a portrait");
});
