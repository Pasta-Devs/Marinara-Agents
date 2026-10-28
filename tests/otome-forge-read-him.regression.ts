// Otome Forge's Read Him (M5): P25's reply holds exactly one true reading per round (three or four different readings,
// a true index that names one, five rounds), the readings are shuffled with the truth, and the truth, the thought and
// the tell never reach the client before that round is answered; the first pick is the answer, also through a race;
// one set per start (a double tap, a reload, a hard set kept) and a new one at a new stage; finishing needs every
// round, pays once whatever the score (failure still pays) within the day's caps, and a capped day still plays; a
// finish whose write failed lands its pay, tells and timeline entry exactly once when it is sent again; the
// tells read right reach the next scene card and the next prompts (never one a bible edit moved); the first Read Him
// is on his Love Timeline once; a finished set is a `chat` source recalled only by him, titled private; P25 carries
// the knowledge boundary and the `home` contract, his tells by index and never an unrevealed truth, and is logged in
// debug mode; P25 sees him as his own reader may (M3's ownView): nothing another love interest's own chapter left on
// his rows; a run deleted while P25 writes keeps no set.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import {
  ACTIVITY_STARLIGHT_DAILY_CAP,
  AFFECTION_EARNINGS,
  OUTSIDE_AFFECTION_DAILY_CAP,
  STARLIGHT_EARNINGS,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import {
  READ_HIM_ROUNDS,
  type ReadHimSetView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/read-him.ts";
import {
  OtomeForgeError,
  createHandle,
  type OtomeReply,
  type RouteDeps,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  RUN_DOC_KINDS,
  runDocTarget,
  stateId,
  unitId,
  worldId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { createOtomeMemory } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import {
  READ_HIM_WORDS,
  ReadHimReplySchema,
  checkReadHimReply,
  normalizeSet,
  readHimId,
  readHimMemorySources,
  shuffleRound,
  type ReadHimReply,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/read-him.ts";
import { registerReadHimRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/read-him.ts";
import { otomeSceneCard } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/scene-card.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import type { FakeReply } from "./fixtures/otome-forge-fakes.ts";
import {
  KAI,
  KAI_SHARED,
  MIR,
  MIREILLE_ONLY,
  RUPTURE_ID,
  bible,
  json,
  storyWorld,
  withMireillesPrivateRows,
} from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];
const isSetPrompt = (messages: Messages) => messages[0]!.content.includes("a mini-game in an otome visual novel");
const TELLS = ["polishes clean glass", "counts the bells", "won't sit"];

/** A valid P25 reply: the truth always first (the server shuffles it), tells 0 and 1 in the first two rounds. */
function setReply(tag = "A", changes: (round: number) => Record<string, unknown> = () => ({})): ReadHimReply {
  return {
    rounds: Array.from({ length: READ_HIM_ROUNDS }, (_, i) => ({
      context: `MOMENT-${tag}${i}: the bell rings once while you wait on the quay.`,
      line: `Late again. How efficient of you.`,
      face: i % 2 ? "cold" : "flustered",
      readings: [`TRUE-${tag}${i} relieved you came`, `annoyed at you ${i}`, `bored by the quay ${i}`],
      trueIndex: 0,
      thought: `THOUGHT-${tag}${i}: I counted every bell until you came.`,
      tell: i < 2 ? i : null,
      ...changes(i),
    })),
  };
}

/** Answers P25 with `replies` in turn, and the kit's summarizer (memory upkeep) whenever it asks. */
function model(...replies: unknown[]): FakeReply[] {
  const queue = [...replies];
  return Array.from({ length: 60 }, () => (messages: Messages) => {
    if (isSetPrompt(messages)) {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      return typeof next === "string" ? next : json(next);
    }
    const input = JSON.parse(messages.at(-1)!.content);
    if (input.source) return json({ summary: `${input.source.title}: ${input.source.content}` });
    if (input.records) return json({ summary: input.records.map((r: { content: string }) => r.content).join(" ") });
    throw new Error(`Unexpected prompt: ${messages[0]!.content.slice(0, 80)}`);
  });
}

/** The Read Him routes on a fake router wrapped by the kit's forgeTimeZoneRoutes; `call` answers like Fastify. */
function readHimRoutes(deps: RouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  registerReadHimRoutes(
    forgeTimeZoneRoutes({
      get: (path: string, handler: RouteHandler) => void routes.set(`GET ${path}`, handler),
      post: (path: string, handler: RouteHandler) => void routes.set(`POST ${path}`, handler),
    }),
    deps,
  );
  return async (path: string, body: object = {}, params: Record<string, string> = {}) => {
    const handler = routes.get(`POST ${path}`);
    assert.ok(handler, `POST ${path} is registered`);
    let status = 200;
    let payload: unknown;
    const reply: OtomeReply = {
      status(code) {
        status = code;
        return reply;
      },
      send(value) {
        payload = value;
        return reply;
      },
    };
    const result = await handler(
      {
        method: "POST",
        url: path,
        body: { timeZone: "UTC", debugMode: true, ...body },
        params: { run: runKey, ...params },
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

const START = "/runs/:run/read-him";
const ANSWER = "/runs/:run/read-him/:set/answer";
const FINISH = "/runs/:run/read-him/:set/finish";
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function readHimWorld(
  runKey: string,
  replies: FakeReply[] = model(setReply()),
  withMemory = false,
  failures: { state: Error[]; set: Error[] } = { state: [], set: [] },
) {
  const base = await storyWorld({ runKey, replies });
  // Errors put in `failures` make the next writes of the state (or of a Read Him set) throw, one each, in turn.
  const store: typeof base.store = {
    ...base.store,
    updateDoc: ((target, normalize, change, options) => {
      const queue = target.id === stateId(base.runId) ? failures.state : target.kind === "readhim" ? failures.set : [];
      const error = queue.shift();
      return error ? Promise.reject(error) : base.store.updateDoc(target, normalize, change, options);
    }) as typeof base.store.updateDoc,
  };
  const t = { ...base, store, deps: { ...base.deps, store } };
  const memory = withMemory
    ? createOtomeMemory({
        runtime: t.runtime,
        store: t.store,
        readSources: async (runId) => readHimMemorySources(t.store, runId, await t.state()),
      })
    : undefined;
  const deps: RouteDeps = { ...t.deps, handle: createHandle(t.runtime.logger), ...(memory ? { memory } : {}) };
  const call = readHimRoutes(deps, runKey);
  const start = async (li = KAI) => call(START, { li });
  const answer = (set: string, round: number, pick: number) => call(ANSWER, { round, pick }, { set });
  const finish = (set: string) => call(FINISH, {}, { set });
  const stored = async (set: string) => {
    const record = await t.fake.documents.getById("otome-forge", readHimId(t.runId, set));
    return record ? normalizeSet(record.data) : null;
  };
  const setCalls = () => t.calls.filter((entry) => isSetPrompt(entry.messages));
  return { ...t, memory, deps, call, start, answer, finish, stored, setCalls };
}

/** The index of the true reading in a round as the client sees it (the fake model tags it). */
const truthOf = (view: ReadHimSetView, round: number) =>
  view.rounds[round]!.readings.findIndex((reading) => reading.startsWith("TRUE-"));

/** Answers every round: right where `right(round)`, else the first decoy. */
async function answerAll(
  t: Awaited<ReturnType<typeof readHimWorld>>,
  view: ReadHimSetView,
  right: (round: number) => boolean,
) {
  for (let round = 0; round < view.rounds.length; round += 1) {
    const truth = truthOf(view, round);
    const pick = right(round) ? truth : (truth + 1) % view.rounds[round]!.readings.length;
    const answered = await t.answer(view.setId, round, pick);
    assert.equal(answered.status, 200);
  }
}

test("P25's reply holds exactly one true reading a round, and the readings are shuffled with the truth", () => {
  const check = checkReadHimReply(TELLS.length);
  const ok = check(setReply());
  assert.ok(typeof ok === "object");
  assert.equal(ok.rounds.length, READ_HIM_ROUNDS);

  const six = { rounds: [...setReply().rounds, setReply("B").rounds[0]!] };
  assert.equal((check(six) as ReadHimReply).rounds.length, READ_HIM_ROUNDS, "extra rounds are dropped");
  assert.equal(ReadHimReplySchema.safeParse({ rounds: setReply().rounds.slice(0, 4) }).success, false);
  assert.equal(
    ReadHimReplySchema.safeParse(setReply("A", () => ({ readings: ["only", "two"] }))).success,
    false,
    "three or four readings",
  );
  assert.match(
    check(setReply("A", (i) => (i === 2 ? { trueIndex: 3 } : {}))) as string,
    /rounds\[2\]\.trueIndex must be the index of one of its readings/,
  );
  assert.match(
    check(setReply("A", (i) => (i === 1 ? { readings: ["Relieved", "relieved", "bored"] } : {}))) as string,
    /rounds\[1\]\.readings must all be different/,
  );
  assert.match(
    check(
      setReply("A", (i) =>
        i === 0
          ? {
              thought: Array(READ_HIM_WORDS.thought + 1)
                .fill("w")
                .join(" "),
            }
          : {},
      ),
    ) as string,
    /thought must be 60 words or fewer/,
  );
  const loose = check(setReply("A", () => ({ face: "smug", tell: 7 }))) as ReadHimReply;
  assert.deepEqual([loose.rounds[0]!.face, loose.rounds[0]!.tell], ["", null], "an unknown face or tell is none");

  // A fixed "random" reverses three readings: the truth moves with them.
  const shuffled = shuffleRound(ok.rounds[0]!, (below) => (below === 3 ? 0 : below - 1));
  assert.equal(shuffled.readings[shuffled.trueIndex], ok.rounds[0]!.readings[0]);
  assert.notEqual(shuffled.trueIndex, 0);
  assert.deepEqual([...shuffled.readings].sort(), [...ok.rounds[0]!.readings].sort());
});

test("the truth never reaches the client before the answer, and the first pick is the answer", async () => {
  const t = await readHimWorld("r-readhim1-aaaaaa");
  const started = await t.start();
  assert.equal(started.status, 200);
  const view = started.body as ReadHimSetView;
  assert.equal(view.rounds.length, READ_HIM_ROUNDS);
  assert.equal(view.grants, null);
  const wire = JSON.stringify(view);
  for (const hidden of ["trueIndex", "thought", "THOUGHT-", "tell", ...TELLS]) {
    assert.ok(!wire.includes(hidden), `the start never carries ${hidden}`);
  }
  assert.ok(view.rounds.every((round) => !("answer" in round)));

  // Round 1 answered: only it names its truth, here and when the set is opened again.
  const truth = truthOf(view, 1);
  const wrong = (truth + 1) % 3;
  const first = await t.answer(view.setId, 1, wrong);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, {
    pick: wrong,
    correct: false,
    trueIndex: truth,
    thought: "THOUGHT-A1: I counted every bell until you came.",
  });
  const again = await t.answer(view.setId, 1, truth);
  assert.deepEqual(again.body, first.body, "a second pick for the same round returns the first");
  const reopened = (await t.start()).body as ReadHimSetView;
  assert.equal(reopened.setId, view.setId, "the unfinished set is played on");
  assert.deepEqual(reopened.rounds[1]!.answer, first.body);
  const rest = JSON.stringify(reopened.rounds.filter((_, round) => round !== 1));
  assert.ok(!rest.includes("THOUGHT-") && !rest.includes("trueIndex"), "the other rounds stay hidden");

  // A right answer names the tell that gave him away (round 0's is his first mask tell).
  const right = await t.answer(view.setId, 0, truthOf(view, 0));
  assert.deepEqual([right.body.correct, right.body.tellLearned], [true, TELLS[0]]);

  // Two different picks at once: one lands, and both are told the same answer.
  const race = await Promise.all([t.answer(view.setId, 2, 0), t.answer(view.setId, 2, 1)]);
  assert.equal(race[0].body.pick, race[1].body.pick);
  assert.equal((await t.stored(view.setId))!.picks[2], race[0].body.pick);

  const bad = await t.answer(view.setId, 3, 3);
  assert.deepEqual([bad.status, bad.body.code], [400, "bad-request"], "a reading the round does not have");
  assert.deepEqual((await t.call(ANSWER, { round: 5, pick: 0 }, { set: view.setId })).status, 400);
  assert.deepEqual((await t.answer("rh-nope-zzzzzz", 0, 0)).status, 404);
  assert.deepEqual((await t.answer("not-a-set", 0, 0)).status, 404);
  assert.equal(t.setCalls().length, 1, "one call for the whole set");
});

test("one set per start: a double tap makes one call, a hard set is kept, and a new stage writes a new one", async () => {
  const t = await readHimWorld("r-readhim2-aaaaaa", model(setReply("A"), setReply("B"), setReply("C")));
  const [one, two] = await Promise.all([t.start(), t.start()]);
  assert.equal(one.body.setId, two.body.setId);
  assert.equal(t.setCalls().length, 1);
  assert.equal((await t.fake.documents.list("otome-forge", "readhim")).length, 1);

  // Each love interest has his own set.
  const theirs = await t.start(MIR);
  assert.notEqual(theirs.body.setId, one.body.setId);
  assert.equal(t.setCalls().length, 2);

  // A stage later, the old unfinished set is left and a new one is written, seeing the old set's moments.
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, stage: 2 } },
  }));
  const later = await t.start();
  assert.notEqual(later.body.setId, one.body.setId);
  const prompt = t.setCalls().at(-1)!.messages.at(-1)!.content;
  assert.ok(prompt.includes("RECENT MOMENTS") && prompt.includes("MOMENT-A0"), "his earlier moments are not repeated");
  assert.ok(!prompt.includes("MOMENT-B0"), "never another love interest's");

  const unknown = await t.start("li-nobody-zz99");
  assert.deepEqual([unknown.status, unknown.body.code], [404, "not-found"]);
  assert.equal((await t.start("not an li")).status, 404);
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    bible: null,
  }));
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, stage: 3 } },
  }));
  const unwritten = await t.start();
  assert.deepEqual([unwritten.status, unwritten.body.code], [409, "conflict"]);
});

