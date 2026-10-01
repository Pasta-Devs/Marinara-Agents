/** G's thread: one message list for the first run, after an update, and from the version pill. */
import assert from "node:assert/strict";
import { slpGThread } from "../packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/slp-g-thread.ts";
import { SLURP2_RELEASES } from "../packages/slurp2/src/engine/packages/client/src/slp/features/onboarding/slp-release.ts";

const welcome = ["Hey.", "Alpha.", "Costs."];
// Newest first, as SLURP2_RELEASES is kept.
const releases = ["0.3.0", "0.2.0", "0.1.0"].map((version) => ({ version, date: "2026-10-01", notes: [version] }));
const ids = (mode: "welcome" | "update" | "pill", seen: string | null) =>
  slpGThread({ mode, seen, welcome, releases }).messages.map((message) => message.id);
const head = ["intro", "welcome-0", "welcome-1", "welcome-2", "discord"];

// First run: the welcome only, no release list, no divider, nothing to jump to.
assert.deepEqual(ids("welcome", null), head);
assert.equal(slpGThread({ mode: "welcome", seen: null, welcome, releases }).scrollTo, null);
const lines = slpGThread({ mode: "welcome", seen: null, welcome, releases }).messages;
assert.deepEqual(
  lines.flatMap((message) => (message.kind === "line" ? [message.text] : [])),
  welcome,
  "the welcome lines keep their order",
);

// After an update: the welcome stays as history, releases run oldest to newest, and "New" sits
// above the first unseen release; the thread opens on the divider.
assert.deepEqual(ids("update", "0.1.0"), [...head, "release-0.1.0", "new", "release-0.2.0", "release-0.3.0"]);
assert.equal(slpGThread({ mode: "update", seen: "0.1.0", welcome, releases }).scrollTo, "new");
assert.deepEqual(ids("update", "0.2.0"), [...head, "release-0.1.0", "release-0.2.0", "new", "release-0.3.0"]);
// A version this list does not know (or blocked storage) counts everything as unseen.
assert.deepEqual(ids("update", "9.9.9"), [...head, "new", "release-0.1.0", "release-0.2.0", "release-0.3.0"]);

// From the pill: the same thread, opened at the newest release; up to date means no divider.
assert.deepEqual(ids("pill", "0.3.0"), [...head, "release-0.1.0", "release-0.2.0", "release-0.3.0"]);
assert.equal(slpGThread({ mode: "pill", seen: "0.3.0", welcome, releases }).scrollTo, "release-0.3.0");
assert.deepEqual(ids("pill", "0.2.0"), [...head, "release-0.1.0", "release-0.2.0", "new", "release-0.3.0"]);
assert.equal(slpGThread({ mode: "pill", seen: "0.2.0", welcome, releases }).scrollTo, "release-0.3.0");

// The real history: every release appears once, in reverse of SLURP2_RELEASES.
const real = slpGThread({ mode: "pill", seen: null, welcome }).messages.filter((message) => message.kind === "release");
assert.deepEqual(
  real.map((message) => message.id),
  [...SLURP2_RELEASES].reverse().map((release) => `release-${release.version}`),
);

console.log("Slurp2 G's thread regressions passed.");
