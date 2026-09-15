// Does the package actually render ST-Beholder's interface?
//
// Every other test here asserts that something written is present, which means it can
// only fail if that work is deleted. None of them can see a feature that was never
// built. Three times running, "do we have X?" was answered by grepping the package,
// finding a hit, and saying yes — and three times the hit was in style.css, which
// carries ST's entire stylesheet and therefore matches whether or not anything renders
// it. The backfill bar, the slot sheet and the note box were all "present" by that test
// and absent from the product.
//
// So this one is inverted. It starts from ST's surface, not from ours, and it looks
// only at what the package's JavaScript builds. A feature that has never been written
// fails here, which is the property every other test in this directory lacks.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classTokens, readSource } from "../scripts/beholder-class-tokens.mjs";

// fileURLToPath rather than URL.pathname, which keeps percent-encoding and mangles
// Windows drive letters — a repository path containing a space was enough to break it.
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(repoRoot, "packages/beholder/src");
const surface = JSON.parse(readFileSync(join(repoRoot, "tests/beholder-reference-surface.json"), "utf8")) as {
  classes: Record<string, { status: "rendered" | "missing" | "not-ported"; reason?: string }>;
};

// Only the JavaScript. Reading the stylesheet here would reintroduce the exact bug
// this file exists to catch. Tokenised through the same helper the generator uses, so
// the two can never disagree about what counts as rendered.
const rendered = classTokens(readSource(srcDir));

const entries = Object.entries(surface.classes);
const renderedEntries = entries.filter(([, v]) => v.status === "rendered");
const missing = entries.filter(([, v]) => v.status === "missing");
const notPorted = entries.filter(([, v]) => v.status === "not-ported");

// A class recorded as rendered must still be rendered — this is the regression half.
const regressed = renderedEntries.filter(([name]) => !rendered.has(name));
assert.deepEqual(
  regressed.map(([name]) => name),
  [],
  "these were rendered and no longer are — the manifest says the package builds them",
);

// A class recorded as missing must still be missing, or the manifest is stale. Being
// wrong in this direction is good news, but it should be recorded rather than drift.
const quietlyFixed = missing.filter(([name]) => rendered.has(name));
assert.deepEqual(
  quietlyFixed.map(([name]) => name),
  [],
  "these are now rendered — move them to status 'rendered' in beholder-reference-surface.json",
);

// An exclusion that is no longer true is worse than a missing one: it reads as a
// considered decision while hiding real coverage, and its reason goes on satisfying the
// length check because nobody rechecks a sentence that already passed.
const staleExclusions = notPorted.filter(([name]) => rendered.has(name));
assert.deepEqual(
  staleExclusions.map(([name]) => name),
  [],
  "these are marked not-ported but the package renders them — re-run scripts/sync-reference-surface.mjs",
);

// Every deliberate omission carries its reason, so "not ported" can never become a
// place to quietly park work.
for (const [name, value] of notPorted) {
  assert.ok(
    // Trimmed: twenty-one spaces satisfied a length check and said nothing.
    value.reason && value.reason.trim().length > 20,
    `${name} is marked not-ported without a real reason — say why, or mark it missing`,
  );
}

// The headline number, printed every run so it cannot be claimed without being seen.
const total = entries.length;
const done = renderedEntries.length;
const pct = Math.round((done / (total - notPorted.length)) * 100);
console.log(
  `beholder parity: ${done}/${total - notPorted.length} of portable surface rendered (${pct}%), ` +
    `${missing.length} missing, ${notPorted.length} deliberately not ported`,
);

// Not an assertion that we are finished — a statement of where we are. The number goes
// up as features land, and this line is the only honest place to read it from.
if (missing.length > 0) {
  console.log(`  still missing: ${missing.map(([n]) => n).join(", ")}`);
}