test("finishing pays once whatever the score, needs every round, and the day's caps limit only the pay", async () => {
  const t = await readHimWorld("r-readhim3-aaaaaa", model(setReply("A"), setReply("B"), setReply("C")));
  const before = (await t.state()).wallet.starlight;
  const view = (await t.start()).body as ReadHimSetView;
  const early = await t.finish(view.setId);
  assert.deepEqual([early.status, early.body.code], [409, "conflict"], "every round first");

  await answerAll(t, view, () => false);
  const [a, b] = await Promise.all([t.finish(view.setId), t.finish(view.setId)]);
  assert.deepEqual([a.status, b.status], [200, 200]);
  const state = await t.state();
  assert.equal(state.wallet.starlight, before + STARLIGHT_EARNINGS.readHim, "failure still pays, once");
  assert.equal(state.lis[KAI]!.points, AFFECTION_EARNINGS.readHim);
  const paid = [a.body, b.body].find((body) => body.grants.length)!;
  assert.deepEqual(paid, {
    grants: [
      { source: "read-him", starlight: STARLIGHT_EARNINGS.readHim },
      { source: "read-him", li: KAI, affection: AFFECTION_EARNINGS.readHim },
    ],
    starlight: before + STARLIGHT_EARNINGS.readHim,
  });
  const replay = await t.finish(view.setId);
  assert.deepEqual(replay.body, paid, "a finish sent again returns what was paid");
  assert.equal((await t.state()).wallet.starlight, before + STARLIGHT_EARNINGS.readHim);
  assert.equal((await t.start()).body.setId !== view.setId, true, "a finished set is never played on");

  // Near the caps: only what is left of them; at the caps: nothing, and the set still plays and finishes.
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (current) => ({
    ...current,
    daily: {
      ...current.daily,
      starlight: ACTIVITY_STARLIGHT_DAILY_CAP - 10,
      affection: { [KAI]: OUTSIDE_AFFECTION_DAILY_CAP - 15 },
    },
  }));
  const near = (await t.start()).body as ReadHimSetView;
  await answerAll(t, near, () => true);
  assert.deepEqual((await t.finish(near.setId)).body.grants, [
    { source: "read-him", starlight: 10 },
    { source: "read-him", li: KAI, affection: 15 },
  ]);
  const capped = (await t.start()).body as ReadHimSetView;
  assert.equal(t.setCalls().length, 3, "a capped day still writes a set");
  await answerAll(t, capped, () => true);
  const nothing = await t.finish(capped.setId);
  assert.deepEqual([nothing.status, nothing.body.grants], [200, []]);
  assert.ok((await t.stored(capped.setId))!.finished, "and still finishes");
});

