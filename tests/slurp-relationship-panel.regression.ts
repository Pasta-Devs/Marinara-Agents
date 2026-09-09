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

// --- The panel itself -------------------------------------------------------------------
assert.match(view, /function SlurpRelationshipPanel\(/u);
assert.doesNotMatch(view, /relationship\.side === "viewer" \?/u);

// Two views, not one view with extra rows appended. Both branches are located by the same
// ternary the component switches on, so the checks below cannot drift onto the wrong half.
const advancedStart = view.indexOf("{advanced ? (");
const branchSplit = view.indexOf("\n        ) : (", advancedStart);
const branchEnd = view.indexOf("\n        )}", branchSplit);
assert.ok(
  advancedStart > 0 && branchSplit > advancedStart && branchEnd > branchSplit,
  "panel must switch on `advanced`",
);
const advancedView = view.slice(advancedStart, branchSplit);
const basicView = view.slice(branchSplit, branchEnd);

// Basic answers what a player needs to play the conversation, and answers it in words.
// slurp-rapport.ts: a number in a thread turns a person into a progress bar and invites farming.
for (const section of ["Right now", "What can happen here", "What they remember about you", "Between you"]) {
  assert.match(basicView, new RegExp(`title="${section}"`, "u"), `basic view needs the ${section} section`);
}
assert.doesNotMatch(basicView, /<Meter/u, "basic view must not render a 0-100 meter");
assert.doesNotMatch(
  basicView,
  /\/100|score|emotionIntensity|resentment|familiarity/u,
  "basic view must stay qualitative",
);

// Advanced is the whole simulation, with every figure the prompt was built from.
for (const section of [
  "Creator right now",
  "This conversation",
  "Boundaries and trust",
  "Rapport breakdown",
  "Context",
  "Memories",
  "Exact values",
]) {
  assert.match(advancedView, new RegExp(`title="${section}"`, "u"), `advanced view needs the ${section} section`);
}
for (const field of [
  "creatorState.arousal",
  "creatorState.energy",
  "creatorState.exposure",
  "creatorState.emotionIntensity",
  "creatorState.intent",
  "threadState.sexualComfort",
  "threadState.respect",
  "threadState.resentment",
  "threadState.familiarity",
  "threadState.threadDesire",
  "threadState.adultLevel",
  "threadState.posture",
]) {
  assert.match(advancedView, new RegExp(field.replace(".", "\\."), "u"), `advanced view must show ${field}`);
}
// Every meter is also readable as text, which is what makes the colour encoding non-essential.
assert.match(advancedView, /title="Exact values"/u);
assert.match(advancedView, /creatorState\.updatedAt/u);
assert.match(advancedView, /threadState\.updatedAt/u);

// Dials nothing writes must not be rendered as though the panel were reporting something.
for (const gone of [
  "creatorState.strategy",
  "creatorState.needs",
  "threadState.interest",
  "threadState.commercialTrust",
]) {
  assert.doesNotMatch(view, new RegExp(gone.replace(".", "\\."), "u"));
}

// --- The pieces it is built from --------------------------------------------------------
// Defined once at module scope. Declaring them inside the component remounts every meter and
// every open section on each render, which is what closed a details block while it was read.
for (const piece of ["Meter", "DivergingBar", "Stepper", "StatusRow", "Field", "PanelSection", "NoteList"]) {
  assert.match(view, new RegExp(`^function ${piece}\\(`, "mu"), `${piece} must be a module-scope component`);
}

// A meter's unfilled track is a lighter step of its own hue, so state reads across the whole bar.
assert.match(view, /track: "bg-\[color-mix\(in_srgb,var\(--noodle-accent\)_18%,transparent\)\]"/u);
assert.match(view, /track: "bg-amber-500\/18"/u);
assert.match(view, /track: "bg-red-500\/18"/u);
// The value is beside the label, never only in the bar's length.
assert.match(view, /role="meter"[\s\S]{0,200}?aria-valuenow=\{clampPercent\(value\)\}/u);
// Polarity gets a centre, not a left anchor: mood and a rapport contribution both have a sign.
assert.match(view, /function DivergingBar\([\s\S]{0,1400}?left-1\/2 w-px/u);
// The adult level is five ranked words, so it renders as an ordered scale with somewhere to go.
assert.match(view, /const ADULT_LEVELS = \["ordinary", "suggestive", "provocative", "intimate", "explicit"\]/u);
// Status is never colour alone: an icon and a sentence carry it in greyscale and forced colours.
assert.match(view, /function StatusRow\(\{\s*icon: Icon,\s*tone,\s*title,/u);
// Notes are a list. Joining them with semicolons made one unreadable run of text.
assert.match(view, /function NoteList\([\s\S]{0,700}?notes\.map\(\(note\) => \(/u);
assert.doesNotMatch(view, /notes\.map\(\(note\) => note\.text\)\.join/u);

// Both words are on screen with one selected, so the control cannot be read as naming the
// mode it would switch to rather than the one already showing.
assert.match(view, /aria-pressed=\{advanced === mode\}/u);
assert.match(view, /\{mode \? "Advanced" : "Basic"\}/u);
assert.match(view, /role="group"\s*aria-label="Detail level"/u);

assert.match(view, /max-h-\[min\(78vh,44rem\)\]/u);
assert.match(view, /relationship\.dayVibe/u);
assert.match(view, /relationship\.imageMode/u);
assert.match(view, /aria-expanded=\{infoOpen\}/u);
// Opening a different conversation must not inherit the last one's open panel.
assert.match(view, /setInfoOpen\(false\);[\s\S]{0,120}setDebugOpen\(false\)/u);
assert.match(view, /Conversation overview/u);
assert.match(view, /if \(distanceFromBottom <= 96\)/u);
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
