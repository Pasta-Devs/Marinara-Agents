/**
 * The drama runtime (`docs/DRAMA.md`): which situations stand, which dramas run, who plays whom, and
 * what is queued for which channel. Pure and seeded, like couples and ties: nothing here calls a
 * model or touches storage. The service applies the jobs (a post line, a DM, a comment, a
 * notification, coins, a choice) and the tie outcomes this returns.
 *
 * ## The rules
 *
 * - **Late casting.** A role is filled when a stage needs it, from the Creators on Slurp now.
 * - **The cast is alive.** Someone in the lead role (the first) leaves: the drama ends and whoever is
 *   still there may post its exit. Someone else leaves: their role is cast again, or its beats drop.
 * - **Every drama ends:** at its last stage, at "end", or at `maxDays`.
 * - **The level** caps how many dramas run at once and how often a new one starts.
 * - **One lead, one side.** A Creator is in at most two running dramas.
 * - **Spice.** A stage above a Creator's spice (or the player's ceiling) is skipped, never forced.
 * - **Nothing piles up.** A job that could not go out in its stage expires and drops.
 */
import { hash } from "../../projects/slp-project.js";
import { slurpTasteWeight } from "../../creators/slp-spice.js";
import { slpDramaPlayerWords, slpDramaRoleWords, slpDramaText } from "./slp-drama-words.js";
import {
  type SlpDramaBeat,
  type SlpDramaLevel,
  type SlpDramaOutcome,
  type SlpDramaRole,
  type SlpRelationToPlayer,
} from "../../../../../../shared/src/slp/slp-drama.js";
import {
  slpStorylineEdges,
  type SlpStoryline,
  type SlpStorylineEnding,
  type SlpStorylineOutcome,
} from "../../../../../../shared/src/slp/slp-storyline.js";
import { couplePairs, meets, slpDramaCast, slpFitsCreator, stageRoles, tieOutcomes } from "./slp-drama-cast.js";
import { slurpStageOutcomes } from "../../projects/slp-project-storyline.js";
import type { SlpInfluenceTarget, SlpStoryOutcome } from "../../../../../../shared/src/slp/slp-story-engine.js";
import type { SlpTaste } from "../../../../../../shared/src/slp/slp-spice.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const KEEP_ENDED = 30;
const KEEP_DONE_DAYS = 7;
const ROLE_CHOICE_HOURS = 3;
/** A new drama is considered once per window. */
const START_WINDOW = 6 * HOUR;
export const SLP_DRAMA_LEVEL_RULES: Record<SlpDramaLevel, { running: number; startChance: number }> = {
  calm: { running: 1, startChance: 20 },
  lively: { running: 2, startChance: 40 },
  soap: { running: 4, startChance: 70 },
};

export type SlpDramaCreator = {
  id: string;
  name: string;
  /** Slurp writes their posts. False: a page the player runs (a persona). */
  automatic: boolean;
  gender: "male" | "female" | "other" | null;
  /** Their explicit level (0-3), already capped by the player's ceiling. */
  spice: number;
  tags: readonly string[];
  joinedAt: string;
  followers: number;
  /** The player's romance setting (0.3.17). */
  romance?: { off: boolean; only: string[] };
  /** What is true for them now (story state and ties), for `requires`, `lacks` and `when`. */
  storyTags?: readonly string[];
  /** Card text and hard noes for `fit` gates; filled only when a switched-on storyline has one. */
  fitText?: string;
  hardNoes?: readonly string[];
  /** Topics the player asked this Creator to leave out (Steering). */
  avoid?: readonly string[];
  /** The Creator's turn-ons: a lead whose turn-ons match a storyline's fit is likelier to take it. */
  turnOns?: readonly string[];
};

/** What the ties say, as the runtime needs it. */
export type SlpDramaWorld = {
  creators: readonly SlpDramaCreator[];
  /** Creator id → what they are to which of the player's pages. */
  relations: ReadonlyMap<string, readonly { playerId: string; relation: SlpRelationToPlayer }[]>;
  /** `kind:a|b` (ids sorted) for every running tie. */
  ties: ReadonlySet<string>;
};

