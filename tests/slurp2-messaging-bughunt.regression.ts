import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createScheduledFollowUps,
  detectPromiseFromText,
  parseTimingToMinutes,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-follow-up";

const slp = new URL("../packages/slurp2/src/engine/packages/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, slp), "utf8");
const server = (path: string) => read(`server/src/slp/${path}`);
const client = (path: string) => read(`client/src/slp/${path}`);

// Follow-up timing and promise detection.
assert.equal(parseTimingToMinutes("1.5 hours"), 90);
assert.equal(parseTimingToMinutes("2 days"), 2880);
assert.equal(parseTimingToMinutes("1 week"), 10080);
assert.equal(parseTimingToMinutes("30 minutes"), 30);
assert.equal(detectPromiseFromText("just finishing my coffee lol"), null);
assert.equal(detectPromiseFromText("I’ll send you the set tonight")?.type, "promise_delivery");
assert.equal(detectPromiseFromText("still finishing your sketch")?.type, "task_update");
const burst = [
  ...createScheduledFollowUps({ type: "reminder", timing: "1 hour", reason: "a" }),
  ...createScheduledFollowUps({ type: "reminder", timing: "1 hour", reason: "b" }),
];
assert.equal(new Set(burst.map((followUp) => followUp.id)).size, burst.length, "follow-up ids must not collide");

// Money: a fresh charged payment is not compensated, and a compensated one is never settled again.
assert.match(
  server("data/messages/slp-messages-storage-base.ts"),
  /row\.status === "charged" && Date\.parse\(String\(row\.updatedAt\)\) > Date\.now\(\) - 5 \* 60 \* 1000\) continue/u,
);
assert.match(
  server("data/messages/slp-messages-storage-context.ts"),
  /status: "settled"[\s\S]{0,400}inArray\(slurpPaymentCompensations\.status, \["created", "charging", "charged", "settled"\]\)/u,
);
const commissions = server("data/messages/slp-messages-storage-commissions.ts");
assert.match(commissions, /const \{ walletEnabled \} = await slurp\.getSettings\(\);\s*if \(walletEnabled\) \{/u);
assert.match(commissions, /`commission:\$\{id\}:accept`,\s*\);\s*\/\/ Compensated[\s\S]{0,200}state: "declined"/u);
assert.match(
  server("data/messages/slp-messages-storage-base.ts"),
  /creator\.sourceEntityId === viewerAccountId\)\s*return \{ status: "not_found" \}/u,
);

// Follow-ups run with default budget settings.
assert.match(server("features/messages/slp-follow-up-scheduler-service.ts"), /workerContext: "present"/u);

// Every fan-facing reply is masked, and a repeated unlock does not react twice.
const send = server("features/messages/slp-messages-send-routes.ts");
assert.doesNotMatch(send, /reply: outcome\.status === "replied" \? outcome\.message : null/u);
assert.doesNotMatch(send, /reply: outcome\.message,/u);
assert.match(send, /alreadyUnlocked \? null : await messages\.getThreadById/u);

// Draft-reply may answer for a hand-operated Creator.
assert.match(server("features/messages/slp-messages-creator-routes.ts"), /operatorDraft: true/u);

// Client: one thread view per conversation, IME-safe Enter, request id tied to its text.
assert.match(client("features/messages/SlpMessages.tsx"), /<SlurpThreadView\s+\/\/[\s\S]{0,300}key=\{/u);
assert.match(client("features/messages/SlpThreadComposer.tsx"), /!event\.nativeEvent\.isComposing/u);
const actions = client("features/messages/slp-thread-actions.ts");
assert.match(actions, /sendRequest\?\.content === content \? sendRequest\.id : newRequestId\(\)/u);
assert.doesNotMatch(actions, /requestId: crypto\.randomUUID\(\)/u);

console.log("slurp2 messaging bughunt regressions passed");
