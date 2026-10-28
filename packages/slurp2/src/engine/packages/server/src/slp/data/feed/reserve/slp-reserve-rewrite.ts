/**
 * Prepared posts after a steering change: how many there are, and turning them back into open
 * slots so the reserve writes them again for the Creator as the player steers them now. Each one
 * costs its AI calls again, inside the usual AI budget and pacing; nothing runs here but storage.
 */
import type { DB } from "../../../../db/connection.js";
import { and, eq } from "../../../../db/file-query.js";
import { slpCreatorPreparedPosts, slurpContentOpportunities } from "../../../../db/schema/slurp.js";
import { unlinkCreatorMedia } from "../../../base/media/slp-media.js";
import { parseRecord } from "../../../modules/records/slp-storage-model.js";
import { slurpPlanRewritable, slurpPreparedRewriteCost } from "../../../modules/feed/slp-prepared-rewrite.js";
import { findSlurpOpportunityBySlot } from "../slp-opportunity-storage.js";
import { listOpenSlurpCampaignStages } from "../slp-campaign-storage.js";

async function preparedFor(db: DB, creatorAccountId: string) {
  return (
    await db
      .select()
      .from(slpCreatorPreparedPosts)
      .where(eq(slpCreatorPreparedPosts.creatorAccountId, creatorAccountId))
  ).map((row) => ({ ...row, payload: parseRecord(row.payload) }));
}

export async function countSlurpPreparedRewrite(
  db: DB,
  creatorAccountId: string,
  at = new Date(),
): Promise<{ posts: number; calls: number }> {
  const rows = await preparedFor(db, creatorAccountId);
  return slurpPreparedRewriteCost(
    rows.map((row) => ({ ...row, imagePrompt: row.payload.imagePrompt })),
    creatorAccountId,
    at,
  );
}

/** Back to scheduled slots, like a post written for an older card. Returns how many. */
export async function rewriteSlurpPreparedPosts(db: DB, creatorAccountId: string, at = new Date()): Promise<number> {
  const rows = (await preparedFor(db, creatorAccountId)).filter(
    (row) => row.state === "prepared" && Date.parse(row.publishAt) > at.getTime(),
  );
  const claimed = new Set(
    (await listOpenSlurpCampaignStages(db, creatorAccountId, at)).flatMap((stage) =>
      stage.opportunityId ? [stage.opportunityId] : [],
    ),
  );
  let rewritten = 0;
  for (const row of rows) {
    const reset = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(slpCreatorPreparedPosts).where(eq(slpCreatorPreparedPosts.id, row.id));
      if (!current || current.state !== "prepared") return false;
      await tx
        .update(slpCreatorPreparedPosts)
        .set({
          generatedAt: at.toISOString(),
          payload: "{}",
          state: "scheduled",
          publishedPostId: null,
          imageState: "none",
          imageClaimToken: null,
          imageClaimLeaseUntil: null,
          updatedAt: at.toISOString(),
        })
        .where(and(eq(slpCreatorPreparedPosts.id, row.id), eq(slpCreatorPreparedPosts.state, "prepared")));
      return true;
    });
    if (!reset) continue;
    rewritten += 1;
    unlinkCreatorMedia(String(parseRecord(row.payload.metadata).noodlerMediaPath ?? "") || null);
    // The slot is planned again under the new steering, unless its plan carries a reason of its own.
    const plan = await findSlurpOpportunityBySlot(db, row.id);
    if (plan && slurpPlanRewritable(plan, claimed.has(plan.id)))
      await db.delete(slurpContentOpportunities).where(eq(slurpContentOpportunities.id, plan.id));
  }
  return rewritten;
}
