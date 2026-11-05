/**
 * Story state: what is true about a Creator right now, read in one place (docs/STORYLINES.md, "State").
 *
 * Pure. A creator fact may carry a condition — a track, a line for the writer, a look for pictures,
 * wardrobe tags, and a deck of small moments. Posts, DMs and pictures read the condition through
 * this, never the facts directly, so the budget below holds everywhere.
 *
 * ## The rules
 *
 * - **A track holds one condition** (`putSlpStoryFact`). Facts without a track are tags only.
 * - **Budget.** At most two lines and one look reach a prompt: by track (body first), then newest.
 *   A condition is a standing truth, not the subject: the subject comes from the beat planner,
 *   and a condition takes a post only through its deck, at its `share`.
 * - **Ties are tags.** A partner, a rival, a friend or a roommate shows as a tag so storylines can
 *   require them; the ties stay where they are.
 */
import {
  SLP_STORY_DEFAULT_SHARE,
  SLP_STORY_TRACKS,
  type SlpStoryFact,
  type SlpStoryOutcome,
} from "../../../../../shared/src/slp/slp-story-engine.js";
import type { SlpWardrobeLook, SlpWardrobeLookInput } from "../../../../../shared/src/slp/slp-wardrobe.js";
import type { SlurpContentIntent } from "../../../../../shared/src/slp/slp-content-axes.js";
import type { SlurpBond } from "../projects/slp-creator-bonds.js";
import type { SlurpCouple } from "../projects/slp-creator-couples.js";
import type { SlurpBrandDeal } from "../economy/slp-brand-deals.js";
import type { SlurpCreatorTies } from "../projects/slp-creator-ties.js";
import { slurpBeatIntents, type SlurpBeat, type SlurpBeatHistory } from "../feed/slp-post-beat.js";
import { slurpWeightedPick } from "../feed/slp-weighted.js";

export const SLURP_STORY_MAX_LINES = 2;

export type SlurpStoryDeckBeat = { line: string; withPartner?: boolean; share: number; label: string };

export type SlurpStoryState = {
  tags: string[];
  /** For the writer, at most two. */
  lines: string[];
  /** For pictures, at most one. */
  look: string | null;
  wardrobe: { prefer: string[]; avoid: string[] };
  deck: SlurpStoryDeckBeat[];
};

export const SLURP_EMPTY_STORY_STATE: SlurpStoryState = {
  tags: [],
  lines: [],
  look: null,
  wardrobe: { prefer: [], avoid: [] },
  deck: [],
};

/** The tie tags of one Creator: partner, ex, friend, roommate, coworker, family, rival, deal. */
export function slurpTieTags(
  document: {
    couples: readonly SlurpCouple[];
    bonds: readonly SlurpBond[];
    ties: Pick<SlurpCreatorTies, "rivalries">;
    deals: readonly Pick<SlurpBrandDeal, "creatorId" | "status">[];
  },
  creatorId: string,
): string[] {
  const tags = new Set<string>();
  for (const couple of document.couples)
    if ([couple.aId, couple.bId, ...(couple.moreIds ?? [])].includes(creatorId))
      tags.add(couple.stage === "split" ? "ex" : "partner");
  for (const bond of document.bonds)
    if (!bond.endedAt && (bond.aId === creatorId || bond.bId === creatorId)) tags.add(bond.kind);
  for (const rivalry of document.ties.rivalries)
    if (rivalry.stage !== "over" && (rivalry.fromId === creatorId || rivalry.toId === creatorId)) tags.add("rival");
  // A brand deal that is still running; done and declined ones are over.
  if (document.deals.some((deal) => deal.creatorId === creatorId && ["accepted", "planned"].includes(deal.status)))
    tags.add("deal");
  return [...tags];
}

export function slurpStoryState(input: {
  facts: readonly SlpStoryFact[];
  creatorId: string;
  tieTags?: readonly string[];
  at: Date;
}): SlurpStoryState {
  const now = input.at.getTime();
  const live = input.facts.filter(
    (fact) =>
      (fact.scope === "world" || fact.creatorId === input.creatorId) &&
      (!fact.expiresAt || Date.parse(fact.expiresAt) > now),
  );
  const rank = (fact: SlpStoryFact) => (fact.track ? SLP_STORY_TRACKS.indexOf(fact.track) : SLP_STORY_TRACKS.length);
  const conditions = live
    .filter((fact) => fact.scope === "creator" && fact.track)
    .sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
  return {
    tags: [...new Set([...live.map((fact) => fact.tag), ...(input.tieTags ?? [])])],
    // A condition with no line still reaches the writer: its label is the plainest line there is.
    lines: conditions.map((fact) => fact.line ?? fact.label).slice(0, SLURP_STORY_MAX_LINES),
    look: conditions.find((fact) => fact.look)?.look ?? null,
    wardrobe: {
      prefer: [...new Set(conditions.flatMap((fact) => fact.wardrobe?.prefer ?? []))],
      avoid: [...new Set(conditions.flatMap((fact) => fact.wardrobe?.avoid ?? []))],
    },
    deck: conditions.flatMap((fact) =>
      (fact.deck ?? []).map((beat) => ({
        ...beat,
        share: fact.share ?? SLP_STORY_DEFAULT_SHARE,
        label: fact.label,
      })),
    ),
  };
}

