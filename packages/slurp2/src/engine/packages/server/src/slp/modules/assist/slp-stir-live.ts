// Stir's "In play" strip and "Suggested" cards, the pure half (W): what is going on in the world right
// now, and up to three plays that fit it. Code only, no AI call (concept slice 7).
import type { SlpStirLive, SlpStirSuggestion } from "../../../../../shared/src/slp/slp-stir.js";

type Person = { id: string; name: string; avatarUrl: string | null };

export type SlpStirLiveInput = {
  at: Date;
  creators: (Person & {
    automatic: boolean;
    /** A couple's shared page: never "quiet", never set up (0.3.1). */
    couplePage?: boolean;
    lastPostAt: string | null;
    pace: string;
    ideas: number;
  })[];
  couples: { id: string; aId: string; bId: string; moreIds?: string[]; stage: string; stageAt: string }[];
  collabs: { id: string; hostId: string; partnerId: string; status: string; dropAt?: string | null }[];
  rivalries: { id: string; fromId: string; toId: string; stage: string }[];
  events: { id: string; name: string; running: boolean; endsAt: string | null }[];
  /** Brand deals the player's own page took and still owes a post for. */
  owed: { id: string; creatorId: string; brand: string }[];
  /** No play in the ledger yet: the first-visit card offers one to start with. */
  firstVisit: boolean;
  /** Free pairs with chemistry, best first (`slurpCoupleMatches`). */
  matches?: { aId: string; bId: string }[];
  /** Suggestion ids the player put away for now. */
  dismissed?: ReadonlySet<string>;
};

const DAY_MS = 86_400_000;
const QUIET_DAYS = 4;
const SPARKS_DAYS = 3;

/** Everything live, love first (what players come back for), then work, drama, the world, and pace. */
export function slpStirLive(input: SlpStirLiveInput): SlpStirLive[] {
  const byId = new Map(input.creators.map((creator) => [creator.id, creator]));
  const who = (...ids: string[]) =>
    ids.flatMap((id) => {
      const found = byId.get(id);
      return found ? [{ id: found.id, name: found.name, avatarUrl: found.avatarUrl }] : [];
    });
  return [
    ...input.events
      .filter((event) => event.running)
      .map((event) => ({
        id: `event:${event.id}`,
        kind: "event" as const,
        who: [],
        state: "running",
        label: event.name,
        until: event.endsAt,
      })),
    ...input.couples
      .filter((couple) => couple.stage !== "split")
      .map((couple) => ({
        id: `couple:${couple.id}`,
        kind: "couple" as const,
        who: who(couple.aId, couple.bId, ...(couple.moreIds ?? [])),
        state: couple.stage,
        label: null,
        until: null,
      })),
    ...input.collabs.map((collab) => ({
      id: `collab:${collab.id}`,
      kind: "collab" as const,
      who: who(collab.hostId, collab.partnerId),
      state: collab.status,
      label: null,
      until: collab.dropAt ?? null,
    })),
    ...input.rivalries.map((rivalry) => ({
      id: `rivalry:${rivalry.id}`,
      kind: "rivalry" as const,
      who: who(rivalry.fromId, rivalry.toId),
      state: rivalry.stage,
      label: null,
      until: null,
    })),
    ...input.creators
      .filter((creator) => creator.pace === "break" || creator.pace === "very_busy")
      .map((creator) => ({
        id: `pace:${creator.id}`,
        kind: "break" as const,
        who: who(creator.id),
        state: creator.pace,
        label: null,
        until: null,
      })),
    ...input.creators
      .filter((creator) => creator.ideas > 0)
      .map((creator) => ({
        id: `ideas:${creator.id}`,
        kind: "ideas" as const,
        who: who(creator.id),
        state: "queued",
        label: String(creator.ideas),
        until: null,
      })),
  ].filter((entry) => entry.kind === "event" || entry.who.length > 0);
}

/** The order suggestions are worth it in: love first, then money owed, then drama, the quiet, the world. */
const SUGGESTION_ORDER: SlpStirSuggestion["kind"][] = [
  "firstPlay",
  "rocky",
  "sparks",
  "owedAd",
  "match",
  "cooling",
  "quiet",
  "event",
];

/**
 * Up to three plays that fit what is going on: a couple stuck at flirting, a rough patch, an owed #ad
 * post, two free Creators who would click, a feud to cool, a Creator gone quiet, an event to start,
 * and on the first visit one pair to set up. Every rule offers all it finds; the three shown are the
 * best of different kinds first, and one the player put away does not come back until it expires.
 * Each comes with a ready step where one is clear; a quiet Creator opens the idea card instead (the
 * idea is the player's).
 */
