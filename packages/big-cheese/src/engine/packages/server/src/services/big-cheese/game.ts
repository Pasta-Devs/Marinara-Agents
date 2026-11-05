// Big Cheese game routes: every action of the route contract on top of the rules core and the model tasks.
// The model only writes words. The code picks every stance, number and outcome. A model call runs before
// the store's write, and the write carries `expectedRevision`, so a changed run is a 409 and the client reloads.
import { z } from "zod";
import { CHOSE, runTask, type Band, type ModelCall } from "./ai/tasks.js";
import { withCast, type Cast } from "./cast.js";
import {
  HOURS,
  WEEKS,
  addEvidence,
  addWitness,
  answerCard,
  dayIndex,
  endDay,
  holdHearing,
  isFriday,
  offer,
  pure,
  readLetter,
  keepPromise,
  spendHours,
  roll,
  seedDay,
  talkToMember,
  trustChange,
  type Run as Game,
} from "./core/index.js";
import type { PlaceKit } from "./core/kits/types.js";
import { addTrust } from "./core/run.js";
import { METERS } from "./core/types.js";
import { BigCheeseError, PLACES, type Run, type RunStore, type SceneText } from "./store.js";

type Patch = Partial<Pick<Run, "game" | "text" | "scene">>;
type Rng = { rng: number };

const bad = (message: string) => new BigCheeseError(400, message, "bad-request");
const wrongPhase = (message: string) => new BigCheeseError(409, message, "wrong-phase");

// Messages thrown by the rules core, mapped to the contract's error codes.
const CORE_ERRORS: [RegExp, number, string][] = [
  [/Not enough hours/, 409, "no-hours"],
  [/No hearing is pending|has not arrived/, 409, "wrong-phase"],
  [/not in the inbox|No such letter/, 404, "not-found"],
  [/not offered|Cannot call|Not a won|Cannot use|Not a hearing/, 400, "bad-request"],
];
function coreError(e: unknown): never {
  const message = e instanceof Error ? e.message : "";
  const hit = CORE_ERRORS.find(([re]) => re.test(message));
  if (!hit) throw e;
  throw new BigCheeseError(hit[1], message, hit[2]);
}

const Base = z.object({ expectedRevision: z.number().int().min(0) });
const text = z.string().trim().min(1).max(300);
const ChooseBody = Base.extend({
  stance: z.string().max(40).optional(),
  text: text.optional(),
  skip: z.literal(true).optional(),
}).refine(
  (b) => [b.stance, b.text, b.skip].filter((v) => v !== undefined).length === 1,
  "Send one of stance, text or skip.",
);
const AnswerBody = Base.extend({
  stance: z.string().max(40).optional(),
  text: text.optional(),
  promise: z.object({ what: z.string().trim().min(3).max(120) }).optional(),
}).refine((b) => (b.stance === undefined) !== (b.text === undefined), "Send one of stance or text.");
const PersonBody = Base.extend({ person: z.string().min(1).max(40) });
const EvidenceBody = Base.extend({ threadId: z.string().min(1).max(40) });

// Scene plans (code data): one goal line per part. Every part ends in a stance choice.
const SCENES = {
  arrival: {
    title: (k: PlaceKit) => `Arrival at ${k.name}`,
    room: (k: PlaceKit) => `${k.bossTitle}'s office`,
    people: (k: PlaceKit, g: Game) => [...new Set([g.deputy, k.guidedLetters[0].person])],
    goals: [
      "You walk in and meet your deputy.",
      "Your deputy shows you the desk, the key and the letters.",
      "A first problem walks in before you sit down.",
    ],
  },
  hearing: {
    title: () => "Board hearing",
    room: (k: PlaceKit) => k.hearing.body,
    people: (_k: PlaceKit, g: Game) => g.hearingBody.map((m) => m.id),
    goals: [
      "The board reads the charge against you.",
      "You answer the charge in front of the board.",
      "Each member has a last word before the vote.",
    ],
  },
};

/** A part's summary plus what the player chose there, so the receipt names the choice. */
const withChoice = (summary: string, stance: string) => `${summary} ${CHOSE[stance] ?? CHOSE.other}`;

