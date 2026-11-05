/** Support's extras offers (`shared/src/slp/slp-extras-offer.ts`) in one of Slurp's own app settings. */
import type { DB } from "../../../db/connection.js";
import { createAppSettingsStorage } from "../../../services/storage/app-settings.storage.js";
import {
  slpExtrasOfferAnswered,
  slpExtrasOfferNow,
  slpExtrasReached,
  type SlpExtrasOffer,
  type SlpExtrasOfferId,
  type SlpExtrasOfferState,
  type SlpExtrasTrigger,
} from "../../../../../shared/src/slp/slp-extras-offer.js";
import { createSlurpStorage } from "../slp-storage.js";
import { slurpPausedNow } from "./slp-pause-storage.js";

const KEY = "slurp2.extrasOffer";

// ponytail: an in-process queue like the trends; two Engine processes writing at once could lose one change.
let queue: Promise<unknown> = Promise.resolve();

function mutate<T>(
  db: DB,
  change: (state: SlpExtrasOfferState) => Promise<{ state: SlpExtrasOfferState | null; result: T }>,
) {
  const run = queue.then(async () => {
    const storage = createAppSettingsStorage(db);
    let state: SlpExtrasOfferState = {};
    try {
      const raw = await storage.get(KEY);
      if (raw) state = JSON.parse(raw) as SlpExtrasOfferState;
    } catch {
      // A broken record starts over: at worst Support offers again.
    }
    const next = await change(state);
    if (next.state) await storage.set(KEY, JSON.stringify(next.state));
    return next.result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function readSlurpExtrasOffer(db: DB): Promise<SlpExtrasOffer | null> {
  return mutate(db, async (state) => {
    const paused = await slurpPausedNow(db);
    const now = slpExtrasOfferNow(state, await createSlurpStorage(db).getSettings(), new Date(), paused);
    return { state: now.changed ? now.state : null, result: now.offer };
  });
}

export function answerSlurpExtrasOffer(db: DB, id: SlpExtrasOfferId, add: boolean): Promise<boolean> {
  return mutate(db, async (state) => {
    const next = slpExtrasOfferAnswered(state, id, add);
    return { state: next, result: next !== null };
  });
}

/** Fire and forget from the trigger sites: an offer is never worth failing a post or an unlock. */
export function markSlurpExtrasReached(db: DB, trigger: SlpExtrasTrigger): void {
  void mutate(db, async (state) => ({ state: slpExtrasReached(state, trigger), result: null })).catch(() => undefined);
}
