import type { DB } from "../../../db/connection.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { slurpActivePlatformEvents } from "../../../../../shared/src/slp/slp-platform-events.js";
import { listSlurpContinuityForEditor } from "../../data/continuity/slp-continuity-storage.js";
import { listSlurpOpportunities } from "../../data/feed/slp-opportunity-storage.js";
import { listSlurpOtherCreatorSubjects } from "../../data/feed/slp-feed-subjects-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import {
  resolveSlurpCreatorScheduleBlocks,
  slurpTimelineMoment,
} from "../../modules/creators/slp-creator-schedule-context.js";
import {
  slurpOrderSignals,
  slurpSignalFromEvent,
  slurpSignalFromFact,
  slurpSignalFromOtherCreator,
  slurpSignalFromPost,
  slurpSignalFromPromise,
  slurpSignalFromSchedule,
  slurpSignalFromWorldEvent,
  type SlurpSignal,
} from "../../modules/continuity/slp-signals.js";

const SIGNAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const SIGNAL_LIMIT = 100;

/**
 * Everything around one Creator in the last two weeks, as signals, newest first. Read-only and
 * best effort per source: a source that fails to read is left out, never the whole list.
 */
export async function listSlurpSignals(db: DB, creatorId: string, at = new Date()): Promise<SlurpSignal[] | null> {
  const storage = createSlurpStorage(db);
  const account = await storage.getNoodlerAccountById(creatorId);
  if (!account) return null;
  const safe = <T>(read: Promise<T>, fallback: T) => read.catch(() => fallback);
  const source = await safe(storage.resolveAccountSource(account), null);
  const [posts, continuity, plans, settings, others, day] = await Promise.all([
    safe(storage.listNoodlerPostsByAccount(creatorId, 30), []),
    safe(listSlurpContinuityForEditor(db, creatorId, at), { facts: [], events: [], proposals: [] }),
    safe(listSlurpOpportunities(db, creatorId, 40), []),
    safe(storage.getSettings(), null),
    listSlurpOtherCreatorSubjects(db, creatorId, at),
    source ? safe(resolveSlurpCreatorScheduleBlocks(createCharactersStorage(db), source, at), null) : null,
  ]);
  const moment = day ? slurpTimelineMoment(day.blocks, day.localNow) : null;
  return slurpOrderSignals(
    [
      ...posts.map(slurpSignalFromPost),
      ...continuity.facts.map(slurpSignalFromFact),
      ...continuity.events.map(slurpSignalFromEvent),
      ...plans.filter((plan) => plan.sourceEventId).map((plan) => slurpSignalFromPromise(creatorId, plan)),
      ...(settings ? slurpActivePlatformEvents(settings.platformEvents, at) : []).map((event) =>
        slurpSignalFromWorldEvent(event, at),
      ),
      ...others.map((title, index) => slurpSignalFromOtherCreator(title, index, at)),
      ...(moment ? [slurpSignalFromSchedule(creatorId, moment, at)] : []),
    ],
    { since: new Date(at.getTime() - SIGNAL_WINDOW_MS), limit: SIGNAL_LIMIT },
  );
}
