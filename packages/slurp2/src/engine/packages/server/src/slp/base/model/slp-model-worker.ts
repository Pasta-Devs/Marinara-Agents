import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import {
  readSlurpModelBudgetLedger,
  spendSlurpModelBudget,
  type SlurpModelBudget,
  type SlurpModelBudgetLedger,
  type SlurpModelJobKind,
} from "./slp-model-budget.js";

export * from "./slp-model-budget.js";

const LEDGER_KEY = "slurp2.model-budget-ledger";
let claimQueue: Promise<unknown> = Promise.resolve();

/** Reserve one call before it starts. Serialized in-process and persisted across restarts. */
export function claimSlurpModelBudget(
  db: DB,
  budget: SlurpModelBudget,
  kind: SlurpModelJobKind,
  at = new Date(),
): Promise<boolean> {
  let allowed = false;
  const run = claimQueue.then(async () => {
    const store = createAppSettingsStorage(db);
    const current = readSlurpModelBudgetLedger(await store.get(LEDGER_KEY), at);
    const next = spendSlurpModelBudget(budget, current, kind);
    if (!next) return;
    await store.set(LEDGER_KEY, JSON.stringify(next));
    allowed = true;
  });
  claimQueue = run.catch(() => undefined);
  return run.then(() => allowed);
}

export async function getSlurpModelBudgetLedger(db: DB, at = new Date()): Promise<SlurpModelBudgetLedger> {
  return readSlurpModelBudgetLedger(await createAppSettingsStorage(db).get(LEDGER_KEY), at);
}
