/**
 * The player's own couple, moved on by the chat (Drama, "your relationship"): her answer to the player
 * reports what the talk did to the two of them ("us"), and these rules decide whether it counts.
 */
import { clampText } from "./slp-project.js";
import type { SlpPlayerCouple } from "../../../../../shared/src/slp/slp-stir.js";
import {
  slurpNextAnniversary,
  slurpCoupleMoment,
  slurpDaysSince,
  slurpMakeOfficial,
  slurpWithMoment,
  type SlurpCouple,
  type SlurpCoupleStage,
} from "./slp-creator-couples.js";

/** Least days on a stage before the chat may move a couple with the player on. */
export const SLURP_PLAYER_STAGE_DAYS: Partial<Record<SlurpCoupleStage, number>> = { sparks: 1, dating: 3 };

/** What the Creator's own chat with the player says about the two of them (her DM answer's "us"). */
export type SlurpPlayerCoupleStep = "closer" | "hurt" | "madeUp";

/**
 * The chat moves a couple with the player on (Drama, "your relationship"): a crush becomes dating,
 * dating becomes official, a real fight makes it rocky, making up ends that. The model only says what
 * happened in the talk; code decides whether it is enough: a stage needs its days first
 * (`SLURP_PLAYER_STAGE_DAYS`), so one warm evening never skips straight to together. Null: no change.
 * `creatorId` is the Creator who answered; `detail` her own few words about it.
 */
export function slurpPlayerCoupleStep(
  couple: SlurpCouple,
  step: SlurpPlayerCoupleStep,
  input: { at: Date; creatorId: string; detail?: string },
): SlurpCouple | null {
  const stamp = input.at.toISOString();
  const detail = clampText(input.detail, 120);
  const ripe = slurpDaysSince(couple.stageAt, input.at) >= (SLURP_PLAYER_STAGE_DAYS[couple.stage] ?? 0);
  if (step === "closer" && couple.stage === "sparks" && ripe)
    return slurpWithMoment(
      { ...couple, stage: "dating", stageAt: stamp },
      slurpCoupleMoment(couple, "date", stamp, detail),
    );
  if (step === "closer" && couple.stage === "dating" && ripe) return slurpMakeOfficial(couple, input.at);
  if (step === "hurt" && (couple.stage === "dating" || couple.stage === "together"))
    return slurpWithMoment(
      { ...couple, stage: "rocky", stageAt: stamp, troubles: couple.troubles + 1 },
      { ...slurpCoupleMoment(couple, "fight", stamp, detail || "a fight in private"), fromId: input.creatorId },
    );
  if (step === "madeUp" && couple.stage === "rocky")
    return slurpWithMoment(
      { ...couple, stage: "together", stageAt: stamp },
      slurpCoupleMoment(couple, "makeup", stamp, detail),
    );
  return null;
}

/** What the player's thread with her shows about the two of them (Details › You two). */
export type SlurpPlayerCoupleView = SlpPlayerCouple;

export function slurpPlayerCoupleView(couple: SlurpCouple, at: Date): SlurpPlayerCoupleView {
  const last = (kinds: readonly string[]) => {
    const moment = [...couple.moments].reverse().find((entry) => kinds.includes(entry.kind));
    return moment ? { at: moment.at, detail: moment.detail } : null;
  };
  const official = couple.stage === "together" || couple.stage === "rocky";
  return {
    id: couple.id,
    stage: couple.stage,
    ending: couple.ending,
    startedAt: couple.startedAt,
    togetherAt: couple.togetherAt,
    stageAt: couple.stageAt,
    secret: Boolean(couple.secret),
    pageOpen: Boolean(couple.page && !couple.page.closedAt),
    aftermath: couple.stage === "split" ? (couple.aftermath ?? null) : null,
    lastDate: last(["date"]),
    lastFight: last(["fight", "jealous"]),
    nextAnniversary: official && couple.togetherAt ? slurpNextAnniversary(couple.togetherAt, at) : null,
  };
}
