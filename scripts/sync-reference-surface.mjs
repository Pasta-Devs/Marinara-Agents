// Refresh tests/beholder-reference-surface.json from a local ST-Beholder checkout.
//
//   node scripts/sync-reference-surface.mjs /path/to/Beholder-ST
//
// Only rewrites the class list and re-derives 'rendered' from the package's JS.
// Existing not-ported reasons are preserved, because they are judgement calls that a
// regeneration has no business discarding.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { classTokens, readSource } from "./beholder-class-tokens.mjs";

const root = dirname(import.meta.dirname);
const stRoot = process.argv[2];
if (!stRoot) {
  console.error("usage: node scripts/sync-reference-surface.mjs /path/to/Beholder-ST");
  process.exit(1);
}
// Recursive: reading the root and one named subdirectory skipped anything nested
// deeper, and a class that is never read is silently absent from the surface rather
// than reported as missing.
const classes = [...classTokens(readSource(stRoot))].sort();

const srcDir = join(root, "packages/beholder/src");
const rendered = classTokens(readSource(srcDir));

const path = join(root, "tests/beholder-reference-surface.json");
const existing = JSON.parse(readFileSync(path, "utf8"));
const next = {};
for (const name of classes) {
  const prior = existing.classes[name];
  // An exclusion only survives while it is still true. Once the package renders the
  // class, keeping the old status would hide real coverage behind a reason nobody
  // rechecked — and the reason, being long enough, would go on satisfying the test.
  if (prior?.status === "not-ported" && !rendered.has(name)) next[name] = prior;
  // Whole tokens, not substrings: `bh-pick` is inside `bh-pick-slot`, so asking whether
  // the source merely contains the name reported classes nobody renders as rendered.
  else next[name] = rendered.has(name) ? { status: "rendered" } : { status: "missing" };
}
writeFileSync(path, JSON.stringify({ ...existing, classes: next }, null, 2) + "\n");
const counts = Object.values(next).reduce((acc, v) => ({ ...acc, [v.status]: (acc[v.status] ?? 0) + 1 }), {});
console.log("reference surface updated:", counts);
