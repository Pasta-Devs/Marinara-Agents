import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  readSlurpModelBudgetLedger,
  slurpModelBudgetSchema,
  slurpModelWorkerAllows,
  spendSlurpModelBudget,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-model-budget.js";

const at = new Date("2026-09-14T12:30:00.000Z");
const budget = slurpModelBudgetSchema.parse({ callsPerHour: 2, callsPerDay: 3, jobs: { rewrite: { maxPerDay: 1 } } });
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

const root = join(import.meta.dirname, "..", "packages", "slurp2", "src", "engine", "packages", "server", "src");
const schema = readFileSync(join(root, "db/schema/slurp.ts"), "utf8");
const pending = readFileSync(join(root, "services/slurp/slurp-pending-text.service.ts"), "utf8");
const scheduler = readFileSync(join(root, "services/slurp/slurp-world-scheduler.service.ts"), "utf8");
assert.match(pending, /modelBudget\.jobs/u, "queued jobs read the live per-kind policy");
assert.match(pending, /\.sort\(/u, "queued jobs are ordered before the drain limit");
assert.match(schema, /export const slurpModelJobs = slurpPendingText/u, "existing rewrite jobs migrate in place");
assert.match(schema, /jobKind: text\("job_kind"\)/u);
assert.match(schema, /attempts: text\("attempts"\)/u);
assert.match(pending, /claimSlurpModelBudget/u);
assert.match(pending, /JOB_MAX_ATTEMPTS/u);
assert.match(scheduler, /topUpSlurpReactionBank\(app\.db\)/u);

console.log("slurp2 model worker regression passed");
