// ──────────────────────────────────────────────
// Otome Forge: the Confrontation (plan M2b "Confrontation", P12; design "Mini-games": three rounds of argument)
// ──────────────────────────────────────────────
// A confrontation node is written in one call (P12, S/story/beats.ts writes it): an opening, three rounds of his lines
// with four stances each (Press, Hold, Yield, Reveal), and three endings. The beat keeps the opening as its `segments`
// and the rest as `confrontation`, which never reaches the client whole: toConfrontationView shows the rounds played
// and the one being played, his answer to each stance taken, and the ending once reached. His composure is never
// shown, nor a stance not taken, nor an ending not reached. Each list is normalized with P6's rules and keeps the
// reply's speaker voices (`voices`), and the game is one beat: a love interest thinks at most once on any path through
// it, and it is set in at most BEAT_PLACES_MAX places (normalizeConfrontationReply).
//
// Resolution: composure starts at 2 and moves by each picked option's own −1, 0 or +1 within 0–4 (SH/arcs.ts). After
// round 3, 0 is the truth (trust +1), 4 a walkout (a major grievance he holds, or a rupture when trust is at −2 or
// below), anything else a standoff (tension +1). Each Reveal records her disclosure. All of it is first play only:
// every stance is saved on the beat once, and its effects reach `${R}:state` through applyChoiceEffects, whose
// `applied` entries (`${i}/stance-<k>`, `${i}/confrontation`) make each land exactly once, with the per-beat and
// per-chapter clamps. Everything here is pure.
//
// The Closer (#1938, P12c) is the warm climax on the same machinery, stored in the same slot with `kind: "closer"`:
// the love interest offers something each round and the protagonist answers with Reassure, Tease, Mirror or Ask. Their
// guard runs on the composure line; 0 is Opened up (trust +1 and, the first time, a "first-opened-up" Love Timeline
// entry), 4 is Shut out (trust −1 and a minor grievance they hold), anything else is Almost (nothing changes). Mirror
// records the protagonist's disclosure as Reveal does; its `applied` entries are `${i}/stance-<k>` and `${i}/closer`.
// CLIMAX holds what differs between the two.
import { forgeChoiceLabel } from "@forge-kit/player-choice-text.mjs";
import { forgeSpeakerGenders } from "@forge-kit/player-choices-server.mjs";
import type {
  Beat,
  Chapter,
  ChapterNode,
  Confrontation,
  ConfrontationEndingView,
  ConfrontationOption,
  ConfrontationRoundView,
  ConfrontationView,
  Effect,
  LiId,
  LiState,
  RunState,
  Segment,
  Unit,
} from "../../../../../client/src/features/otome-forge/shared/api-types.js";
import {
  CLIMAX_ENDINGS,
  CLIMAX_MOVES,
  CONFRONTATION_ROUNDS,
  WALKOUT_RUPTURE_TRUST,
  climaxOf,
  closerEndingFor,
  composureAfter,
  endingFor,
  type ClimaxEnding,
  type ClimaxKind,
  type ClimaxMove,
} from "../../../../../client/src/features/otome-forge/shared/arcs.js";
import type { MusicMood } from "../../../../../client/src/features/otome-forge/shared/faces.js";
import { keepTimeline } from "../schemas/state.js";
import { applyChoiceEffects } from "../state/relationship.js";
import {
  BEAT_PLACES_MAX,
  CONFRONTATION_ANSWER_MAX,
  CLOSER_INTIMATE_ENDING_MAX,
  CONFRONTATION_ENDING_MAX,
  CONFRONTATION_HIS_MAX,
  CONFRONTATION_OPENING_MAX,
  type ConfrontationReply,
} from "./prompts.js";