test("a finish whose write failed pays, learns the tells and dates the first Read Him once when sent again", async () => {
  const cases: Array<[label: string, failures: { state: Error[]; set: Error[] }]> = [
    ["the state's write failed", { state: [new Error("ENOSPC: no space left on device")], set: [] }],
    ["the state's write lost every revision", { state: [new OtomeForgeError(409, "lost", "conflict")], set: [] }],
    ["the set's write failed after the pay", { state: [], set: [new Error("EIO: the set was not saved")] }],
  ];
  for (const [index, [label, failures]] of cases.entries()) {
    const errors: { state: Error[]; set: Error[] } = { state: [], set: [] };
    const t = await readHimWorld(`r-readhimf${index}-aaaaaa`, model(setReply()), false, errors);
    const before = await t.state();
    const view = (await t.start()).body as ReadHimSetView;
    await answerAll(t, view, () => true);
    // The finish's writes fail now, once.
    errors.state.push(...failures.state);
    errors.set.push(...failures.set);
    const failed = await t.finish(view.setId);
    assert.notEqual(failed.status, 200, `${label}: the first finish says it failed`);
    if (failures.state.length) {
      assert.equal((await t.state()).wallet.starlight, before.wallet.starlight, `${label}: nothing paid yet`);
      assert.equal((await t.stored(view.setId))!.finished, null, `${label}: and the set is not finished`);
    }
    // Sent again (Retry, or the next Read Him, which picks the answered set up and finishes it).
    const again = await t.finish(view.setId);
    assert.equal(again.status, 200, `${label}: ${JSON.stringify(again.body)}`);
    const paid = [
      { source: "read-him", starlight: STARLIGHT_EARNINGS.readHim },
      { source: "read-him", li: KAI, affection: AFFECTION_EARNINGS.readHim },
    ];
    assert.deepEqual(again.body.grants, paid, `${label}: what it paid`);
    const once = async () => {
      const state = await t.state();
      assert.equal(state.wallet.starlight, before.wallet.starlight + STARLIGHT_EARNINGS.readHim, `${label}: paid once`);
      assert.equal(state.lis[KAI]!.points, AFFECTION_EARNINGS.readHim, `${label}: affection once`);
      assert.deepEqual(state.lis[KAI]!.tellsLearned, [0, 1], `${label}: the tells read right`);
      assert.ok(state.lis[KAI]!.firsts["read-him"], `${label}: his first Read Him`);
      assert.equal(state.timeline.filter((entry) => entry.kind === "first-read-him").length, 1, `${label}: timeline`);
    };
    await once();
    assert.deepEqual((await t.stored(view.setId))!.finished!.grants, paid, `${label}: the set is finished`);
    // And again: nothing more.
    assert.deepEqual((await t.finish(view.setId)).body.grants, paid);
    await once();
  }
});

