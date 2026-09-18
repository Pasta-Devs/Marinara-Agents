import assert from "node:assert/strict";
import { join } from "node:path";

import {
  readSlurpModelBudgetLedger,
  slurpModelBudgetRetryAt,
  slurpModelBudgetSchema,
  slurpModelWorkerAllows,
  spendSlurpModelBudget,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/model/slp-model-budget.js";
import { slurp2Source } from "./slurp2-source";
const fanActivityOperation = slurp2Source(
  join(
    import.meta.dirname,
    "..",
    "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-fan-activity.operation.ts",
  ),
);

const at = new Date("2026-09-14T12:30:00.000Z");
const budget = slurpModelBudgetSchema.parse({ callsPerHour: 2, callsPerDay: 3, jobs: { rewrite: { maxPerDay: 1 } } });
assert.match(
  fanActivityOperation,
  /Math\.min\(settings\.fanActivityRunsPerDay, settings\.modelBudget\.jobs\.thread\.maxPerDay\)/u,
  "fan activity uses the lower configured and thread model limits",
);
assert.match(fanActivityOperation, /noodlerFanActivityRunLimit\(settings\),/gu);
assert.equal(
  [...fanActivityOperation.matchAll(/noodlerFanActivityRunLimit\(settings\),/gu)].length,
  2,
  "plan reconciliation and status use the same authoritative limit",
);
const empty = readSlurpModelBudgetLedger(null, at);
const first = spendSlurpModelBudget(budget, empty, "rewrite");
assert.ok(first);
assert.equal(spendSlurpModelBudget(budget, first!, "rewrite"), null, "per-kind daily caps are hard caps");
const second = spendSlurpModelBudget(budget, first!, "brief");
assert.ok(second);
assert.equal(spendSlurpModelBudget(budget, second!, "brief"), null, "hourly caps are hard caps");
assert.equal(readSlurpModelBudgetLedger(JSON.stringify(second), new Date("2026-09-14T13:01:00.000Z")).callsThisHour, 0);
assert.equal(readSlurpModelBudgetLedger(JSON.stringify(second), new Date("2026-09-15T00:01:00.000Z")).callsToday, 0);
assert.equal(slurpModelWorkerAllows({ ...budget, mode: "present" }, "background"), false);
assert.equal(slurpModelWorkerAllows({ ...budget, mode: "background" }, "background"), true);
assert.equal(slurpModelWorkerAllows({ ...budget, mode: "off" }, "present"), false);
assert.equal(
  slurpModelBudgetRetryAt(budget, second!, "brief", at),
  "2026-09-14T13:00:00.000Z",
  "an hourly cap defers work to the next UTC hour instead of raising a provider error",
);
assert.equal(
  slurpModelBudgetRetryAt({ ...budget, callsPerHour: 0 }, empty, "brief", at),
  null,
  "a disabled budget waits for a settings change rather than scheduling a hot retry loop",
);

const root = join(import.meta.dirname, "..", "packages", "slurp2", "src", "engine", "packages", "server", "src");
const schema = slurp2Source(join(root, "db/schema/slurp.ts"));
const pending = slurp2Source(join(root, "services/slurp/slurp-pending-text.service.ts"));
const scheduler = slurp2Source(join(root, "services/slurp/slurp-world-scheduler.service.ts"));
const messages = slurp2Source(join(root, "services/slurp/slurp-message.operation.ts"));
const followUps = slurp2Source(join(root, "services/slurp/slurp-follow-up-scheduler.service.ts"));
assert.match(pending, /modelBudget\.jobs/u, "queued jobs read the live per-kind policy");
assert.match(pending, /\.sort\(/u, "queued jobs are ordered before the drain limit");
assert.match(schema, /export const slurpModelJobs = slurpPendingText/u, "existing rewrite jobs migrate in place");
assert.match(schema, /jobKind: text\("job_kind"\)/u);
assert.match(schema, /attempts: text\("attempts"\)/u);
assert.match(pending, /claimSlurpModelBudget/u);
assert.match(pending, /JOB_MAX_ATTEMPTS/u);
assert.match(scheduler, /topUpSlurpReactionBank\(app\.db\)/u);
assert.match(messages, /error instanceof SlurpMessageBudgetUnavailableError/u);
assert.match(messages, /return \{ status: "queued", pacing \}/u);
// `messagesAwayRepliesEnabled` is the permission for an unattended reply, so queued replies must
// not also require the global background-worker switch.
assert.match(messages, /workerContext: "present"/u);
assert.match(followUps, /postponeScheduledFollowUp/u);

console.log("slurp2 model worker regression passed");
