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
import { slpRomancePairAllowed } from "../../../../../../shared/src/slp/slp-creator-steering.js";
import { hash } from "../../projects/slp-project.js";
import {
  slpDramaCouplePairs,
  type SlpDrama,
  type SlpDramaBeat,
  type SlpDramaLevel,
  type SlpDramaOutcome,
  type SlpDramaRole,
  type SlpDramaStage,
  type SlpRelationToPlayer,
  type SlpSituation,
} from "../../../../../../shared/src/slp/slp-drama.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NEWCOMER_DAYS = 14;
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

export type SlpDramaTieEffect = { runId: string; outcome: SlpDramaOutcome; ids: [string, string] };

export type SlpDramaInput = {
  at: Date;
  level: SlpDramaLevel;
  /** Only the switched-on entries (`slpEnabledDrama`). */
  situations: readonly SlpSituation[];
  dramas: readonly SlpDrama[];
  dials: Readonly<Record<string, Readonly<Record<string, string>>>>;
  world: SlpDramaWorld;
  /** World activity; 0 starts nothing new (running dramas still move and end). */
  activity: number;
  newId: () => string;
};

const active = <T extends { endedAt: string | null }>(entry: T) => entry.endedAt === null;
const pairKey = (kind: string, a: string, b: string) => `${kind}:${[a, b].sort().join("|")}`;
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Words about the player in pack text, from their page's gender: "{you-bf}" is bf, gf or partner,
 * "{you-man}" man, girl or one, "{you-him}", "{you-he}", "{you-boy}". None: the neutral words.
 */
export function slpDramaPlayerWords(player: Pick<SlpDramaCreator, "gender"> | undefined): Record<string, string> {
  const gender = player?.gender;
  const pick = (male: string, female: string, other: string) =>
    gender === "male" ? male : gender === "female" ? female : other;
  return {
    "you-bf": pick("bf", "gf", "partner"),
    "you-man": pick("man", "girl", "one"),
    "you-boy": pick("boy", "girl", "one"),
    "you-him": pick("him", "her", "them"),
    "you-he": pick("he", "she", "they"),
  };
}