test("the tells read right reach the next scene card and the next prompt; a moved tell is never learned", async () => {
  const t = await readHimWorld("r-readhim4-aaaaaa", model(setReply("A"), setReply("B")));
  const view = (await t.start()).body as ReadHimSetView;
  // Round 0 (tell 0) read right, round 1 (tell 1) read wrong.
  await answerAll(t, view, (round) => round !== 1);
  // A bible edit moves tell 2 meanwhile: nothing was learned through it anyway, and tell 0 still matches.
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    bible: bible({ mask: { presents: "Unbothered", tells: [...TELLS.slice(0, 2), "hums off-key"] } }),
  }));
  await t.finish(view.setId);
  const state = await t.state();
  assert.deepEqual(state.lis[KAI]!.tellsLearned, [0]);
  assert.deepEqual(state.lis[MIR]!.tellsLearned, [], "nothing learned of anyone else");

  const unit = normalizeUnit((await t.fake.documents.getById("otome-forge", unitId(t.runId, KAI)))!.data);
  const card = otomeSceneCard(unit, state.lis[KAI]!);
  assert.match(card, /The protagonist has learned to read these tells and may call them out: polishes clean glass\./);
  assert.doesNotMatch(otomeSceneCard(unit, { stage: 1 }), /learned to read/, "no line without learned tells");

  const second = (await t.start()).body as ReadHimSetView;
  const next = t.setCalls().at(-1)!.messages.at(-1)!.content;
  assert.ok(next.includes("learned to read these tells and may call them out: polishes clean glass"));

  // Both tells read right this time: the known one stays once, the new one joins after it.
  await answerAll(t, second, () => true);
  await t.finish(second.setId);
  assert.deepEqual((await t.state()).lis[KAI]!.tellsLearned, [0, 1]);
  // An index his bible no longer has names nothing.
  const edited = bible({ mask: { presents: "Unbothered", tells: ["hums off-key", ...TELLS.slice(1)] } });
  assert.doesNotMatch(otomeSceneCard({ ...unit, bible: edited }, { stage: 1, tellsLearned: [0, 4] }), /polishes/);
});

