/**
 * A collab is WORK (U, user): the host announces it first ("collab with @kai drops Friday"), the
 * joint post goes up on its drop day with both pages tagged, it splits as agreed, and it brings fans
 * across from one page to the other. A couple is LIFE and has none of this (`slp-couple-beats.ts`).
 *
 * Pure and deterministic, no model call. The beats (`slp-tie-beats.ts`) and the ties service use it.
 */
import { hash } from "./slp-project.js";
import type { SlurpCollab, SlurpCreatorTies } from "./slp-creator-ties.js";

const MINUTE = 60_000;

/** Interests read from a card, so "a baker" and "loves sourdough" land in the same niche. */
export const SLURP_COLLAB_INTERESTS: readonly { id: string; words: RegExp; ideas: readonly string[] }[] = [
  {
    id: "fitness",
    words:
      /\b(gym|work ?outs?|training|fitness|lift(s|ing)?|runn(ing|er)|yoga|pilates|climb\w*|boxing|sports?|athlet\w*|cardio|bouldering|Sport)\b/iu,
    ideas: [
      "a workout together, one of you pushing the other",
      "a joint training day with a challenge at the end",
      "teaching each other one move you are best at",
    ],
  },
  {
    id: "style",
    words:
      /\b(fashion\w*|style|stylish|outfits?|wardrobe|model(ing|s)?|lingerie|shopping|thrift\w*|streetwear|vintage|Mode)\b/iu,
    ideas: [
      "a styling swap: each of you dresses the other",
      "a thrift run with a budget and a winner",
      "matching looks for one shared shoot",
    ],
  },
  {
    id: "food",
    // Not coffee or "bakery": nearly every card drinks coffee, and "lives above a bakery" is a place. Both
    // made a climbing coach a flour brand's pick in the 7b-c measure.
    words:
      /\b(cook\w*|bak(e|es|er|ing)|chef|kitchen|recipes?|food\w*|Küche|kochen|backen|Backstube|Bäcker\w*|Brot)\b/iu,
    ideas: [
      "a cooking night, one dish each",
      "one recipe, made both your ways",
      "a market run and whatever you cook from it",
    ],
  },
  {
    id: "art",
    words: /\b(art|artist|paint\w*|draw\w*|sketch\w*|illustrat\w*|tattoo\w*|ink|design\w*|craft\w*)\b/iu,
    ideas: [
      "one piece made together, half each",
      "drawing each other, no peeking",
      "a small art swap: one piece each, traded",
    ],
  },
  {
    id: "music",
    words: /\b(music\w*|sing(s|er|ers|ing)?|songs?|band|guitar|piano|dj|producer|rapper|concerts?|vinyl)\b/iu,
    ideas: [
      "a little jam session, recorded",
      "a cover of one song you both love",
      "swapping playlists and reacting to each other's",
    ],
  },
  {
    id: "games",
    words: /\b(gam(e|es|er|ing)|stream\w*|twitch|console|esports?|cosplay\w*|anime|manga)\b/iu,
    ideas: [
      "a game night on stream, with some trash talk",
      "a co-op run with one rule each",
      "a costume or cosplay swap for one evening",
    ],
  },
  {
    id: "beauty",
    words: /\b(make-?up|beauty|skin ?care|nails|hair\w*|salon|glam)\b/iu,
    ideas: ["a get-ready-together session", "doing each other's look", "a skincare swap and honest reviews"],
  },
  {
    id: "outdoors",
    words: /\b(hik(e|es|ing)|travel\w*|trips?|beach|surf\w*|camping|nature|mountains?|road ?trip|sailing)\b/iu,
    ideas: [
      "a day out together somewhere new",
      "a sunrise trip neither of you wants to get up for",
      "a picnic spot one of you swears by",
    ],
  },
  {
    id: "night",
    words: /\b(party\w*|clubs?|clubbing|bars?|cocktails?|nightlife|rave\w*|bartend\w*)\b/iu,
    ideas: [
      "a night out together, the before and the after",
      "one bar each, the other judges",
      "a pre-party at one place, the party at the other",
    ],
  },
  {
    id: "books",
    words: /\b(books?|read(s|ing|er)?|writ(e|er|ing)|poet\w*|librar\w*|novels?)\b/iu,
    ideas: [
      "a swap of favourite books, and a reading date",
      "a tiny book club of two",
      "reading each other's comfort book",
    ],
  },
];

