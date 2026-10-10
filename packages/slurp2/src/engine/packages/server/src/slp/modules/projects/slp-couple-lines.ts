/**
 * What a Creator knows about their own love life, as plain sentences for the briefs and the DMs:
 * a crush before dating, the partner while together, an ex after a breakup (U).
 */
import { slurpCoupleActive, slurpCoupleFor, slurpCoupleOf, type SlurpCouple } from "./slp-creator-couples.js";
import { slurpForcedCoupleLine } from "./slp-couple-words.js";
import { slurpCouplePartners, slurpNameList } from "./slp-couple-group.js";

/** An ex stays on a Creator's mind (and in their posts and chats) this long after the breakup. */
export const SLURP_EX_DAYS = 30;

/** What a Creator calls the one they are with, from that page's gender. */
export const slurpPartnerWord = (gender: string | null | undefined) =>
  gender === "male" ? "boyfriend" : gender === "female" ? "girlfriend" : "partner";

export type SlurpRelationshipOptions = {
  withId?: string | null;
  at?: Date;
  /** Pages the player runs: the one she is with is then the player, not "another Creator on Slurp". */
  playerIds?: ReadonlySet<string>;
  /** Page id → what she calls them ("boyfriend", `slurpPartnerWord`). */
  words?: ReadonlyMap<string, string>;
};

/**
 * What a Creator knows about their own love life, in one plain sentence, or "". In a chat with the
 * partner (or the ex) it says who they are to each other; anywhere else it is part of their life,
 * and for a while after a breakup the ex is too (U: exes show up in posts and DMs).
 */
export function slurpRelationshipLine(
  couples: readonly SlurpCouple[],
  creatorId: string,
  names: ReadonlyMap<string, string>,
  options: SlurpRelationshipOptions = {},
): string {
  const line = oneRelationshipLine(couples, creatorId, names, options);
  // Polyamory (0.3.5): one person in several couples hears about all of them.
  const main = options.withId ? slurpCoupleOf(couples, creatorId, options.withId) : slurpCoupleFor(couples, creatorId);
  const more = couples
    .filter((couple) => couple !== main && slurpCoupleActive(couple))
    .flatMap((couple) => {
      const who = slurpNameList(
        slurpCouplePartners(couple, creatorId).flatMap((id) => (names.has(id) ? [names.get(id)!] : [])),
      );
      if (!who) return [];
      return [
        couple.stage === "sparks"
          ? `flirting with ${who}`
          : couple.stage === "dating"
            ? `dating ${who}`
            : `with ${who}`,
      ];
    });
  return more.length ? `${line} You are polyamorous, and you are also ${more.join(", and ")}.`.trim() : line;
}

function oneRelationshipLine(
  couples: readonly SlurpCouple[],
  creatorId: string,
  names: ReadonlyMap<string, string>,
  options: SlurpRelationshipOptions,
): string {
  const at = options.at ?? new Date();
  const withThem = options.withId ? slurpCoupleOf(couples, creatorId, options.withId) : null;
  const couple = withThem ?? slurpCoupleFor(couples, creatorId) ?? slurpRecentEx(couples, creatorId, at);
  if (!couple) return "";
  // Polyamory (0.3.5): a couple of three or four names every partner; "they" for more than one.
  const partnerIds = slurpCouplePartners(couple, creatorId);
  const partner = slurpNameList(partnerIds.flatMap((id) => (names.has(id) ? [names.get(id)!] : [])));
  if (!partner) return "";
  if (partnerIds.length > 1) return slurpGroupLine(couple, partner, Boolean(withThem));
  const days = Math.max(0, Math.round((at.getTime() - Date.parse(couple.stageAt)) / 86_400_000));
  if (options.playerIds?.has(partnerIds[0]!))
    return slurpPlayerLine(couple, creatorId, partner, {
      word: options.words?.get(partnerIds[0]!) ?? "partner",
      inChat: Boolean(withThem),
      days,
    });
  const trouble = [...couple.moments].reverse().find((moment) => moment.kind === "fight" || moment.kind === "jealous");
  // A couple the player forced against a card: the card colors how it feels (slice I).
  const tone = slurpCoupleActive(couple) ? slurpForcedCoupleLine(couple, creatorId, partner) : "";
  const colored = (line: string) => (tone ? `${line} ${tone}` : line);
  if (withThem) {
    if (couple.stage === "sparks")
      return colored(`You and ${partner} have been flirting on Slurp lately. Nothing is official.`);
    if (couple.stage === "dating")
      return colored(`You and ${partner} are dating. It is new, and not official in public yet.`);
    if (couple.stage === "together")
      return colored(`${partner} is your partner: you two are together, and your fans know.`);
    if (couple.stage === "rocky")
      return colored(
        `${partner} is your partner, but things are rocky between you right now${trouble?.detail ? ` (${trouble.detail})` : ""}.`,
      );
    return slurpExLine(couple, partner, days, true);
  }
  if (couple.stage === "sparks")
    return colored(`You have a crush on ${partner}, another Creator on Slurp. Nothing is official.`);
  if (couple.stage === "split") return slurpExLine(couple, partner, days, false);
  const what =
    couple.stage === "dating"
      ? `You are dating ${partner}, another Creator on Slurp; it is still new.`
      : `You are with ${partner}, another Creator on Slurp.`;
  const rocky = couple.stage === "rocky" ? " Things are rocky between you two right now." : "";
  return colored(`${what}${rocky}`) + " They are part of your life, not the topic of everything you write.";
}