test("the first Read Him goes on his Love Timeline once", async () => {
  const t = await readHimWorld("r-readhim5-aaaaaa", model(setReply("A"), setReply("B")));
  for (let set = 0; set < 2; set += 1) {
    const view = (await t.start()).body as ReadHimSetView;
    await answerAll(t, view, (round) => round === 2);
    await t.finish(view.setId);
  }
  const state = await t.state();
  const firsts = state.timeline.filter((entry) => entry.kind === "first-read-him");
  assert.equal(firsts.length, 1);
  assert.equal(firsts[0]!.li, KAI);
  assert.equal(
    firsts[0]!.text,
    "THOUGHT-A2: I counted every bell until you came.",
    "his thought from a round read right",
  );
  assert.ok(state.lis[KAI]!.firsts["read-him"]);
});

test("a finished set is a chat source for its love interest only: recalled by him, never by another", async () => {
  const t = await readHimWorld("r-readhim6-aaaaaa", model(setReply("KAI"), setReply("MIR")), true);
  const kai = (await t.start(KAI)).body as ReadHimSetView;
  const mir = (await t.start(MIR)).body as ReadHimSetView;
  assert.deepEqual(await readHimMemorySources(t.store, t.runId, await t.state()), [], "an unfinished set is no source");
  await answerAll(t, kai, () => true);
  await answerAll(t, mir, () => false);
  await t.finish(kai.setId);
  await t.finish(mir.setId);

  const sources = await readHimMemorySources(t.store, t.runId, await t.state());
  assert.deepEqual(
    sources.map((source) => [source.kind, source.audience]).sort(),
    [
      ["chat", [KAI]],
      ["chat", [MIR]],
    ].sort(),
  );
  const own = sources.find((source) => source.audience?.[0] === KAI)!;
  // Titled private, as a phone session is: a scene with others in it recalls it as theirs alone.
  assert.equal(own.title, "Ines reads Kai (private: only Kai and the protagonist know how it went)");
  assert.match(own.content, /^Ines tried to read Kai in 5 small moments and read 5 right\./);
  assert.ok(own.content.includes("THOUGHT-KAI0"));

  const memory = t.memory!;
  assert.equal(await memory.maintain({ runId: t.runId }), true);
  for (let turn = 0; turn < 2000 && (await memory.status(t.runId)).phase === "pending"; turn += 1) await tick();
  assert.equal((await memory.status(t.runId)).phase, "ready");
  const recall = async (who: { reader?: string; cast?: string[] }) =>
    (await memory.recall({ runId: t.runId, job: "chat", query: { cues: ["the bell on the quay"] }, ...who })).text;
  assert.ok((await recall({ reader: KAI })).includes("THOUGHT-KAI"));
  assert.ok(!(await recall({ reader: KAI })).includes("THOUGHT-MIR"));
  assert.ok((await recall({ reader: MIR })).includes("THOUGHT-MIR"));
  assert.ok(!(await recall({ reader: MIR })).includes("THOUGHT-KAI"));
  assert.ok(!(await recall({ cast: [] })).includes("THOUGHT-"), "never for a scene he is not in");
});

