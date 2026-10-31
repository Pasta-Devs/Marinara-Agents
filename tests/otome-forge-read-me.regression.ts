// Otome Hearth's Read Me (#1945): the reply holds READ_ME_GUESSES guesses, each in a notebook category, about something
// different, with no empty field, nothing over its word limit and nothing medical (extra guesses are dropped; anything
// else gets the repair turn); a guess's reactions and its fact never reach the client before it is answered, and only
// the chosen verdict's reaction then; the first answer is final, also through a race; one set per start, played on at
// any stage; finishing needs every guess, pays once within the day's caps (pinned numbers) and writes one notebook
// entry per guess once, in the same write; a deleted entry never comes back from a finish sent again, even one retried
// after the set's own write failed; the notebook routes read, rewrite, clear and delete entries (404 for an unknown
// one) and refuse medical words with nothing saved, and the set's copy of the words follows; the prompt carries the
// knowledge boundary and the `chat` contract (it follows the Heat), the love interest's own notebook and never
// another's, sees them as their own reader may, and is logged in debug mode; a run deleted while the set is written
// keeps no set, deleting a run sweeps sets, and a set is never a story-memory source.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityLanguageModelMessage } from "@marinara-engine/shared";
import { forgeKnowledgeBoundary } from "@forge-kit/story-memory-integration.mjs";
import { forgeTimeZoneRoutes } from "@forge-kit/time-zone-server.mjs";
import type { LiState } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import { defaultContent } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/content.ts";
import {
  ACTIVITY_STARLIGHT_DAILY_CAP,
  OUTSIDE_AFFECTION_DAILY_CAP,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import {
  READ_ME_GUESSES,
  READ_ME_WORDS_MAX,
  type NotebookEntry,
  type ReadMeSetView,
  type ReadMeVerdict,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/read-me.ts";
import {
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
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import {
  READ_ME_WORDS,
  ReadMeReplySchema,
  applyReadMe,
  checkReadMeReply,
  normalizeSet,
  readMeId,
  type ReadMeReply,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/read-me.ts";
import { registerReadMeRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/read-me.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import type { FakeReply } from "./fixtures/otome-forge-fakes.ts";
import {
  KAI,
  KAI_SHARED,
  MIR,
  MIREILLE_ONLY,
  SOL,
  at,
  json,
  storyWorld,
  withMireillesPrivateRows,
} from "./fixtures/otome-forge-story.ts";

type Messages = CapabilityLanguageModelMessage[];
const isSetPrompt = (messages: Messages) => messages[0]!.content.includes('"Read Me", a mini-game');
const CATEGORIES = ["likes", "fears", "habits", "dreams"] as const;

/** A valid reply: four guesses in four categories, every field tagged so the tests can tell where it went. */
function setReply(tag = "A", changes: (guess: number) => Record<string, unknown> = () => ({})): ReadMeReply {
  return {
    context: `CONTEXT-${tag}: Kai sets two cups on the sea wall and studies you over his.`,
    guesses: Array.from({ length: READ_ME_GUESSES }, (_, i) => ({
      category: CATEGORIES[i]!,
      line: `GUESS-${tag}${i}: You take your tea bitter, don't you?`,
      face: i % 2 ? "cold" : "tender",
      fact: `FACT-${tag}${i}: Ines takes her tea bitter, cup ${i}.`,
      reactions: {
        right: { line: `REACT-RIGHT-${tag}${i}: I knew it.`, face: "flustered" },
        close: { line: `REACT-CLOSE-${tag}${i}: Nearly, then.`, face: "" },
        wrong: { line: `REACT-WRONG-${tag}${i}: Hm. Noted.`, face: "smug" },
      },
      ...changes(i),
    })),
  };
}

/** Answers the Read Me prompt with `replies` in turn (the last one repeats). */
function model(...replies: unknown[]): FakeReply[] {
  const queue = [...replies];
  return Array.from({ length: 30 }, () => (messages: Messages) => {
    if (!isSetPrompt(messages)) throw new Error(`Unexpected prompt: ${messages[0]!.content.slice(0, 80)}`);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return typeof next === "string" ? next : json(next);
  });
}

/** The Read Me routes on a fake router wrapped by the kit's forgeTimeZoneRoutes; `call` answers like Fastify. */
function readMeRoutes(deps: RouteDeps, runKey: string) {
  const routes = new Map<string, RouteHandler>();
  registerReadMeRoutes(
    forgeTimeZoneRoutes({
      get: (path: string, handler: RouteHandler) => void routes.set(`GET ${path}`, handler),
      post: (path: string, handler: RouteHandler) => void routes.set(`POST ${path}`, handler),
    }),
    deps,
  );
  return async (method: "GET" | "POST", path: string, body: object = {}, params: Record<string, string> = {}) => {
    const handler = routes.get(`${method} ${path}`);
    assert.ok(handler, `${method} ${path} is registered`);
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
    const fields = { timeZone: "UTC", debugMode: true };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        query: method === "GET" ? fields : {},
        params: { run: runKey, ...params },
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
}

const START = "/runs/:run/read-me";
const ANSWER = "/runs/:run/read-me/:set/answer";
const FINISH = "/runs/:run/read-me/:set/finish";
const NOTEBOOK = "/runs/:run/lis/:li/notebook";

async function readMeWorld(
  runKey: string,
  replies: FakeReply[] = model(setReply()),
  {
    failures = { state: [], set: [] },
    lis = {},
    content,
  }: {
    failures?: { state: Error[]; set: Error[] };
    lis?: Record<string, Partial<LiState>>;
    content?: ReturnType<typeof defaultContent>;
  } = {},
) {
  const base = await storyWorld({ runKey, replies, lis, ...(content ? { content } : {}) });
  // Errors put in `failures` make the next writes of the state (or of a Read Me set) throw, one each, in turn.
  const store: typeof base.store = {
    ...base.store,
    updateDoc: ((target, normalize, change, options) => {
      const queue = target.id === stateId(base.runId) ? failures.state : target.kind === "readme" ? failures.set : [];
      const error = queue.shift();
      return error ? Promise.reject(error) : base.store.updateDoc(target, normalize, change, options);
    }) as typeof base.store.updateDoc,
  };
  const t = { ...base, store };
  const deps: RouteDeps = { ...base.deps, store, handle: createHandle(t.runtime.logger) };
  const call = readMeRoutes(deps, runKey);
  const start = (li = KAI) => call("POST", START, { li });
  const answer = (set: string, guess: number, verdict: ReadMeVerdict, words?: string) =>
    call("POST", ANSWER, { guess, verdict, ...(words === undefined ? {} : { words }) }, { set });
  const finish = (set: string) => call("POST", FINISH, {}, { set });
  const notebook = (li = KAI) => call("GET", NOTEBOOK, {}, { li });
  const edit = (id: string, words: string, li = KAI) => call("POST", NOTEBOOK, { action: "edit", id, words }, { li });
  const remove = (id: string, li = KAI) => call("POST", NOTEBOOK, { action: "delete", id }, { li });
  const stored = async (set: string) => {
    const record = await t.fake.documents.getById("otome-forge", readMeId(t.runId, set));
    return record ? normalizeSet(record.data) : null;
  };
  const setCalls = () => t.calls.filter((entry) => isSetPrompt(entry.messages));
  return { ...t, deps, call, start, answer, finish, notebook, edit, remove, stored, setCalls };
}

/** Answers every guess with `verdicts[i]` (words for some, when given). */
async function answerAll(
  t: Awaited<ReturnType<typeof readMeWorld>>,
  view: ReadMeSetView,
  verdicts: readonly ReadMeVerdict[],
  words: readonly (string | undefined)[] = [],
) {
  for (let guess = 0; guess < view.guesses.length; guess += 1) {
    const answered = await t.answer(view.setId, guess, verdicts[guess] ?? "wrong", words[guess]);
    assert.equal(answered.status, 200, JSON.stringify(answered.body));
  }
}

const seeded = (id: string, text: string): NotebookEntry => ({ id, category: "likes", text, verdict: "right", at });

test("the reply holds four guesses in notebook categories; anything broken gets the repair turn", () => {
  const ok = checkReadMeReply(setReply());
  assert.ok(typeof ok === "object");
  assert.equal(ok.guesses.length, READ_ME_GUESSES);
  assert.deepEqual(
    [ok.guesses[0]!.reactions.wrong.face, ok.guesses[0]!.reactions.close.face, ok.guesses[1]!.face],
    ["", "", "cold"],
    "an unknown face is a plain look",
  );

  const six = { ...setReply(), guesses: [...setReply().guesses, ...setReply("B").guesses.slice(0, 2)] };
  assert.equal(ReadMeReplySchema.safeParse(six).success, true, "up to two extra guesses parse");
  assert.equal((checkReadMeReply(six) as ReadMeReply).guesses.length, READ_ME_GUESSES, "and are dropped");
  const seven = { ...six, guesses: [...six.guesses, setReply("C").guesses[0]!] };
  assert.equal(ReadMeReplySchema.safeParse(seven).success, false, "never more than six");
  const three = { ...setReply(), guesses: setReply().guesses.slice(0, 3) };
  assert.equal(ReadMeReplySchema.safeParse(three).success, false, "never fewer than four");

  const broken = (changes: (guess: number) => Record<string, unknown>) => checkReadMeReply(setReply("A", changes));
  assert.equal(
    (
      checkReadMeReply({
        ...setReply(),
        guesses: setReply("A", () => ({ category: " Likes " })).guesses,
      }) as ReadMeReply
    ).guesses.length,
    READ_ME_GUESSES,
    "a category reads case- and space-insensitively",
  );
  assert.match(
    broken((i) => (i === 2 ? { category: "secrets" } : {})) as string,
    /guesses\[2\]\.category must be one of/,
  );
  assert.match(
    broken((i) => (i === 1 ? { fact: "  " } : {})) as string,
    /guesses\[1\]: line and fact must not be empty/,
  );
  assert.match(broken((i) => (i === 0 ? { line: '""' } : {})) as string, /guesses\[0\]: line and fact/);
  assert.match(
    broken((i) =>
      i === 3 ? { reactions: { ...setReply().guesses[3]!.reactions, close: { line: "" } } } : {},
    ) as string,
    /guesses\[3\]\.reactions\.close\.line must not be empty/,
  );
  assert.match(
    broken((i) =>
      i === 0
        ? {
            fact: Array(READ_ME_WORDS.fact + 1)
              .fill("w")
              .join(" "),
          }
        : {},
    ) as string,
    /guesses\[0\]\.fact must be 25 words or fewer/,
  );
  assert.match(
    broken((i) => (i === 1 ? { fact: "Ines takes ibuprofen for her cramps." } : {})) as string,
    /guesses\[1\] is about health or medicine/,
  );
  assert.match(
    broken((i) => (i === 2 ? { line: "You skip your pills, don't you?" } : {})) as string,
    /guesses\[2\] is about health or medicine/,
  );
  assert.match(broken(() => ({ fact: "Ines takes her tea bitter." })) as string, /every guess must be about something/);
  assert.match(checkReadMeReply({ ...setReply(), context: " " }) as string, /context must not be empty/);
});

test("reactions and facts never reach the client before the answer, and the first answer is final", async () => {
  const t = await readMeWorld("r-readme1-aaaaaa");
  const started = await t.start();
  assert.equal(started.status, 200);
  const view = started.body as ReadMeSetView;
  assert.equal(view.guesses.length, READ_ME_GUESSES);
  assert.equal(view.grants, null);
  assert.equal(view.context, "CONTEXT-A: Kai sets two cups on the sea wall and studies you over his.");
  assert.deepEqual(view.guesses[1], {
    category: "fears",
    line: "GUESS-A1: You take your tea bitter, don't you?",
    face: "cold",
  });
  const wire = JSON.stringify(view);
  for (const hidden of ["REACT-", "FACT-", "reactions", "fact"]) {
    assert.ok(!wire.includes(hidden), `the start never carries ${hidden}`);
  }

  // Words that sound medical are refused, and nothing is saved.
  const medical = await t.answer(view.setId, 1, "close", "Only with my painkillers.");
  assert.deepEqual([medical.status, medical.body.code], [400, "bad-request"]);
  assert.equal((await t.stored(view.setId))!.answers[1], null);

  // Guess 1 answered: only it shows a reaction, the chosen verdict's, here and when the set is opened again.
  const first = await t.answer(view.setId, 1, "close", "  Only   with honey,\n actually.  ");
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, {
    verdict: "close",
    reaction: "REACT-CLOSE-A1: Nearly, then.",
    face: "",
    words: "Only with honey, actually.",
  });
  const again = await t.answer(view.setId, 1, "right");
  assert.deepEqual(again.body, first.body, "another answer for the same guess returns the first");
  const reopened = (await t.start()).body as ReadMeSetView;
  assert.equal(reopened.setId, view.setId, "the unfinished set is played on");
  assert.deepEqual(reopened.guesses[1]!.answer, first.body);
  const rest = JSON.stringify(reopened.guesses.filter((_, guess) => guess !== 1));
  assert.ok(!rest.includes("REACT-") && !rest.includes("answer"), "the other guesses stay hidden");
  assert.ok(!JSON.stringify(reopened).includes("FACT-"), "a fact never reaches the set's view");

  const right = await t.answer(view.setId, 0, "right");
  assert.deepEqual(right.body, { verdict: "right", reaction: "REACT-RIGHT-A0: I knew it.", face: "flustered" });
  const long = await t.answer(view.setId, 3, "wrong", "x".repeat(READ_ME_WORDS_MAX + 40));
  assert.equal(long.body.words, "x".repeat(READ_ME_WORDS_MAX), "the words are capped");

  // Two different answers at once: one lands, and both are told the same.
  const race = await Promise.all([t.answer(view.setId, 2, "right"), t.answer(view.setId, 2, "wrong")]);
  assert.equal(race[0].body.verdict, race[1].body.verdict);
  assert.equal((await t.stored(view.setId))!.answers[2]!.verdict, race[0].body.verdict);

  assert.deepEqual((await t.answer(view.setId, READ_ME_GUESSES, "right")).status, 400, "a guess the set has not");
  assert.deepEqual((await t.answer(view.setId, 0, "maybe" as ReadMeVerdict)).status, 400);
  assert.deepEqual((await t.answer("rm-nope-zzzzzz", 0, "right")).status, 404);
  assert.deepEqual((await t.answer("rh-nope-zzzzzz", 0, "right")).status, 404, "a Read Him id names no Read Me set");
  assert.equal(t.setCalls().length, 1, "one call for the whole set");
});

test("one set per start: a double tap makes one call, and a set is played on at any stage", async () => {
  const t = await readMeWorld("r-readme2-aaaaaa", model(setReply("A"), setReply("B"), setReply("C")));
  const [one, two] = await Promise.all([t.start(), t.start()]);
  assert.equal(one.body.setId, two.body.setId);
  assert.equal(t.setCalls().length, 1);
  assert.equal((await t.fake.documents.list("otome-forge", "readme")).length, 1);

  // Each love interest has their own set.
  const theirs = await t.start(MIR);
  assert.notEqual(theirs.body.setId, one.body.setId);
  assert.equal(t.setCalls().length, 2);

  // A stage later, the unfinished set is still the one played (its answers are waiting for the notebook).
  await t.answer(one.body.setId, 0, "right");
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: { ...state.lis, [KAI]: { ...state.lis[KAI]!, stage: 2 } },
  }));
  const later = await t.start();
  assert.equal(later.body.setId, one.body.setId);
  assert.ok(later.body.guesses[0].answer);
  assert.equal(t.setCalls().length, 2, "no new call");

  const unknown = await t.start("li-nobody-zz99");
  assert.deepEqual([unknown.status, unknown.body.code], [404, "not-found"]);
  assert.equal((await t.start("not an li")).status, 404);
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, SOL)), normalizeUnit, (unit) => ({
    ...unit,
    bible: null,
  }));
  const unwritten = await t.start(SOL);
  assert.deepEqual([unwritten.status, unwritten.body.code], [409, "conflict"]);
  assert.equal(t.setCalls().length, 2);
});

