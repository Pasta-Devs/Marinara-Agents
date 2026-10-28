/** Task F: the AI budget is sized per active Creator, old custom limits stay, and Settings says what it means. */
import assert from "node:assert/strict";
import {
  resolveSlurpModelBudget,
  setSlurpModelBudgetLimit,
  SLURP_MODEL_JOB_KINDS,
  slurpModelBudgetOutlook,
  slurpModelBudgetSchema,
  spendSlurpModelBudget,
  readSlurpModelBudgetLedger,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget.ts";
import { slurp2Source } from "./slurp2-source.ts";

const root = "packages/slurp2/src/engine/packages";
const source = (side: "client" | "server" | "shared", path: string) => slurp2Source(`${root}/${side}/src/slp/${path}`);
const fresh = slurpModelBudgetSchema.parse({});

// Scaling: SIM-REPORT "Budget sizing" table (3 / 8 / 15 active Creators).
for (const [creators, perHour, perDay, dm, thread, rewrite, bank, continuity, brief] of [
  [0, 6, 40, 15, 8, 3, 5, 4, 2],
  [3, 9, 58, 21, 10, 7, 7, 6, 3],
  [8, 14, 88, 31, 13, 13, 10, 9, 4],
  [15, 21, 130, 45, 17, 22, 14, 13, 6],
] as const) {
  const sized = resolveSlurpModelBudget(fresh, creators);
  assert.equal(sized.callsPerHour, perHour, `callsPerHour at ${creators}`);
  assert.equal(sized.callsPerDay, perDay, `callsPerDay at ${creators}`);
  assert.equal(sized.jobs.dm_reply.maxPerDay, dm);
  assert.equal(sized.jobs.thread.maxPerDay, thread);
  assert.equal(sized.jobs.rewrite.maxPerDay, rewrite);
  assert.equal(sized.jobs.bank_grow.maxPerDay, bank);
  assert.equal(sized.jobs.continuity.maxPerDay, continuity);
  assert.equal(sized.jobs.brief.maxPerDay, brief);
  assert.equal(sized.jobs.assist.maxPerDay, 40, "writing help stays flat");
  assert.equal(sized.jobs.fan_type_voice.maxPerDay, 10);
  assert.ok(sized.jobs.image_prompt.maxPerDay >= 60, "never below the shipped 60");
  // The world's own rows fit inside its 75 % share of the day, so replies keep their reserve.
  const world =
    sized.jobs.thread.maxPerDay +
    sized.jobs.rewrite.maxPerDay +
    sized.jobs.bank_grow.maxPerDay +
    sized.jobs.continuity.maxPerDay +
    sized.jobs.brief.maxPerDay;
  if (creators > 0) assert.ok(world <= perDay - Math.floor(perDay / 4), `world rows fit at ${creators}`);
}
// Caps hold at the top end; a new schema default is the no-Creator sizing.
assert.equal(resolveSlurpModelBudget(fresh, 1000).callsPerHour, 100);
assert.equal(resolveSlurpModelBudget(fresh, 1000).callsPerDay, 500);
assert.deepEqual(fresh.customLimits, []);
assert.equal(fresh.raisedNotice, false);

// The sized budget is what the claim spends against: 8 Creators let 66 world calls through, not the old 15.
{
  const sized = resolveSlurpModelBudget(fresh, 8);
  let ledger = readSlurpModelBudgetLedger(null, new Date("2026-09-28T12:00:00Z"));
  let spent = 0;
  for (const kind of ["thread", "rewrite", "bank_grow", "continuity", "brief"] as const)
    for (let i = 0; i < 40; i++) {
      const next = spendSlurpModelBudget({ ...sized, callsPerHour: 100 }, ledger, kind);
      if (!next) break;
      ledger = next;
      spent++;
    }
  assert.equal(spent, 49, "every world row reaches its own sized limit inside the day cap");
}

// Setting a limit by hand makes it the player's: it no longer moves with the Creator count.
{
  const own = setSlurpModelBudgetLimit(fresh, "callsPerDay", 25);
  const withRow = setSlurpModelBudgetLimit(own, "thread", 3);
  assert.deepEqual(withRow.customLimits, ["callsPerDay", "thread"]);
  const sized = resolveSlurpModelBudget(withRow, 15);
  assert.equal(sized.callsPerDay, 25);
  assert.equal(sized.jobs.thread.maxPerDay, 3);
  assert.equal(sized.callsPerHour, 21, "the untouched hourly cap still grows");
  // "Use recommended limits" clears the list and everything is sized again.
  assert.equal(resolveSlurpModelBudget({ ...withRow, customLimits: [] }, 15).callsPerDay, 130);
  // Saved and read back, the choice survives.
  assert.deepEqual(
    slurpModelBudgetSchema.parse(JSON.parse(JSON.stringify(withRow))).customLimits,
    withRow.customLimits,
  );
}

// Migration: a budget saved before task F keeps only the limits that differ from the old fixed defaults.
{
  const untouched = slurpModelBudgetSchema.parse({
    mode: "present",
    connectionId: null,
    callsPerHour: 4,
    callsPerDay: 20,
    jobs: {
      dm_reply: { enabled: true, priority: 1, maxPerDay: 40 },
      thread: { enabled: false, priority: 9, maxPerDay: 8 },
    },
  });
  assert.deepEqual(untouched.customLimits, [], "old defaults move; priority and switches are not limits");
  assert.equal(untouched.raisedNotice, true, "an updated player gets the one-time note");
  assert.equal(untouched.jobs.thread.enabled, false, "a switched-off row stays off");
  assert.equal(untouched.jobs.thread.priority, 9);
  assert.equal(resolveSlurpModelBudget(untouched, 8).callsPerDay, 88);

  const custom = slurpModelBudgetSchema.parse({
    mode: "background",
    callsPerHour: 4,
    callsPerDay: 60,
    jobs: {
      continuity: { enabled: true, priority: 8, maxPerDay: 0 },
      assist: { enabled: true, priority: 2, maxPerDay: 100 },
    },
  });
  assert.deepEqual(custom.customLimits, ["callsPerDay", "continuity", "assist"]);
  const sized = resolveSlurpModelBudget(custom, 8);
  assert.equal(sized.callsPerDay, 60, "a raised custom cap stays");
  assert.equal(sized.jobs.continuity.maxPerDay, 0, "a row turned down to 0 stays at 0");
  assert.equal(sized.jobs.assist.maxPerDay, 100);
  assert.equal(sized.callsPerHour, 14, "the untouched hourly cap moves");
  assert.equal(sized.mode, "background");

  // Once saved with the list, it is never migrated again (the note clears for good).
  const saved = slurpModelBudgetSchema.parse({ ...JSON.parse(JSON.stringify(custom)), raisedNotice: false });
  assert.equal(saved.raisedNotice, false);
  assert.deepEqual(saved.customLimits, custom.customLimits);
  // A kind added later (Stir's "plan" row) has no sizing entry and keeps its own default.
  for (const kind of SLURP_MODEL_JOB_KINDS) assert.ok(sized.jobs[kind].maxPerDay >= 0);
}

// Copy numbers: the plain-words summary for 8 Creators and 4 posts a day.
{
  const outlook = slurpModelBudgetOutlook(resolveSlurpModelBudget(fresh, 8), 4);
  assert.deepEqual(outlook, {
    posts: 4,
    creatorMessages: 31,
    threads: 13,
    fanMessages: 13,
    textCalls: 96,
    pictures: 4,
    tokens: 288_000,
  });
  const off = slurpModelBudgetOutlook({ ...resolveSlurpModelBudget(fresh, 8), mode: "off" }, 4);
  assert.equal(off.creatorMessages + off.threads + off.fanMessages, 0);
  assert.equal(off.textCalls, 8, "posts still write their text and picture prompt");
}

// Wiring: every claim sizes the budget; the usage route reports the Creator count; Settings and Pulse say it.
{
  const worker = source("server", "base/model/slp-model-worker.ts");
  assert.match(worker, /budget = await slurpEffectiveModelBudget\(db, budget\)/u);
  assert.match(worker, /autoPosting\?\.enabled === true/u);
  assert.match(
    source("server", "features/settings/slp-settings-routes.ts"),
    /activeCreators: await countSlurpActiveCreators/u,
  );
  assert.match(
    source("server", "features/audience/slp-fan-activity-operation.ts"),
    /slurpEffectiveModelBudget\(input\.db/u,
  );
  const panel = source("client", "features/audience/SlpAudienceConfigPanel.tsx");
  assert.match(panel, /aiBudget\.outlook\.title/u);
  assert.match(panel, /aiBudget\.outlook\.cost/u);
  assert.match(panel, /aiBudget\.useRecommended/u);
  assert.match(panel, /setSlurpModelBudgetLimit\(budget, limit, value\)/u, "edits save on the player's own budget");
  const pulse = source("client", "modules/chrome/SlpPulse.tsx");
  assert.match(pulse, /pulse\.budgetNote\.title/u);
  assert.match(source("client", "app/SlpHomeHost.tsx"), /raisedNotice: false/u);
}

// 0.3.6: every `getSettings()` counts active Creators; the count is cached per accounts write generation.
{
  const worker = source("server", "base/model/slp-model-worker.ts");
  assert.match(worker, /getTableWriteGeneration\?\.\("slurp2_accounts"\)/u);
  assert.match(worker, /if \(generation !== undefined && cached\?\.generation === generation\) return cached\.count;/u);
}

console.log("slurp2 budget sizing regression passed");
