// Refresh tests/beholder-reference-surface.json from a local ST-Beholder checkout.
//
//   node scripts/sync-reference-surface.mjs /path/to/Beholder-ST
//
// Only rewrites the class list and re-derives 'rendered' from the package's JS.
// Existing not-ported reasons are preserved, because they are judgement calls that a
// regeneration has no business discarding.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

const root = dirname(import.meta.dirname);
const stRoot = process.argv[2];
if (!stRoot) {
  console.error("usage: node scripts/sync-reference-surface.mjs /path/to/Beholder-ST");
  process.exit(1);
}
const stJs = [...readdirSync(stRoot), ...readdirSync(join(stRoot, "engine")).map((f) => join("engine", f))]
  .filter((f) => f.endsWith(".js"))
  .map((f) => readFileSync(join(stRoot, f), "utf8"))
  .join("\n");
const classes = [
  ...new Set(
    [...stJs.matchAll(/class=["']([^"']*)["']/g)]
      .flatMap((m) => m[1].split(/\s+/))
      .flatMap((c) => [...c.matchAll(/\b(?:bh|beholder)-[a-z0-9-]+/g)].map((x) => x[0])),
  ),
].sort();

const srcDir = join(root, "packages/beholder/src");
const packageJs = readdirSync(srcDir)
  .filter((f) => f.endsWith(".js"))
  .sort()
  .map((f) => readFileSync(join(srcDir, f), "utf8"))
  .join("\n");

const path = join(root, "tests/beholder-reference-surface.json");
const existing = JSON.parse(readFileSync(path, "utf8"));
const next = {};
for (const name of classes) {
  const prior = existing.classes[name];
  if (prior?.status === "not-ported") next[name] = prior;
  else next[name] = packageJs.includes(name) ? { status: "rendered" } : { status: "missing" };
}
writeFileSync(path, JSON.stringify({ ...existing, classes: next }, null, 2) + "\n");
const counts = Object.values(next).reduce((acc, v) => ({ ...acc, [v.status]: (acc[v.status] ?? 0) + 1 }), {});
console.log("reference surface updated:", counts);