test("finishing needs every guess, pays once within the day's caps and writes the notebook once", async () => {
  const t = await readMeWorld("r-readme3-aaaaaa", model(setReply("A"), setReply("B"), setReply("C")));
  const before = (await t.state()).wallet.starlight;
  const view = (await t.start()).body as ReadMeSetView;
  const early = await t.finish(view.setId);
  assert.deepEqual([early.status, early.body.code], [409, "conflict"], "every guess first");
  await t.answer(view.setId, 0, "right");
  assert.equal((await t.finish(view.setId)).status, 409, "still every guess");

  await answerAll(t, view, ["right", "close", "wrong", "right"], [undefined, "Only with honey.", "", undefined]);
  const [a, b] = await Promise.all([t.finish(view.setId), t.finish(view.setId)]);
  assert.deepEqual([a.status, b.status], [200, 200]);
  // 40 Starlight; 20 affection, +10 for each right guess and +5 for each close one: 20 + 2×10 + 5.
  const grants = [
    { source: "read-me", starlight: 40 },
    { source: "read-me", li: KAI, affection: 45 },
  ];
  const state = await t.state();
  assert.equal(state.wallet.starlight, before + 40, "paid once");
  assert.equal(state.lis[KAI]!.points, 45);
  const known = state.lis[KAI]!.known;
  assert.deepEqual(
    known.map(({ at: _at, ...entry }) => entry),
    [
      {
        id: `${view.setId}/0`,
        category: "likes",
        text: "FACT-A0: Ines takes her tea bitter, cup 0.",
        verdict: "right",
      },
      {
        id: `${view.setId}/1`,
        category: "fears",
        text: "FACT-A1: Ines takes her tea bitter, cup 1.",
        verdict: "close",
        words: "Only with honey.",
      },
      {
        id: `${view.setId}/2`,
        category: "habits",
        text: "FACT-A2: Ines takes her tea bitter, cup 2.",
        verdict: "wrong",
      },
      {
        id: `${view.setId}/3`,
        category: "dreams",
        text: "FACT-A3: Ines takes her tea bitter, cup 3.",
        verdict: "right",
      },
    ],
  );
  assert.ok(known.every((entry) => typeof entry.at === "string" && entry.at));
  const paid = [a.body, b.body].find((body) => body.grants.length)!;
  assert.deepEqual(paid, { grants, starlight: before + 40, known });
  assert.deepEqual(state.lis[MIR]!.known, [], "nothing in anyone else's notebook");
  assert.ok(state.lis[KAI]!.firsts["read-me"], "the first Read Me");
  const firsts = state.timeline.filter((entry) => entry.kind === "first-read-me");
  assert.deepEqual(
    firsts.map((entry) => [entry.li, entry.text, entry.ref]),
    [[KAI, "CONTEXT-A: Kai sets two cups on the sea wall and studies you over his.", view.setId]],
  );
  assert.deepEqual(state.readMe.paid, [{ setId: view.setId, li: KAI, starlight: 40, affection: 45 }]);
  assert.deepEqual((await t.stored(view.setId))!.finished!.grants, grants);

  const replay = await t.finish(view.setId);
  assert.deepEqual(replay.body, paid, "a finish sent again returns what was paid");
  assert.equal((await t.state()).wallet.starlight, before + 40);
  assert.equal((await t.state()).lis[KAI]!.known.length, READ_ME_GUESSES, "and writes nothing twice");
  // Past the once-only mark too: an entry id the notebook already has is never added again.
  const twice = applyReadMe(await t.state(), (await t.stored(view.setId))!, { at });
  assert.deepEqual(twice.state.lis[KAI]!.known, known);

  // Near the caps: only what is left of them; at the caps: nothing, and the notebook still learns.
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (current) => ({
    ...current,
    daily: {
      ...current.daily,
      starlight: ACTIVITY_STARLIGHT_DAILY_CAP - 10,
      affection: { [KAI]: OUTSIDE_AFFECTION_DAILY_CAP - 15 },
    },
  }));
  const near = (await t.start()).body as ReadMeSetView;
  assert.notEqual(near.setId, view.setId, "a finished set is never played on");
  await answerAll(t, near, ["right", "right", "right", "right"]);
  assert.deepEqual((await t.finish(near.setId)).body.grants, [
    { source: "read-me", starlight: 10 },
    { source: "read-me", li: KAI, affection: 15 },
  ]);
  const capped = (await t.start()).body as ReadMeSetView;
  assert.equal(t.setCalls().length, 3, "a capped day still writes a set");
  await answerAll(t, capped, ["wrong", "wrong", "wrong", "wrong"]);
  const nothing = await t.finish(capped.setId);
  assert.deepEqual([nothing.status, nothing.body.grants], [200, []]);
  const after = await t.state();
  assert.equal(after.lis[KAI]!.known.length, 3 * READ_ME_GUESSES, "and still fills the notebook");
  assert.equal(after.timeline.filter((entry) => entry.kind === "first-read-me").length, 1, "the first is once");
});

