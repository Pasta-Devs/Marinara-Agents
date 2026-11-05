import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { slpLiveSummaryText } from "../../../../../shared/src/slp/slp-live.js";
import type { SlurpLiveShow } from "../../data/live/slp-live-storage.js";
import { createSlurpEventsStorage } from "../../data/notifications/slp-notification-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";

/**
 * "X is live" (LIVE-V3-PLAN.md "When shows happen"): every player persona subscribed to the Creator gets
 * one notification per show. A viewer account's id is the persona id; population fans have no persona.
 */
export async function notifySlurpLiveStart(db: DB, show: SlurpLiveShow) {
  const noodle = createSlurpStorage(db);
  const host = await noodle.getAccountById(show.hostId);
  if (!host) return;
  const events = createSlurpEventsStorage(db);
  for (const subscription of await noodle.listSubscriptionsForCreator(show.hostId)) {
    const personaId = subscription.viewerAccountId;
    if (!(await noodle.getViewer(personaId).catch(() => null))) continue;
    await events
      .record({
        recipientPersonaId: personaId,
        kind: "live",
        creatorAccountId: show.hostId,
        subjectId: show.id,
        actorLabel: host.id,
        operationId: `live-start:${show.id}:${personaId}`,
      })
      .catch((error: unknown) => logger.warn(error, "[slurp-live] Could not send the live notification"));
  }
}

export async function postSlurpLiveSummary(db: DB, show: SlurpLiveShow) {
  // Nobody tipped and nobody talked: a quiet show leaves no post behind.
  if (!show.state.raised && !show.state.log.some((event) => event.kind === "you")) return;
  await createSlurpStorage(db)
    .createPost({
      authorAccountId: show.hostId,
      content: slpLiveSummaryText(show.id, show.state),
      source: "generated",
      metadata: { liveShowId: show.id },
    })
    .catch((error: unknown) => logger.warn(error, "[slurp-live] Could not post the show summary"));
}
