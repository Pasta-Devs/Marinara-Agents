// Two panels, not one. The fan gets words; the Creator's operator gets the numbers. The split is
// enforced on the server, because a client-side split leaks the moment a new endpoint forgets it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp-messages.routes.ts", "utf8");
const storage = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
const view = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx", "utf8");
const locales = JSON.parse(
  readFileSync("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8"),
) as Record<string, string>;

// Every thread response funnels through one place, and that place defaults to the fan.
assert.match(routes, /const freshView = async \(threadId: string, side: "viewer" \| "creator" = "viewer"\)/u);
assert.match(routes, /side === "creator" \? view : \{ \.\.\.view, \.\.\.messages\.forViewer\(thread\) \}/u);

// The fan's copy carries no score, no mood, no notes and no strike count.
assert.match(storage, /forViewer\(thread: SlurpThread\): SlurpThread/u);
for (const stripped of ["mood: 0", "moodUpdatedAt: null", "strikes: 0", "lastStrikeAt: null", "notes: \\[\\]"]) {
  assert.match(storage, new RegExp(`forViewer[\\s\\S]{0,600}?${stripped}`, "u"), `forViewer must strip ${stripped}`);
}
assert.match(storage, /forViewer[\s\S]{0,700}?rapport: \{ \.\.\.thread\.rapport, score: 0, contributions: \[\] \}/u);

// The creator-side routes ask for the full view explicitly, so the default stays the safe one.
assert.equal((routes.match(/freshView\([^)]*"creator"\)/gu) ?? []).length, 3);

// The panel payload differs by side. A score must never reach the fan's half.
assert.match(routes, /side === "creator"[\s\S]{0,400}?contributions: thread\.rapport\.contributions/u);
const viewerBlock = routes.slice(routes.indexOf("spentCoins: await messages.spentWithCreator"));
assert.doesNotMatch(viewerBlock.slice(0, 300), /score:|mood:/u);

// The client renders both, and only shows the numbers on the creator side.
assert.match(view, /function SlurpRelationshipPanel\(/u);
assert.match(view, /relationship\.side === "viewer" \?/u);
assert.match(view, /aria-expanded=\{infoOpen\}/u);
// Opening a different conversation must not inherit the last one's open panel.
assert.match(view, /setInfoOpen\(false\);[\s\S]{0,120}setDebugOpen\(false\)/u);

for (const key of [
  "relationshipToggle",
  "relationshipTier",
  "relationshipSpent",
  "relationshipScore",
  "relationshipMood",
  "relationshipNotes",
  "relationshipCooling",
]) {
  assert.ok(locales[`ui.slurp.messages.${key}`], `missing panel copy for ${key}`);
}

console.log("slurp relationship panel regression passed");