test("a deleted entry never comes back: not from a replay, not from a finish retried after the set's write failed", async () => {
  const failures: { state: Error[]; set: Error[] } = { state: [], set: [] };
  const t = await readMeWorld("r-readme4-aaaaaa", model(setReply("A"), setReply("B")), { failures });
  const before = (await t.state()).wallet.starlight;

  // A finished set: delete one entry, then finish again.
  const view = (await t.start()).body as ReadMeSetView;
  await answerAll(t, view, ["right", "close", "wrong", "wrong"], ["", "Only with honey."]);
  assert.equal((await t.finish(view.setId)).status, 200);
  assert.equal((await t.remove(`${view.setId}/1`)).status, 200);
  const replay = await t.finish(view.setId);
  assert.deepEqual(
    replay.body.known.map((entry: NotebookEntry) => entry.id),
    [0, 2, 3].map((i) => `${view.setId}/${i}`),
  );
  assert.ok(!(await t.state()).lis[KAI]!.known.some((entry) => entry.id === `${view.setId}/1`));

  // The pay lands but the set's own finished mark fails; the player deletes an entry; the finish is sent again.
  const second = (await t.start()).body as ReadMeSetView;
  await answerAll(t, second, ["right", "right", "right", "right"]);
  failures.set.push(new Error("EIO: the set was not saved"));
  const failed = await t.finish(second.setId);
  assert.equal(failed.status, 500);
  assert.equal((await t.stored(second.setId))!.finished, null, "the set is not finished yet");
  const paidOnce = await t.state();
  assert.equal(paidOnce.lis[KAI]!.known.filter((entry) => entry.id.startsWith(second.setId)).length, 4);
  assert.equal((await t.remove(`${second.setId}/2`)).status, 200);
  const again = await t.finish(second.setId);
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.deepEqual(again.body.grants, [
    { source: "read-me", starlight: 40 },
    { source: "read-me", li: KAI, affection: 60 },
  ]);
  const state = await t.state();
  assert.ok(!state.lis[KAI]!.known.some((entry) => entry.id === `${second.setId}/2`), "the deleted entry stays gone");
  assert.equal(state.wallet.starlight, before + 80, "each set paid once");
  // 20 + 10 + 5 for the first set, 20 + 4×10 for the second.
  assert.equal(state.lis[KAI]!.points, 35 + 60);
  assert.ok((await t.stored(second.setId))!.finished, "and the set is finished now");
});

