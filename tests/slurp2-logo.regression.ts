import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SLURP_LOGO_SRC } from "../packages/slurp2/src/engine/packages/client/src/components/slurp/slurp-logo";

// The header logo used to load through the package-asset route, which only answers while the Engine
// lists this exact package as ready. 0.0.1 even pointed it at Slurp Legacy's package. Inlined, it
// cannot break on install state.
const clientRoot = "packages/slurp2/src/engine/packages/client/src";
const sources = (readdirSync(clientRoot, { recursive: true }) as string[]).filter((file) => /\.tsx?$/u.test(file));
for (const file of sources) {
  const text = readFileSync(join(clientRoot, file), "utf8");
  assert.doesNotMatch(
    text,
    /capability-packages\/slurp2?\/assets\/slurp2?-logo\.png/u,
    `${file} must use SLURP_LOGO_SRC`,
  );
}

const png = readFileSync("packages/slurp2/slurp2-logo.png");
assert.equal(SLURP_LOGO_SRC, `data:image/png;base64,${png.toString("base64")}`, "the inlined logo must match the PNG");
assert.deepEqual(png, readFileSync("packages/slurp/slurp-logo.png"), "Slurp2 keeps Slurp Legacy's logo");

const shell = readFileSync(join(clientRoot, "components/slurp/SlurpShell.tsx"), "utf8");
assert.match(shell, /export const NOODLE_LOGO_SRC = SLURP_LOGO_SRC;/u);
console.log("slurp2 logo regression passed");