export type SlpDramaHeat = { line: string; withId?: string; shotById?: string; forId?: string; forFans?: boolean };
export type SlpDramaJob = {
  id: string;
  runId: string;
  channel: SlpDramaBeat["channel"] | "choice";
  /** Who acts; null for the crowd. */
  actorId: string | null;
  toId?: string;
  onId?: string;
  seed?: string;
  lines?: string[];
  heat?: SlpDramaHeat;
  amount?: number;
  /** A choice for the player: the question, its options, and the stage it belongs to. */
  choice?: { question: string; options: string[]; stage?: string };
  /** Names for `{role}` in the text, filled at queue time. */
  names: Record<string, string>;
  /** The player's pages in the cast when it was queued (who a notification is for). */
  playerIds?: string[];
  dueAt: string;
  expiresAt: string;
  status: "queued" | "done" | "dropped";
};
export type SlpDramaLog = { at: string; code: string; detail?: string };
export type SlpDramaRun = {
  id: string;
  dramaId: string;
  cast: Record<string, string>;
  stage: string;
  stageAt: string;
  /** Seeded length of the current stage, in days. */
  stageDays: number;
  startedAt: string;
  endedAt: string | null;
  ending: "done" | "left" | "off" | "player" | "time" | null;
  choice: {
    stage: string;
    askedAt: string;
    dueAt: string;
    answer: number | null;
    by: string | null;
    /** Who is asked, and how many answers there are: an answer is checked against these. */
    asks?: "fans" | "player" | "role";
    count?: number;
    /** The options that fit the lead, when some do not: the player's answer is an index into these. */
    offered?: number[];
  } | null;
  log: SlpDramaLog[];
};
export type SlpSituationRun = {
  id: string;
  situationId: string;
  cast: Record<string, string>;
  startedAt: string;
  endedAt: string | null;
  ending: "left" | "off" | null;
  day: string;
  drawn: number;
  lastDrawAt: string | null;
};
export type SlpDramaState = {
  runs: SlpDramaRun[];
  situations: SlpSituationRun[];
  jobs: SlpDramaJob[];
  /** Drama id → when it last ended, for its cooldown. */
  ended: Record<string, string>;
  startWindow: number | null;
  /** The player asked Stir to start this drama now: the next tick tries it first, past the level's cap. */
  requested?: string | null;
  /** Who the player picked for the requested drama's first role (0.3.11), when they picked one. */
  requestedLead?: string | null;
};
export const SLP_EMPTY_DRAMA_STATE: SlpDramaState = {
  runs: [],
  situations: [],
  jobs: [],
  ended: {},
  startWindow: null,
};

/**
 * Stored state back. It is Slurp's own record, so the check is shallow: the lists must be lists and
 * every entry needs an id; anything else starts empty rather than failing the tick.
 */
export function readSlpDramaState(raw: unknown): SlpDramaState {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const list = <T>(entry: unknown) =>
    (Array.isArray(entry) ? entry : []).filter(
      (item): item is T => Boolean(item) && typeof (item as { id?: unknown }).id === "string",
    );
  const ended = value.ended && typeof value.ended === "object" && !Array.isArray(value.ended) ? value.ended : {};
  return {
    runs: list<SlpDramaRun>(value.runs),
    situations: list<SlpSituationRun>(value.situations),
    jobs: list<SlpDramaJob>(value.jobs),
    ended: Object.fromEntries(Object.entries(ended).filter(([, at]) => typeof at === "string")) as Record<
      string,
      string
    >,
    startWindow: typeof value.startWindow === "number" ? value.startWindow : null,
    requested: typeof value.requested === "string" ? value.requested : null,
    requestedLead: typeof value.requestedLead === "string" ? value.requestedLead : null,
  };
}

/** Story state for the lead: a stage's condition and outcomes, an ending's outcomes (Storylines). */
export type SlpDramaStoryEffect = { creatorId: string; sourceId: string; outcomes: SlpStoryOutcome[]; label?: string };

export type SlpDramaTieEffect = { runId: string; outcome: SlpDramaOutcome; ids: [string, string] };

export type SlpDramaInput = {
  at: Date;
  level: SlpDramaLevel;
  /** Only the switched-on entries (`slpEnabledDrama`), as storylines (`slpDramaStorylines`). */
  situations: readonly SlpStoryline[];
  dramas: readonly SlpStoryline[];
  /** Every drama in the library, switched on or off: a run whose drama went off still takes its condition away. */
  known?: readonly SlpStoryline[];
  dials: Readonly<Record<string, Readonly<Record<string, string>>>>;
  world: SlpDramaWorld;
  /** World activity; 0 starts nothing new (running dramas still move and end). */
  activity: number;
  /** The player's tastes: a drama whose fit shares their words starts more often. */
  tastes?: readonly SlpTaste[];
  newId: () => string;
};

