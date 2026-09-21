import type { FastifyInstance } from "fastify";
import { logger } from "../../lib/logger.js";
import { drainSlurpAudienceReplies } from "../features/audience/slp-audience-contract.js";
import { drainSlurpPendingText } from "../features/world/slp-world-contract.js";
import { topUpSlurpReactionBank } from "../features/world/slp-world-contract.js";
import { advanceSlurpWorld } from "../features/world/slp-world-contract.js";
import { drainSlurpContinuityExtraction } from "../features/messages/slp-messages-contract.js";

/** World work that runs when the player opens the notification stream. Each step fails soft. */
export async function slpCatchUpWorldOnOpen(app: FastifyInstance) {
  // Catch-up on open. This is one of the two callers of `advanceSlurpWorld`; the other is the
  // background scheduler. Advancing on read mirrors `applyStipend`, which bills on read and
  // needs no timer to stay correct. A failure here must not cost the player their feed.
  await advanceSlurpWorld(app.db).catch((error: unknown) =>
    logger.warn(error, "[slurp-world] Catch-up on open failed"),
  );
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
}