test("P25 carries the boundary and the home contract, his tells by index, never an unrevealed truth, and is logged", async () => {
  const t = await readHimWorld("r-readhim7-aaaaaa");
  await t.start();
  const [call] = t.setCalls();
  const [system, user] = call!.messages.map((message) => message.content);
  assert.ok(system!.includes(forgeKnowledgeBoundary));
  assert.ok(system!.includes("CONTENT CONTRACT") && system!.includes("Heat: SFW"), "the home contract's SFW wording");
  assert.ok(system!.includes('"Read Kai"'));
  assert.ok(user!.includes("MASK TELLS (by index)\n0: polishes clean glass\n1: counts the bells\n2: won't sit"));
  assert.ok(user!.includes("flinches at the bell"), "a hidden secret shows only as its tells");
  const sent = JSON.stringify(call!.messages);
  assert.ok(!sent.includes("HIDDEN-TRUTH") && !sent.includes("MYSTERY-TRUTH"), "never an unrevealed truth");
  assert.equal(call!.options?.temperature, 0.9);
  assert.ok(t.logs.some((entry) => entry.level === "debugOverride" && entry.args[0] === `read-him/${KAI}`));
});

test("P25 sees him as his own reader may: nothing another love interest's own chapter left on his rows", async () => {
  const t = await readHimWorld("r-readhim9-aaaaaa");
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) =>
    withMireillesPrivateRows(state, { rupture: true }),
  );
  assert.equal((await t.start()).status, 200);
  const [call] = t.setCalls();
  const sent = call!.messages.map((message) => message.content).join("\n");
  assert.deepEqual(
    MIREILLE_ONLY.filter((marker) => sent.includes(marker)),
    [],
    "no grievance, disclosure, rupture text or ledger line of Mireille's own chapters",
  );
  for (const marker of KAI_SHARED) assert.ok(sent.includes(marker), `his own ${marker}`);
  assert.ok(
    sent.includes("Lately: KAI-MAIN-RELATIONSHIP: he let her hold the lamp. KAI-MAIN-OFFSCREEN: Kai rewired the bell."),
    "his newest lines among those he may know",
  );
  // The rupture itself is named: it is how he is with her now.
  assert.ok(sent.includes(`A rupture stands between them (${RUPTURE_ID})`));
});