const LABEL_MAX = 200;
const SELECTION_MAX = 400;
const TEXT_MAX = 600;
const NAME_MAX = 120;

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** What a Confrontation and a Closer differ in; everything else is the same game. */
interface ClimaxSpec {
  moves: readonly ClimaxMove[];
  endings: readonly ClimaxEnding[];
  /** The ending a final composure (a Closer's guard) reaches. */
  endingFor(level: number): ClimaxEnding;
  /** The move that tells something true about the protagonist, recorded once as a disclosure. */
  discloses: ClimaxMove;
  severity: "major" | "minor";
  /** The reply's field for an option's hidden −1, 0 or +1 (stored as `composure`). */
  moveField: "composure" | "guard";
  /** The moods a reply may pick, the first being the default. */
  moods: readonly MusicMood[];
  /** The `applied` entry of its ending, and its name in the repair turn and the canon. */
  noun: ClimaxKind;
  grievanceWhy: string;
  disclosureWhy: string;
}

export const CLIMAX: Readonly<Record<ClimaxKind, ClimaxSpec>> = {
  confrontation: {
    moves: CLIMAX_MOVES.confrontation,
    endings: CLIMAX_ENDINGS.confrontation,
    endingFor,
    discloses: "reveal",
    severity: "major",
    moveField: "composure",
    moods: ["tense", "angst"],
    noun: "confrontation",
    grievanceWhy: "what a walkout leaves between them",
    disclosureWhy: "what the protagonist tells them in reveal",
  },
  closer: {
    moves: CLIMAX_MOVES.closer,
    endings: CLIMAX_ENDINGS.closer,
    endingFor: closerEndingFor,
    discloses: "mirror",
    severity: "minor",
    moveField: "guard",
    moods: ["tender", "confession"],
    noun: "closer",
    grievanceWhy: "what being shut out leaves between them",
    disclosureWhy: "what the protagonist shares of themselves in mirror",
  },
};

/** The Love Timeline first an Opened up Closer marks, once per love interest. */
export const OPENED_UP_FIRST = "opened-up";
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * Whom the protagonist plays a climax node with (a Confrontation's opponent, a Closer's partner): the chapter's own
 * love interest or its Lead when present, else the first love interest in the node. Null when nobody is (the node is
 * then written as an ordinary beat, framed as its kind).
 */
export function confrontationOpponent(
  chapter: Pick<Chapter, "li" | "lead">,
  node: Pick<ChapterNode, "kind" | "cast">,
  units: ReadonlyArray<Pick<Unit, "id">>,
): LiId | null {
  if (node.kind !== "confrontation" && node.kind !== "closer") return null;
  const known = node.cast.filter((li) => units.some((unit) => unit.id === li));
  const owner = chapter.li ?? chapter.lead;
  return known.includes(owner) ? owner : (known[0] ?? null);
}

/** How beats.ts normalizes one list of segments (its P6 rules), lent to P12's reply. */
export interface SegmentLists {
  /** A specific place-reference validation error, before list() reduces invalid input to null. */
  placesProblem?(raw: unknown): string;
  /** The list in its saved shape from `start` (the place it opens in); null when nothing usable is left. */
  list(raw: unknown, start: string): { segments: Segment[]; places: Array<{ name: string; tags: string }> } | null;
  /**
   * Why the list's thoughts break the rules (a love interest's before stage 2, or a second one in the scene), or "".
   * `counts` holds each love interest's thoughts on the way to this list, and gets the list's added.
   */
  thoughts(raw: unknown[], counts: Map<string, number>): string;
}

/** The stored parts a P12 (P12c) reply becomes: the opening (the beat's segments) and the rest of the game. */
export interface ConfrontationBody {
  segments: Segment[];
  places: Array<{ name: string; tags: string }>;
  musicMood: MusicMood;
  cg?: Beat["cg"];
  confrontation: Confrontation;
}

const lastPlace = (segments: readonly Segment[], fallback: string) =>
  [...segments].reverse().find((segment) => segment.place)?.place ?? fallback;

