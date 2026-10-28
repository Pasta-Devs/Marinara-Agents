// The relationship panel shows the complete simulation state to both sides of the conversation.
import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/routes/slurp-messages.routes.ts");
const storage = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
);
const view = slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx");
const hook = slurp2Source("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts");
const locales = JSON.parse(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/localization/locales/en.json"),
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
// Two more creator-owner-gated routes (media request resolution, draft reply) have been added
// since this count was last checked; each call site below is ownsCreator-gated.
assert.equal((routes.match(/freshView\([^)]*"creator"\)/gu) ?? []).length, 5);

// Both sides receive the complete relationship state now.
// The inline relationship object was extracted into the shared relationshipFor helper (R1-012),
// used by both routes that build a thread response.
assert.match(routes, /relationship: await relationshipFor\(thread, creator, side, presence\.creatorAvailability\)/u);
assert.match(
  routes,
  /const relationshipFor = async \([\s\S]{0,2000}?tier: thread\.rapport\.tier,\s*\n\s*score: thread\.rapport\.score,\s*\n\s*contributions: thread\.rapport\.contributions,/u,
);
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
for (const section of ["Right now", "What can happen here", "Between you"]) {
  assert.match(basicView, new RegExp(`title="${section}"`, "u"), `basic view needs the ${section} section`);
}
// Exception: the player's own partner thread trades the stranger's qualitative "What can happen
// here" for "Between you two" meters (1867359ab) — it is the player's own romance, not a fan to
// farm. Strip that one partnered branch before checking every other fan-facing path stays words.
const partneredStart = basicView.indexOf("{partnered ? (");
const partneredEnd = basicView.indexOf(") : (", partneredStart);
assert.ok(
  partneredStart > 0 && partneredEnd > partneredStart,
  "the basic view must branch on the player's own partner",
);
assert.match(basicView.slice(partneredStart, partneredEnd), /title="Between you two"/u);
const basicViewForStrangers = basicView.slice(0, partneredStart) + basicView.slice(partneredEnd);
assert.doesNotMatch(basicViewForStrangers, /<Meter/u, "a fan's basic view must not render a 0-100 meter");
assert.doesNotMatch(
  basicViewForStrangers,
  /\/100|score|emotionIntensity|resentment|familiarity/u,
  "a fan's basic view must stay qualitative",
);

// Advanced is the whole simulation, with every figure the prompt was built from.
for (const section of [
  "Creator right now",
  "This conversation",
  "Boundaries and trust",
  "Rapport breakdown",
  "Context",
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
// Moved to SlpDetailsParts.tsx (size cap, 1867359ab), each exported.
for (const piece of ["Meter", "DivergingBar", "Stepper", "StatusRow", "Field", "PanelSection"]) {
  assert.match(view, new RegExp(`^export function ${piece}\\(`, "mu"), `${piece} must be a module-scope component`);
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
// Memory has one dedicated editor instead of a read-only copy in either Details view.
assert.doesNotMatch(advancedView, /title="Memories"/u);
assert.doesNotMatch(basicView, /title="What they remember about you"/u);
assert.match(view, /function SlurpMemoriesPanel\(/u);

// Both words are on screen with one selected, so the control cannot be read as naming the
// mode it would switch to rather than the one already showing.
// The hand-rolled toggle button pair became the shared SlpSegment radiogroup control.
assert.match(view, /<SlpSegment\s+label="Detail level"\s+value=\{advanced \? "advanced" : "basic"\}/u);
// SlpSegment renders both option labels itself (role="radiogroup"), so there is no single
// current-mode label or hand-rolled role="group" left to pin.

// The panel's own height clamp was dropped: Details now renders inside the shared SlpThreadDrawer
// (SlpSheet), which already clamps every drawer's height.
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/messages/SlpThreadDrawer.tsx"),
  /SlpSheet open=\{Boolean\(drawerMode\)\}/u,
  "Details must render inside the shared, height-clamped sheet",
);
assert.match(view, /relationship\.dayVibe/u);
assert.match(view, /relationship\.imageMode/u);
// The hand-rolled <dialog> with a visible-heading aria-labelledby became the shared SlpSheet,
// which names its role="dialog" with aria-label={title} instead.
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/modules/chrome/SlpSheet.tsx"),
  /role=\{kind === "dialog" \? "dialog" : undefined\}[\s\S]{0,120}?aria-label=\{kind === "dialog" \? title : undefined\}/u,
  "the shared sheet must still name itself as an accessible dialog",
);
// Opening a different conversation must not inherit the last one's drawer state. The explicit
// reset was replaced by remounting the whole thread view per conversation (a `key` keyed on
// thread/compose/support), which resets every piece of state at once, not just these two.
assert.match(
  view,
  /key=\{`\$\{openThreadId \?\? ""\}:\$\{composeWith \?\? ""\}:\$\{startAsSupport \? "support" : ""\}`\}/u,
  "the thread view must remount per conversation so no drawer or search state leaks across threads",
);
assert.match(view, /Conversation overview/u);
// The named distanceFromBottom became one inline calculation; the 96px pinned-to-bottom threshold
// is unchanged.
assert.match(view, /scrollHeight - container\.scrollTop - container\.clientHeight <= 96/u);
assert.doesNotMatch(view, /creatorStatus &&/u);
assert.match(hook, /refetchInterval: threadId && personaId \? 30_000 : false/u);
assert.match(hook, /refetchInterval: creatorAccountId && personaId && !peek \? 30_000 : false/u);

// The mobile conversation must contain its header and commission controls instead of widening the viewport.
assert.match(view, /min-w-0 flex-1 items-center gap-2 overflow-hidden/u);
assert.match(view, /overflow-x-hidden overflow-y-auto/u);
assert.match(view, /min-h-0 min-w-0 max-w-full flex-1/u);
assert.match(view, /grid min-w-0 grid-cols-4/u);
// Details, Memories, Commissions and the prompt debugger now share one sheet: on a desktop width
// it centres as a modal (SlpSheet's "modal" mode) sized by its own width prop, rather than
// anchoring to the trailing edge as its own one-off drawer.
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/features/messages/SlpThreadDrawer.tsx"),
  /<SlpSheet open=\{Boolean\(drawerMode\)\} onClose=\{closeDrawer\} title=\{title\} width="max-w-lg"/u,
  "details must size the shared sheet explicitly",
);
// The drawer's own mobile bottom-sheet clamp is superseded by SlpSheet's "sheet" mode, already
// proven above to size every drawer (including Details) consistently.
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/modules/chrome/SlpSheet.tsx"),
  /max-h-\[88dvh\]/u,
  "details must become a mobile bottom sheet",
);

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
