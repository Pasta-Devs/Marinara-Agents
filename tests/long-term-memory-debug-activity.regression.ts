import assert from "node:assert/strict";

import {
  collectDebugNoteIds,
  deriveOperationStatus,
  filterOperations,
  formatAge,
  formatDuration,
  groupOperations,
  humanizeDebugText,
  LTM_DEBUG_STALE_OPERATION_MS,
} from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/settings/debug-activity.js";
import english from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/locales/en.json" with { type: "json" };
import type { LtmDebugEvent } from "../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.js";

let sequence = 0;
const event = (
  fields: Partial<LtmDebugEvent> & Pick<LtmDebugEvent, "operationId" | "action" | "status">,
): LtmDebugEvent =>
  ({
    id: `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`,
    ts: "2026-10-07T10:00:00.000Z",
    phase: "llm",
    ...fields,
  }) as LtmDebugEvent;

// D01: a phase/status filter selects whole operations and keeps all of their
// events, so a partial import that ended ok does not flip to "Failed".
const partial = [
  event({ operationId: "op-partial", action: "import_sources", status: "started" }),
  event({
    operationId: "op-partial",
    action: "extract_source_note",
    status: "error",
    error: { message: "One source failed." },
  }),
  event({ operationId: "op-partial", action: "import_sources", status: "ok" }),
];
const operations = groupOperations([
  ...partial,
  event({ operationId: "op-ok", action: "recall_explanation", status: "ok" }),
]);
const errorsOnly = filterOperations(operations, "errors");
assert.equal(errorsOnly.length, 1, "only the operation with an error event is kept");
assert.equal(errorsOnly[0].operationId, "op-partial");
assert.equal(errorsOnly[0].events.length, 3, "the filtered operation keeps its full event list");
assert.equal(deriveOperationStatus(errorsOnly[0].events), "completed_with_warnings");

// D11: a started-only operation with no completion past the threshold reads
// "No completion recorded"; a recent one still reads "Running".
const now = Date.parse("2026-10-07T12:00:00.000Z");
const stale = [
  event({ operationId: "op-stale", action: "extract_source_note", status: "started", ts: "2026-10-05T10:00:00.000Z" }),
];
assert.equal(deriveOperationStatus(stale, { now, staleMs: LTM_DEBUG_STALE_OPERATION_MS }), "incomplete");
const live = [
  event({ operationId: "op-live", action: "extract_source_note", status: "started", ts: "2026-10-07T11:59:00.000Z" }),
];
assert.equal(deriveOperationStatus(live, { now, staleMs: LTM_DEBUG_STALE_OPERATION_MS }), "started");
assert.equal(deriveOperationStatus(stale), "started", "without a threshold a started-only run stays Running");

// D03: id replacement matches whole tokens, so an id that is a prefix of an
// unknown id is left intact.
const titles = new Map([["character_mara", "Mara Quill"]]);
assert.equal(
  humanizeDebugText("missing note character_mara_missing", titles, "an internal record"),
  "missing note character_mara_missing",
);
assert.equal(humanizeDebugText("loaded character_mara", titles, "an internal record"), "loaded Mara Quill");
assert.equal(
  humanizeDebugText("draft 11111111-2222-3333-4444-555555555555", titles, "an internal record"),
  "draft an internal record",
);

// D17: only note-id-shaped ids are collected for the titles lookup, from
// structured fields and prose; UUIDs and ordinary words are not requested.
const overlongId = `source_${"x".repeat(120)}`;
const atCapId = `source_${"y".repeat(113)}`;
const collected = collectDebugNoteIds([
  event({
    operationId: "op-ids",
    action: "extract_source_note",
    status: "error",
    sourceNoteId: "source_a",
    error: { message: "record 11111111-2222-3333-4444-555555555555 missing" },
    details: {
      summary: "world_lantern_guild_v2 and character_mara_missing ready",
      targetNoteIds: [
        "world_target_only",
        "single",
        atCapId,
        overlongId,
        "",
        "World_uppercase",
        "world__invalid",
        "world_bad-id",
        "world_newline\n",
        "11111111-2222-3333-4444-555555555555",
        null,
        42,
      ],
    },
  }),
]);
assert.deepEqual(collected, [
  "character_mara_missing",
  "single",
  "source_a",
  atCapId,
  "world_lantern_guild_v2",
  "world_target_only",
]);

// A prose token past the 120-char id cap is not requested, so one long word
// cannot fail the whole batch and blank every title.
assert.equal(atCapId.length, 120);
assert.deepEqual(
  collectDebugNoteIds([
    event({
      operationId: "op-overlong",
      action: "extract_source_note",
      status: "error",
      error: { message: `${overlongId} ${atCapId}` },
    }),
  ]),
  [atCapId],
);

// Durations read in the unit that fits: ms under a second, seconds (one decimal under
// 10 s) under a minute, then minutes and seconds. The shipped English catalog supplies the wording.
const translate = (key: string, values: Record<string, unknown> = {}) =>
  (english as Record<string, string>)[key]!.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name]));
for (const [ms, expected] of [
  [0, "0 ms"],
  [999, "999 ms"],
  [1_000, "1.0 s"],
  [9_999, "9.9 s"],
  [10_000, "10 s"],
  [59_999, "59 s"],
  [60_000, "1 min 0 s"],
  [74_000, "1 min 14 s"],
] as const) {
  assert.equal(formatDuration(ms, "en", translate), expected, `${ms} ms`);
}

// Ages round down to whole seconds, minutes, hours and days; a timestamp ahead of the clock reads as now.
const ageNow = Date.parse("2026-10-12T12:00:00.000Z");
for (const [ago, expected] of [
  [0, "0 sec. ago"],
  [59_000, "59 sec. ago"],
  [60_000, "1 min. ago"],
  [3_599_000, "59 min. ago"],
  [3_600_000, "1 hr. ago"],
  [86_399_000, "23 hr. ago"],
  [86_400_000, "1 day ago"],
  [-5_000, "0 sec. ago"],
] as const) {
  assert.equal(formatAge(new Date(ageNow - ago).toISOString(), "en", ageNow), expected, `${ago} ms ago`);
}
assert.equal(formatAge("not a date", "en", ageNow), "");

console.log("long-term-memory debug-activity helpers: ok");