/** The reply as a climax game of the node's kind, or the first rule it breaks (the repair turn names it). */
export function normalizeConfrontationReply(
  reply: ConfrontationReply,
  {
    li,
    node,
    cgOpen,
    cgExplicit = false,
    climax = "confrontation",
    intimateRoom = false,
  }: {
    li: LiId;
    node: Pick<ChapterNode, "place">;
    cgOpen: boolean;
    cgExplicit?: boolean;
    climax?: ClimaxKind;
    /** NSFW: Explicit: a Closer's opened ending may run to CLOSER_INTIMATE_ENDING_MAX when it reaches sex. */
    intimateRoom?: boolean;
  },
  lists: SegmentLists,
): ConfrontationBody | string {
  const spec = CLIMAX[climax];
  const placesProblem = lists.placesProblem?.(reply.places);
  if (placesProblem) return placesProblem;
  const lengths = (name: string, items: unknown, max: number) =>
    Array.isArray(items) && items.length > max ? `${name} has more than ${max} segments` : "";
  // One thought per love interest in the whole scene, as P6 counts a beat: along the path with the most of them (the
  // opening, then each round's lines and its busiest answer, then the busiest ending), since any stance may be taken.
  let counts = new Map<string, number>();
  const thought = (raw: unknown, seen: Map<string, number>) => (Array.isArray(raw) ? lists.thoughts(raw, seen) : "");
  /** The busiest of several alternative lists: each counted from `counts`, the most of each love interest's kept. */
  const busiest = (alternatives: ReadonlyArray<Map<string, number>>) => {
    const most = new Map(counts);
    for (const seen of alternatives) for (const [li, count] of seen) most.set(li, Math.max(most.get(li) ?? 0, count));
    return most;
  };
  const tooLong = lengths("opening", reply.opening, CONFRONTATION_OPENING_MAX);
  if (tooLong) return tooLong;
  const openingThought = thought(reply.opening, counts);
  if (openingThought) return openingThought;
  // Every place a list is set in (a round or an ending may move on), in order, so each one is recorded and painted;
  // more than BEAT_PLACES_MAX get the repair turn, as an ordinary beat's do. A place first met with no description takes
  // the tags a later list gives it.
  const places = new Map<string, { name: string; tags: string }>();
  const keep = (found: ReadonlyArray<{ name: string; tags: string }>) => {
    for (const entry of found) {
      const key = entry.name.normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
      const known = places.get(key);
      if (known) {
        if (!known.tags && entry.tags) places.set(key, entry);
      } else if (places.size >= BEAT_PLACES_MAX) return `the ${spec.noun} uses more than ${BEAT_PLACES_MAX} places`;
      else places.set(key, entry);
    }
    return "";
  };
  const opening = lists.list({ segments: reply.opening, places: reply.places }, node.place ?? "");
  if (!opening) return "opening needs at least one segment with text";
  forgeSpeakerGenders(reply, opening.segments);
  const crowded = keep(opening.places);
  if (crowded) return crowded;
  let place = lastPlace(opening.segments, node.place ?? "");
  const list = (name: string, raw: unknown, max: number, seen: Map<string, number>): Segment[] | string => {
    if (!Array.isArray(raw) || !raw.length) return `${name} needs 1 to ${max} segments`;
    if (raw.length > max) return `${name} has more than ${max} segments`;
    const problem = thought(raw, seen);
    if (problem) return `${name}: ${problem}`;
    const body = lists.list({ segments: raw, places: reply.places }, place);
    if (!body) return `${name} needs at least one segment with text`;
    const over = keep(body.places);
    if (over) return `${name}: ${over}`;
    return forgeSpeakerGenders(reply, body.segments);
  };

  if (!Array.isArray(reply.rounds) || reply.rounds.length !== CONFRONTATION_ROUNDS) {
    return `rounds must be exactly ${CONFRONTATION_ROUNDS}`;
  }
  const rounds: Confrontation["rounds"] = [];
  for (const [index, rawRound] of reply.rounds.entries()) {
    const round = record(rawRound);
    // `lines` in the prompt (a love interest may be anyone); `his` is the stored field, and accepted too.
    const his = list(`rounds[${index}].lines`, round.lines ?? round.his, CONFRONTATION_HIS_MAX, counts);
    if (typeof his === "string") return his;
    place = lastPlace(his, place);
    const rawOptions = record(round.options);
    const options: Partial<Record<ClimaxMove, ConfrontationOption>> = {};
    const answers: Array<Map<string, number>> = [];
    for (const stance of spec.moves) {
      const option = record(rawOptions[stance]);
      const label = forgeChoiceLabel(str(option.label, LABEL_MAX));
      const selection = record(option.selection);
      const kind = selection.kind === "dialogue" || selection.kind === "action" ? selection.kind : null;
      const said = str(selection.text, SELECTION_MAX);
      if (!str(option.label, LABEL_MAX) || !kind || !said) {
        return `rounds[${index}].options.${stance} needs a label and a selection {kind: dialogue|action, text}`;
      }
      const seen = new Map(counts);
      answers.push(seen);
      const segments = list(
        `rounds[${index}].options.${stance}.segments`,
        option.segments,
        CONFRONTATION_ANSWER_MAX,
        seen,
      );
      if (typeof segments === "string") return segments;
      const move = Number(option[spec.moveField]);
      if (![-1, 0, 1].includes(move)) return `rounds[${index}].options.${stance}.${spec.moveField} must be -1, 0 or 1`;
      options[stance] = { label, selection: { kind, text: said }, segments, composure: move as -1 | 0 | 1 };
    }
    rounds.push({ his, options });
    counts = busiest(answers);
  }

  const rawEndings = record(reply.endings);
  const endings: Confrontation["endings"] = {};
  for (const ending of spec.endings) {
    const max =
      intimateRoom && climax === "closer" && ending === "opened"
        ? CLOSER_INTIMATE_ENDING_MAX
        : CONFRONTATION_ENDING_MAX;
    const segments = list(`endings.${ending}`, rawEndings[ending], max, new Map(counts));
    if (typeof segments === "string") return segments;
    endings[ending] = segments;
  }
  const grievanceText = str(record(reply.grievance).text, TEXT_MAX);
  if (!grievanceText) return `grievance.text is required (${spec.grievanceWhy})`;
  const disclosure = str(reply.disclosure, TEXT_MAX);
  if (!disclosure) return `disclosure is required (${spec.disclosureWhy})`;

  const mood = spec.moods.find((candidate) => candidate === reply.musicMood) ?? spec.moods[0]!;
  const body: ConfrontationBody = {
    segments: opening.segments,
    places: [...places.values()],
    musicMood: mood,
    confrontation: {
      ...(climax === "closer" ? { kind: "closer" as const } : {}),
      li,
      rounds,
      endings,
      grievance: { text: grievanceText, severity: spec.severity },
      disclosure,
      picks: [],
    },
  };
  const cg = record(reply.cg);
  const brief = str(cg.brief, 1200);
  if (cgOpen && brief) {
    const at = Number(cg.at);
    body.cg = {
      at: Number.isInteger(at) ? Math.max(0, Math.min(opening.segments.length - 1, at)) : 0,
      brief,
      cast: (Array.isArray(cg.cast) ? cg.cast : [])
        .map((name) => str(name, NAME_MAX))
        .filter(Boolean)
        .slice(0, 3),
      ...(cgExplicit && cg.explicit === true ? { explicit: true as const } : {}),
    };
  }
  return body;
}

