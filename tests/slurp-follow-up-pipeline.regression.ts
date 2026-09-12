import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const scheduler = read(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-follow-up-scheduler.service.ts",
);

// 2.3 — a follow-up obeys cool-off, night quiet and the offline schedule instead of sending.
assert.match(scheduler, /const coolingOff = Boolean\(thread\.coolUntil/u);
assert.match(scheduler, /resolveSlurpCreatorAvailability\(/u);
assert.match(
  scheduler,
  /if \(coolingOff \|\| quiet \|\| !availability\.online\) \{[\s\S]{0,900}?postponeScheduledFollowUp\([\s\S]{0,600}?continue;/u,
  "a silenced follow-up must be postponed, not sent",
);
assert.doesNotMatch(scheduler, /coolingOff: false/u, "the follow-up must pass the real cool-off state");

// 2.4 — the follow-up reply applies the same outcome as a normal reply.
assert.match(scheduler, /recordCreatorStateSignals\(threadRow\.creatorAccountId, reply\.stateSignals\)/u);
assert.match(scheduler, /applyFollowUpBoundary\(messages, threadRow\.id, reply\.latitude\)/u);

// 2.2 — the thread route and the client type both carry the scheduled follow-ups the UI renders.
for (const route of [
  "packages/slurp2/src/engine/packages/server/src/routes/slurp-messages.routes.ts",
]) {
  assert.match(read(route), /scheduledFollowUps: thread\.scheduledFollowUps/u, route);
}
assert.match(
  read("packages/slurp2/src/engine/packages/client/src/hooks/use-slurp.ts"),
  /scheduledFollowUps: Array<\{/u,
  "SlurpThreadRelationship must declare scheduledFollowUps",
);

console.log("slurp follow-up pipeline regression: ok");