test("the notebook routes read, rewrite, clear and delete entries; the set's words follow; medical words are refused", async () => {
  const mine = seeded("rm-seed-aaaaaa/0", "MIR-NOTEBOOK: Ines likes the bell.");
  const t = await readMeWorld("r-readme5-aaaaaa", model(setReply()), { lis: { [MIR]: { known: [mine] } } });
  assert.deepEqual((await t.notebook()).body, { li: KAI, entries: [] });
  const view = (await t.start()).body as ReadMeSetView;
  await answerAll(t, view, ["right", "close", "wrong", "right"], ["", "Only with honey."]);
  const finished = (await t.finish(view.setId)).body;
  const read = await t.notebook();
  assert.deepEqual(read.body, { li: KAI, entries: finished.known });
  assert.deepEqual((await t.notebook(MIR)).body, { li: MIR, entries: [mine] }, "each love interest's own");

  // Rewrite the words (cleaned), then clear them: the set's copy follows each time.
  const id = `${view.setId}/1`;
  const edited = await t.edit(id, '  "Honey,   and   lemon."  ');
  assert.equal(edited.status, 200);
  assert.equal(edited.body.li, KAI);
  assert.equal(edited.body.entries[1].words, "Honey, and lemon.");
  assert.equal((await t.stored(view.setId))!.answers[1]!.words, "Honey, and lemon.");
  const added = await t.edit(`${view.setId}/2`, "I hate tea.");
  assert.equal(added.body.entries[2].words, "I hate tea.", "words can be given later");
  const cleared = await t.edit(id, "");
  assert.ok(!("words" in cleared.body.entries[1]), '"" clears them');
  assert.ok(!("words" in (await t.stored(view.setId))!.answers[1]!));

  // Medical words: refused, nothing saved.
  const before = await t.state();
  const medical = await t.edit(`${view.setId}/2`, "My doctor's orders, no caffeine.");
  assert.deepEqual([medical.status, medical.body.code], [400, "bad-request"]);
  assert.deepEqual(await t.state(), before);
  assert.equal((await t.stored(view.setId))!.answers[2]!.words, "I hate tea.");

  // Delete: gone from the notebook, and its words from the set.
  const removed = await t.remove(`${view.setId}/2`);
  assert.deepEqual(
    removed.body.entries.map((entry: NotebookEntry) => entry.id),
    [0, 1, 3].map((i) => `${view.setId}/${i}`),
  );
  assert.ok(!("words" in (await t.stored(view.setId))!.answers[2]!), "the player's words are not kept");
  assert.equal((await t.stored(view.setId))!.answers[2]!.verdict, "wrong", "only the words go");

  for (const [label, response] of [
    ["an entry already deleted", await t.remove(`${view.setId}/2`)],
    ["an unknown entry", await t.edit("rm-nope-zzzzzz/0", "x")],
    ["another love interest's entry", await t.remove(mine.id)],
    ["a love interest the run has not", await t.notebook("li-nobody-zz99")],
    ["a malformed love interest", await t.remove(id, "not an li")],
    ["an unknown run", await t.call("GET", NOTEBOOK, {}, { run: "r-nobody-zzzzzz", li: KAI })],
  ] as const) {
    assert.deepEqual([response.status, response.body.code], [404, "not-found"], label);
  }
  assert.equal((await t.call("POST", NOTEBOOK, { action: "rename", id }, { li: KAI })).status, 400);
  assert.equal((await t.edit(id, "x".repeat(2000))).status, 400, "a body over its limit");
  assert.deepEqual((await t.state()).lis[MIR]!.known, [mine], "never touched");
});