// ── What the client sees ──

/** The game's spec: a Closer's, or a Confrontation's for any game stored without a kind. */
export const climaxSpec = (game: Pick<Confrontation, "kind">) => CLIMAX[climaxOf(game)];

/** The ending the picks reach: composure (a Closer's guard) from 2 by each picked option's move. */
export function endingOf(
  confrontation: Pick<Confrontation, "kind" | "rounds">,
  picks: readonly ClimaxMove[],
): ClimaxEnding {
  return climaxSpec(confrontation).endingFor(
    composureAfter(picks.map((stance, k) => confrontation.rounds[k]?.options[stance]?.composure ?? 0)),
  );
}

function roundView(confrontation: Confrontation, k: number): ConfrontationRoundView {
  const round = confrontation.rounds[k]!;
  const picked = confrontation.picks[k];
  const options: ConfrontationRoundView["options"] = {};
  for (const stance of climaxSpec(confrontation).moves) {
    const option = round.options[stance];
    if (!option) continue;
    const { label, selection, segments } = option;
    options[stance] = { label, selection, ...(picked === stance ? { segments } : {}) };
  }
  return { round: k + 1, his: round.his, options, ...(picked ? { picked } : {}) };
}

export function endingView(confrontation: Confrontation): ConfrontationEndingView | undefined {
  const kind = confrontation.ending;
  return kind ? { kind, segments: confrontation.endings[kind] ?? [] } : undefined;
}

