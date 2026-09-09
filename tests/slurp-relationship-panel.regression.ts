// The relationship panel shows the complete simulation state to both sides of the conversation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp-messages.routes.ts", "utf8");
const storage = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  "utf8",
);
const view = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx", "utf8");
const hook = readFileSync("packages/slurp/src/engine/packages/client/src/hooks/use-slurp.ts", "utf8");
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

// Both sides receive the complete relationship state now.
assert.match(routes, /relationship: \{[\s\S]{0,500}?contributions: thread\.rapport\.contributions/u);
assert.match(routes, /side,\s*tier: thread\.rapport\.tier,[\s\S]{0,500}?mood: thread\.mood/u);
assert.match(routes, /spentCoins: await messages\.spentWithCreator/u);
assert.match(routes, /score: thread\.rapport\.score/u);
assert.match(routes, /creatorState: await slurp\.getCreatorState\(thread\.creatorAccountId\)/u);
assert.match(routes, /threadState: thread\.threadState/u);

// The client renders one complete panel for both sides.
assert.match(view, /function SlurpRelationshipPanel\(/u);
assert.doesNotMatch(view, /relationship\.side === "viewer" \?/u);
assert.match(view, /moodLabel/u);
for (const section of ["Current situation", "Creator now", "Boundaries", "Memories", "Context", "Business"]) {
  assert.match(view, new RegExp(`title=\"${section}\"`, "u"));
}
for (const field of [
  "creatorState.arousal",
  "creatorState.emotion",
  "creatorState.energy",
  "creatorState.intent",
  "creatorState.strategy",
  "threadState.sexualComfort",
  "threadState.adultLevel",
]) {
  assert.match(view, new RegExp(field.replace(".", "\\."), "u"));
}
assert.match(view, /max-h-\[min\(78vh,44rem\)\]/u);
assert.match(view, /State updated/u);
assert.match(view, /relationship\.dayVibe/u);
assert.match(view, /relationship\.imageMode/u);
assert.match(view, /InfoChip/u);
assert.match(view, /aria-expanded=\{infoOpen\}/u);
assert.match(view, /Working memory/u);
assert.match(view, /Long-term memory/u);
// Opening a different conversation must not inherit the last one's open panel.
assert.match(view, /setInfoOpen\(false\);[\s\S]{0,120}setDebugOpen\(false\)/u);
assert.match(view, /Conversation overview/u);
assert.match(view, /aria-pressed=\{advanced\}/u);
assert.match(view, /if \(distanceFromBottom <= 96\)/u);
assert.doesNotMatch(view, /State updated .*aria-live/u);
assert.doesNotMatch(view, /creatorStatus &&/u);
assert.match(hook, /refetchInterval: threadId && personaId \? 60_000 : false/u);
assert.match(hook, /refetchInterval: creatorAccountId && personaId \? 60_000 : false/u);

// The mobile conversation must contain its header and commission controls instead of widening the viewport.
assert.match(view, /min-w-0 min-w-0|max-w-full flex-1 items-center gap-2 overflow-hidden/u);
assert.match(view, /overflow-x-hidden overflow-y-auto/u);
assert.match(view, /min-w-0 max-w-full overflow-hidden rounded-xl/u);
assert.match(view, /grid min-w-0 grid-cols-4/u);

for (const key of [
  "relationshipToggle",
  "relationshipTier",
  "relationshipSpent",
  "relationshipScore",
  "relationshipMood",
  "relationshipNotes",
  "relationshipWorkingNotes",
  "relationshipLongTermNotes",
  "relationshipCooling",
]) {
  assert.ok(locales[`ui.slurp.messages.${key}`], `missing panel copy for ${key}`);
}

console.log("slurp relationship panel regression passed");
