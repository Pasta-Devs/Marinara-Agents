/**
 * Drama casting (`docs/DRAMA.md`): who may fill a role, the cast search, and what a storyline's start asks
 * of its lead. Pure and seeded, like the runtime that calls it.
 */
import { slpRomancePairAllowed } from "../../../../../../shared/src/slp/slp-creator-steering.js";
import { hash } from "../../projects/slp-project.js";
import type { SlpDramaOutcome, SlpDramaRole, SlpFit } from "../../../../../../shared/src/slp/slp-drama.js";
import { SLP_EXPLICIT_LEVELS } from "../../../../../../shared/src/slp/slp-spice.js";
import { slurpPackFits } from "../../feed/slp-occasion-beats.js";
import { slurpTasteWeight } from "../../creators/slp-spice.js";
import type {
  SlpStoryRequires,
  SlpStoryline,
  SlpStorylineOutcome,
  SlpStorylineStage,
} from "../../../../../../shared/src/slp/slp-storyline.js";
import type { SlpDramaCreator, SlpDramaWorld } from "./slp-drama-runtime.js";

const DAY = 86_400_000;
const NEWCOMER_DAYS = 14;
const pairKey = (kind: string, a: string, b: string) => `${kind}:${[a, b].sort().join("|")}`;

export const couplePairs = (storyline: SlpStoryline) =>
  [
    ...storyline.stages.flatMap((stage) => stage.leave),
    ...storyline.endings.flatMap((ending) => ending.outcomes),
  ].flatMap((outcome) => (outcome.kind === "tie" && outcome.tie === "couple" ? [outcome.between] : []));
export const tieOutcomes = (list: readonly SlpStorylineOutcome[]) =>
  list.filter(
    (outcome): outcome is SlpDramaOutcome =>
      outcome.kind === "tie" || outcome.kind === "end-tie" || outcome.kind === "temperature",
  );
export const meets = (requires: SlpStoryRequires, tags: ReadonlySet<string>) =>
  requires.tags.every((tag) => tags.has(tag)) && !requires.lacks.some((tag) => tags.has(tag));

/** A `fit` gate (docs/STORYLINES.md, PR 5) on one Creator; a gated entry whose card text is not known does not fit. */
export const slpFitsCreator = (fit: SlpFit | undefined, creator: SlpDramaCreator | undefined): boolean =>
  !fit ||
  (creator?.fitText !== undefined &&
    slurpPackFits(fit, {
      text: creator.fitText,
      level: SLP_EXPLICIT_LEVELS[creator.spice] ?? "none",
      hardNoes: creator.hardNoes ?? [],
      avoid: creator.avoid ?? [],
    }));

/** Whether a storyline has a `fit` anywhere, so the world has to read card texts for it. */
export const slpStorylineGated = (storyline: SlpStoryline): boolean =>
  Boolean(storyline.fit) ||
  storyline.stages.some(
    (stage) =>
      stage.fit ||
      stage.choice?.options.some((option) => option.fit) ||
      [...stage.beats, ...stage.deck].some((beat) => beat.fit),
  ) ||
  storyline.endings.some((ending) => ending.beat?.fit);

// ─── Casting ────────────────────────────────────────────────────────────────────────────────────

function fits(
  role: SlpDramaRole,
  creator: SlpDramaCreator,
  cast: Readonly<Record<string, string>>,
  world: SlpDramaWorld,
  playerKey: string | undefined,
): { ok: boolean; player?: string } {
  if (Boolean(role.player) !== !creator.automatic) return { ok: false };
  const needs = role.needs;
  if (needs.gender && creator.gender !== needs.gender) return { ok: false };
  if (needs.minSpice !== undefined && creator.spice < needs.minSpice) return { ok: false };
  if (needs.sharesNicheWith) {
    const other = world.creators.find((entry) => entry.id === cast[needs.sharesNicheWith!]);
    const tags = new Set(other?.tags.map((tag) => tag.toLocaleLowerCase()) ?? []);
    if (!other || !creator.tags.some((tag) => tags.has(tag.toLocaleLowerCase()))) return { ok: false };
  }
  if (needs.tiedTo) {
    const other = cast[needs.tiedTo.role];
    if (!other || !needs.tiedTo.kinds.some((kind) => world.ties.has(pairKey(kind, creator.id, other))))
      return { ok: false };
  }
  if (needs.relationToPlayer) {
    const match = (world.relations.get(creator.id) ?? []).find(
      (entry) =>
        needs.relationToPlayer!.includes(entry.relation) &&
        (!playerKey || !cast[playerKey] || cast[playerKey] === entry.playerId),
    );
    return match ? { ok: true, player: match.playerId } : { ok: false };
  }
  return { ok: true };
}

/**
 * Fills `keys` that are not cast yet. Returns the new cast, or null when a key cannot be filled. A
 * player role is the page tied to whoever needed a relation to the player, else the first page.
 */
