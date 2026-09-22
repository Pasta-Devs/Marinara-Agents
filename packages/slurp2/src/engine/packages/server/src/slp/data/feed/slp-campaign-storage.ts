import type { DB } from "../../../db/connection.js";
import { and, eq } from "../../../db/file-query.js";
import { slurpContentCampaigns, slurpContentCampaignStages } from "../../../db/schema/slurp.js";
import { newId } from "../../../utils/id-generator.js";
import {
  SLURP_CAMPAIGN_MAX_AGE_MS,
  SLURP_CAMPAIGN_TEMPLATE,
  slurpCampaignStageCanMove,
  type SlurpCampaignStageKind,
  type SlurpCampaignStageStatus,
  type SlurpCampaignStageView,
} from "../../modules/feed/slp-campaign.js";

export type SlurpCampaignStage = SlurpCampaignStageView & {
  creatorAccountId: string;
  opportunityId: string | null;
  postId: string | null;
  completedAt: string | null;
};

function mapStage(row: Record<string, unknown>): SlurpCampaignStage {
  const position = Number.parseInt(String(row.position ?? "0"), 10);
  return {
    id: String(row.id),
    campaignId: String(row.campaignId),
    creatorAccountId: String(row.creatorAccountId),
    kind: String(row.kind) as SlurpCampaignStageKind,
    position: Number.isFinite(position) ? position : 0,
    access: String(row.access ?? ""),
    status: String(row.status) as SlurpCampaignStageStatus,
    opportunityId: row.opportunityId ? String(row.opportunityId) : null,
    postId: row.postId ? String(row.postId) : null,
    dueAt: String(row.dueAt),
    completedAt: row.completedAt ? String(row.completedAt) : null,
  };
}

/**
 * Open a campaign around a set that is being planned now. The set is its first stage, already
 * claimed by the plan that is about to produce it.
 */
export async function openSlurpCampaign(
  db: DB,
  input: { creatorAccountId: string; opportunityId: string | null; at: Date; dueAt?: Date | null },
): Promise<string> {
  const campaignId = newId();
  // Stages count from when the set goes up, not from when it was planned: a scheduled set planned
  // tonight for tomorrow must not have its teaser due before it exists.
  const at = (input.dueAt ?? input.at).getTime();
  await db.insert(slurpContentCampaigns).values({
    id: campaignId,
    creatorAccountId: input.creatorAccountId,
    status: "open",
    createdAt: input.at.toISOString(),
    expiresAt: new Date(at + SLURP_CAMPAIGN_MAX_AGE_MS).toISOString(),
  });
  for (const [position, stage] of SLURP_CAMPAIGN_TEMPLATE.entries()) {
    await db.insert(slurpContentCampaignStages).values({
      id: newId(),
      campaignId,
      creatorAccountId: input.creatorAccountId,
      kind: stage.kind,
      position: String(position),
      access: stage.access,
      status: position === 0 ? "claimed" : "planned",
      opportunityId: position === 0 ? input.opportunityId : null,
      postId: null,
      dueAt: new Date(at + stage.delayMs).toISOString(),
      completedAt: null,
    });
  }
  return campaignId;
}

/**
 * Every stage of this Creator's open campaigns. Expired campaigns are closed first and their
 * unfinished stages cancelled, so a stage that never found a slot cannot run a week late.
 */
export async function listOpenSlurpCampaignStages(
  db: DB,
  creatorAccountId: string,
  at: Date,
): Promise<SlurpCampaignStage[]> {
  const campaigns = await db
    .select()
    .from(slurpContentCampaigns)
    .where(and(eq(slurpContentCampaigns.creatorAccountId, creatorAccountId), eq(slurpContentCampaigns.status, "open")));
  const open: string[] = [];
  for (const campaign of campaigns) {
    if (Date.parse(String(campaign.expiresAt)) > at.getTime()) {
      open.push(String(campaign.id));
      continue;
    }
    await closeSlurpCampaign(db, String(campaign.id), "cancelled", at);
  }
  const stages: SlurpCampaignStage[] = [];
  for (const campaignId of open) {
    const rows = await db
      .select()
      .from(slurpContentCampaignStages)
      .where(eq(slurpContentCampaignStages.campaignId, campaignId));
    stages.push(...rows.map((row) => mapStage(row as Record<string, unknown>)));
  }
  return stages;
}

/** Move one stage, refusing any move the rules do not allow. Returns whether it moved. */
export async function moveSlurpCampaignStage(
  db: DB,
  stage: Pick<SlurpCampaignStage, "id" | "status">,
  to: SlurpCampaignStageStatus,
  input: { at: Date; opportunityId?: string | null; postId?: string | null },
): Promise<boolean> {
  if (!slurpCampaignStageCanMove(stage.status, to)) return false;
  await db
    .update(slurpContentCampaignStages)
    .set({
      status: to,
      ...(input.opportunityId !== undefined ? { opportunityId: input.opportunityId } : {}),
      ...(input.postId ? { postId: input.postId } : {}),
      ...(to === "completed" || to === "skipped" || to === "cancelled" ? { completedAt: input.at.toISOString() } : {}),
    })
    .where(eq(slurpContentCampaignStages.id, stage.id));
  return true;
}

/**
 * Close the stage a finished plan was running, and the campaign once nothing in it is left open.
 * Called wherever a plan completes, so every path that produces a post also advances its stage.
 */
export async function completeSlurpCampaignStageFor(
  db: DB,
  opportunityId: string,
  input: { at: Date; postId?: string | null },
): Promise<void> {
  const rows = await db
    .select()
    .from(slurpContentCampaignStages)
    .where(eq(slurpContentCampaignStages.opportunityId, opportunityId));
  for (const row of rows) {
    const stage = mapStage(row as Record<string, unknown>);
    await moveSlurpCampaignStage(db, stage, "completed", { at: input.at, postId: input.postId ?? null });
    const siblings = await db
      .select()
      .from(slurpContentCampaignStages)
      .where(eq(slurpContentCampaignStages.campaignId, stage.campaignId));
    const unfinished = siblings
      .map((sibling) => mapStage(sibling as Record<string, unknown>))
      .some((sibling) => sibling.status === "planned" || sibling.status === "claimed");
    if (!unfinished) await closeSlurpCampaign(db, stage.campaignId, null, input.at);
  }
}

async function closeSlurpCampaign(
  db: DB,
  campaignId: string,
  cancelStages: "cancelled" | null,
  at: Date,
): Promise<void> {
  if (cancelStages) {
    const rows = await db
      .select()
      .from(slurpContentCampaignStages)
      .where(eq(slurpContentCampaignStages.campaignId, campaignId));
    for (const row of rows) {
      const stage = mapStage(row as Record<string, unknown>);
      await moveSlurpCampaignStage(db, stage, cancelStages, { at });
    }
  }
  await db.update(slurpContentCampaigns).set({ status: "closed" }).where(eq(slurpContentCampaigns.id, campaignId));
}
