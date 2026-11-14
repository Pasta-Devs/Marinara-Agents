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
import {
  activitySignalOf,
  claimActivityOwner,
  markRetried,
  retriedAtOf,
  subscribeRetried,
} from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/activity-signal.js";
import {
  leftOutFromExplanation,
  pickCardProblem,
  recallProblemKey,
} from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/card-problem.js";
import {
  autoImportSavedSince,
  hiddenSince,
  hiddenToastStep,
  lastRecallAt,
  ltmHiddenLine,
  markLtmCardOpen,
  isLtmCardOpen,
} from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/auto-import-status.js";
import { nearestRecallPreset } from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/recall-style.js";
import { askSlurpMemories } from "../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/settings/slurp-memory-offer.js";
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

// Slurp's memory switches: the ask happens only when Slurp answers with that switch off, and it changes nothing itself.
const offer = async (
  read: () => Promise<{ flavourFromAgents?: boolean; shareWithMemory?: boolean }>,
  answer: boolean,
  setting: "flavourFromAgents" | "shareWithMemory" = "flavourFromAgents",
) => {
  const calls = { confirm: 0 };
  const outcome = await askSlurpMemories({
    setting,
    read,
    confirm: () => (calls.confirm++, answer),
  });
  return { outcome, ...calls };
};
void (async () => {
  assert.deepEqual(await offer(async () => ({ flavourFromAgents: false }), true), {
    outcome: "accepted",
    confirm: 1,
  });
  assert.deepEqual(await offer(async () => ({ flavourFromAgents: false }), false), {
    outcome: "declined",
    confirm: 1,
  });
  assert.deepEqual(await offer(async () => ({ flavourFromAgents: true }), true), {
    outcome: "skipped",
    confirm: 0,
  });
  assert.deepEqual(
    await offer(async () => {
      throw new Error("Slurp is not installed");
    }, true),
    { outcome: "skipped", confirm: 0 },
  );
  // Each switch is read on its own: the add offer ignores the read switch, and an older Slurp without it skips.
  assert.deepEqual(
    await offer(async () => ({ flavourFromAgents: false, shareWithMemory: true }), true, "shareWithMemory"),
    { outcome: "skipped", confirm: 0 },
  );
  assert.deepEqual(
    await offer(async () => ({ flavourFromAgents: true, shareWithMemory: false }), true, "shareWithMemory"),
    {
      outcome: "accepted",
      confirm: 1,
    },
  );
  assert.deepEqual(await offer(async () => ({ flavourFromAgents: false }), true, "shareWithMemory"), {
    outcome: "skipped",
    confirm: 0,
  });
  console.log("long-term-memory slurp memory offer: ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// soup/ltm-settings-tidy: a form saved as Custom resets to the preset its weights are closest to.
{
  const weights = (semantic: number, lexical: number, graph: number, keyword: number) => ({
    longTermMemorySemanticWeight: semantic,
    longTermMemoryLexicalWeight: lexical,
    longTermMemoryGraphWeight: graph,
    longTermMemoryKeywordWeight: keyword,
  });
  assert.equal(nearestRecallPreset(weights(0.7, 0.42, 0.105, 0.56)), "balanced", "untouched Balanced stays Balanced");
  assert.equal(nearestRecallPreset(weights(0.91, 0.525, 0.42, 0.56)), "story", "a tweaked Story weight stays Story");
  assert.equal(nearestRecallPreset(weights(0.7, 0.525, 0, 0.56)), "story", "Story with links switched off stays Story");
  assert.equal(nearestRecallPreset(weights(0.2, 0.7, 0, 0.56)), "exact", "a tweaked Exact weight stays Exact");
  assert.equal(nearestRecallPreset(weights(0.7, 0.28, 0.25, 0.5)), "broad", "a tweaked Broad weight stays Broad");
}

// The card names at most one problem, in a fixed order, and counts what a limit cut from the recall's explanation.
{
  const attempt = (outcome: "completed" | "skipped" | "failed" | "cancelled", extra: Record<string, unknown> = {}) =>
    ({
      version: 1,
      chatId: "c",
      attemptId: "a",
      at: "2026-01-01T00:00:00.000Z",
      outcome,
      debugEnabled: true,
      confirmed: false,
      ...extra,
    }) as never;
  const saveFailed = { cause: "Provider error" };
  const leftOut = { count: 2, limit: "budget" } as const;
  const all = { recall: attempt("failed"), saveFailed, needsSetup: true, leftOut };
  assert.equal(pickCardProblem(all)?.kind, "recall", "all four at once: recall first");
  assert.equal(pickCardProblem({ ...all, recall: null })?.kind, "saveFailed", "then a failed save");
  assert.equal(pickCardProblem({ ...all, recall: null, saveFailed: null })?.kind, "setup", "then no extraction model");
  assert.equal(pickCardProblem({ ...all, recall: null, saveFailed: null, needsSetup: false })?.kind, "leftOut");
  assert.equal(pickCardProblem({ recall: null, saveFailed: null, needsSetup: false, leftOut: null }), null);
  assert.equal(
    pickCardProblem({ recall: null, saveFailed: null, needsSetup: false, leftOut: { count: 0, limit: "budget" } }),
    null,
    "nothing cut is no problem",
  );
  const base = "ui.longTermMemory.lastinjectionsummary.";
  assert.equal(recallProblemKey(attempt("cancelled")), `${base}recallCancelled`);
  assert.equal(recallProblemKey(attempt("failed")), `${base}recallFailed`);
  assert.equal(recallProblemKey(attempt("skipped", { reason: "empty_query" })), `${base}recallSkippedEmptyQuery`);
  assert.equal(recallProblemKey(attempt("skipped", { reason: "prompt_budget" })), `${base}recallSkippedPromptBudget`);
  assert.equal(
    recallProblemKey(attempt("skipped", { reason: "chat_not_found" })),
    `${base}recallSkippedChatUnavailable`,
  );
  assert.equal(recallProblemKey(attempt("skipped")), `${base}recallSkipped`);
  assert.equal(recallProblemKey(attempt("completed")), `${base}recallNotConfirmed`);
  for (const key of Object.keys(english).filter((k) => k.startsWith(`${base}recall`)))
    assert.ok(!/^The latest recall/u.test((english as Record<string, string>)[key]!), `${key} says the reason only`);

  const explanation = (selected: unknown[], rejected: unknown[]) => ({ details: { selected, rejected } });
  assert.equal(leftOutFromExplanation(undefined), null, "explanations off: nothing to say");
  assert.equal(leftOutFromExplanation(explanation([], [{ noteId: "x", rejectionReason: "score_threshold" }])), null);
  assert.deepEqual(
    leftOutFromExplanation(
      explanation(
        [{ noteId: "a" }],
        [
          { noteId: "b", rejectionReason: "budget" },
          { noteId: "b", rejectionReason: "budget" },
          { noteId: "c", rejectionReason: "lower_rank" },
          { noteId: "d", rejectionReason: "lower_rank" },
          { noteId: "a", rejectionReason: "budget" },
          { noteId: "e", rejectionReason: "prompt_budget" },
        ],
      ),
    ),
    { count: 3, limit: "lower_rank" },
    "each memory once, none already added, the limit that cut more",
  );
  assert.equal(
    leftOutFromExplanation(
      explanation(
        [],
        [
          { noteId: "a", rejectionReason: "budget" },
          { noteId: "b", rejectionReason: "lower_rank" },
        ],
      ),
    )?.limit,
    "budget",
    "a tie names the token limit",
  );
}

// Part 3 of the card: what "new" means (after the last recall), and the one sentence for a hide.
{
  const saved = (chatId: string, ts: string, applied: number, action = "auto_import") =>
    ({ ts, action, status: "ok", chatId, counts: { applied } }) as never;
  const events = [
    saved("c", "2026-01-01T10:00:00.000Z", 3),
    saved("c", "2026-01-01T12:00:00.000Z", 2),
    saved("other", "2026-01-01T12:00:00.000Z", 9),
    saved("c", "2026-01-01T12:00:00.000Z", 5, "import_sources"),
  ];
  const noon = Date.parse("2026-01-01T11:00:00.000Z");
  assert.equal(autoImportSavedSince(events, "c", noon), 2, "this chat's background saves after the recall");
  assert.equal(autoImportSavedSince(events, "c", 0), 5, "no recall yet counts them all");
  assert.equal(autoImportSavedSince(events, "c", Date.parse("2026-01-02T00:00:00.000Z")), 0);
  assert.equal(lastRecallAt(null), 0);
  assert.equal(lastRecallAt({ dispatchedAt: null, attempt: null }), 0);
  assert.equal(
    lastRecallAt({ dispatchedAt: "2026-01-01T10:00:00.000Z", attempt: { at: "2026-01-01T11:00:00.000Z" } }),
    noon,
    "a later attempt that sent nothing still counts as the next reply",
  );
  const hidden = { from: 12, to: 25, at: "2026-01-01T12:00:00.000Z" };
  assert.equal(hiddenSince(hidden, noon), hidden);
  assert.equal(hiddenSince(hidden, Date.parse(hidden.at)), null, "gone once a reply's recall ran after the hide");
  assert.equal(hiddenSince(null, 0), null);
  assert.deepEqual(ltmHiddenLine({ from: 12, to: 25 }), [
    "ui.longTermMemory.lastinjectionsummary.hiddenRange",
    { from: 12, to: 25 },
  ]);
  assert.deepEqual(ltmHiddenLine({ from: 7, to: 7 }), [
    "ui.longTermMemory.lastinjectionsummary.hiddenOne",
    { from: 7 },
  ]);
  const closeA = markLtmCardOpen("c");
  const closeB = markLtmCardOpen("c");
  closeA();
  assert.ok(isLtmCardOpen("c"), "two cards open: one closing leaves the chat open");
  closeB();
  assert.ok(!isLtmCardOpen("c"));
  // The hidden-messages toast: the first read of a chat is silent, a new hide speaks once, an open card keeps it quiet.
  const first = hiddenToastStep(undefined, { at: "t1" }, false);
  assert.deepEqual(first, { seen: "t1", say: false });
  assert.deepEqual(hiddenToastStep(first.seen, { at: "t1" }, false), { seen: "t1", say: false });
  assert.deepEqual(hiddenToastStep("t1", { at: "t2" }, false), { seen: "t2", say: true });
  assert.deepEqual(hiddenToastStep("t1", { at: "t2" }, true), { seen: "t2", say: false });
  assert.deepEqual(hiddenToastStep("t2", null, false), { seen: "t2", say: false });
  assert.deepEqual(hiddenToastStep(undefined, null, false), { seen: "", say: false });
}

// The Agent activity icon: it spins while memory reads and shows a dot when saving failed, and nothing else lights it.
{
  assert.deepEqual(activitySignalOf({ reading: false, saveFailed: null }), { busy: false, alert: false });
  assert.deepEqual(activitySignalOf({ reading: true, saveFailed: null }), { busy: true, alert: false });
  assert.deepEqual(activitySignalOf({ reading: false, saveFailed: { cause: null } }), { busy: false, alert: true });
  assert.deepEqual(activitySignalOf({ reading: true, saveFailed: { cause: "Timed out" } }), {
    busy: true,
    alert: true,
  });
  // Try again is kept per chat and tells every listener, so the surface's dot clears when the panel retries.
  let heard = 0;
  const stop = subscribeRetried(() => (heard += 1));
  assert.equal(retriedAtOf("chat-a"), 0);
  assert.equal(retriedAtOf(null), 0);
  markRetried("chat-a", 123);
  assert.equal(retriedAtOf("chat-a"), 123);
  assert.equal(retriedAtOf("chat-b"), 0, "a retry in one chat leaves the others");
  assert.equal(heard, 1);
  stop();
  markRetried("chat-a", 456);
  assert.equal(heard, 1, "a stopped listener hears nothing");
  // Try again marks the failed read's own time: that failure is hidden, a later one shows again.
  const failedAt = Date.parse("2026-11-14T10:00:00.000Z");
  markRetried("chat-c", failedAt);
  assert.equal(
    failedAt > retriedAtOf("chat-c"),
    false,
    "the retried failure is hidden whatever the browser clock says",
  );
  assert.equal(failedAt + 1 > retriedAtOf("chat-c"), true, "a later failure shows again");
  // The entry is cleared only when the last mount for the chat leaves, once.
  const surface = claimActivityOwner("chat-a");
  const panel = claimActivityOwner("chat-a");
  const other = claimActivityOwner("chat-b");
  assert.equal(surface(), false, "the panel still owns the chat");
  assert.equal(surface(), false, "a second release of the same mount counts nothing");
  assert.equal(other(), true, "another chat has its own count");
  assert.equal(panel(), true, "the last mount clears");
  assert.equal(claimActivityOwner("chat-a")(), true, "a later mount starts a new count");
}

console.log("long-term-memory debug-activity helpers: ok");