export function slpStirSuggestions(input: SlpStirLiveInput): SlpStirSuggestion[] {
  const byId = new Map(input.creators.map((creator) => [creator.id, creator]));
  const who = (...ids: string[]) =>
    ids.flatMap((id) => {
      const found = byId.get(id);
      return found ? [{ id: found.id, name: found.name, avatarUrl: found.avatarUrl }] : [];
    });
  const age = (iso: string | null) => (iso ? (input.at.getTime() - Date.parse(iso)) / DAY_MS : Infinity);
  const people = input.creators.filter((creator) => !creator.couplePage);
  const out: SlpStirSuggestion[] = [];
  for (const rocky of input.couples.filter((couple) => couple.stage === "rocky"))
    out.push({
      id: `rocky:${rocky.id}`,
      kind: "rocky",
      who: who(rocky.aId, rocky.bId),
      label: null,
      step: { action: "steer-couple", input: { coupleId: rocky.id, steer: "patchUp" } },
    });
  for (const sparks of input.couples.filter(
    (couple) => couple.stage === "sparks" && age(couple.stageAt) >= SPARKS_DAYS,
  ))
    out.push({
      id: `sparks:${sparks.id}`,
      kind: "sparks",
      who: who(sparks.aId, sparks.bId),
      label: null,
      step: { action: "steer-couple", input: { coupleId: sparks.id, steer: "date" } },
    });
  for (const owed of input.owed)
    out.push({ id: `owed:${owed.id}`, kind: "owedAd", who: who(owed.creatorId), label: owed.brand, step: null });
  for (const match of (input.matches ?? []).slice(0, 3))
    if (byId.has(match.aId) && byId.has(match.bId))
      out.push({
        id: `match:${match.aId}:${match.bId}`,
        kind: "match",
        who: who(match.aId, match.bId),
        label: null,
        step: { action: "set-up-couple", input: { aId: match.aId, bId: match.bId } },
      });
  for (const feud of input.rivalries.filter((rivalry) => rivalry.stage === "feud"))
    out.push({
      id: `cooling:${feud.id}`,
      kind: "cooling",
      who: who(feud.fromId, feud.toId),
      label: null,
      step: { action: "cool-rivalry", input: { rivalryId: feud.id } },
    });
  for (const quiet of people
    .filter((creator) => creator.automatic && creator.pace !== "break" && age(creator.lastPostAt) >= QUIET_DAYS)
    .sort((left, right) => age(right.lastPostAt) - age(left.lastPostAt)))
    out.push({
      id: `quiet:${quiet.id}`,
      kind: "quiet",
      who: who(quiet.id),
      label: Number.isFinite(age(quiet.lastPostAt)) ? String(Math.floor(age(quiet.lastPostAt))) : null,
      step: null,
    });
  // One event a day, the same all day (not a new pick on every visit).
  const idle = input.events.filter((event) => !event.running);
  const day = Math.floor(input.at.getTime() / DAY_MS);
  const event = idle.length ? idle[day % idle.length] : null;
  if (event)
    out.push({
      id: `event:${event.id}`,
      kind: "event",
      who: [],
      label: event.name,
      step: { action: "start-event", input: { eventId: event.id } },
    });
  if (input.firstVisit && input.couples.every((couple) => couple.stage === "split")) {
    const match = input.matches?.[0];
    const [a, b] = match ? [byId.get(match.aId), byId.get(match.bId)] : people.filter((creator) => creator.automatic);
    if (a && b)
      out.push({
        id: `first:${a.id}:${b.id}`,
        kind: "firstPlay",
        who: who(a.id, b.id),
        label: null,
        step: { action: "set-up-couple", input: { aId: a.id, bId: b.id } },
      });
  }
  const open = out
    // The first-visit pair is the best match already; do not offer the same two twice (and not as
    // a match once the player put the first-visit card away).
    .filter(
      (suggestion, _index, all) =>
        suggestion.kind !== "match" ||
        !all.some((other) => other.kind === "firstPlay" && other.id.slice(6) === suggestion.id.slice(6)),
    )
    .filter((suggestion) => !input.dismissed?.has(suggestion.id))
    .sort((left, right) => SUGGESTION_ORDER.indexOf(left.kind) - SUGGESTION_ORDER.indexOf(right.kind));
  const firsts = open.filter(
    (suggestion, index) => open.findIndex((other) => other.kind === suggestion.kind) === index,
  );
  return [...firsts, ...open.filter((suggestion) => !firsts.includes(suggestion))].slice(0, 3);
}