const active = <T extends { endedAt: string | null }>(entry: T) => entry.endedAt === null;
const iso = (ms: number) => new Date(ms).toISOString();

/** The id runs, cooldowns and settings use: a converted v1 entry keeps its own id. */
export const slpDramaId = (storyline: Pick<SlpStoryline, "id" | "source">): string =>
  storyline.source?.id ?? storyline.id;

/**
 * The running storylines' stage influences on one target for their lead: the product of the "multiply"
 * ones (docs/STORYLINES.md, PR 6) — a pregnancy announced brings subscribers, a secret one costs some.
 */
export function slpDramaStageMultiplier(
  state: Pick<SlpDramaState, "runs">,
  storylines: readonly SlpStoryline[],
  creatorId: string,
  target: SlpInfluenceTarget,
): number {
  const byId = new Map(storylines.map((storyline) => [slpDramaId(storyline), storyline]));
  return state.runs.filter(active).reduce((product, run) => {
    const storyline = byId.get(run.dramaId);
    if (!storyline || run.cast[storyline.cast[0]!.key] !== creatorId) return product;
    const stage = storyline.stages.find((entry) => entry.key === run.stage);
    return (stage?.influences ?? [])
      .filter((effect) => effect.target === target && effect.operation === "multiply")
      .reduce((value, effect) => value * effect.value, product);
  }, 1);
}

/** A run stopped from outside (switched off, Stir) only takes its stage's condition away; the stage's own outcomes never ran. */
export const slpDramaStopOutcomes = (storyline: SlpStoryline, stage: string): SlpStoryOutcome[] => {
  const tag = storyline.stages.find((entry) => entry.key === stage)?.condition?.tag;
  return tag ? [{ kind: "remove-creator-fact", tag }] : [];
};
// ─── Jobs ───────────────────────────────────────────────────────────────────────────────────────

function job(
  beat: SlpDramaBeat,
  run: { id: string; cast: Readonly<Record<string, string>> },
  input: { dueAt: number; expiresAt: number; names: Record<string, string>; id: string; seed: string },
): SlpDramaJob | null {
  const who = (key: string | undefined) => (key ? run.cast[key] : undefined);
  const actorId = beat.role === "crowd" ? null : (who(beat.role) ?? undefined);
  if (actorId === undefined) return null;
  if ((beat.to && !who(beat.to)) || (beat.on && !who(beat.on))) return null;
  if (beat.chance !== undefined && hash(`${input.seed}:chance`) % 100 >= beat.chance) return null;
  const delay = beat.delayHours
    ? beat.delayHours[0] + ((hash(`${input.seed}:delay`) % 1000) / 1000) * (beat.delayHours[1] - beat.delayHours[0])
    : 0;
  const amount = beat.amount
    ? beat.amount.min + (hash(`${input.seed}:amount`) % (beat.amount.max - beat.amount.min + 1))
    : undefined;
  return {
    id: input.id,
    runId: run.id,
    channel: beat.channel,
    actorId,
    ...(beat.to ? { toId: who(beat.to) } : {}),
    ...(beat.on ? { onId: who(beat.on) } : {}),
    ...(beat.seed ? { seed: beat.seed } : {}),
    ...(beat.lines ? { lines: [...beat.lines] } : {}),
    ...(beat.heat
      ? {
          heat: {
            line: beat.heat.line,
            ...(who(beat.heat.with) ? { withId: who(beat.heat.with) } : {}),
            ...(who(beat.heat.shotBy) ? { shotById: who(beat.heat.shotBy) } : {}),
            ...(beat.heat.for === "fans" ? { forFans: true } : who(beat.heat.for) ? { forId: who(beat.heat.for) } : {}),
          },
        }
      : {}),
    ...(amount !== undefined ? { amount } : {}),
    names: input.names,
    dueAt: iso(input.dueAt + delay * HOUR),
    expiresAt: iso(Math.max(input.expiresAt, input.dueAt + delay * HOUR + 6 * HOUR)),
    status: "queued",
  };
}

// ─── One tick ───────────────────────────────────────────────────────────────────────────────────

