import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { drainSlurpAudienceReplies } from "../features/audience/slp-audience-contract.js";
import { drainSlurpPendingText } from "../features/world/slp-world-contract.js";
import { topUpSlurpReactionBank } from "../features/world/slp-world-contract.js";
import { advanceSlurpDrama, advanceSlurpWorld } from "../features/world/slp-world-contract.js";
import {
  advanceSlurpSupportDesk,
  drainSlurpContinuityExtraction,
  textSlurpPartners,
} from "../features/messages/slp-messages-contract.js";
import { refreshSlurpCreatorPages } from "../features/creators/slp-creators-contract.js";
import { slurpPausedNow } from "../data/settings/slp-pause-storage.js";

let modelDrains: Promise<void> | null = null;

/** World work that runs when the player opens the notification stream. Each step fails soft. */
export async function slpCatchUpWorldOnOpen(app: FastifyInstance) {
  // "Pause all": nothing catches up while Slurp is paused.
  if (await slurpPausedNow(app.db)) return;
  // Catch-up on open. This is one of the two callers of `advanceSlurpWorld`; the other is the
  // background scheduler. Advancing on read mirrors `applyStipend`, which bills on read and
  // needs no timer to stay correct. A failure here must not cost the player their feed.
  await advanceSlurpWorld(app.db).catch((error: unknown) =>
    logger.warn(error, "[slurp-world] Catch-up on open failed"),
  );
  // The Support desk: suspicion, tickets, challenges, contracts (docs/SUPPORT-DESK.md). Templates only.
  await advanceSlurpSupportDesk(app.db).catch((error: unknown) => logger.warn(error, "[slurp-desk] Catch-up failed"));
  // Drama (docs/DRAMA.md): situations and dramas the player switched on, and their due beats.
  await advanceSlurpDrama(app.db).catch((error: unknown) => logger.warn(error, "[slurp-drama] Catch-up failed"));
  // A Creator who is with the player texts like a partner.
  await textSlurpPartners(app.db).catch((error: unknown) => logger.warn(error, "[slurp-partner] Catch-up failed"));
  // The model drains below are not awaited: the notification list used to wait seconds of model
  // time before it showed. They run single-flight and their text lands on the next refetch.
  if (!modelDrains)
    modelDrains = (async () => {
      // Tier 2. The world writes from templates because unattended work never calls the model; this
      // is where that debt is paid, with the player present and against text they are about to read.
      await drainSlurpPendingText(app.db).catch((error: unknown) =>
        logger.warn(error, "[slurp-pending] Drain on open failed"),
      );
      // Present mode grows reusable banks only while somebody is here. Background mode also reaches
      // this path, but the durable ledger still makes it one shared budget.
      await topUpSlurpReactionBank(app.db, "present").catch((error: unknown) =>
        logger.warn(error, "[slurp-bank] Top-up on open failed"),
      );
      // Tier 2 the other way round: the creator answering the audience rather than the audience
      // being rewritten. Same rule and same reason it lives here — unattended work never calls the
      // model, so a written answer is spent with the player present and against a comment thread
      // they are about to read.
      await drainSlurpAudienceReplies(app.db).catch((error: unknown) =>
        logger.warn(error, "[slurp-audience-reply] Drain on open failed"),
      );
      // Last and lowest priority: reading new messages for Creator statements. Nothing on screen waits
      // on it, and it spends from the same budget as everything above.
      await drainSlurpContinuityExtraction(app.db).catch((error: unknown) =>
        logger.warn(error, "[slurp-continuity] Drain on open failed"),
      );
    })().finally(() => {
      modelDrains = null;
    });
  // Not awaited: an AI Creator designing or refreshing their Page is never urgent, and nothing this
  // open answers with depends on it. The runner itself never runs twice at once.
  void refreshSlurpCreatorPages(app.db).catch((error: unknown) =>
    logger.warn(error, "[slurp-creator-page] Refresh on open failed"),
  );
}