const band = (trust: number): Band =>
  trust < 25 ? "cold" : trust < 45 ? "wary" : trust < 60 ? "neutral" : trust < 80 ? "warm" : "loyal";

export function kitView(kitId: string, cast?: Cast) {
  const k = withCast(PLACES[kitId as keyof typeof PLACES], cast);
  return {
    id: k.id,
    name: k.name,
    premise: k.premise,
    bossTitle: k.bossTitle,
    meters: Object.fromEntries(METERS.map((m) => [m, { label: k.meters[m].label }])),
    boss: cast?.boss && { name: cast.boss.name, avatar: cast.boss.avatar },
    people: k.people.map((p) => ({
      ...(cast?.people[p.id] && { library: true, avatar: cast.people[p.id].avatar }),
      id: p.id,
      name: p.name,
      role: p.role,
      hue: p.colour,
      deputy: !!p.deputy,
      traits: p.traits,
      voiceLines: p.voice.phrases,
    })),
    rooms: k.rooms.map(({ id, name, text }) => ({ id, name, text })),
    letters: k.guidedLetters,
  };
}
export const view = (run: Run) => ({ run, kit: kitView(run.kitId, run.cast) });

export function createGame(store: RunStore, getModel: () => Promise<ModelCall | undefined>) {
  const placeOf = (run: Run) => withCast(PLACES[run.kitId as keyof typeof PLACES], run.cast, run.game.clock);
  const modelFor = (run: { lite: boolean }) => (run.lite ? Promise.resolve(undefined) : getModel());

  // One part of a scene. The code picks the offered stances; `h.rng` moves on after the call.
  async function nextPart(kit: PlaceKit, h: Rng, game: Game, s: SceneText, model?: ModelCall) {
    const stances = offer(h, game.authority).map((a) => a.stance);
    const { output } = await runTask(
      "scene.part",
      {
        kit,
        rng: h.rng,
        blueprint: s.blueprint,
        goal: SCENES[s.blueprint].goals[s.parts.length],
        room: s.room,
        people: s.people,
        offer: stances,
        earlier: s.parts.map((p) => p.summary),
        chose: s.parts.map((p) => p.chosen ?? "other"),
      },
      { model },
    );
    roll(h);
    return output;
  }

  async function openScene(kit: PlaceKit, h: Rng, game: Game, blueprint: SceneText["blueprint"], model?: ModelCall) {
    const plan = SCENES[blueprint];
    const s: SceneText = {
      blueprint,
      title: plan.title(kit),
      room: plan.room(kit),
      people: plan.people(kit, game),
      parts: [],
      total: plan.goals.length,
      done: false,
    };
    s.parts.push(await nextPart(kit, h, game, s, model));
    return s;
  }

  // Runs one action: parse, check the revision and the phase, build a patch, write it with the revision.
  async function act<S extends z.ZodType<{ expectedRevision: number }>>(
    id: unknown,
    body: unknown,
    schema: S,
    guard: "idle" | "quiet" | "any",
    fn: (run: Run, b: z.infer<S>) => Promise<Patch>,
  ) {
    const b = schema.safeParse(body ?? {});
    if (!b.success) throw bad(b.error.issues[0]?.message ?? "Invalid request.");
    const run = await store.get(id);
    if (b.data.expectedRevision !== run.revision)
      throw new BigCheeseError(409, "The run changed. Reload it.", "conflict");
    if (guard !== "any" && run.scene) throw wrongPhase("Finish the scene first.");
    if (run.game.status !== "playing") throw wrongPhase("This run is over.");
    let patch: Patch;
    try {
      patch = await fn(run, b.data);
    } catch (e) {
      if (e instanceof BigCheeseError) throw e;
      coreError(e);
    }
    return view(await store.update(run.id, run.revision, (r) => ({ ...r, ...patch })));
  }

  const withGame = (game: Game, h: Rng): Game => ({ ...game, rng: h.rng });

  return {
    async create(kitId: string, lite = false, cast?: Cast) {
      const model = await modelFor({ lite });
      return view(
        await store.create(
          kitId,
          lite,
          async (game) => {
            const h = { rng: game.rng };
            const arrival = await openScene(
              withCast(PLACES[kitId as keyof typeof PLACES], cast),
              h,
              game,
              "arrival",
              model,
            );
            game.rng = h.rng;
            return { text: { cards: {}, scenes: { arrival }, feelings: {} }, scene: "arrival" };
          },
          cast,
        ),
      );
    },

    choose: (id: unknown, sceneId: string, body: unknown) =>
      act(id, body, ChooseBody, "any", async (run, b) => {
        const kit = placeOf(run);
        const found = Object.hasOwn(run.text.scenes, sceneId) ? run.text.scenes[sceneId] : undefined;
        if (!found) throw new BigCheeseError(404, "No such scene.", "not-found");
        if (run.scene !== sceneId) throw wrongPhase("This scene is not open.");
        const s = structuredClone(found);
        const last = s.parts[s.parts.length - 1];
        const h = { rng: run.game.rng };
        const model = await modelFor(run);
        let stance = b.stance ?? last.suggestions[1]?.stance ?? last.suggestions[0].stance;
        if (b.stance && !last.suggestions.some((x) => x.stance === b.stance)) throw bad("That answer is not offered.");
        if (b.text) {
          const allowed = last.suggestions.map((x) => x.stance);
          stance = (await runTask("answer.tag", { kit, text: b.text, allowed }, { model })).output.stance;
        }
        last.chosen = stance;
        if (stance) last.summary = withChoice(last.summary, stance);
        const picks = [stance];
        if (b.skip) {
          // Skip: the middle answer for every part left, with no model calls.
          while (s.parts.length < s.total) {
            const mid = offer(h, run.game.authority)[1].stance;
            s.parts.push({
              lines: [],
              suggestions: [],
              summary: withChoice(SCENES[s.blueprint].goals[s.parts.length], mid),
              chosen: mid,
            });
            picks.push(mid);
          }
        } else if (s.parts.length < s.total) {
          s.parts.push(await nextPart(kit, h, run.game, s, model));
        }
        const done = s.parts.length >= s.total && !!s.parts[s.parts.length - 1].chosen;
        let game = withGame(run.game, h);
        if (s.blueprint === "arrival") {
          // Small trust nudges for the people on stage.
          game = pure((g: Game) =>
            picks.forEach((p) => s.people.forEach((who) => addTrust(g, who, trustChange(p, 1)))),
          )(game);
        }
        if (done) {
          s.done = true;
          if (s.blueprint === "arrival")
            s.outcome = `Your first hour at ${kit.name} is over. The letters are in the drawer.`;
          else {
            game = holdHearing(game);
            const r = game.lastHearing!;
            s.outcome = r.won
              ? `The board backed you, ${r.backing} of ${r.of}. You keep the job on a last warning.`
              : `Only ${r.backing} of ${r.of} backed you. ${game.endingName}.`;
          }
        }
        return {
          game,
          text: { ...run.text, scenes: { ...run.text.scenes, [sceneId]: s } },
          scene: done ? null : sceneId,
        };
      }),

    dayStart: (id: unknown, body: unknown) =>
      act(id, body, Base, "idle", async (run) => {
        if (run.game.clock.hoursLeft !== HOURS || run.game.inbox.some((c) => c.age === 0))
          throw wrongPhase("The day has started.");
        const game = seedDay(run.game);
        const seeds = game.inbox.filter((c) => !run.game.inbox.some((o) => o.id === c.id));
        const h = { rng: game.rng };
        const cards = { ...run.text.cards };
        if (seeds.length) {
          const { output, source } = await runTask(
            "cards.day",
            {
              kit: placeOf(run),
              rng: h.rng,
              seeds: seeds.map((c) => ({
                id: c.id,
                asker: c.asker,
                need: c.need,
                severity: c.severity,
                offer: c.answers,
              })),
            },
            { model: await modelFor(run) },
          );
          roll(h);
          for (const c of output.cards) cards[c.seed] = { line: c.text, answers: c.answers, source };
        }
        return { game: withGame(game, h), text: { ...run.text, cards } };
      }),

    answer: (id: unknown, cardId: string, body: unknown) =>
      act(id, body, AnswerBody, "idle", async (run, b) => {
        const card = run.game.inbox.find((c) => c.id === cardId);
        if (!card) throw new BigCheeseError(404, `Card ${cardId} is not in the inbox.`, "not-found");
        if (run.game.clock.hoursLeft < 1) throw new BigCheeseError(409, "No hours left today.", "no-hours");
        let stance = b.stance ?? "";
        let promise: { to: string; what: string } | undefined = b.promise && { to: card.asker, what: b.promise.what };
        if (b.text) {
          // The tag can only land on an offered answer, because the core accepts nothing else.
          const input = {
            kit: placeOf(run),
            text: b.text,
            allowed: card.answers.map((a) => a.stance),
            asker: card.asker,
          };
          const tag = (await runTask("answer.tag", input, { model: await modelFor(run) })).output;
          stance = tag.stance;
          // The model may only word the promise; it always goes to the asker.
          promise ??= tag.promise && { to: card.asker, what: tag.promise.what };
        }
        const { week, day } = run.game.clock;
        // ponytail: a promise is due the same day next week, capped at the last week; real due dates come later.
        const due = { week: Math.min(week + 1, WEEKS), day };
        return { game: answerCard(run.game, cardId, stance, promise ? [{ ...promise, due }] : []) };
      }),

    dayEnd: (id: unknown, body: unknown) =>
      act(id, body, Base, "idle", async (run) => {
        let game = endDay(run.game);
        const { week } = run.game.clock;
        if (!isFriday(run.game.clock) || game.report?.week !== week) return { game };
        // A Friday settle: one feeling line per key person.
        const kit = placeOf(run);
        const people = [...new Set([game.deputy, ...kit.guidedLetters.map((l) => l.person)])]
          .filter((p) => game.people[p])
          .map((p) => ({ person: p, band: band(game.people[p].trust) }));
        const h = { rng: game.rng };
        const { output } = await runTask("feeling.lines", { kit, rng: h.rng, people }, { model: await modelFor(run) });
        roll(h);
        game = withGame(game, h);
        return { game, text: { ...run.text, feelings: { ...run.text.feelings, [week]: output.lines } } };
      }),

    readLetter: (id: unknown, index: number, body: unknown) =>
      act(id, body, Base, "quiet", async (run) => {
        if (!Number.isInteger(index) || index < 0) throw new BigCheeseError(404, "No such letter.", "not-found");
        return { game: readLetter(run.game, index) };
      }),

    witness: (id: unknown, body: unknown) =>
      act(id, body, PersonBody, "idle", async (run, b) => ({ game: addWitness(run.game, b.person) })),
    evidence: (id: unknown, body: unknown) =>
      act(id, body, EvidenceBody, "idle", async (run, b) => ({ game: addEvidence(run.game, b.threadId) })),
    // Keeping a promise takes one hour of the boss's day; the Friday check then closes it as won.
    keepPromise: (id: unknown, threadId: string, body: unknown) =>
      act(id, body, Base, "idle", async (run) => {
        const p = run.game.threads[threadId]?.promise;
        if (!p || p.kept) throw new BigCheeseError(404, "No open promise.", "not-found");
        const game = keepPromise(run.game, threadId);
        game.clock = spendHours(game.clock, 1);
        return { game };
      }),
    talk: (id: unknown, body: unknown) =>
      act(id, body, PersonBody, "idle", async (run, b) => ({ game: talkToMember(run.game, b.person) })),

    hearingStart: (id: unknown, body: unknown) =>
      act(id, body, Base, "idle", async (run) => {
        const hearing = run.game.hearing;
        if (!hearing || dayIndex(run.game.clock) < dayIndex(hearing)) throw wrongPhase("No hearing is held today.");
        const sceneId = `hearing-w${hearing.week}`;
        if (run.text.scenes[sceneId]) throw wrongPhase("This hearing has started.");
        const h = { rng: run.game.rng };
        const scene = await openScene(placeOf(run), h, run.game, "hearing", await modelFor(run));
        return {
          game: withGame(run.game, h),
          text: { ...run.text, scenes: { ...run.text.scenes, [sceneId]: scene } },
          scene: sceneId,
        };
      }),
  };
}
