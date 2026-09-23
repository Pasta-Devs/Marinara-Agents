/**
 * The story engine: portable packs in, safe entries out, and a ledger that never fires twice.
 *
 * Packs are data. Nothing here may install enabled content, carry a local Creator id across the
 * boundary, or let a repeated world tick duplicate an occurrence, a fact, or an opportunity.
 */
import assert from "node:assert/strict";

import {
  applySlpStoryOutcomes,
  reconcileSlpScheduledOccurrences,
  selectSlpEventParticipants,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-story-runtime.ts";
import { projectSlpStoryCalendar } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-story-runtime.ts";
import {
  applySlpStoryPack,
  exportSlpStoryPack,
  parseSlpStoryPack,
  previewSlpStoryPack,
  slpBundledStoryPacks,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-story-packs.ts";
import type {
  SlpArcBlueprint,
  SlpEventBlueprint,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-story-engine.js";

const at = new Date("2026-06-04T12:00:00.000Z");
const account = (id: string, tags: string[]) => ({ id, hiddenAt: null, settings: { profile: { tags } } }) as never;
const accounts = [account("a", ["music"]), account("b", ["gaming"]), account("c", ["music", "travel"])];

// --- Every bundled pack is valid input to the same reader that accepts an upload. ---
const bundled = slpBundledStoryPacks();
assert.ok(bundled.length >= 7, "the bundled gallery ships the original content plus the optional packs");
for (const pack of bundled) {
  const reparsed = parseSlpStoryPack(JSON.parse(JSON.stringify(pack)));
  assert.deepEqual(reparsed.errors, [], `${pack.id} must parse`);
  assert.deepEqual(reparsed.pack, pack, `${pack.id} must survive a JSON round-trip unchanged`);
}
assert.ok(
  bundled.some((pack) => pack.id === "slurp-everyday-life") &&
    bundled.some((pack) => pack.id === "slurp-core-calendar"),
  "the shipped arcs and calendar are themselves packs",
);
const calendarBlueprint = bundled.find((pack) => pack.id === "slurp-core-calendar")!.events[0]!;
const calendarItems = projectSlpStoryCalendar({
  events: [calendarBlueprint],
  occurrences: [],
  plans: [
    {
      id: "plan-1",
      title: "Prepare the launch",
      direction: "Move from announcement to launch.",
      chapters: [],
      chapter: 0,
      status: "active",
      posts: 0,
      startedAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
      typeId: null,
      tone: "",
      durationDays: 12,
      phaseDays: [],
      chapterStartedAt: "2026-01-03T00:00:00.000Z",
      intensity: "focus",
      origin: "manual",
      generated: false,
      history: [],
      completedAt: null,
      twist: "",
      choices: [],
      pollPostId: null,
      pollClosesAt: null,
      reach: [],
      revertProfileAtEnd: false,
      pendingProfile: null,
      previousProfile: null,
      creatorIds: ["creator-1"],
      profiles: {},
    },
  ],
  from: new Date("2026-01-01T00:00:00.000Z"),
  to: new Date("2026-02-01T00:00:00.000Z"),
});
assert.ok(
  calendarItems.some((item) => item.kind === "occasion"),
  "calendar projects annual occasions",
);
assert.ok(
  calendarItems.some((item) => item.kind === "plan" && item.title === "Prepare the launch"),
  "calendar projects Plans",
);
assert.equal(calendarItems.find((item) => item.kind === "occasion")!.status, "scheduled");

// --- Imported content arrives inert: off, not built in, and stamped with where it came from. ---
const career = bundled.find((pack) => pack.id === "slurp-creator-career")!;
const preview = previewSlpStoryPack(career, { arcs: [], events: [] });
assert.deepEqual(
  [...new Set(preview.entries.map((entry) => entry.status))],
  ["new"],
  "nothing is installed yet, so every entry is new",
);
assert.ok(
  preview.entries.every((entry) => entry.selected),
  "new entries start selected",
);
const applied = applySlpStoryPack(
  preview,
  preview.entries.map((entry) => ({ kind: entry.kind, contentId: entry.contentId, action: "copy" as const })),
  { arcs: [], events: [] },
);
assert.equal(applied.arcs.length, career.arcs.length);
for (const arc of applied.arcs) {
  assert.equal(arc.enabled, false, "an imported arc never turns itself on");
  assert.equal(arc.builtin, false, "imported content is never built in");
  assert.equal(arc.automation, "inherit");
  assert.equal(arc.provenance?.packId, career.id);
}

// --- Re-importing the same pack offers an update, and an untouched entry is not re-selected. ---
const second = previewSlpStoryPack(career, { arcs: applied.arcs, events: [] });
assert.deepEqual(
  [...new Set(second.entries.map((entry) => entry.status))],
  ["update"],
  "installed entries are updates, not duplicates",
);
assert.ok(
  second.entries.every((entry) => !entry.selected),
  "an entry that matches what is installed is not re-applied",
);
// A locally edited entry is reported as such and left alone unless the player chooses otherwise.
const edited = applied.arcs.map((arc, index) => (index === 0 ? { ...arc, description: "My own version." } : arc));
const third = previewSlpStoryPack(career, { arcs: edited, events: [] });
const editedEntry = third.entries.find((entry) => entry.status === "local-edit");
assert.ok(editedEntry, "an edited entry must be reported as a local edit");
assert.equal(editedEntry.selected, false, "a local edit is never overwritten by default");
// Replacing keeps the installed id, so a running arc's reference does not dangle.
const replaced = applySlpStoryPack(third, [{ kind: "arc", contentId: editedEntry.contentId, action: "replace" }], {
  arcs: [...edited],
  events: [],
});
assert.equal(replaced.arcs.length, edited.length, "replace must not add a second copy");
assert.equal(replaced.arcs[0]!.id, edited[0]!.id, "replace keeps the id the world already points at");
const editedTemplate = {
  ...career.arcs[0]!,
  name: "Launching a smaller project",
  description: "A user-edited direction.",
  tone: "hopeful",
  chapters: career.arcs[0]!.chapters.map((chapter, index) =>
    index === 0 ? { ...chapter, label: "the smaller announcement", minDays: 3, maxDays: 9 } : chapter,
  ),
};
const editedApplied = applySlpStoryPack(
  preview,
  [
    {
      kind: "arc",
      contentId: preview.entries.find((entry) => entry.kind === "arc")!.contentId,
      action: "copy",
      value: editedTemplate,
    },
  ],
  { arcs: [], events: [] },
);
assert.equal(editedApplied.arcs[0]!.name, "Launching a smaller project", "the Pack editor value is applied");
assert.equal(editedApplied.arcs[0]!.chapters[0]!.label, "the smaller announcement");
assert.equal(editedApplied.arcs[0]!.provenance?.contentId, editedTemplate.contentId);
const enabledApplied = applySlpStoryPack(
  preview,
  [
    {
      kind: "arc",
      contentId: preview.entries.find((entry) => entry.kind === "arc")!.contentId,
      action: "copy",
      enabled: true,
    },
  ],
  { arcs: [], events: [] },
);
assert.equal(enabledApplied.arcs[0]!.enabled, true, "the importer can explicitly enable an entry");

// --- Export is data only: local Creator assignments never leave the install. ---
const localEvent = {
  ...bundled.find((pack) => pack.id === "slurp-core-calendar")!.events[0]!,
  target: { kind: "selected" as const, creatorIds: ["a", "b"] },
};
const exported = exportSlpStoryPack({ id: "mine", name: "Mine", arcs: [], events: [localEvent as never] });
assert.deepEqual(exported.events[0]!.target, { kind: "all" }, "a local Creator list must not be exported");
assert.equal(JSON.stringify(exported).includes('"creatorIds"'), false);
assert.deepEqual(parseSlpStoryPack(exported).errors, [], "an export is valid import input");
const localPreview = previewSlpStoryPack({ ...exported, events: [localEvent] }, { arcs: [], events: [] });
assert.ok(
  localPreview.entries[0]!.warnings.some((warning) => warning.includes("Creator")),
  "a pack that still names local Creators warns before it is applied",
);
assert.deepEqual(
  applySlpStoryPack(localPreview, [{ kind: "event", contentId: localPreview.entries[0]!.contentId, action: "copy" }], {
    arcs: [],
    events: [],
  }).events[0]!.target,
  { kind: "all" },
  "applying strips the local assignment too, not just exporting",
);

// --- Bad input is refused whole; a legacy single-arc file is still accepted. ---
assert.equal(parseSlpStoryPack({ format: "something-else" }).pack, null);
assert.equal(parseSlpStoryPack({ ...career, arcs: [{ id: "x" }] }).pack, null, "a broken entry fails its pack");
assert.ok(parseSlpStoryPack({ ...career, evil: "code" }).errors.length > 0, "unknown keys are rejected");
const legacyArc: SlpArcBlueprint = career.arcs[0]!;
const legacy = parseSlpStoryPack(JSON.parse(JSON.stringify(legacyArc)));
assert.equal(legacy.pack?.arcs.length, 1, "a legacy single-arc file becomes a one-item pack");

// --- Targeting is deterministic, and a hidden Creator is never picked. ---
const musicEvent = {
  ...bundled.find((pack) => pack.id === "slurp-festival-circuit")!.events[0]!,
  target: { kind: "tags" as const, mode: "any" as const, tags: ["music"] },
};
assert.deepEqual(selectSlpEventParticipants(musicEvent, accounts, "k"), ["a", "c"]);
assert.deepEqual(
  selectSlpEventParticipants(musicEvent, [...accounts, account("d", ["music"])], "k"),
  selectSlpEventParticipants(musicEvent, [...accounts, account("d", ["music"])], "k"),
  "the same inputs always give the same participants",
);
assert.deepEqual(
  selectSlpEventParticipants(
    musicEvent,
    [{ ...(accounts[0] as never as object), hiddenAt: at.toISOString() } as never, accounts[2]!],
    "k",
  ),
  ["c"],
  "a hidden Creator never takes part",
);
// --- The ledger is idempotent: a repeated tick adds nothing. ---
const annual: SlpEventBlueprint = {
  ...musicEvent,
  id: "festival",
  enabled: true,
  automation: "auto",
  target: { kind: "all" },
  activation: { kind: "annual", month: 6, day: 1, durationDays: 7 },
};
const first = reconcileSlpScheduledOccurrences({
  events: [annual],
  occurrences: [],
  accounts,
  at,
  automation: "suggest",
});
assert.equal(first.occurrences.length, 1);
assert.equal(first.activated.length, 1, "an auto event starts on its own");
assert.equal(first.occurrences[0]!.status, "active");
assert.deepEqual(first.occurrences[0]!.participantIds, ["a", "b", "c"]);
const again = reconcileSlpScheduledOccurrences({
  events: [annual],
  occurrences: first.occurrences,
  accounts,
  at,
  automation: "suggest",
});
assert.deepEqual(again.occurrences, first.occurrences, "the same day must not start the event twice");
assert.deepEqual(again.activated, [], "a restart re-runs the tick without re-firing anything");
// A suggestion waits; a manual event never schedules itself.
assert.equal(
  reconcileSlpScheduledOccurrences({
    events: [{ ...annual, automation: "inherit" }],
    occurrences: [],
    accounts,
    at,
    automation: "suggest",
  }).occurrences[0]!.status,
  "suggested",
);
assert.deepEqual(
  reconcileSlpScheduledOccurrences({
    events: [{ ...annual, automation: "manual" }],
    occurrences: [],
    accounts,
    at,
    automation: "auto",
  }).occurrences,
  [],
  "a manual event only starts when the player starts it",
);
// The window closing completes the occurrence; editing the blueprint never rewrites it.
const later = new Date("2026-06-20T12:00:00.000Z");
const closed = reconcileSlpScheduledOccurrences({
  events: [{ ...annual, name: "Renamed", target: { kind: "selected", creatorIds: [] } }],
  occurrences: first.occurrences,
  accounts,
  at: later,
  automation: "suggest",
});
assert.equal(closed.occurrences[0]!.status, "completed");
assert.deepEqual(closed.occurrences[0]!.participantIds, ["a", "b", "c"], "a finished occurrence keeps its snapshot");
assert.equal(closed.occurrences[0]!.blueprint.name, annual.name, "the snapshot is not re-read from the blueprint");

// --- Outcomes apply once, then expire on their own. ---
const outcomes = [
  { kind: "add-creator-fact" as const, tag: "played-the-festival", label: "Played the festival", expiresAfterDays: 10 },
  { kind: "grant-arc-opportunity" as const, storyTags: ["recovery"], weight: 2, consume: true, expiresAfterDays: 10 },
];
const once = applySlpStoryOutcomes({
  outcomes,
  participants: ["a", "c"],
  sourceKind: "event",
  sourceId: "festival",
  at,
  facts: [],
  opportunities: [],
});
assert.equal(once.facts.length, 2);
assert.equal(once.opportunities.length, 2);
const twice = applySlpStoryOutcomes({
  outcomes,
  participants: ["a", "c"],
  sourceKind: "event",
  sourceId: "festival",
  at,
  facts: once.facts,
  opportunities: once.opportunities,
});
assert.deepEqual(twice.facts, once.facts, "applying the same outcome twice adds nothing");
assert.deepEqual(twice.opportunities, once.opportunities);
const expired = applySlpStoryOutcomes({
  outcomes: [],
  participants: [],
  sourceKind: "event",
  sourceId: "festival",
  at: new Date("2026-07-04T12:00:00.000Z"),
  facts: once.facts,
  opportunities: once.opportunities,
});
assert.deepEqual(expired.facts, [], "an expired fact is cleared by the next tick");
assert.deepEqual(expired.opportunities, []);

console.log("slurp2 story engine regression passed");
