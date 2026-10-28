/**
 * A Creator who is with the player texts like a partner, on the world clock (Drama, "the player as a
 * partner"). Code picks when and what about (`modules/messages/slp-partner-texts.ts`); the words come
 * from the follow-up writer as an opener, so night quiet, proactive-message settings and the AI budget
 * apply as for every other message she starts. Any failure skips one text, never a tick.
 */
import { randomUUID } from "node:crypto";
import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { createSlurpMessagesStorage, createSlurpStorage } from "../../data/slp-storage.js";
import { readSlurpCreatorTiesDocument } from "../../data/projects/slp-creator-ties-storage.js";
import {
  slurpPartnerNews,
  slurpPartnerText,
  type SlurpPartnerStage,
} from "../../modules/messages/slp-partner-texts.js";
import { resolveSlurpExplicitLevel } from "../../data/settings/slp-post-guidance-storage.js";
import { SLP_EXPLICIT_LEVELS } from "../../../../../shared/src/slp/slp-spice.js";

const HOUR = 3_600_000;

export async function textSlurpPartners(db: DB, at = new Date()): Promise<void> {
  const { couples } = await readSlurpCreatorTiesDocument(db);
  const live = couples.filter((couple) => couple.stage !== "split");
  if (!live.length) return;
  const accounts = await createSlurpStorage(db).listNoodlerAccounts();
  // The player's pages, and the persona behind each: her texts go to that persona's inbox.
  const viewerOf = new Map(
    accounts.flatMap((account) =>
      account.kind === "persona" && account.sourceKind === "persona" && account.sourceEntityId
        ? [[account.id, account.sourceEntityId] as const]
        : [],
    ),
  );
  const messages = createSlurpMessagesStorage(db);
  for (const couple of live) {
    const members = [couple.aId, couple.bId, ...(couple.moreIds ?? [])];
    for (const pageId of members.filter((id) => viewerOf.has(id)))
      for (const creatorId of members.filter((id) => !viewerOf.has(id))) {
        try {
          const viewer = viewerOf.get(pageId)!;
          let thread = await messages.getThread(viewer, creatorId);
          const reason = slurpPartnerText({
            pairKey: `${creatorId}|${viewer}`,
            stage: couple.stage as SlurpPartnerStage,
            news: slurpPartnerNews(couple, at, thread?.lastMessageAt ?? null),
            heat:
              SLP_EXPLICIT_LEVELS.indexOf(
                await resolveSlurpExplicitLevel(db, creatorId).catch(() => "none" as const),
              ) >= 2,
            // ponytail: the server's clock, not the Creator's own time zone; use her schedule's zone if it drifts.
            hour: at.getHours(),
            hoursSinceLast: thread ? (at.getTime() - Date.parse(thread.lastMessageAt)) / HOUR : null,
            busy: Boolean(thread && (thread.needsReply || thread.scheduledFollowUps.length > 0)),
            slot: Math.floor(at.getTime() / HOUR),
          });
          if (!reason) continue;
          if (!thread) {
            const opened = await messages.openThread(viewer, creatorId, "creator", "waive");
            thread = opened.status === "ok" ? opened.thread : null;
          }
          if (!thread) continue;
          await messages.addScheduledFollowUps(thread.id, [
            {
              id: `followup-${randomUUID()}`,
              scheduledAt: new Date(at.getTime() + 2 * 60_000).toISOString(),
              type: "opener",
              reason,
              context: "",
            },
          ]);
        } catch (error) {
          logger.warn(error, "[slurp-partner] Could not plan a text from a partner; skipped this time");
        }
      }
  }
}