test("the prompt carries the boundary, the chat contract, their own notebook only, and is logged", async () => {
  const lis = {
    [KAI]: { known: [seeded("rm-seed-aaaaaa/0", "KAI-NOTEBOOK: Ines likes the bell.")] },
    [MIR]: { known: [seeded("rm-seed-bbbbbb/0", "MIR-NOTEBOOK: Ines likes the ledger.")] },
  };
  const t = await readMeWorld("r-readme6-aaaaaa", model(setReply()), { lis });
  await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) =>
    withMireillesPrivateRows(state),
  );
  assert.equal((await t.start()).status, 200);
  const [call] = t.setCalls();
  const [system, user] = call!.messages.map((message) => message.content);
  assert.ok(system!.includes(forgeKnowledgeBoundary));
  assert.ok(system!.includes("CONTENT CONTRACT") && system!.includes("Heat: SFW"));
  assert.ok(system!.includes("Kai is an adult"));
  assert.ok(
    system!.includes(
      "Never guess about the protagonist's health, illness or medication, or about anyone's period or cycle.",
    ),
  );
  assert.ok(system!.includes("Never guess again what Kai already knows (ALREADY KNOWN)"));
  assert.ok(user!.includes("ALREADY KNOWN (never guess these again)\nWhat Kai has come to know about the protagonist"));
  assert.ok(user!.includes("KAI-NOTEBOOK: Ines likes the bell."), "their own notebook");
  const sent = JSON.stringify(call!.messages);
  assert.ok(!sent.includes("MIR-NOTEBOOK"), "never another love interest's notebook");
  assert.ok(!sent.includes("HIDDEN-TRUTH") && !sent.includes("MYSTERY-TRUTH"), "never an unrevealed truth");
  assert.deepEqual(
    MIREILLE_ONLY.filter((marker) => sent.includes(marker)),
    [],
    "nothing of Mireille's own chapters",
  );
  for (const marker of KAI_SHARED) assert.ok(sent.includes(marker), `his own ${marker}`);
  assert.equal(call!.options?.temperature, 0.9);
  assert.ok(t.logs.some((entry) => entry.level === "debugOverride" && entry.args[0] === `read-me/${KAI}`));

  // An empty notebook: no ALREADY KNOWN, and no rule naming it.
  const empty = await t.start(SOL);
  assert.equal(empty.status, 200);
  const [solSystem, solUser] = t.setCalls()[1]!.messages.map((message) => message.content);
  assert.ok(!solSystem!.includes("ALREADY KNOWN") && !solUser!.includes("ALREADY KNOWN"));

  // The chat contract follows the story's Heat (a Home prompt would stay SFW).
  const nsfw = await readMeWorld("r-readme6-bbbbbb", model(setReply()), {
    content: { ...defaultContent(), heat: "explicit" },
  });
  assert.equal((await nsfw.start()).status, 200);
  assert.match(nsfw.setCalls()[0]!.messages[0]!.content, /Heat: NSFW, explicit\./);
});