export function slpAdvanceDrama(
  state: SlpDramaState,
  input: SlpDramaInput,
): { state: SlpDramaState; ties: SlpDramaTieEffect[]; story: SlpDramaStoryEffect[] } {
  const now = input.at.getTime();
  const stamp = iso(now);
  const live = new Map(input.world.creators.map((creator) => [creator.id, creator]));
  const dramas = new Map(input.dramas.map((drama) => [slpDramaId(drama), drama]));
  const known = new Map((input.known ?? []).map((drama) => [slpDramaId(drama), drama]));
  const situations = new Map(input.situations.map((situation) => [slpDramaId(situation), situation]));
  const situationKey = new Map(input.situations.map((situation) => [situation.id, slpDramaId(situation)]));
  /** The situation a drama stands in, by its run id; `start.within` names the storyline. */
  const withinOf = (drama: SlpStoryline) =>
    drama.start.within === undefined ? undefined : (situationKey.get(drama.start.within) ?? drama.start.within);
  /** The lead's tags, and the situation the drama stands in is true for it. */
  const tagsOf = (drama: SlpStoryline, cast: Readonly<Record<string, string>>) => {
    const within = withinOf(drama);
    return new Set([...(live.get(cast[drama.cast[0]!.key]!)?.storyTags ?? []), ...(within ? [within] : [])]);
  };
  /** The way on from a stage with no answer: the first edge whose `when` holds, else the last. */
  const wayOn = (drama: SlpStoryline, index: number, cast: Readonly<Record<string, string>>): string => {
    const stage = drama.stages[index]!;
    const edges =
      stage.next !== undefined
        ? slpStorylineEdges(stage.next)
        : [{ to: drama.stages[index + 1]?.key ?? drama.endings[0]?.key ?? "end" }];
    const tags = tagsOf(drama, cast);
    return (edges.find((edge) => !edge.when || tags.has(edge.when.tag) === edge.when.set) ?? edges.at(-1)!).to;
  };
  const ties: SlpDramaTieEffect[] = [];
  const story: SlpDramaStoryEffect[] = [];
  /** The stage left, and the stage entered or the ending reached, write the lead's story state. */
  const write = (
    run: SlpDramaRun,
    drama: SlpStoryline,
    move: { leave?: string | null; enter?: string | null; ending?: string | null },
  ) => {
    const creatorId = run.cast[drama.cast[0]!.key];
    const outcomes = slurpStageOutcomes(drama, {
      leave: move.leave || null,
      enter: move.enter ?? null,
      ending: move.ending ?? null,
    });
    if (creatorId && outcomes.length)
      story.push({
        creatorId,
        sourceId: `${run.id}:${move.enter ?? move.ending ?? `${move.leave}:leave`}`,
        outcomes,
        label: drama.name,
      });
  };
  let jobs = [...state.jobs];
  const ended = { ...state.ended };
  const names = (cast: Readonly<Record<string, string>>) => ({
    // Each role's name, and their he/she/they words ("{her:he}").
    ...Object.fromEntries(
      Object.entries(cast).flatMap(([key, id]) => {
        const creator = live.get(id);
        return creator ? [[key, creator.name], ...Object.entries(slpDramaRoleWords(key, creator))] : [];
      }),
    ),
    ...slpDramaPlayerWords(
      Object.values(cast)
        .map((id) => live.get(id))
        .find((creator) => creator && !creator.automatic),
    ),
  });
  const log = (run: SlpDramaRun, code: string, detail?: string): SlpDramaRun => ({
    ...run,
    log: [...run.log, { at: stamp, code, ...(detail ? { detail } : {}) }].slice(-20),
  });
  const queue = (
    beats: readonly SlpDramaBeat[],
    run: { id: string; cast: Record<string, string> },
    until: number,
    tag: string,
  ) => {
    const playerIds = Object.values(run.cast).filter((id) => live.get(id)?.automatic === false);
    beats.forEach((beat, index) => {
      if (!slpFitsCreator(beat.fit, live.get(run.cast[beat.role]!))) return;
      const made = job(beat, run, {
        dueAt: now,
        expiresAt: until,
        names: names(run.cast),
        id: input.newId(),
        seed: `${run.id}:${tag}:${index}`,
      });
      if (made) jobs.push(playerIds.length ? { ...made, playerIds } : made);
    });
  };

  // Situations: end what is off or lost its cast; start what is on; draw from the deck.
  let situationRuns = state.situations.map((run) => {
    if (!active(run)) return run;
    if (!situations.has(run.situationId)) return { ...run, endedAt: stamp, ending: "off" as const };
    return Object.values(run.cast).every((id) => live.has(id))
      ? run
      : { ...run, endedAt: stamp, ending: "left" as const };
  });
  for (const situation of input.situations) {
    if (situationRuns.some((run) => active(run) && run.situationId === slpDramaId(situation))) continue;
    const id = input.newId();
    const cast = slpDramaCast(
      situation.cast,
      situation.cast.map((role) => role.key),
      {},
      { world: input.world, busy: new Set(), seed: id, at: input.at, leadFit: situation.fit },
    );
    if (cast)
      situationRuns.push({
        id,
        situationId: slpDramaId(situation),
        cast,
        startedAt: stamp,
        endedAt: null,
        ending: null,
        day: stamp.slice(0, 10),
        drawn: 0,
        lastDrawAt: null,
      });
  }
  situationRuns = situationRuns.map((run) => {
    const situation = situations.get(run.situationId);
    if (!active(run) || !situation) return run;
    const day = stamp.slice(0, 10);
    const drawn = run.day === day ? run.drawn : 0;
    const gap = (24 / situation.perDay) * HOUR * 0.5;
    if (drawn >= situation.perDay || (run.lastDrawAt && now - Date.parse(run.lastDrawAt) < gap))
      return { ...run, day, drawn };
    if (hash(`${run.id}:${Math.floor(now / HOUR)}:draw`) % 100 >= 25) return { ...run, day, drawn };
    const dials = {
      ...Object.fromEntries(situation.dials.map((dial) => [dial.key, dial.default])),
      ...input.dials[slpDramaId(situation)],
    };
    const deck = (situation.stages[0]?.deck ?? []).filter(
      (beat) =>
        Object.entries(beat.when ?? {}).every(([key, value]) => dials[key] === value) &&
        slpFitsCreator(beat.fit, live.get(run.cast[beat.role]!)),
    );
    const beat = deck[hash(`${run.id}:${Math.floor(now / HOUR)}:pick`) % Math.max(1, deck.length)];
    if (!beat) return { ...run, day, drawn };
    queue([beat], run, now + DAY, `deck:${Math.floor(now / HOUR)}`);
    return { ...run, day, drawn: drawn + 1, lastDrawAt: stamp };
  });

  // Running dramas.
  const busy = () => {
    const count = new Map<string, number>();
    for (const run of runs.filter(active))
      for (const id of Object.values(run.cast)) count.set(id, (count.get(id) ?? 0) + 1);
    return new Set([...count].filter(([, value]) => value >= 2).map(([id]) => id));
  };
  let runs = [...state.runs];
  const end = (
    run: SlpDramaRun,
    ending: NonNullable<SlpDramaRun["ending"]>,
    exit: SlpStorylineEnding | undefined,
  ): SlpDramaRun => {
    // Switched off, lead gone, out of time: what it still had queued goes nowhere (the exit is new).
    if (ending !== "done")
      jobs = jobs.map((entry) =>
        entry.runId === run.id && entry.status === "queued" ? { ...entry, status: "dropped" as const } : entry,
      );
    if (exit?.beat) queue([exit.beat], { id: run.id, cast: aliveCast(run.cast) }, now + 2 * DAY, "exit");
    ended[run.dramaId] = stamp;
    return log({ ...run, endedAt: stamp, ending, choice: null }, "ended", ending);
  };
  const aliveCast = (cast: Record<string, string>) =>
    Object.fromEntries(Object.entries(cast).filter(([, id]) => live.has(id)));
  /** Its tie outcomes, between cast people who are still on Slurp. */
  const settle = (run: SlpDramaRun, outcomes: readonly SlpStorylineOutcome[]) => {
    for (const outcome of tieOutcomes(outcomes)) {
      const a = run.cast[outcome.between[0]];
      const b = run.cast[outcome.between[1]];
      if (a && b && live.has(a) && live.has(b)) ties.push({ runId: run.id, outcome, ids: [a, b] });
    }
  };

  /** Enters `key` (or an ending): casts its roles, skips it when it cannot run, queues its beats. */
  const enter = (run: SlpDramaRun, drama: SlpStoryline, key: string, depth = 0): SlpDramaRun => {
    const ending = drama.endings.find((entry) => entry.key === key);
    const index = drama.stages.findIndex((stage) => stage.key === key);
    if (ending) settle(run, ending.outcomes);
    if (ending || index < 0 || depth > drama.stages.length) {
      write(run, drama, { leave: run.stage, ending: ending?.key });
      return end(run, "done", ending ?? drama.endings[0]);
    }
    const stage = drama.stages[index]!;
    const needed = stageRoles(stage, drama.cast);
    const playerKey = drama.cast.find((role) => role.player)?.key;
    const cast = slpDramaCast(drama.cast, needed, aliveCast(run.cast), {
      couples: couplePairs(drama),
      world: input.world,
      busy: busy(),
      seed: `${run.id}:${key}`,
      at: input.at,
    });
    const actors = needed
      .map((role) => (cast ? live.get(cast[role]!) : undefined))
      .filter(Boolean) as SlpDramaCreator[];
    const tooHot =
      stage.minSpice !== undefined && actors.some((creator) => creator.automatic && creator.spice < stage.minSpice!);
    const lead = cast ? live.get(cast[drama.cast[0]!.key]!) : undefined;
    const dials = {
      ...Object.fromEntries(drama.dials.map((dial) => [dial.key, dial.default])),
      ...input.dials[slpDramaId(drama)],
    };
    const offered = (stage.choice?.options ?? []).flatMap((option, at) =>
      slpFitsCreator(option.fit, lead) &&
      Object.entries(option.when ?? {}).every(([key, value]) => dials[key] === value)
        ? [at]
        : [],
    );
    // A choice with no option that fits the lead is skipped like a stage that does not fit.
    const offFit = !slpFitsCreator(stage.fit, lead) || Boolean(stage.choice && !offered.length);
    if (!cast || tooHot || offFit)
      return enter(log(run, "skipped", key), drama, wayOn(drama, index, run.cast), depth + 1);
    // A stage with no days stands until its choice is answered, or until the storyline runs out of time.
    const days = stage.days
      ? stage.days[0] + (hash(`${run.id}:${key}:days`) % (stage.days[1] - stage.days[0] + 1))
      : drama.maxDays;
    let entered: SlpDramaRun = log(
      { ...run, cast, stage: key, stageAt: stamp, stageDays: days, choice: null },
      "stage",
      key,
    );
    queue(stage.beats, entered, now + Math.max(days, 1) * DAY, key);
    write(entered, drama, { leave: run.stage, enter: key });
    if (stage.choice) {
      const dueAt =
        stage.choice.asks === "role" ? now + ROLE_CHOICE_HOURS * HOUR : now + stage.choice.timeoutDays * DAY;
      entered = {
        ...entered,
        choice: {
          stage: key,
          askedAt: stamp,
          dueAt: iso(dueAt),
          answer: null,
          by: null,
          asks: stage.choice.asks,
          count: offered.length,
          ...(offered.length < stage.choice.options.length ? { offered } : {}),
        },
      };
      if (stage.choice.asks === "player" && playerKey && cast[playerKey]) {
        const asker = cast[drama.cast[0]!.key] ?? null;
        jobs.push({
          id: input.newId(),
          runId: run.id,
          channel: "choice",
          actorId: asker,
          toId: cast[playerKey],
          choice: {
            question: stage.choice.question,
            options: offered.map((at) => stage.choice!.options[at]!.label),
            stage: key,
          },
          names: names(cast),
          dueAt: stamp,
          expiresAt: iso(dueAt),
          status: "queued",
        });
      }
    }
    return entered;
  };

  runs = runs.map((run) => {
    if (!active(run)) return run;
    const drama = dramas.get(run.dramaId);
    if (!drama) {
      const off = known.get(run.dramaId);
      const creatorId = off && run.cast[off.cast[0]!.key];
      const outcomes = off ? slpDramaStopOutcomes(off, run.stage) : [];
      if (creatorId && outcomes.length) story.push({ creatorId, sourceId: `${run.id}:${run.stage}:off`, outcomes });
      return end(run, "off", undefined);
    }
    const lead = drama.cast[0]!.key;
    const gone = run.cast[lead] && !live.has(run.cast[lead]!);
    if (gone || now - Date.parse(run.startedAt) >= drama.maxDays * DAY) {
      write(run, drama, { leave: run.stage });
      return end(run, gone ? "left" : "time", drama.endings[0]);
    }
    const index = drama.stages.findIndex((stage) => stage.key === run.stage);
    const stage = drama.stages[index];
    if (!stage) return end(run, "done", drama.endings[0]);
    let current = run;
    const choice = stage.choice;
    if (choice && current.choice && current.choice.answer === null && now >= Date.parse(current.choice.dueAt)) {
      // Nobody answered in time (player), the vote closed (fans), or the role made up their mind (role).
      const picked =
        choice.asks === "player"
          ? choice.default
          : hash(`${run.id}:${stage.key}:vote`) % 3 === 0
            ? hash(`${run.id}:${stage.key}:pick`) % choice.options.length
            : choice.default;
      // An option that does not fit the lead was never offered: the pick falls on one that was.
      const offered = current.choice.offered;
      const decided =
        !offered || offered.includes(picked)
          ? picked
          : offered[hash(`${run.id}:${stage.key}:offered`) % offered.length]!;
      current = log(
        {
          ...current,
          choice: { ...current.choice, answer: decided, by: choice.asks === "player" ? "default" : choice.asks },
        },
        "choice",
        slpDramaText(choice.options[decided]!.label, names(current.cast)),
      );
    }
    const waiting = choice && current.choice?.answer === null;
    if (waiting || now - Date.parse(current.stageAt) < current.stageDays * DAY) return current;
    // The stage is over: its outcomes happen, then the next stage.
    settle(current, stage.leave);
    const answer =
      choice && current.choice?.answer !== null && current.choice
        ? choice.options[current.choice.answer]?.next
        : undefined;
    return enter(current, drama, answer ?? wayOn(drama, index, current.cast));
  });

  // A drama starts: cast its lead and first stage; on a situation, with the situation's people.
  const standing = new Map(situationRuns.filter(active).map((run) => [run.situationId, run]));
  const start = (pick: SlpStoryline, lead?: string | null): boolean => {
    const within = withinOf(pick);
    if (within && !standing.has(within)) return false;
    const id = input.newId();
    const base: Record<string, string> = within ? { ...standing.get(within)!.cast } : {};
    // The player's pick for the first role (Stir), when it still fits once the rest is cast.
    if (lead && !within) base[pick.cast[0]!.key] = lead;
    const first = pick.stages[0]!;
    const cast = slpDramaCast(pick.cast, [pick.cast[0]!.key, ...stageRoles(first, pick.cast)], base, {
      couples: couplePairs(pick),
      leadFit: pick.fit,
      world: input.world,
      busy: busy(),
      seed: id,
      at: input.at,
    });
    if (!cast || !meets(pick.requires, tagsOf(pick, cast))) return false;
    const run: SlpDramaRun = {
      id,
      dramaId: slpDramaId(pick),
      cast,
      stage: "",
      stageAt: stamp,
      stageDays: 0,
      startedAt: stamp,
      endedAt: null,
      ending: null,
      choice: null,
      log: [],
    };
    runs.push(enter(log(run, "started"), pick, first.key));
    return true;
  };
  const running = () => new Set(runs.filter(active).map((run) => run.dramaId));

  // The player asked for this one: now, whatever the level (once; a drama with no cast waits no longer).
  const requested = state.requested ? dramas.get(state.requested) : undefined;
  if (requested && !running().has(slpDramaId(requested))) start(requested, state.requestedLead);

  // Now and then a new drama starts, within the level's cap and each drama's cooldown.
  const window = Math.floor(now / START_WINDOW);
  const rules = SLP_DRAMA_LEVEL_RULES[input.level];
  let startWindow = state.startWindow;
  if (startWindow !== window) {
    startWindow = window;
    const room = runs.filter(active).length < rules.running;
    const roll = hash(`${window}:drama-start`) % 100 < Math.round(rules.startChance * Math.max(0, input.activity));
    if (room && roll) {
      const options = input.dramas.filter((drama) => {
        const id = slpDramaId(drama);
        const within = withinOf(drama);
        return (
          !running().has(id) &&
          // ponytail: the one seasonal drama is gated by id; add a `months` field to the schema when a second one comes.
          (id !== "costume-contest" || new Date(now).getUTCMonth() === 9) &&
          (!ended[id] || now - Date.parse(ended[id]!) >= drama.start.cooldownDays * DAY) &&
          (!within || standing.has(within))
        );
      });
      const weight = (drama: SlpStoryline) => drama.start.weight * slurpTasteWeight(drama.fit, input.tastes);
      const total = options.reduce((sum, drama) => sum + weight(drama), 0);
      let point = ((hash(`${window}:drama-pick`) % 10_000) / 10_000) * total;
      const pick = options.find((drama) => (point -= weight(drama)) < 0) ?? options.at(-1);
      if (pick) start(pick);
    }
  }

  // Housekeeping: jobs that could not go out in time drop; old ones and old runs go.
  jobs = jobs
    .map((entry) =>
      entry.status === "queued" && now > Date.parse(entry.expiresAt) ? { ...entry, status: "dropped" as const } : entry,
    )
    .filter((entry) => entry.status === "queued" || now - Date.parse(entry.dueAt) < KEEP_DONE_DAYS * DAY);
  const endedRuns = runs.filter((run) => !active(run));
  const dropRuns = new Set(endedRuns.slice(0, Math.max(0, endedRuns.length - KEEP_ENDED)));
  const endedSituations = situationRuns.filter((run) => !active(run));
  const dropSituations = new Set(endedSituations.slice(0, Math.max(0, endedSituations.length - KEEP_ENDED)));
  return {
    state: {
      runs: runs.filter((run) => !dropRuns.has(run)),
      situations: situationRuns.filter((run) => !dropSituations.has(run)),
      jobs,
      ended,
      startWindow,
      requested: null,
      requestedLead: null,
    },
    ties,
    story,
  };
}

