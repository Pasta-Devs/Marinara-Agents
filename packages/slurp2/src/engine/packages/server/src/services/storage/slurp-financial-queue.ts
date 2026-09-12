import type { DB } from "../../db/connection.js";

const financialQueues = new WeakMap<object, Promise<unknown>>();

export function enqueueSlurpFinancial<T>(db: DB, operation: () => Promise<T>): Promise<T> {
  const previous = financialQueues.get(db) ?? Promise.resolve();
  const run = previous.then(operation);
  financialQueues.set(
    db,
    run.catch(() => undefined),
  );
  return run;
}