test("a bad reply gets one repair turn; a run deleted mid-write keeps no set; sets are swept and never memory", async () => {
  const bad = setReply("A", (i) => (i === 0 ? { category: "secrets" } : {}));
  const t = await readMeWorld("r-readme7-aaaaaa", model(bad));
  const failed = await t.start();
  assert.deepEqual([failed.status, failed.body.code], [502, "bad-format"]);
  assert.equal(t.setCalls().length, 2, "one repair turn");
  assert.match(t.setCalls()[1]!.messages.at(-1)!.content, /guesses\[0\]\.category must be one of/);
  assert.equal((await t.fake.documents.list("otome-forge", "readme")).length, 0);

  const repaired = await readMeWorld("r-readme7-cccccc", model(bad, setReply("B")));
  const fixed = await repaired.start();
  assert.equal(fixed.status, 200);
  assert.equal(repaired.setCalls().length, 2);
  assert.equal(fixed.body.guesses[0].line, "GUESS-B0: You take your tea bitter, don't you?");

  // Held at the model: the run is deleted (its world first) before the reply lands.
  const u = await readMeWorld("r-readme7-bbbbbb");
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
  assert.equal((await u.fake.documents.list("otome-forge", "readme")).length, 0, "the late set did not stay");
  assert.ok((RUN_DOC_KINDS as readonly string[]).includes("readme"), "deleting a run sweeps its sets");

  // A finished set, words and all, is never a story-memory source: the notebook is the only copy prompts see.
  const view = fixed.body as ReadMeSetView;
  await answerAll(repaired, view, ["right", "close", "wrong", "right"], ["MY-OWN-WORDS: honey."]);
  assert.equal((await repaired.finish(view.setId)).status, 200);
  const sources = JSON.stringify(await readMemorySources(repaired.store, repaired.runId));
  for (const marker of ["readme", "FACT-", "GUESS-", "REACT-", "CONTEXT-", "MY-OWN-WORDS"]) {
    assert.ok(!sources.includes(marker), `no ${marker} in the story's memory`);
  }
});
