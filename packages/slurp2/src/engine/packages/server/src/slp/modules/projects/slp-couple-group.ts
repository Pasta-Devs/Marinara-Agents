/**
 * Polyamory (0.3.5, Settings › Stir, off by default): a couple can grow to four. The first two stay
 * the couple's pair (`aId`, `bId`: its stage, dates and fights run on them); more partners join in
 * `moreIds`. Everything that names "the partner" names them all.
 *
 * Pure, so the rules run in tests.
 */
import type { SlurpCouple, SlurpCoupleMoment } from "./slp-creator-couples.js";
import type { SlurpTieCreator } from "./slp-creator-ties.js";
import { readSlurpTieStamp } from "./slp-tie-stamp.js";

/** The most people one couple can have. */
export const SLURP_COUPLE_GROUP_MAX = 4;

export const slurpCoupleMembers = (couple: Pick<SlurpCouple, "aId" | "bId" | "moreIds">): string[] => [
  couple.aId,
  couple.bId,
  ...(couple.moreIds ?? []),
];

/** Everyone this Creator is with in this couple (empty when they are not in it). */
export function slurpCouplePartners(couple: SlurpCouple, creatorId: string): string[] {
  const members = slurpCoupleMembers(couple);
  return members.includes(creatorId) ? members.filter((id) => id !== creatorId) : [];
}

/** "Kai", "Kai and Lena", "Kai, Lena and Mo". */
export function slurpNameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export type SlurpCoupleJoinError = "polyOff" | "notFound" | "notTogether" | "full" | "same" | "mono";

/**
 * Someone joins a couple: only with polyamory on, only a couple that is dating or together, never
 * past four, and everyone in it (the joiner too) must be polyamorous (`SlurpTieCreator.poly`). The
 * joiner may have other couples too. The couple gets a "joined" moment.
 */
export function slurpAddToCouple(
  couples: readonly SlurpCouple[],
  coupleId: string,
  joiner: Pick<SlurpTieCreator, "id" | "poly">,
  options: { at: Date; polyamory: boolean; creators?: readonly Pick<SlurpTieCreator, "id" | "poly">[] },
): SlurpCouple[] | SlurpCoupleJoinError {
  if (!options.polyamory) return "polyOff";
  const couple = couples.find((entry) => entry.id === coupleId);
  if (!couple) return "notFound";
  if (couple.stage !== "dating" && couple.stage !== "together" && couple.stage !== "rocky") return "notTogether";
  const members = slurpCoupleMembers(couple);
  if (members.includes(joiner.id)) return "same";
  if (members.length >= SLURP_COUPLE_GROUP_MAX) return "full";
  const poly = new Map((options.creators ?? []).map((creator) => [creator.id, creator.poly === true]));
  if (!joiner.poly || members.some((id) => poly.get(id) === false)) return "mono";
  const stamp = options.at.toISOString();
  const moment: SlurpCoupleMoment = {
    id: `joined:${Date.parse(stamp).toString(36)}:${couple.moments.length}`,
    kind: "joined",
    at: stamp,
    detail: "",
    withId: joiner.id,
  };
  return couples.map((entry) =>
    entry.id === couple.id
      ? { ...entry, moreIds: [...(entry.moreIds ?? []), joiner.id], moments: [...entry.moments, moment].slice(-10) }
      : entry,
  );
}

/**
 * How much a couple post draws the crowd, as a reach factor for the world pulse: a launch, a breakup
 * or a reunion is news, a date a little. Any other post: 1.
 */
export function slurpCoupleBuzz(metadata: Record<string, unknown> | null | undefined): number {
  const stamp = readSlurpTieStamp(metadata);
  if (stamp?.kind !== "couple") return 1;
  const moment = stamp.moment ?? "";
  if (["launch", "breakup", "reunion", "pageOpen", "joined"].includes(moment)) return 1.8;
  if (["anniversary", "fight", "jealous", "pageClose", "movingOn"].includes(moment)) return 1.4;
  return 1.15;
}

/** What a shared page earns goes to every member, in equal shares (the odd coins to the first). */
export function slurpCouplePageSplit(amount: number, members = 2): number[] {
  const whole = Math.max(0, Math.floor(amount));
  const count = Math.max(1, Math.floor(members));
  const share = Math.floor(whole / count);
  return Array.from({ length: count }, (_, index) => share + (index < whole - share * count ? 1 : 0));
}