/** `{role}` in pack text becomes that role's name. Unknown roles stay as they are. */
export function slpDramaText(text: string, names: Readonly<Record<string, string>>): string {
  return text.replace(/\{([a-z][a-z0-9-]*)\}/gu, (whole, role: string) => names[role] ?? whole);
}

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
): { state: SlpDramaState; ties: SlpDramaTieEffect[] } {
  const now = input.at.getTime();
  const stamp = iso(now);
  const live = new Map(input.world.creators.map((creator) => [creator.id, creator]));
  const dramas = new Map(input.dramas.map((drama) => [drama.id, drama]));
  const situations = new Map(input.situations.map((situation) => [situation.id, situation]));
  const ties: SlpDramaTieEffect[] = [];
  let jobs = [...state.jobs];
  const ended = { ...state.ended };
  const names = (cast: Readonly<Record<string, string>>) => ({
    ...Object.fromEntries(
      Object.entries(cast).flatMap(([key, id]) => (live.get(id) ? [[key, live.get(id)!.name]] : [])),
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
    if (situationRuns.some((run) => active(run) && run.situationId === situation.id)) continue;
    const id = input.newId();
    const cast = slpDramaCast(
      situation.roles,
      situation.roles.map((role) => role.key),
      {},
      { world: input.world, busy: new Set(), seed: id, at: input.at },
    );
    if (cast)
      situationRuns.push({
        id,
        situationId: situation.id,
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
      ...input.dials[situation.id],
    };
    const deck = situation.deck.filter((beat) =>
      Object.entries(beat.when ?? {}).every(([key, value]) => dials[key] === value),
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
  const end = (run: SlpDramaRun, ending: NonNullable<SlpDramaRun["ending"]>, exit: boolean): SlpDramaRun => {
    const drama = dramas.get(run.dramaId);
    // Switched off, lead gone, out of time: what it still had queued goes nowhere (the exit is new).
    if (ending !== "done")
      jobs = jobs.map((entry) =>
        entry.runId === run.id && entry.status === "queued" ? { ...entry, status: "dropped" as const } : entry,
      );
    if (exit && drama) queue([drama.exit], { id: run.id, cast: aliveCast(run.cast) }, now + 2 * DAY, "exit");
    ended[run.dramaId] = stamp;
    return log({ ...run, endedAt: stamp, ending, choice: null }, "ended", ending);
  };
  const aliveCast = (cast: Record<string, string>) =>
    Object.fromEntries(Object.entries(cast).filter(([, id]) => live.has(id)));

  /** Enters `key` (or ends the drama): casts its roles, skips it when it cannot run, queues its beats. */
  const enter = (run: SlpDramaRun, drama: SlpDrama, key: string, depth = 0): SlpDramaRun => {
    if (key === "end" || depth > drama.stages.length) return end(run, "done", true);
    const index = drama.stages.findIndex((stage) => stage.key === key);
    const stage = drama.stages[index]!;
    const next = () => stage.next ?? drama.stages[index + 1]?.key ?? "end";
    const needed = stageRoles(stage, drama.roles);
    const playerKey = drama.roles.find((role) => role.player)?.key;
    const cast = slpDramaCast(drama.roles, needed, aliveCast(run.cast), {
      couples: slpDramaCouplePairs(drama),
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
    if (!cast || tooHot) return enter(log(run, "skipped", key), drama, next(), depth + 1);
    const days = stage.days[0] + (hash(`${run.id}:${key}:days`) % (stage.days[1] - stage.days[0] + 1));
    let entered: SlpDramaRun = log(
      { ...run, cast, stage: key, stageAt: stamp, stageDays: days, choice: null },
      "stage",
      key,
    );
    queue(stage.beats, entered, now + Math.max(days, 1) * DAY, key);
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
          count: stage.choice.options.length,
        },
      };
      if (stage.choice.asks === "player" && playerKey && cast[playerKey]) {
        const asker = cast[drama.roles[0]!.key] ?? null;
        jobs.push({
          id: input.newId(),
          runId: run.id,
          channel: "choice",
          actorId: asker,
          toId: cast[playerKey],
          choice: {
            question: stage.choice.question,
            options: stage.choice.options.map((option) => option.label),
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
    if (!drama) return end(run, "off", false);
    const lead = drama.roles[0]!.key;
    if (run.cast[lead] && !live.has(run.cast[lead]!)) return end(run, "left", true);
    if (now - Date.parse(run.startedAt) >= drama.maxDays * DAY) return end(run, "time", true);
    const index = drama.stages.findIndex((stage) => stage.key === run.stage);
    const stage = drama.stages[index];
    if (!stage) return end(run, "done", true);
    let current = run;
    const choice = stage.choice;
    if (choice && current.choice && current.choice.answer === null && now >= Date.parse(current.choice.dueAt)) {
      // Nobody answered in time (player), the vote closed (fans), or the role made up their mind (role).
      const decided =
        choice.asks === "player"
          ? choice.default
          : hash(`${run.id}:${stage.key}:vote`) % 3 === 0
            ? hash(`${run.id}:${stage.key}:pick`) % choice.options.length
            : choice.default;
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
    for (const outcome of stage.outcomes) {
      const a = current.cast[outcome.between[0]];
      const b = current.cast[outcome.between[1]];
      if (a && b && live.has(a) && live.has(b)) ties.push({ runId: run.id, outcome, ids: [a, b] });
    }
    const answer =
      choice && current.choice?.answer !== null && current.choice
        ? choice.options[current.choice.answer]?.next
        : undefined;
    return enter(current, drama, answer ?? stage.next ?? drama.stages[index + 1]?.key ?? "end");
  });

  // A drama starts: cast its lead and first stage; on a situation, with the situation's people.
  const standing = new Map(situationRuns.filter(active).map((run) => [run.situationId, run]));
  const start = (pick: SlpDrama, lead?: string | null): boolean => {
    if (pick.requires && !standing.has(pick.requires.situation)) return false;
    const id = input.newId();
    const base: Record<string, string> = pick.requires ? { ...standing.get(pick.requires.situation)!.cast } : {};
    // The player's pick for the first role (Stir), when it still fits once the rest is cast.
    if (lead && !pick.requires) base[pick.roles[0]!.key] = lead;
    const first = pick.stages[0]!;
    const cast = slpDramaCast(pick.roles, [pick.roles[0]!.key, ...stageRoles(first, pick.roles)], base, {
      couples: slpDramaCouplePairs(pick),
      world: input.world,
      busy: busy(),
      seed: id,
      at: input.at,
    });
    if (!cast) return false;
    const run: SlpDramaRun = {
      id,
      dramaId: pick.id,
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
  if (requested && !running().has(requested.id)) start(requested, state.requestedLead);

  // Now and then a new drama starts, within the level's cap and each drama's cooldown.
  const window = Math.floor(now / START_WINDOW);
  const rules = SLP_DRAMA_LEVEL_RULES[input.level];
  let startWindow = state.startWindow;
  if (startWindow !== window) {
    startWindow = window;
    const room = runs.filter(active).length < rules.running;
    const roll = hash(`${window}:drama-start`) % 100 < Math.round(rules.startChance * Math.max(0, input.activity));
    if (room && roll) {
      const options = input.dramas.filter(
        (drama) =>
          !running().has(drama.id) &&
          (!ended[drama.id] || now - Date.parse(ended[drama.id]!) >= drama.cooldownDays * DAY) &&
          (!drama.requires || standing.has(drama.requires.situation)),
      );
      const total = options.reduce((sum, drama) => sum + drama.weight, 0);
      let point = ((hash(`${window}:drama-pick`) % 10_000) / 10_000) * total;
      const pick = options.find((drama) => (point -= drama.weight) < 0) ?? options.at(-1);
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
  };
}

/** Every role a stage names: its beats' actors, targets and heat people, its choice role, its outcomes. */
export function stageRoles(stage: SlpDramaStage, roles: readonly SlpDramaRole[]): string[] {
  const keys = [
    ...stage.beats.flatMap((beat) => [beat.role, beat.to, beat.on, beat.heat?.with, beat.heat?.shotBy, beat.heat?.for]),
    stage.choice?.role,
    stage.choice?.asks === "player" ? roles.find((role) => role.player)?.key : undefined,
    ...stage.outcomes.flatMap((outcome) => outcome.between),
  ];
  return [...new Set(keys.filter((key): key is string => Boolean(key) && key !== "crowd" && key !== "fans"))];
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
            choice: { ...run.choice!, answer: option, by: "player" },
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

/**
 * Whether this drama can start now with `leadId` in its first role: the rest of its first stage is
 * cast as the tick would, and the lead must still fit once they are (Stir's lead pick, 0.3.11).
 */
export function slpDramaLeadFits(
  drama: SlpDrama,
  leadId: string,
  input: { world: SlpDramaWorld; busy: ReadonlySet<string>; at: Date },
): boolean {
  const role = drama.roles[0]!;
  const lead = input.world.creators.find((creator) => creator.id === leadId);
  if (!lead || drama.requires || (input.busy.has(leadId) && !role.player)) return false;
  const cast = slpDramaCast(
    drama.roles,
    [role.key, ...stageRoles(drama.stages[0]!, drama.roles)],
    { [role.key]: leadId },
    {
      ...input,
      seed: `lead:${leadId}`,
      couples: slpDramaCouplePairs(drama),
    },
  );
  const playerKey = drama.roles.find((entry) => entry.player)?.key;
  return Boolean(cast && fits(role, lead, cast, input.world, playerKey).ok);
}