/** One deck moment for this slot at the condition's share, or null. Seeded by Creator and slot. */
function pickConditionMoment(input: {
  creatorAccountId: string;
  sequence: number;
  state: SlurpStoryState;
  recent: readonly string[];
  partner: string | null;
  avoid?: readonly string[];
}): SlurpStoryDeckBeat | null {
  const recent = new Set(input.recent);
  const avoided = (line: string) =>
    (input.avoid ?? []).some(
      (topic) => topic.trim() && line.toLocaleLowerCase().includes(topic.trim().toLocaleLowerCase()),
    );
  const candidates = input.state.deck.filter(
    (beat) => !recent.has(beat.line) && (!beat.withPartner || input.partner) && !avoided(beat.line),
  );
  if (!candidates.length) return null;
  const share = Math.max(...candidates.map((beat) => beat.share));
  const take = slurpWeightedPick("condition", input.creatorAccountId, input.sequence, [
    { value: true, weight: share },
    { value: false, weight: 1 - share },
  ]);
  if (!take) return null;
  return slurpWeightedPick(
    "conditionBeat",
    input.creatorAccountId,
    input.sequence,
    candidates.map((value) => ({ value, weight: 1 })),
  );
}

/**
 * A small moment of a standing condition as this slot's beat, at the condition's share; null
 * otherwise. A line this Creator used lately is skipped. `partner` is the partner's name, used only
 * for a beat written with the partner in it.
 */
export function slurpConditionBeat(input: {
  creatorAccountId: string;
  sequence: number;
  state: SlurpStoryState;
  history: Pick<SlurpBeatHistory, "recentAnchors">;
  intents: readonly SlurpContentIntent[];
  partner: string | null;
  /** The player's avoided topics: a moment that names one is left out. */
  avoid?: readonly string[];
}): SlurpBeat | null {
  const beat = pickConditionMoment({ ...input, recent: input.history.recentAnchors.slice(0, 8) });
  if (!beat) return null;
  const type = beat.withPartner ? "relationship_moment" : "sensory_mood";
  if (!slurpBeatIntents(type).some((intent) => input.intents.includes(intent))) return null;
  return {
    type,
    anchorKind: "condition",
    anchor: beat.line,
    line: beat.line,
    cast: beat.withPartner && input.partner ? [input.partner] : [],
    place: null,
  };
}

/** What a post prompt gets of the state: the standing lines, and for a post with no beat a moment. */
export type SlurpStoryNow = { lines: readonly string[]; moment: string | null };

/**
 * The state for one post prompt. A post with a beat has its subject. A plain post without one (the
 * classic planner; a beats slot that found nothing) may be about a deck moment, at the same share.
 * ponytail: no memory of used moments here, so one can repeat; the beats planner skips recent ones.
 */
export function slurpStoryNow(
  state: SlurpStoryState,
  creatorAccountId: string,
  sequence: number,
  avoid: readonly string[] | undefined,
  plain: boolean,
): SlurpStoryNow {
  const moment = plain
    ? pickConditionMoment({ creatorAccountId, sequence, state, recent: [], partner: null, avoid })
    : null;
  return { lines: state.lines, moment: moment?.line ?? null };
}

/**
 * The closet as a condition wants it: avoided tags left out, preferred tags only when any look has
 * one. A condition never leaves the closet empty: if nothing is left, the closet stays as it was.
 */
export function slurpConditionCloset<T extends Pick<SlpWardrobeLook, "tags">>(
  looks: readonly T[],
  wardrobe: SlurpStoryState["wardrobe"],
): T[] {
  const has = (look: T, tags: readonly string[]) =>
    look.tags.some((item) => tags.some((wanted) => item.toLocaleLowerCase() === wanted.toLocaleLowerCase()));
  const kept = wardrobe.avoid.length ? looks.filter((look) => !has(look, wardrobe.avoid)) : [...looks];
  const preferred = wardrobe.prefer.length ? kept.filter((look) => has(look, wardrobe.prefer)) : [];
  const result = preferred.length ? preferred : kept;
  return result.length ? result : [...looks];
}

/**
 * What one look outcome changes in a Creator's closet (docs/STORYLINES.md, PR 5c): a look to add,
 * never twice, or the look this storyline gave to take away. The player's own looks always stay.
 */
export function slurpStoryLookChange(
  outcome: SlpStoryOutcome,
  looks: readonly Pick<SlpWardrobeLook, "id" | "name" | "source">[],
  /** The storyline's name: it only takes back a look it gave itself. */
  label?: string,
): { add: SlpWardrobeLookInput } | { remove: string } | null {
  if (outcome.kind !== "add-look" && outcome.kind !== "remove-look") return null;
  const name = (outcome.kind === "add-look" ? outcome.look.name : outcome.name).toLocaleLowerCase();
  const given = looks.find(
    (look) => look.source.kind === "storyline" && look.source.label === label && look.name.toLocaleLowerCase() === name,
  );
  if (outcome.kind === "remove-look") return given ? { remove: given.id } : null;
  return given ? null : { add: outcome.look };
}