test("a bad reply gets one repair turn and then fails with nothing saved; a run deleted mid-write keeps no set", async () => {
  const bad = setReply("A", (i) => (i === 0 ? { trueIndex: 3 } : {}));
  const t = await readHimWorld("r-readhim8-aaaaaa", model(bad));
  const failed = await t.start();
  assert.deepEqual([failed.status, failed.body.code], [502, "bad-format"]);
  assert.equal(t.setCalls().length, 2, "one repair turn");
  assert.match(t.setCalls()[1]!.messages.at(-1)!.content, /trueIndex must be the index of one of its readings/);
  assert.equal((await t.fake.documents.list("otome-forge", "readhim")).length, 0);

  // Held at the model: the run is deleted (its world first) before the reply lands.
  const u = await readHimWorld("r-readhim8-bbbbbb");
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const waiting = new Promise<void>((resolve) => (reached = resolve));
  const models = u.runtime.languageModels as { resolveForRequest: typeof u.runtime.languageModels.resolveForRequest };
  const resolve = models.resolveForRequest.bind(models);
  models.resolveForRequest = async (request) => {
    const resolved = await resolve(request);
    return {
      ...resolved,
      async chatComplete(messages, options) {
        reached();
        await gate;
        return resolved.chatComplete(messages, options);
      },
    };
  };
  const starting = u.start();
  await waiting;
  await u.store.removeDoc(worldId(u.runId));
  release();
  const done = await starting;
  assert.deepEqual([done.status, done.body.code], [404, "not-found"]);
  assert.equal((await u.fake.documents.list("otome-forge", "readhim")).length, 0, "the late set did not stay");
  assert.ok((RUN_DOC_KINDS as readonly string[]).includes("readhim"), "deleting a run sweeps its sets");
});