/**
 * An ex's line, by what the breakup leaves behind (#1293). "forget" overrides whatever the chat's own
 * history already shows: there is no deleting old messages, so the line says plainly it is over and
 * nothing is unfinished, rather than staying silent and letting the old transcript speak for itself.
 */
function slurpExLine(couple: SlurpCouple, name: string, days: number, inChat: boolean, player = false): string {
  // Forgetting wins over everything else, including a fizzle: there is nothing left to recall at all.
  if (couple.aftermath === "forget")
    return `You have no memory of a romantic relationship with ${name}. Whatever older messages or posts between you show are historical records only: you do not reconstruct that relationship from them, bring it up, or act like any romance is unfinished.`;
  if (couple.ending === "fizzled") return `You and ${name} flirted for a while, and it went nowhere.`;
  const ago = days <= 1 ? "just now" : `${days} days ago`;
  if (couple.aftermath === "moveOn")
    return `${name} is your ex. You broke up ${ago}. You have moved on: you do not dwell on it or bring up the breakup.`;
  return inChat
    ? `${name} is your ex. You broke up ${ago}.`
    : player
      ? `${name} is your ex: you broke up ${ago}. It still comes up now and then.`
      : `${name} is your ex: you broke up ${ago}. It still comes up now and then, and fans may ask. Say as much or as little as you would.`;
}

/**
 * She is with the player (Drama, "your relationship"): the one she is with, never "another Creator on
 * Slurp", and never "not the topic of everything" in her chat with them. A secret couple stays out of
 * public: she knows, her fans do not.
 */
function slurpPlayerLine(
  couple: SlurpCouple,
  creatorId: string,
  name: string,
  { word, inChat, days }: { word: string; inChat: boolean; days: number },
): string {
  const trouble = [...couple.moments].reverse().find((moment) => moment.kind === "fight" || moment.kind === "jealous");
  const tone = slurpCoupleActive(couple) ? slurpForcedCoupleLine(couple, creatorId, name) : "";
  const colored = (line: string) => (tone ? `${line} ${tone}` : line);
  const hush = couple.secret ? ` It is a secret: your fans do not know, so you never name ${name} in public.` : "";
  if (couple.stage === "sparks")
    return colored(
      inChat
        ? `You have a crush on ${name}, and ${name} flirts back. Nothing is official yet.`
        : `You have a crush on ${name}. Nothing is official.`,
    );
  if (couple.stage === "dating")
    return colored(
      `You and ${name} are dating. It is new${couple.secret ? "" : ", and not official in public yet"}.${hush}`,
    );
  if (couple.stage === "together" || couple.stage === "rocky") {
    const rocky =
      couple.stage === "rocky"
        ? ` Things are rocky between you right now${trouble?.detail ? ` (${trouble.detail})` : ""}.`
        : "";
    const known = couple.secret ? "" : inChat ? ", and your fans know" : "";
    return colored(`${name} is your ${word}: you two are together${known}.${rocky}${hush}`);
  }
  return slurpExLine(couple, name, days, inChat, true);
}

