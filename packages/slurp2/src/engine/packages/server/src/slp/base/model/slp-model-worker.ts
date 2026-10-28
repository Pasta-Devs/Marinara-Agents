import { eq } from "../../../db/file-query.js";
import type { DB } from "../../../db/connection.js";
import { slpAccounts } from "../../../db/schema/slurp.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import {
  readSlurpModelBudgetLedger,
  resolveSlurpModelBudget,
  slurpModelBudgetRetryAt,
  SLURP_UPKEEP_JOB_KINDS,
  spendSlurpModelBudget,
  type SlurpModelBudget,
  type SlurpModelBudgetLedger,
  type SlurpModelJobKind,
} from "../../../../../shared/src/slp/slp-model-budget.js";

export * from "../../../../../shared/src/slp/slp-model-budget.js";

const LEDGER_KEY = "slurp2.model-budget-ledger";
let claimQueue: Promise<unknown> = Promise.resolve();

/**
 * Creators the world posts for: Slurp accounts with automatic posting on, never a persona's own actor
 * account. The budget's untouched limits grow with this number (task F).
 */
export async function countSlurpActiveCreators(db: DB): Promise<number> {
  // Every `getSettings()` asks for this, and it parses every account row: the feed paid for it several
  // times per Creator per request. Cached until the accounts table is written again (0.3.6).
  const store = (db as { _fileStore?: { getTableWriteGeneration?: (table: string) => number } })._fileStore;
  const generation = store?.getTableWriteGeneration?.("slurp2_accounts");
  const cached = store ? activeCreatorsCache.get(store) : undefined;
  if (generation !== undefined && cached?.generation === generation) return cached.count;
  const rows = await db.select().from(slpAccounts).where(eq(slpAccounts.platform, "slurp"));
  const count = rows.filter((row) => {
    if (row.kind === "persona" && (row.sourceKind ?? row.kind) === "persona") return false;
    try {
      const settings = typeof row.settings === "string" ? JSON.parse(row.settings) : row.settings;
      return settings?.scheduler?.autoPosting?.enabled === true;
    } catch {
      return false;
    }
  }).length;
  if (store && generation !== undefined) activeCreatorsCache.set(store, { generation, count });
  return count;
}

const activeCreatorsCache = new WeakMap<object, { generation: number; count: number }>();

/** The saved budget sized for today's Creators. Every claim goes through this, so callers pass the saved one. */
export async function slurpEffectiveModelBudget(db: DB, budget: SlurpModelBudget): Promise<SlurpModelBudget> {
  return resolveSlurpModelBudget(budget, await countSlurpActiveCreators(db));
}

/** Reserve one call before it starts. Serialized in-process and persisted across restarts. */
export function claimSlurpModelBudget(
  db: DB,
  budget: SlurpModelBudget,
  kind: SlurpModelJobKind,
  at = new Date(),
  /** False when the player asked for this upkeep job now ("Rewrite all pending"): the day's caps still hold. */
  paced = SLURP_UPKEEP_JOB_KINDS.has(kind),
): Promise<boolean> {
  let allowed = false;
  const run = claimQueue.then(async () => {
    budget = await slurpEffectiveModelBudget(db, budget);
    const store = createAppSettingsStorage(db);
    const current = readSlurpModelBudgetLedger(await store.get(LEDGER_KEY), at);
    // Upkeep kinds follow the day's pace; a player's request never does (fix phase 1b, R1-106).
    const next = spendSlurpModelBudget(budget, current, kind, paced ? at : undefined);
    if (!next) return;
    await store.set(LEDGER_KEY, JSON.stringify(next));
    allowed = true;
  });
  claimQueue = run.catch(() => undefined);
  return run.then(() => allowed);
}

/**
 * For world work of a kind a player can also ask for (written audience replies, storylines the world
 * starts): whether the world's share is still inside the day's pace. Checked before the claim.
 */
export async function slurpModelBudgetPaceOpen(
  db: DB,
  budget: SlurpModelBudget,
  kind: SlurpModelJobKind,
  at = new Date(),
): Promise<boolean> {
  const effective = await slurpEffectiveModelBudget(db, budget);
  return spendSlurpModelBudget(effective, await getSlurpModelBudgetLedger(db, at), kind, at) !== null;
}

export async function getSlurpModelBudgetLedger(db: DB, at = new Date()): Promise<SlurpModelBudgetLedger> {
  return readSlurpModelBudgetLedger(await createAppSettingsStorage(db).get(LEDGER_KEY), at);
}

/** When a refused claim may try again, against the budget sized for today's Creators. */
export async function slurpModelBudgetRetryAtNow(
  db: DB,
  budget: SlurpModelBudget,
  kind: SlurpModelJobKind,
): Promise<string | null> {
  return slurpModelBudgetRetryAt(
    await slurpEffectiveModelBudget(db, budget),
    await getSlurpModelBudgetLedger(db),
    kind,
  );
}