/** How many rounds the client sees: those played, and the one being played until it ends or was eased off. */
const shownRounds = (beat: Pick<Beat, "easedOff" | "confrontation">) => {
  const confrontation = beat.confrontation!;
  const played = confrontation.picks.length;
  return confrontation.ending || beat.easedOff ? played : Math.min(CONFRONTATION_ROUNDS, played + 1);
};

/**
 * The length of the game's mainline, which its reading position indexes: the opening, each shown round's `his`
 * lines, and the ending once reached.
 */
export function confrontationMainline(beat: Pick<Beat, "segments" | "easedOff" | "confrontation">): number {
  const confrontation = beat.confrontation;
  if (!confrontation) return beat.segments.length;
  const rounds = confrontation.rounds.slice(0, shownRounds(beat));
  const ending = confrontation.ending ? (confrontation.endings[confrontation.ending]?.length ?? 0) : 0;
  return beat.segments.length + rounds.reduce((sum, round) => sum + round.his.length, 0) + ending;
}

/**
 * A climax game as the client sees it, with the beat's own fields (no effects, no stored game): every round played
 * and the one being played (none more after an Ease off), and the ending once reached. Null for a beat with no game.
 */
export function toConfrontationView(beat: Beat): ConfrontationView | null {
  const confrontation = beat.confrontation;
  if (!confrontation) return null;
  const {
    effects: _effects,
    applied: _applied,
    confrontation: _game,
    segments,
    choices: _choices,
    choiceCanon: _canon,
    ...rest
  } = beat;
  const ending = endingView(confrontation);
  return {
    ...rest,
    li: confrontation.li,
    opening: segments,
    rounds: Array.from({ length: shownRounds(beat) }, (_, k) => roundView(confrontation, k)),
    ...(ending ? { ending } : {}),
  };
}

/** What a played round shows: the round itself with its pick, then the next round or the ending. */
export function afterRound(confrontation: Confrontation, round: number) {
  const ending = endingView(confrontation);
  return {
    round: roundView(confrontation, round - 1),
    ...(ending ? { ending } : round < CONFRONTATION_ROUNDS ? { next: roundView(confrontation, round) } : {}),
  };
}

/** Every line of the game, for whoever paints the speakers' faces (the opening, his lines, answers, endings). */
export function confrontationLines(beat: Pick<Beat, "segments" | "confrontation">): Segment[] {
  const confrontation = beat.confrontation;
  if (!confrontation) return beat.segments;
  const spec = climaxSpec(confrontation);
  return [
    ...beat.segments,
    ...confrontation.rounds.flatMap((round) => [
      ...round.his,
      ...spec.moves.flatMap((stance) => round.options[stance]?.segments ?? []),
    ]),
    ...spec.endings.flatMap((ending) => confrontation.endings[ending] ?? []),
  ];
}