/**
 * The player's relationship with a character, for an ordinary Engine chat with that character (the
 * chat bridge, `slp-chat-context.ts`): one standing fact, in the third person. "" when there is none.
 */
export function slurpChatBridgeCoupleLine(
  couple: SlurpCouple | null,
  input: { her: string; herGender: string | null | undefined; you: string; at: Date },
): string {
  if (!couple) return "";
  const { her, you } = input;
  const since = (iso: string | null) => (iso ? ` since ${iso.slice(0, 10)}` : "");
  const hush = couple.secret ? ", kept secret from her fans" : "";
  const fight = [...couple.moments].reverse().find((moment) => moment.kind === "fight" || moment.kind === "jealous");
  // #1293: forgetting overrides whatever the chat's own transcript already shows, so it never stays
  // silent and lets old messages speak for themselves; it says plainly there is nothing unfinished.
  if (couple.aftermath === "forget")
    return `${her} has no memory of a romantic relationship with ${you} on Slurp. Older messages between them are historical records only: ${her} does not reconstruct a relationship from them or act like any romance is unfinished.`;
  if (couple.stage === "sparks")
    return `${her} and ${you} have a crush on each other on Slurp; nothing is official yet.`;
  if (couple.stage === "dating") return `${her} and ${you} are dating on Slurp${since(couple.stageAt)}${hush}.`;
  if (couple.stage === "together" || couple.stage === "rocky")
    return `${her} is ${you}'s ${slurpPartnerWord(input.herGender)} on Slurp: together${since(couple.togetherAt)}${hush}.${
      couple.stage === "rocky" ? ` Things are rocky right now${fight?.detail ? ` (${fight.detail})` : ""}.` : ""
    }`;
  const days = Math.round((input.at.getTime() - Date.parse(couple.stageAt)) / 86_400_000);
  if (couple.ending !== "breakup" || days > SLURP_EX_DAYS) return "";
  const ago = days <= 1 ? "just now" : `${days} days ago`;
  return couple.aftermath === "moveOn"
    ? `${her} and ${you} broke up on Slurp ${ago}. ${her} has moved on and does not dwell on it.`
    : `${her} and ${you} broke up on Slurp ${ago}.`;
}

/** The newest breakup of this Creator in the last `SLURP_EX_DAYS` days, or null. */
function slurpRecentEx(couples: readonly SlurpCouple[], creatorId: string, at: Date): SlurpCouple | null {
  return (
    [...couples]
      .sort((left, right) => Date.parse(right.stageAt) - Date.parse(left.stageAt))
      .find(
        (couple) =>
          couple.ending === "breakup" &&
          !slurpCoupleActive(couple) &&
          // #1293: a forgotten ex never surfaces unasked, in a post or anywhere else ambient.
          couple.aftermath !== "forget" &&
          slurpCoupleOf(couples, couple.aId, couple.bId) === couple &&
          slurpCouplePartners(couple, creatorId).length > 0 &&
          at.getTime() - Date.parse(couple.stageAt) >= 0 &&
          at.getTime() - Date.parse(couple.stageAt) < SLURP_EX_DAYS * 86_400_000,
      ) ?? null
  );
}

/** A couple of three or four, from one member's side. */
function slurpGroupLine(couple: SlurpCouple, partners: string, inChat: boolean): string {
  if (couple.stage === "split") {
    if (couple.aftermath === "forget")
      return `You have no memory of a romantic relationship with ${partners}. Whatever older messages or posts between you show are historical records only: you do not reconstruct that relationship from them or act like any romance is unfinished.`;
    const on =
      couple.aftermath === "moveOn" ? " You have moved on and do not dwell on it." : " It still comes up now and then.";
    return `${partners} are your exes: the relationship you had together is over.${on}`;
  }
  const rocky = couple.stage === "rocky" ? " Things are rocky between you right now." : "";
  const what =
    couple.stage === "together"
      ? `You are in a polyamorous relationship with ${partners}, and your fans know.`
      : `You are dating ${partners} together, a polyamorous relationship that is still new.`;
  return inChat
    ? `${what}${rocky}`
    : `${what}${rocky} They are part of your life, not the topic of everything you write.`;
}
