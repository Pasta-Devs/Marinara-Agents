/**
 * The trends (`docs/TRENDS.md`) in one of Slurp's own app settings: a handful of small records that the
 * planner reads on every post and the world tick changes. Every change goes through `mutateSlurpTrends`.
 */
import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import { pruneSlurpTrends, readSlurpTrends, type SlurpTrend } from "../../modules/discovery/slp-trends.js";

export const SLURP_TRENDS_KEY = "slurp2.trends";

// ponytail: an in-process queue like the ties document; two Engine processes writing at once could lose
// one change, and the world tick holds a database lease.
let queue: Promise<unknown> = Promise.resolve();

export async function readSlurpTrendList(db: DB): Promise<SlurpTrend[]> {
  const raw = await createAppSettingsStorage(db).get(SLURP_TRENDS_KEY);
  try {
    return readSlurpTrends(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

/** Read, change, write, one at a time. `change` returning null writes nothing. */
export function mutateSlurpTrends<T>(
  db: DB,
  at: Date,
  change: (trends: SlurpTrend[]) => { trends: SlurpTrend[]; result: T } | null,
): Promise<T | null> {
  const run = queue.then(async () => {
    const next = change(await readSlurpTrendList(db));
    if (!next) return null;
    await createAppSettingsStorage(db).set(
      SLURP_TRENDS_KEY,
      JSON.stringify(
        // Real clock for the prune, never later than the world date: a restore to an earlier date must not prune a fresh trend.
        pruneSlurpTrends(next.trends, new Date(Math.min(Date.now(), at.getTime()))),
      ),
    );
    return next.result;
  });
  queue = run.catch(() => undefined);
  return run;
}