// ── Resolution ──

/** What the ending changes between them (first play, clamped when applied). */
export function endingEffects(confrontation: Confrontation, liState: Pick<LiState, "trust">): Effect[] {
  const li = confrontation.li;
  switch (confrontation.ending) {
    case "truth":
      return [{ li, trust: 1 }];
    case "walkout":
      return [
        {
          li,
          grievance: {
            by: "li",
            text: confrontation.grievance.text,
            severity: liState.trust <= WALKOUT_RUPTURE_TRUST ? "rupture" : "major",
          },
        },
      ];
    case "standoff":
      return [{ li, tension: 1 }];
    case "opened":
      return [{ li, trust: 1 }];
    case "shut":
      return [{ li, trust: -1, grievance: { by: "li", text: confrontation.grievance.text, severity: "minor" } }];
    default:
      // A standoff's twin, Almost, changes nothing.
      return [];
  }
}

export interface ConfrontationOutcome {
  state: RunState;
  remembered: boolean;
  rememberedBy: LiId[];
}

/** The `${R}:state` with the love interest's Opened up first marked, the first time only (as a first date is). */
function withOpenedUp(state: RunState, li: LiId, chapter: Pick<Chapter, "key" | "title">, at: string): RunState {
  const current = state.lis[li];
  if (!current || current.firsts[OPENED_UP_FIRST]) return state;
  return {
    ...state,
    lis: { ...state.lis, [li]: { ...current, firsts: { ...current.firsts, [OPENED_UP_FIRST]: at } } },
    timeline: keepTimeline([
      ...state.timeline,
      { at, li, kind: `first-${OPENED_UP_FIRST}`, text: chapter.title.slice(0, 600), ref: chapter.key },
    ]),
  };
}

/**
 * Every effect the beat's saved moves have earned and the state does not have yet: each Reveal's (Mirror's)
 * disclosure, and the ending's effects once it is reached, with an Opened up Closer's first. A replay, or an effect
 * that already landed, changes nothing. The walkout reads trust from the state it lands on, so the rupture rule sees
 * the trust of that moment.
 */
export function applyConfrontation(
  state: RunState,
  chapter: Pick<Chapter, "key" | "nodes" | "title">,
  beat: Pick<Beat, "i" | "confrontation">,
  at: string,
): ConfrontationOutcome {
  const confrontation = beat.confrontation;
  if (!confrontation) return { state, remembered: false, rememberedBy: [] };
  const spec = climaxSpec(confrontation);
  let next = state;
  const rememberedBy = new Set<LiId>();
  const apply = (effects: Effect[], choice: string) => {
    const outcome = applyChoiceEffects(next, effects, {
      key: chapter.key,
      i: beat.i,
      choice,
      resolves: chapter.nodes[beat.i]?.resolves ?? [],
      at,
    });
    next = outcome.state;
    for (const li of outcome.rememberedBy) rememberedBy.add(li);
    return outcome;
  };
  for (const [k, stance] of confrontation.picks.entries()) {
    if (stance === spec.discloses) {
      apply([{ li: confrontation.li, disclose: confrontation.disclosure }], `stance-${k + 1}`);
    }
  }
  if (confrontation.ending) {
    const outcome = apply(endingEffects(confrontation, next.lis[confrontation.li] ?? { trust: 0 }), spec.noun);
    // In the same write as the ending's effects, so a replay or a retry never marks it twice.
    if (!outcome.replay && confrontation.ending === "opened") {
      const stamped = withOpenedUp(next, confrontation.li, chapter, at);
      // Remembered only when the first is new; the trust +1 reports itself when it moves.
      if (stamped !== next) rememberedBy.add(confrontation.li);
      next = stamped;
    }
  }
  return { state: next, remembered: rememberedBy.size > 0, rememberedBy: [...rememberedBy] };
}
