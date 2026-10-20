import assert from "node:assert/strict";

import {
  isUnsolicitedCreatorMessage,
  slurpAllowsUnsolicitedText,
  type SlpGateMessage,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-follow-up.js";
import { slurp2Source } from "./slurp2-source";

// Issue #1289 — "Slurp: global control to stop creator follow-up texts until the viewer replies".
// Executable proof for the pure gate `slurpAllowsUnsolicitedText`, plus source checks that the
// world-tick planner, the follow-up scheduler, and the storage transaction all call it.
//
// The planner (`slp-creator-check-in.ts`) is checked by source assertion, not by import: it pulls
// in the full storage module graph (down to `db/file-query.ts`), which this repo's vendored
// `packages/slurp2/src/engine` copy does not carry standalone — only a real Engine checkout does.

const viewer = (overrides: Partial<SlpGateMessage> = {}): SlpGateMessage => ({ role: "viewer", ...overrides });
const creator = (overrides: Partial<SlpGateMessage> = {}): SlpGateMessage => ({ role: "creator", ...overrides });
const opener = () => creator({ metadata: { followUp: true, followUpType: "opener" } });
const checkIn = () => creator({ metadata: { followUp: true, followUpType: "check_in" } });
const recurring = () => creator({ metadata: { followUp: true, followUpType: "recurring" } });
const dramaChoice = () =>
  creator({ metadata: { dramaChoice: { runId: "r1", stage: null, options: [], chosen: null } } });
const cannedOpener = () => creator({ metadata: { unsolicited: true } });
// A fully unmarked row: no `followUpType`, no `dramaChoice`, no `unsolicited`. This is what every
// direct reply looks like, and also what a pre-feature historical opener row looks like — the two
// are indistinguishable after the fact. `isUnsolicitedCreatorMessage` reads it as "not unsolicited"
// (a known limit), but `slurpAllowsUnsolicitedText`'s own fallback (exhausting the window with no
// match) still blocks on it when it is the *only* thing in the window — see that assertion below.
const unmarkedCreatorRow = () => creator({ metadata: {} });
const promiseDelivery = () => creator({ metadata: { followUp: true, followUpType: "promise_delivery" } });
const reminder = () => creator({ metadata: { followUp: true, followUpType: "reminder" } });
const taskUpdate = () => creator({ metadata: { followUp: true, followUpType: "task_update" } });
const systemLine = () => creator({ kind: "system", metadata: {} });
const deskQuietViewer = () => viewer({ metadata: { deskQuiet: true } });

async function main() {
  // A brand-new thread's first unsolicited text is always allowed.
  assert.equal(slurpAllowsUnsolicitedText([]), true, "empty thread allows the first text");

  // Each assertion below passes the thread's history *before* the next candidate send; the
  // function answers whether that next send is allowed now.

  // Viewer → creator reply: a check-in right after is allowed.
  assert.equal(
    slurpAllowsUnsolicitedText([viewer(), unmarkedCreatorRow()]),
    true,
    "a check-in after a real reply is fine",
  );

  // One unsolicited text already sent, no reply since: a second one (any of these types) is blocked.
  assert.equal(
    slurpAllowsUnsolicitedText([viewer(), unmarkedCreatorRow(), checkIn()]),
    false,
    "a second check-in is blocked",
  );
  assert.equal(
    slurpAllowsUnsolicitedText([recurring()]),
    false,
    "a recurring update already sent blocks the next text",
  );
  assert.equal(
    slurpAllowsUnsolicitedText([dramaChoice()]),
    false,
    "a drama-choice question already sent blocks the next text",
  );
  assert.equal(slurpAllowsUnsolicitedText([opener()]), false, "an unanswered opener blocks the next text");

  // The viewer replying clears the block.
  assert.equal(
    slurpAllowsUnsolicitedText([opener(), viewer()]),
    true,
    "a real viewer reply allows the next unsolicited text again",
  );

  // Read-only (no viewer row at all) stays blocked.
  assert.equal(slurpAllowsUnsolicitedText([opener()]), false, "no viewer message at all stays blocked");

  // A full, ambiguous window with neither a real reply nor an unsolicited marker in it is blocked,
  // not allowed by default (an older unresolved opener may sit just outside the window).
  assert.equal(
    slurpAllowsUnsolicitedText([promiseDelivery(), promiseDelivery(), systemLine()]),
    false,
    "an all-exempt window with no real reply and no unsolicited marker is not treated as allowed",
  );

  // Owed sends are never classified as unsolicited, so the scheduler never runs this gate for them
  // at all (it filters by `followUp.type` before ever calling `slurpAllowsUnsolicitedText`).
  for (const exempt of [promiseDelivery(), reminder(), taskUpdate()]) {
    assert.equal(isUnsolicitedCreatorMessage(exempt), false, `${JSON.stringify(exempt.metadata)} is exempt`);
  }

  // A drama-choice message is classified as unsolicited purely from its own `dramaChoice` marker.
  assert.equal(isUnsolicitedCreatorMessage(dramaChoice()), true, "a drama choice question counts as unsolicited");

  // System lines are neither a reply nor an unsolicited text; they are invisible to the gate.
  assert.equal(
    slurpAllowsUnsolicitedText([viewer(), unmarkedCreatorRow(), systemLine()]),
    true,
    "a system line after a reply does not re-block the next unsolicited text",
  );

  // Read receipts and desk-quiet notes are not a reply: "left on read" must still block.
  assert.equal(
    slurpAllowsUnsolicitedText([opener(), deskQuietViewer()]),
    false,
    "a deskQuiet viewer note is not a reply",
  );

  // Rows carrying only `followUpType` (every opener/check-in/recurring send before and after this
  // feature shipped) are classified correctly without needing the newer `unsolicited` marker.
  assert.equal(isUnsolicitedCreatorMessage(opener()), true, "a followUpType=opener message counts");
  assert.equal(isUnsolicitedCreatorMessage(checkIn()), true, "a followUpType=check_in message counts");
  assert.equal(isUnsolicitedCreatorMessage(recurring()), true, "a followUpType=recurring message counts");
  assert.equal(
    isUnsolicitedCreatorMessage(cannedOpener()),
    true,
    "the canned opener's own `unsolicited` marker counts",
  );
  assert.equal(
    isUnsolicitedCreatorMessage(unmarkedCreatorRow()),
    false,
    "a fully unmarked row cannot be told apart from a reply",
  );
  // ...but it is still not treated as a reply: with only an unmarked row in the window, and no real
  // viewer reply anywhere, the gate still blocks (same "ambiguous window" fallback as above).
  assert.equal(
    slurpAllowsUnsolicitedText([unmarkedCreatorRow()]),
    false,
    "a window containing only an unmarked creator row, with no real reply, still blocks",
  );

  // Wiring: the setting exists, defaults off, and the scheduler + storage tx both call the gate.
  const settingsSource = slurp2Source(
    "packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts",
  );
  assert.match(settingsSource, /messagesPauseFollowUpsUntilReply: z\.boolean\(\)/u, "the setting is declared");
  assert.match(settingsSource, /messagesPauseFollowUpsUntilReply: false/u, "the setting defaults off");

  const schedulerSource = slurp2Source(
    "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-follow-up-scheduler.service.ts",
  );
  assert.match(
    schedulerSource,
    /getSettings\(\)\)\.messagesPauseFollowUpsUntilReply[\s\S]{0,80}slurpAllowsUnsolicitedText\(history\)/u,
    "the scheduler checks the gate, against a freshly read setting, before generating",
  );
  // Anchor to this feature's own branch, not the pre-existing per-creator `proactiveMessages`
  // cancel a few lines above it, which already calls `cancelScheduledFollowUp` on its own condition.
  assert.match(
    schedulerSource,
    /slurpAllowsUnsolicitedText\(history\)\s*\)\s*\{\s*await messages\.cancelScheduledFollowUp\(threadRow\.id, followUp\.id\);/u,
    "a follow-up blocked by this gate is cancelled, not postponed",
  );

  const checkInSource = slurp2Source(
    new URL(
      "../packages/slurp2/src/engine/packages/server/src/slp/features/world/slp-creator-check-in.ts",
      import.meta.url,
    ),
  );
  assert.match(
    checkInSource,
    /pauseUntilReply[\s\S]{0,40}slurpAllowsUnsolicitedText\(await input\.messages\.listMessages/u,
    "the check-in planner itself checks the gate before scheduling",
  );

  const storageSource = slurp2Source(
    "packages/slurp2/src/engine/packages/server/src/services/storage/slurp-messages.storage.ts",
  );
  assert.match(
    storageSource,
    /slurpAllowsUnsolicitedText\(recentRows\.map\(mapMessage\)\.reverse\(\)\)/u,
    "appendMessage re-checks the gate inside its own transaction",
  );

  console.log("slurp2 pause-follow-ups-until-reply regression: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
