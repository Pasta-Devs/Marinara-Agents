/** The plain words of couple moments: dates, jealousy, fights, and how a forced couple feels. */
import type { SlurpCouple } from "./slp-creator-couples.js";

/** What a date can be; a shared interest of the two comes first (`pickDate`). */
export const SLURP_COUPLE_DATES = [
  "a late dinner at a place neither of you had tried",
  "a long walk that ended somewhere you did not plan",
  "cooking together, badly, and laughing about it",
  "a movie night that turned into talking until three",
  "a day trip on a whim",
  "breakfast in bed and a very slow morning",
  "an arcade night with a lot of trash talk",
  "a picnic with too much food",
  "a rainy afternoon in a tiny café",
  "a night market and one bite of everything",
] as const;

export const SLURP_COUPLE_JEALOUSY = [
  "someone keeps flirting with them in the comments",
  "an ex of theirs popped up in the comments",
  "they were very friendly with a fan on a live",
] as const;

export const SLURP_COUPLE_FIGHTS = [
  "how little time you two get together lately",
  "whether to post about the relationship at all",
  "something one of you said that landed wrong",
  "who forgot what, again",
  "money, and who pays for what",
  "plans one of you cancelled last minute",
] as const;

/**
 * How a couple the player forced against a card feels, from one side, in one sentence, or "". The
 * card that says no colors it: taken = complicated, not into romance = reluctant, never dates or not
 * their type = awkward. The couple still happens; this is how, not whether.
 */
export function slurpForcedCoupleLine(couple: SlurpCouple, creatorId: string, partner: string): string {
  if (!couple.forced) return "";
  const mine = couple.forced.byId === creatorId;
  switch (couple.forced.misfit) {
    case "taken":
      return mine
        ? `You already have someone in your life, so this thing with ${partner} is complicated: you keep it low-key and feel torn about it.`
        : `${partner} already has someone in their life, so it is complicated and stays low-key.`;
    case "notInto":
      return mine
        ? `Romance is not really your thing, so you go along with it a little reluctantly, in your own way.`
        : `Romance is not really ${partner}'s thing, so they are a little reluctant, and you take it slow.`;
    case "noDating":
      return mine
        ? `You never date, and yet here you are. It feels awkward, and you are not sure what to do with it.`
        : `${partner} never dates, so they are awkward about it, and neither of you is sure where it goes.`;
    case "orientation":
      return mine
        ? `${partner} is not who you usually go for, so it feels awkward and new, and you are still figuring it out.`
        : `You are not who ${partner} usually goes for, so it is awkward and new for both of you.`;
    case "romance":
      return mine
        ? `You were not looking for anything with ${partner}, so this is new and a little awkward.`
        : `${partner} was not looking for anything with you, so you take it slow.`;
  }
}
