/**
 * S — Slurp ships its own pictures: every `/api/capability-packages/slurp2/assets/…` the client
 * names is a file in the package and served by the manifest's `contributions.assets.paths` (else 404).
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PREFIX = "/api/capability-packages/slurp2/assets/";
const manifest = JSON.parse(readFileSync("packages/slurp2/manifest.json", "utf8"));
const served = new Set<string>(manifest.contributions?.assets?.paths ?? []);
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : /\.tsx?$/u.test(entry.name) ? [join(dir, entry.name)] : [],
  );
const used = new Set<string>();
for (const file of files("packages/slurp2/src/engine/packages/client/src/slp"))
  for (const match of readFileSync(file, "utf8").matchAll(/"\/api\/capability-packages\/slurp2\/assets\/([^"]+)"/gu))
    used.add(match[1]!);
assert.ok(used.size >= 2, `the demo post pictures are named (${used.size})`);
for (const path of used) {
  assert.ok(existsSync(join("packages/slurp2", path)), `${PREFIX}${path} is in the package`);
  assert.ok(served.has(path), `${path} is served (manifest contributions.assets.paths)`);
}
console.log("slurp2 bundled pictures: ok");
