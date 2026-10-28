/**
 * Set campaigns: the set, a public teaser for it, and a later callback.
 *
 * Pure and deterministic, like the other Slurp rule modules.
 *
 * ## The problem
 *
 * Every set was a one-off. A paid drop went up and nothing ever pointed at it again: no public
 * teaser to sell it, no follow-up for the people who bought it. A creator page converts in short
 * sequences, and a feed of unrelated single posts reads as nobody running the business.
 *
 * ## The approach
 *
 * A drawn set opens a campaign of three stages. The set comes first because it is the thing that
 * exists; the teaser follows as "the full set is up, here is a corner of it", which lets it show a
 * server-cropped piece of the real set instead of a promise. The callback comes a day later.
 *
 * A stage never publishes because it exists. It runs only when the planner hands it a slot, only
 * after the stage before it completed, and only while the campaign is open. A stage that never
 * finds a slot expires with its campaign.
 */

import type { SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";

export const SLURP_CAMPAIGN_STAGE_KINDS = ["set", "teaser", "callback"] as const;
export type SlurpCampaignStageKind = (typeof SLURP_CAMPAIGN_STAGE_KINDS)[number];

export const SLURP_CAMPAIGN_STAGE_STATUSES = ["planned", "claimed", "completed", "skipped", "cancelled"] as const;
export type SlurpCampaignStageStatus = (typeof SLURP_CAMPAIGN_STAGE_STATUSES)[number];

/** A campaign that has not finished in four days has lost the moment it was selling. */
export const SLURP_CAMPAIGN_MAX_AGE_MS = 4 * 24 * 60 * 60_000;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The stages a set opens, relative to the set. The set itself is due immediately. */
export const SLURP_CAMPAIGN_TEMPLATE: readonly {
  kind: SlurpCampaignStageKind;
  access: "" | "public" | "locked";
  delayMs: number;
}[] = [
  { kind: "set", access: "", delayMs: 0 },
  // A teaser needs a public slot, or it sells nothing to anyone who has not already paid.
  { kind: "teaser", access: "public", delayMs: 2 * HOUR },
  { kind: "callback", access: "", delayMs: 24 * HOUR },
];

/**
 * A free tease's campaign (3b): the tease comes first and promises the drop, which is the next
 * locked post a few hours later, then the usual callback. A drop needs a locked slot, or the
 * people who read the tease for free would get it for free too.
 */
export const SLURP_TEASE_CAMPAIGN_TEMPLATE: typeof SLURP_CAMPAIGN_TEMPLATE = [
  { kind: "teaser", access: "public", delayMs: 0 },
  { kind: "set", access: "locked", delayMs: 3 * HOUR },
  { kind: "callback", access: "", delayMs: 27 * HOUR },
];

const NIGHT = (at: Date) => at.getHours() >= 23 || at.getHours() < 7;

/**
 * When a tease's drop goes up (slice I, user: the tease names an exact time and Slurp holds that
 * slot): the first full hour at least `minGapMs` after the tease that is not in the night (23:00 to
 * 07:00, local) and clear of this Creator's other posts and slots by their own spacing. Looks a day
 * and a half ahead; past that it takes the first hour out of the night.
 */
export function slurpHeldDropTime(input: {
  teaseAt: Date;
  minGapMs: number;
  /** This Creator's other posts and held slots (epoch ms). */
  busy: readonly number[];
  /** This Creator's own spacing between posts. */
  spacingMs: number;
}): Date {
  const first = new Date(input.teaseAt.getTime() + Math.max(input.minGapMs, input.spacingMs));
  if (first.getMinutes() || first.getSeconds() || first.getMilliseconds())
    first.setHours(first.getHours() + 1, 0, 0, 0);
  let fallback: Date | null = null;
  for (let step = 0; step < 36; step += 1) {
    const candidate = new Date(first.getTime() + step * HOUR);
    if (NIGHT(candidate)) continue;
    fallback ??= candidate;
    if (input.busy.every((time) => Math.abs(time - candidate.getTime()) >= input.spacingMs)) return candidate;
  }
  return fallback ?? first;
}

/** The drop stage a slot was held for: a planned drop due exactly at the slot's time. */
export function slurpHeldDropStage<T extends SlurpCampaignStageView>(
  stages: readonly T[],
  slotAt: Date | null | undefined,
): T | null {
  if (!slotAt) return null;
  return (
    stages.find(
      (stage) =>
        stage.kind === "set" &&
        stage.status === "planned" &&
        Math.abs(Date.parse(stage.dueAt) - slotAt.getTime()) < MINUTE,
    ) ?? null
  );
}

export type SlurpCampaignStageView = {
  id: string;
  campaignId: string;
  kind: SlurpCampaignStageKind;
  position: number;
  access: string;
  status: SlurpCampaignStageStatus;
  dueAt: string;
};

/**
 * The stage this slot should run, or null.
 *
 * Due, still planned, in a slot with the access it needs, and every earlier stage of its campaign
 * finished. A skipped stage counts as finished, so a Creator can let the teaser go and still post
 * the callback; a planned or claimed earlier stage does not, so the teaser never runs before the
 * set it previews exists.
 */
export function slurpNextCampaignStage<T extends SlurpCampaignStageView>(
  stages: readonly T[],
  input: { at: Date; access: string; story?: boolean },
): T | null {
  const due = stages
    .filter((stage) => stage.status === "planned")
    // A drop is a feed post; a Story that disappears in a day is not what the tease promised.
    .filter((stage) => !(input.story && stage.kind === "set"))
    .filter((stage) => Date.parse(stage.dueAt) <= input.at.getTime())
    .filter((stage) => !stage.access || stage.access === input.access)
    .filter((stage) =>
      stages
        .filter((other) => other.campaignId === stage.campaignId && other.position < stage.position)
        .every((other) => other.status === "completed" || other.status === "skipped"),
    )
    .sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt) || left.position - right.position);
  return due[0] ?? null;
}

/** A stage kind is also its intent, so the planner can run it through the ordinary draw. */
export function slurpCampaignStageIntent(kind: SlurpCampaignStageKind): SlurpContentIntent {
  return kind;
}

/** Where a stage may go next. Only an open stage moves; a finished one stays finished. */
const STAGE_NEXT: Partial<Record<SlurpCampaignStageStatus, readonly SlurpCampaignStageStatus[]>> = {
  planned: ["claimed", "skipped", "cancelled"],
  // ponytail: a claimed stage whose run fails stays claimed until its campaign expires. Returning it
  // to planned needs a failure hook on every generation path; add one if lost stages show up.
  claimed: ["completed", "cancelled"],
};

export function slurpCampaignStageCanMove(from: SlurpCampaignStageStatus, to: SlurpCampaignStageStatus): boolean {
  return STAGE_NEXT[from]?.includes(to) ?? false;
}