// ─── The player's answer, and the planner's pick ────────────────────────────────────────────────

/** The player answered a choice: the next tick moves on with it. Unknown or settled: unchanged. */
export function slpAnswerDramaChoice(
  state: SlpDramaState,
  runId: string,
  option: number,
  at: Date,
  /** The stage the question was asked in: an old message never answers a newer question. */
  stage?: string,
): SlpDramaState | null {
  const run = state.runs.find((entry) => entry.id === runId && active(entry));
  if (!run?.choice || run.choice.answer !== null || option < 0) return null;
  if (stage !== undefined && run.choice.stage !== stage) return null;
  if (run.choice.asks !== undefined && run.choice.asks !== "player") return null;
  if (run.choice.count !== undefined && option >= run.choice.count) return null;
  return {
    ...state,
    runs: state.runs.map((entry) =>
      entry === run
        ? {
            ...run,
            choice: { ...run.choice!, answer: run.choice!.offered?.[option] ?? option, by: "player" },
            log: [...run.log, { at: at.toISOString(), code: "choice", detail: `#${option}` }].slice(-20),
          }
        : entry,
    ),
    jobs: state.jobs.map((entry) =>
      entry.runId === runId && entry.channel === "choice" && entry.status === "queued"
        ? { ...entry, status: "done" }
        : entry,
    ),
  };
}