export function slpDramaCast(
  roles: readonly SlpDramaRole[],
  keys: readonly string[],
  cast: Readonly<Record<string, string>>,
  input: {
    world: SlpDramaWorld;
    busy: ReadonlySet<string>;
    seed: string;
    at: Date;
    couples?: readonly (readonly [string, string])[];
    /** The storyline's `fit`, checked on whoever takes the first role. */
    leadFit?: SlpFit;
  },
): Record<string, string> | null {
  const next = { ...cast };
  // Couple roles keep the romance settings, cast before (a situation, a stage) or now.
  const who = (id?: string) => input.world.creators.find((creator) => creator.id === id);
  const pairOk = (a?: string, b?: string) => slpRomancePairAllowed(who(a), who(b));
  if (!(input.couples ?? []).every(([x, y]) => pairOk(cast[x], cast[y]))) return null;
  const byKey = new Map(roles.map((role) => [role.key, role]));
  const playerKey = roles.find((role) => role.player)?.key;
  // A role's conditions name other roles ("tied to him"): those are cast too, and first.
  const wanted = new Set(keys);
  for (const key of keys) {
    const needs = byKey.get(key)?.needs;
    if (needs?.tiedTo) wanted.add(needs.tiedTo.role);
    if (needs?.sharesNicheWith) wanted.add(needs.sharesNicheWith);
  }
  const order = [...wanted].sort((a, b) => {
    const depends = (key: string) =>
      Number(Boolean(byKey.get(key)?.needs.sharesNicheWith || byKey.get(key)?.needs.tiedTo || byKey.get(key)?.player));
    return depends(a) - depends(b);
  });
  // A small search: try the best candidates for each role in order and step back when a later role
  // cannot be filled ("her partner" only works for someone who has one). Bounded, so it stays cheap.
  let budget = 400;
  const fill = (index: number, current: Record<string, string>): Record<string, string> | null => {
    const key = order[index];
    if (key === undefined) return current;
    if (current[key]) return fill(index + 1, current);
    const role = byKey.get(key);
    if (!role) return null;
    const taken = new Set(Object.values(current));
    const options = input.world.creators
      .filter((creator) => !taken.has(creator.id) && (role.player || !input.busy.has(creator.id)))
      .filter((creator) => key !== roles[0]?.key || slpFitsCreator(input.leadFit, creator))
      .map((creator) => ({ creator, fit: fits(role, creator, current, input.world, playerKey) }))
      .filter((option) => {
        const as = (role: string) => (role === key ? option.creator.id : current[role]);
        return option.fit.ok && (input.couples ?? []).every(([x, y]) => pairOk(as(x), as(y)));
      })
      .sort((left, right) => {
        const newcomer = (creator: SlpDramaCreator) =>
          Number(input.at.getTime() - Date.parse(creator.joinedAt) < NEWCOMER_DAYS * DAY);
        if (role.prefer === "newcomer" && newcomer(left.creator) !== newcomer(right.creator))
          return newcomer(right.creator) - newcomer(left.creator);
        if (role.prefer === "popular" && left.creator.followers !== right.creator.followers)
          return right.creator.followers - left.creator.followers;
        // A lead whose turn-ons match the storyline's fit words is likelier, not certain, to take it.
        const lean = (creator: SlpDramaCreator) =>
          key === roles[0]?.key
            ? slurpTasteWeight(
                input.leadFit,
                (creator.turnOns ?? []).map((text) => ({ text, strength: "often" as const })),
              )
            : 1;
        if (lean(left.creator) !== 1 || lean(right.creator) !== 1) {
          const rank = (creator: SlpDramaCreator) =>
            (((hash(`${input.seed}:${key}:${creator.id}`) % 10_000) + 1) / 10_001) ** (1 / lean(creator));
          return rank(right.creator) - rank(left.creator);
        }
        return hash(`${input.seed}:${key}:${left.creator.id}`) - hash(`${input.seed}:${key}:${right.creator.id}`);
      });
    for (const pick of options) {
      if ((budget -= 1) < 0) return null;
      const tried = { ...current, [key]: pick.creator.id };
      // Whoever needs a relation to the player brings that player's page along.
      if (pick.fit.player && playerKey && !tried[playerKey]) tried[playerKey] = pick.fit.player;
      const done = fill(index + 1, tried);
      if (done) return done;
    }
    return null;
  };
  return fill(0, next);
}

/** Every role a stage names: its beats' actors, targets and heat people, its choice role, its outcomes. */
export function stageRoles(stage: SlpStorylineStage, roles: readonly SlpDramaRole[]): string[] {
  const keys = [
    ...stage.beats.flatMap((beat) => [beat.role, beat.to, beat.on, beat.heat?.with, beat.heat?.shotBy, beat.heat?.for]),
    stage.choice?.role,
    stage.choice?.asks === "player" ? roles.find((role) => role.player)?.key : undefined,
    ...tieOutcomes(stage.leave).flatMap((outcome) => outcome.between),
  ];
  return [...new Set(keys.filter((key): key is string => Boolean(key) && key !== "crowd" && key !== "fans"))];
}

/**
 * Whether this drama can start now with `leadId` in its first role: the rest of its first stage is
 * cast as the tick would, and the lead must still fit once they are (Stir's lead pick, 0.3.11).
 */
export function slpDramaLeadFits(
  drama: SlpStoryline,
  leadId: string,
  input: { world: SlpDramaWorld; busy: ReadonlySet<string>; at: Date },
): boolean {
  const role = drama.cast[0]!;
  const lead = input.world.creators.find((creator) => creator.id === leadId);
  if (!lead || drama.start.within || (input.busy.has(leadId) && !role.player)) return false;
  if (!meets(drama.requires, new Set(lead.storyTags ?? [])) || !slpFitsCreator(drama.fit, lead)) return false;
  const cast = slpDramaCast(
    drama.cast,
    [role.key, ...stageRoles(drama.stages[0]!, drama.cast)],
    { [role.key]: leadId },
    {
      ...input,
      seed: `lead:${leadId}`,
      couples: couplePairs(drama),
    },
  );
  const playerKey = drama.cast.find((entry) => entry.player)?.key;
  return Boolean(cast && fits(role, lead, cast, input.world, playerKey).ok);
}
