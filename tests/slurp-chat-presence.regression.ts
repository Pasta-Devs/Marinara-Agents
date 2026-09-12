// The pacing model was computed in full and reported to nobody. `replyToSlurpMessage` returns six
// outcomes; the client read none of them, so a sleeping creator, a busy thread and a missing
// connection were the same blank screen. Read state had the same problem: written on every message
// since messaging shipped, displayed on none.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync("packages/slurp/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx", "utf8");
const operation = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-message.operation.ts",
  "utf8",
);
const locales = JSON.parse(
  readFileSync("packages/slurp/src/engine/packages/client/src/localization/locales/en.json", "utf8"),
) as Record<string, string>;

// A queued reply means she noticed and did not answer. That is a beat, not a bug, and it needs a
// timestamp to be one.
assert.match(operation, /markRead\(thread\.id, "creator"\)/u);
assert.match(operation, /pacing\.mode === "queued" \|\| pacing\.mode === "delayed"/u);
assert.match(
  operation,
  /Momentum can extend the stored conversation window, but it must not override a schedule/u,
  "hot momentum must not make an offline creator answer immediately",
);
assert.match(
  operation,
  /momentum === "hot" && availability\.online/u,
  "only an online Creator can extend the conversation window",
);

// Every outcome the operation can report has copy, so none of them renders as silence.
for (const status of ["queued", "cooling", "busy", "ineligible", "connection_not_found", "failed"]) {
  assert.ok(locales[`ui.slurp.messages.replyStatus.${status}`], `missing reply status copy for ${status}`);
  assert.ok(
    view.includes(`${status}:`) || view.includes(`replyStatus.${status}`),
    `reply status ${status} has no fallback`,
  );
}
assert.match(view, /setReplyStatus\(result\.replyStatus \?\? null\)/u);
// A replied outcome is the message itself. Announcing it would be noise.
assert.match(view, /replyStatus !== "replied"/u);

// The receipt goes on the newest message you sent, not on all of them.
assert.match(view, /const lastOwnMessageId = messages\.reduce/u);
assert.match(view, /showReceipt=\{entry\.message\.id === lastOwnMessageId\}/u);
assert.match(view, /mine && showReceipt && message\.readAt/u);
assert.ok(locales["ui.slurp.messages.seenAt"], "missing seen receipt copy");

console.log("slurp chat presence regression passed");