/** The queued jobs due now on a channel, oldest first (the service sends them and marks them done). */
export const slpDueDramaJobs = (state: SlpDramaState, at: Date, channel?: SlpDramaJob["channel"]) =>
  state.jobs
    .filter(
      (entry) =>
        entry.status === "queued" && Date.parse(entry.dueAt) <= at.getTime() && (!channel || entry.channel === channel),
    )
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt));

export const slpMarkDramaJob = (state: SlpDramaState, id: string, status: "done" | "dropped"): SlpDramaState => ({
  ...state,
  jobs: state.jobs.map((entry) => (entry.id === id ? { ...entry, status } : entry)),
});

/** The player ends a running drama in Stir: no exit beat, its queued beats drop. Null when not running. */
export function slpEndDramaRun(state: SlpDramaState, runId: string, at: Date): SlpDramaState | null {
  const run = state.runs.find((entry) => entry.id === runId && active(entry));
  if (!run) return null;
  const stamp = at.toISOString();
  return {
    ...state,
    runs: state.runs.map((entry) =>
      entry === run
        ? {
            ...run,
            endedAt: stamp,
            ending: "player" as const,
            choice: null,
            log: [...run.log, { at: stamp, code: "ended", detail: "player" }].slice(-20),
          }
        : entry,
    ),
    jobs: state.jobs.map((entry) =>
      entry.runId === runId && entry.status === "queued" ? { ...entry, status: "dropped" as const } : entry,
    ),
    ended: { ...state.ended, [run.dramaId]: stamp },
  };
}

/** Stir: start this drama on the next tick, past the level's cap. The drama must be switched on. */
export const slpRequestDrama = (state: SlpDramaState, dramaId: string, lead?: string | null): SlpDramaState => ({
  ...state,
  requested: dramaId,
  requestedLead: lead ?? null,
});