/** Of the partner's fans, about this share come across after a collab; capped per collab. */
export const SLURP_CROSSOVER_SHARE = 0.08;
export const SLURP_CROSSOVER_MAX = 30;

/**
 * When an announced collab drops: tomorrow or the day after, in the evening (6, 7 or 8 pm, host
 * time). V (orchestrator decision on U): the drop holds its exact hour like a teased drop, so with the
 * host's `busy` times (posts and held slots) it takes the first evening hour (5 to 9 pm, the rolled one
 * first) clear of them by the host's own spacing; with none clear, the rolled hour.
 */
export function slurpCollabDropAt(
  id: string,
  at: Date,
  slots: { busy: readonly number[]; spacingMs: number } | null = null,
): string {
  const roll = hash(`${id}:drop`);
  const drop = new Date(at);
  drop.setDate(drop.getDate() + 1 + (roll % 2));
  const first = 18 + (roll % 3);
  const hours = [first, ...[17, 18, 19, 20, 21].filter((hour) => hour !== first)];
  const free = slots
    ? hours.find((hour) => {
        const time = new Date(drop).setHours(hour, 0, 0, 0);
        return slots.busy.every((busy) => Math.abs(busy - time) >= slots.spacingMs);
      })
    : undefined;
  drop.setHours(free ?? first, 0, 0, 0);
  return drop.toISOString();
}

/**
 * What an agreed collab asks of its host now: announce it, post it (its drop is due), or wait. A
 * collab agreed before announcements existed announces first too; one already planned or up is done.
 * `dueAt` is the slot's own time (the reserve prepares slots ahead): the slot held at the drop hour
 * takes the drop, and a later slot takes it when something else had that one.
 */
export function slurpCollabStep(collab: SlurpCollab, at: Date, dueAt?: Date | null): "announce" | "post" | "wait" {
  if (collab.status !== "agreed") return "wait";
  if (!collab.announcedAt) return "announce";
  return !collab.dropAt || Date.parse(collab.dropAt) - MINUTE <= (dueAt ?? at).getTime() ? "post" : "wait";
}

/** The host's slot took the announcement: the joint post waits for its drop hour. */
export function slurpAnnounceCollab(
  ties: SlurpCreatorTies,
  id: string,
  at: Date,
  dropAt = slurpCollabDropAt(id, at),
): SlurpCreatorTies {
  return {
    ...ties,
    collabs: ties.collabs.map((collab) =>
      collab.id === id && !collab.announcedAt ? { ...collab, announcedAt: at.toISOString(), dropAt } : collab,
    ),
  };
}

/** The slot at `slotAt` is the one held for a collab this Creator hosts (V): its drop, to the minute. */
export function slurpHoldsCollabDrop(ties: SlurpCreatorTies, hostId: string, slotAt: Date): boolean {
  return ties.collabs.some(
    (collab) =>
      collab.hostId === hostId &&
      collab.status === "agreed" &&
      Boolean(collab.dropAt) &&
      Math.abs(Date.parse(collab.dropAt!) - slotAt.getTime()) < MINUTE,
  );
}

/**
 * Fans who come across after a collab: of the other page's followers and subscribers who do not
 * follow this one yet, about one in twelve (subscribers first: they care most), at most 30. Picked
 * by a seed, so a repeated settle picks the same people.
 */
export function slurpCollabCrossover(
  fans: readonly { memberId: string; stage: string }[],
  alreadyHere: ReadonlySet<string>,
  seed: string,
): string[] {
  const rank = (stage: string) => (["subscriber", "regular", "whale"].includes(stage) ? 0 : 1);
  const eligible = fans.filter(
    (fan) => ["follower", "subscriber", "regular", "whale"].includes(fan.stage) && !alreadyHere.has(fan.memberId),
  );
  const count = Math.min(SLURP_CROSSOVER_MAX, Math.round(eligible.length * SLURP_CROSSOVER_SHARE));
  return [...eligible]
    .sort(
      (left, right) =>
        rank(left.stage) - rank(right.stage) || hash(`${seed}:${left.memberId}`) - hash(`${seed}:${right.memberId}`),
    )
    .slice(0, count)
    .map((fan) => fan.memberId);
}
