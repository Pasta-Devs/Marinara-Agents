// Otome Forge's Claw Machine (M5): the finish route accepts only this machine's prizes (the six series plushes and the
// partner's own, each once, at most seven), pays every round even when nothing was caught, within the day's activity
// caps, and pays a round once however often (or however concurrently) its finish is sent; the shelf counts, a first
// plush of his is a timeline entry with his plush line; the play view, where his plush wears his look or its Home
// cut-out (M3), his claw and cold lines come with it (so the machine never reads Home's lines route, which queues a
// missing pack's write), and nothing is asked for; each round is his private memory, titled private, and costs no
// model call, in the route or in memory upkeep, with a model and an image client that throw, and playing with one love
// interest never evicts another's rounds; a name of any length never drops a round. The rules are pure and
// deterministic for a seed: the grip formula, the layout, the drops, his plan by style, each cheat's effect (a bonus
// drop labelled where it was put), and the claw's motion and swing the same at any frame rate.
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { ClawCheat } from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/api-types.ts";
import {
  CHEER_GOAL,
  CLAW_DROPS,
  CLAW_MAX_CATCHES,
  CLAW_ROUNDS_KEPT,
  PLUSH_SERIES,
  clawPrizeIds,
  liPlushId,
  type ClawFinishResult,
  type ClawRound,
  type PlayView,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/claw.ts";
import {
  ACTIVITY_STARLIGHT_DAILY_CAP,
  OUTSIDE_AFFECTION_DAILY_CAP,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/shared/economy.ts";
import {
  GEOMETRY,
  STYLE_PLAY,
  cheer,
  clawStyleOf,
  createRound,
  currentPlayer,
  gripChance,
  isBonusTurn,
  isRoundOver,
  landDrop,
  planPartnerTurn,
  restingBody,
  retargetPlan,
  stepBody,
  type ClawRoundState,
  type Prize,
} from "../packages/otome-forge/src/engine/packages/client/src/features/otome-forge/lib/claw-physics.ts";
import {
  createHandle,
  type OtomeReply,
  type RouteDeps,
  type RouteHandler,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/http.ts";
import {
  runDocTarget,
  stateId,
  unitId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { createOtomeMemory } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/memory.ts";
import { readMemorySources } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/memory/sources.ts";
import { FIRST_PLUSH } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/minigames/claw.ts";
import { registerClawRoutes } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/routes/claw.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import { normalizeUnit } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/unit.ts";
import { KAI, MIR, bible, storyWorld } from "./fixtures/otome-forge-story.ts";

const RUN = "r-claw-abcdef";
const PLUSH_LINE = "PLUSH-LINE: it has my scowl.";

/** A world whose model and image client throw if anything calls them, with the claw routes on a fake router. */
async function clawWorld() {
  const t = await storyWorld({ runKey: RUN });
  // Kai cheats by nudging the machine and has his fixed lines; Mireille has no pack yet.
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    bible: bible({ play: { style: "Careful and patient, lines it up twice.", cheat: "nudge" } }),
    lines: {
      stages: {},
      fixed: {
        comfort: [],
        claw: { cheer: ["c"], cheat: ["x"], win: ["w"], miss: ["m"], plush: [PLUSH_LINE] },
        at: "2026-10-28T09:00:00.000Z",
      },
    },
  }));
  let modelCalls = 0;
  let imageCalls = 0;
  const runtime = new Proxy(t.runtime, {
    get(target, property, receiver) {
      if (property === "languageModels") {
        return {
          resolveForRequest() {
            modelCalls += 1;
            throw new Error("The Claw Machine must never resolve a model");
          },
        };
      }
      return Reflect.get(target, property, receiver);
    },
  }) as CapabilityRuntimeHost;
  const images = new Proxy(
    {},
    {
      get() {
        imageCalls += 1;
        throw new Error("The Claw Machine must never touch the image client");
      },
    },
  );
  const memory = {
    recall: async () => assert.fail("no recall from the Claw Machine"),
    maintain: async () => assert.fail("the Claw Machine never starts memory upkeep"),
    status: async () => assert.fail("no memory status from the Claw Machine"),
    invalidate: () => assert.fail("no invalidate from the Claw Machine"),
    dispose: () => undefined,
  } as unknown as RouteDeps["memory"];
  const deps: RouteDeps = {
    runtime,
    store: t.store,
    handle: createHandle(t.runtime.logger),
    images: images as never,
    memory,
  };
  const routes = new Map<string, RouteHandler>();
  registerClawRoutes(
    {
      get: (path: string, handler: RouteHandler) => routes.set(`GET ${path}`, handler),
      post: (path: string, handler: RouteHandler) => routes.set(`POST ${path}`, handler),
    },
    deps,
  );
  const call = async (method: "GET" | "POST", path: string, body: object = {}, timeZone = "UTC") => {
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
    const fields = { timeZone, debugMode: false };
    const result = await handler(
      {
        method,
        url: path,
        body: method === "POST" ? { ...fields, ...body } : undefined,
        params: { run: RUN },
        query: method === "GET" ? { ...fields, ...body } : {},
      },
      reply,
    );
    return { status, body: (result === reply ? payload : result) as Record<string, any> };
  };
  let rounds = 0;
  const finish = (body: Partial<Record<string, unknown>> = {}) =>
    call("POST", "/runs/:run/claw/finish", {
      li: KAI,
      round: `c-test${(rounds += 1).toString(36)}-abcdef`,
      first: "me",
      caught: [],
      cheered: false,
      ...body,
    });
  return { ...t, call, finish, counts: () => ({ modelCalls, imageCalls }) };
}

test("the finish route accepts only this machine's prizes, each once, and at most seven", async () => {
  const t = await clawWorld();
  const refused = async (caught: unknown[], label: string) => {
    const answer = await t.finish({ caught });
    assert.equal(answer.status, 400, label);
    assert.equal(answer.body.code, "bad-request", label);
  };
  await refused([{ prize: "dragon", by: "me" }], "an unknown prize");
  await refused([{ prize: liPlushId(MIR), by: "me" }], "another love interest's plush is not in his machine");
  await refused([{ prize: "li:", by: "me" }], "an empty plush id");
  await refused(
    [
      { prize: "bunny", by: "me" },
      { prize: "bunny", by: "partner" },
    ],
    "the same prize twice",
  );
  await refused(
    [...clawPrizeIds(KAI), "bunny"].map((prize) => ({ prize, by: "me" })),
    "more than seven catches",
  );
  assert.equal((await t.finish({ caught: [{ prize: "bunny", by: "nobody" }] })).status, 400, "who caught it");
  assert.equal((await t.finish({ round: "not-a-round" })).status, 400, "a round id");
  assert.equal((await t.finish({ li: "li-ghost-zz99" })).status, 404, "a love interest the run lacks");
  // Nothing refused changed the state.
  assert.deepEqual((await t.state()).owned.plush, {});
  assert.equal((await t.state()).wallet.starlight, 2000);

  const all = await t.finish({
    caught: clawPrizeIds(KAI).map((prize, index) => ({ prize, by: index % 2 ? "me" : "partner" })),
  });
  assert.equal(all.status, 200, "all seven prizes, once each");
  assert.equal(clawPrizeIds(KAI).length, CLAW_MAX_CATCHES);
  assert.deepEqual(t.counts(), { modelCalls: 0, imageCalls: 0 });
});

test("every round pays, even with nothing caught, within the day's activity caps, and never twice", async () => {
  const t = await clawWorld();
  const empty = await t.finish();
  assert.equal(empty.status, 200);
  const result = empty.body as ClawFinishResult;
  assert.deepEqual(result.grants, [
    { source: "claw", starlight: 20 },
    { source: "claw", li: KAI, affection: 30 },
  ]);
  assert.equal(result.capped, false);
  assert.equal(result.replay, false);
  assert.equal(result.starlight, 2020);
  assert.equal((await t.state()).lis[KAI]!.points, 30, "affection with the partner");

  const three = await t.finish({
    caught: [
      { prize: "bunny", by: "me" },
      { prize: "whale", by: "partner" },
      { prize: "star", by: "me" },
    ],
  });
  assert.deepEqual(three.body.grants[0], { source: "claw", starlight: 20 + 3 * 30 });
  assert.deepEqual(three.body.newPlush, ["bunny", "whale", "star"]);

  // The day's activity Starlight is capped at 400 in all, and affection at 300 per love interest.
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    daily: {
      ...state.daily,
      starlight: ACTIVITY_STARLIGHT_DAILY_CAP - 10,
      affection: { [KAI]: OUTSIDE_AFFECTION_DAILY_CAP - 5 },
    },
  }));
  const before = await t.state();
  const capped = await t.finish({ caught: [{ prize: "chick", by: "me" }] });
  assert.equal(capped.status, 200, "a capped round still plays and saves");
  assert.deepEqual(capped.body.grants, [
    { source: "claw", starlight: 10 },
    { source: "claw", li: KAI, affection: 5 },
  ]);
  assert.equal(capped.body.capped, true);
  const full = await t.finish({ caught: [{ prize: "kitty", by: "me" }] });
  assert.deepEqual(full.body.grants, [], "past the caps a round pays nothing more");
  assert.equal(full.body.capped, true);
  assert.equal((await t.state()).owned.plush.kitty, 1, "but the plush still joins the shelf");
  assert.equal((await t.state()).wallet.starlight, before.wallet.starlight + 10);
  // Another love interest has his own affection cap.
  const mireille = await t.finish({ li: MIR });
  assert.deepEqual(mireille.body.grants, [{ source: "claw", li: MIR, affection: 30 }]);

  // A new local day starts the caps again (the request's own time zone decides the day).
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    daily: { ...state.daily, dayKey: "2000-01-01" },
  }));
  const tomorrow = await t.finish();
  assert.deepEqual(tomorrow.body.grants, [
    { source: "claw", starlight: 20 },
    { source: "claw", li: KAI, affection: 30 },
  ]);
  assert.deepEqual(t.counts(), { modelCalls: 0, imageCalls: 0 });
});

test("a round's finish is paid once: sent again, at the same time, or over a stale revision", async () => {
  const t = await clawWorld();
  const body = { round: "c-once1-abcdef", caught: [{ prize: liPlushId(KAI), by: "partner" }], cheered: true };
  const first = await t.finish(body);
  assert.equal(first.status, 200);
  assert.equal(first.body.replay, false);
  const again = await t.finish(body);
  assert.equal(again.body.replay, true);
  assert.deepEqual(again.body.grants, first.body.grants, "the same answer");
  assert.equal(again.body.line, first.body.line);
  const state = await t.state();
  assert.equal(state.wallet.starlight, 2000 + 20 + 30);
  assert.equal(state.owned.plush[liPlushId(KAI)], 1);
  assert.equal(state.claw.rounds.length, 1);

  // Two finishes of one round at once: the second write finds the first and answers as a replay.
  const both = await Promise.all([t.finish({ round: "c-once2-abcdef" }), t.finish({ round: "c-once2-abcdef" })]);
  assert.deepEqual(
    both.map((answer) => answer.status),
    [200, 200],
  );
  assert.deepEqual(both.map((answer) => answer.body.replay).sort(), [false, true]);
  assert.equal((await t.state()).wallet.starlight, 2000 + 50 + 20);

  // Another writer saved first: the change is applied again on top of theirs, once.
  t.fake.interfere(stateId(t.runId), (data: any) => ({ ...data, wallet: { starlight: data.wallet.starlight + 1 } }));
  const stale = await t.finish({ round: "c-once3-abcdef" });
  assert.equal(stale.status, 200);
  assert.equal((await t.state()).wallet.starlight, 2000 + 50 + 20 + 1 + 20);
  assert.equal((await t.state()).claw.rounds.length, 3);

  // A round id is one round with one love interest.
  const other = await t.finish({ round: "c-once1-abcdef", li: MIR });
  assert.equal(other.status, 409);
  assert.equal(other.body.code, "conflict");
});

test("his first plush is a dated first with his plush line; the shelf counts every catch", async () => {
  const t = await clawWorld();
  const his = liPlushId(KAI);
  const first = await t.finish({
    caught: [
      { prize: his, by: "me" },
      { prize: "bear", by: "partner" },
    ],
  });
  assert.equal(first.body.firstPlush, true);
  assert.equal(first.body.line, PLUSH_LINE);
  assert.deepEqual(first.body.plush, { [his]: 1, bear: 1 });
  const state = await t.state();
  assert.ok(state.lis[KAI]!.firsts[FIRST_PLUSH], "a dated first");
  const entries = state.timeline.filter((entry) => entry.kind === FIRST_PLUSH);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.li, KAI);
  assert.match(entries[0]!.text, /Kai's plush/u);

  const second = await t.finish({ caught: [{ prize: his, by: "partner" }] });
  assert.equal(second.body.firstPlush, false);
  assert.equal(second.body.line, undefined);
  assert.deepEqual(second.body.newPlush, []);
  assert.equal((await t.state()).owned.plush[his], 2);
  assert.equal((await t.state()).timeline.filter((entry) => entry.kind === FIRST_PLUSH).length, 1, "only the first");

  // During a rupture his warm plush line is not his to say.
  const cold = await clawWorld();
  await cold.store.mutateDoc(runDocTarget("state", stateId(cold.runId)), normalizeState, (current) => ({
    ...current,
    lis: { ...current.lis, [KAI]: { ...current.lis[KAI]!, rupture: { grievanceId: "g-1", since: "2026-10-27" } } },
  }));
  const during = await cold.finish({ caught: [{ prize: his, by: "me" }] });
  assert.equal(during.body.firstPlush, true);
  assert.equal(during.body.line, undefined);

  // Mireille has no pack yet: her first plush has no line, and the client says the catalog's.
  const mireille = await t.finish({ li: MIR, caught: [{ prize: liPlushId(MIR), by: "me" }] });
  assert.equal(mireille.body.firstPlush, true);
  assert.equal(mireille.body.line, undefined);
});

test("the play view: today's caps, the shelf, and how each love interest plays", async () => {
  const t = await clawWorld();
  await t.finish({ caught: [{ prize: "whale", by: "me" }] });
  const view = (await t.call("GET", "/runs/:run/play")).body as PlayView;
  assert.deepEqual(view.starlight, { earned: 50, cap: ACTIVITY_STARLIGHT_DAILY_CAP });
  assert.deepEqual(view.affection, { earned: { [KAI]: 30 }, cap: OUTSIDE_AFFECTION_DAILY_CAP });
  assert.deepEqual(view.plush, { whale: 1 });
  assert.deepEqual(view.lis[KAI], {
    cheat: "nudge",
    style: "Careful and patient, lines it up twice.",
    rupture: false,
    makeItRight: false,
    lines: { claw: { cheer: ["c"], cheat: ["x"], win: ["w"], miss: ["m"], plush: [PLUSH_LINE] }, cold: [] },
  });
  assert.deepEqual(view.lis[MIR], {
    cheat: "steady",
    style: "",
    rupture: false,
    makeItRight: false,
    lines: { claw: null, cold: [] },
  });
  // A new local day shows nothing earned yet.
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    daily: { ...state.daily, dayKey: "2000-01-01" },
  }));
  const fresh = (await t.call("GET", "/runs/:run/play")).body as PlayView;
  assert.deepEqual(fresh.starlight.earned, 0);
  assert.deepEqual(fresh.affection.earned, {});
  assert.equal((await t.call("GET", "/runs/:run/play")).status, 200);
  assert.deepEqual(t.counts(), { modelCalls: 0, imageCalls: 0 });
});

test("his claw and cold lines come with the play view, which never queues a missing pack's write", async () => {
  const t = await clawWorld();
  const cold = ["COLD-1: Fine.", "COLD-2: Your turn."];
  // His stage-1 pack and his fixed lines, then a route chapter takes him to stage 2, whose pack is not written yet:
  // Home's GET .../lines would queue that pack's write (P15, a model call); the machine reads what he has.
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    lines: {
      ...unit.lines!,
      stages: {
        "1": {
          stage: 1,
          tap: {
            head: { morning: [], day: [], night: [] },
            hand: { morning: [], day: [], night: [] },
            heart: { morning: [], day: [], night: [] },
          },
          annoyed: [],
          cold,
          at: "2026-10-28T09:00:00.000Z",
        },
      },
    },
  }));
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    lis: {
      ...state.lis,
      [KAI]: {
        ...state.lis[KAI]!,
        stage: 2,
        rupture: { grievanceId: "g-main-1-1-0", since: "2026-10-28T09:00:00.000Z" },
      },
    },
  }));
  const view = (await t.call("GET", "/runs/:run/play")).body as PlayView;
  assert.deepEqual(view.lis[KAI]!.lines, {
    claw: { cheer: ["c"], cheat: ["x"], win: ["w"], miss: ["m"], plush: [PLUSH_LINE] },
    cold,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(t.counts(), { modelCalls: 0, imageCalls: 0 });
});

test("his plush wears his look, or its cut-out once Home has made it, and the play view never asks for one", async () => {
  const t = await clawWorld();
  const look = "/api/global-gallery/file/kai-look.png";
  const setCutouts = (cutouts: Record<string, unknown>) =>
    t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
      ...unit,
      portrait: look,
      cutouts: cutouts as never,
    }));
  const plushOf = async (li: string) => ((await t.call("GET", "/runs/:run/play")).body as PlayView).lis[li]!.plush;
  // No look, no picture: the client draws initials.
  assert.equal(await plushOf(KAI), undefined);
  assert.equal("plush" in ((await t.call("GET", "/runs/:run/play")).body as PlayView).lis[MIR]!, false);
  // His look until a cut-out is ready (none yet, one on its way, one that failed).
  await setCutouts({});
  assert.equal(await plushOf(KAI), look);
  await setCutouts({ [look]: { state: "pending", at: "2026-10-28T09:00:00.000Z" } });
  assert.equal(await plushOf(KAI), look);
  await setCutouts({ [look]: { state: "failed", at: "2026-10-28T09:00:00.000Z", error: "no remover" } });
  assert.equal(await plushOf(KAI), look);
  // Home's cut-out, once ready.
  const cut = "/api/global-gallery/file/kai-cut.png";
  await setCutouts({ [look]: { state: "ready", at: "2026-10-28T09:00:00.000Z", url: cut, ref: "global-gallery:k1" } });
  assert.equal(await plushOf(KAI), cut);
  // A look he wears at home (M4's Wardrobe) dresses his plush as it dresses Home, and its own cut-out once ready.
  const worn = "/api/global-gallery/file/kai-coat.png";
  const wornCut = "/api/global-gallery/file/kai-coat-cut.png";
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    outfits: [{ id: "coat", name: "Coat", outfitLine: "a long coat", url: worn, at: "2026-10-28T09:00:00.000Z" }],
    wornOutfit: "coat",
  }));
  assert.equal(await plushOf(KAI), worn);
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    cutouts: { ...unit.cutouts, [worn]: { state: "ready", at: "2026-10-28T09:00:00.000Z", url: wornCut } } as never,
  }));
  assert.equal(await plushOf(KAI), wornCut);
  await t.store.mutateDoc(
    runDocTarget("unit", unitId(t.runId, KAI)),
    normalizeUnit,
    ({ wornOutfit: _worn, ...unit }) => unit,
  );
  // The play view reads the record and asks for nothing: no cut-out is queued, and no model or image is touched.
  await setCutouts({});
  await t.call("GET", "/runs/:run/play");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual((await t.store.readDoc(unitId(t.runId, KAI), normalizeUnit))!.cutouts, {});
  assert.deepEqual(t.counts(), { modelCalls: 0, imageCalls: 0 });
});

test("each round is his private memory, recalled only by him, and upkeep makes no model call for it", async () => {
  const t = await clawWorld();
  await t.finish({
    caught: [
      { prize: "bunny", by: "me" },
      { prize: liPlushId(KAI), by: "partner" },
    ],
    cheered: true,
  });
  await t.finish({ li: MIR, caught: [] });
  const sources = (await readMemorySources(t.store, t.runId)).filter((source) => source.id.startsWith("claw:"));
  assert.deepEqual(
    sources.map((source) => [source.kind, source.audience]),
    [
      ["chat", [KAI]],
      ["chat", [MIR]],
    ],
  );
  const kai = sources[0]!.content;
  assert.match(kai, /Ines and Kai played a claw machine together\./u);
  assert.match(kai, /Kai cheated, bumping the machine/u);
  assert.match(kai, /Ines won a bunny plush\./u);
  assert.match(kai, /Kai won a plush of Kai/u);
  assert.match(sources[1]!.content, /Neither of them won a plush\./u);
  // Titled private, as a phone session is: a scene with others in it recalls it as theirs alone.
  assert.equal(sources[0]!.title, "The claw machine with Kai (private: only Kai and the protagonist know how it went)");
  for (const source of sources) assert.doesNotMatch(source.content, /\b(?:he|him|his|she|her)\b/iu, "no pronouns");

  // Recall through the real memory: his reader sees his round, never hers, and a scene without him sees neither.
  const memory = createOtomeMemory({ runtime: t.runtime, store: t.store });
  const before = t.calls.length;
  assert.equal(await memory.maintain({ runId: t.runId }), true);
  for (let turn = 0; turn < 2000 && (await memory.status(t.runId)).phase === "pending"; turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  const recall = async (who: { reader?: string; cast?: string[] }) =>
    (await memory.recall({ runId: t.runId, job: "chat", query: { cues: ["claw machine plush"] }, ...who })).text;
  assert.match(await recall({ reader: KAI }), /bunny plush/u);
  assert.doesNotMatch(await recall({ reader: KAI }), /Neither of them won/u);
  assert.match(await recall({ reader: MIR }), /Neither of them won/u);
  assert.doesNotMatch(await recall({ reader: MIR }), /bunny plush/u);
  assert.doesNotMatch(await recall({ cast: [] }), /claw machine/iu);
  assert.equal(t.calls.length, before, "a round's memory is its own record: no model call to summarize it");
  memory.dispose();

  // The state keeps each love interest's newest rounds, and his first-plush round: an evening of rounds with Kai never
  // evicts Mireille's, and Kai still remembers his first plush.
  for (let index = 0; index <= CLAW_ROUNDS_KEPT; index += 1) await t.finish({ round: `c-keep${index}-abcdef` });
  const kept = (await t.state()).claw.rounds;
  const of = (li: string) => kept.filter((entry) => entry.li === li);
  assert.equal(of(KAI).length, CLAW_ROUNDS_KEPT + 1, "his newest rounds, and his first-plush round");
  assert.equal(of(KAI)[0]!.firstPlush, true);
  assert.equal(of(KAI).at(-1)!.id, `c-keep${CLAW_ROUNDS_KEPT}-abcdef`, "the newest");
  assert.equal(of(MIR).length, 1, "Mireille's round is still hers");
  const after = (await readMemorySources(t.store, t.runId)).filter((source) => source.id.startsWith("claw:"));
  assert.equal(after.filter((source) => source.audience?.[0] === MIR).length, 1, "and so is her memory of it");
  assert.ok(after.some((source) => /first plush of Kai/u.test(source.content)));
  // A round past the bound is trimmed on read as well (an older state, a hand edit): the newest of each.
  await t.store.mutateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
    ...state,
    claw: {
      rounds: [
        ...state.claw.rounds,
        ...Array.from({ length: 5 }, (_, index): ClawRound => ({
          ...state.claw.rounds.at(-1)!,
          id: `c-extra${index}-abcdef`,
        })),
      ],
    },
  }));
  const trimmed = (await t.state()).claw.rounds;
  assert.equal(trimmed.filter((entry) => entry.li === KAI).length, CLAW_ROUNDS_KEPT + 1);
  assert.equal(trimmed.at(-1)!.id, "c-extra4-abcdef");
  assert.equal(trimmed.filter((entry) => entry.li === MIR).length, 1);
});

test("a love interest's name of any length never drops a round (or its replay guard)", async () => {
  const t = await clawWorld();
  // A card's name has no length cap: 114 crescent moons are 228 UTF-16 units.
  const name = "🌙".repeat(114);
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({ ...unit, name }));
  const body = { round: "c-moons1-abcdef", caught: [{ prize: liPlushId(KAI), by: "me" as const }] };
  const first = await t.finish(body);
  assert.equal(first.status, 200);
  const state = await t.state();
  assert.equal(state.claw.rounds.length, 1, "the round is kept");
  const kept = state.claw.rounds[0]!;
  assert.ok(kept.name.length <= 200 && kept.name.length > 0, "clipped as the state counts it");
  assert.ok(!/[\uD800-\uDBFF]$/u.test(kept.name), "never inside a surrogate pair");
  assert.equal(state.timeline.filter((entry) => entry.kind === FIRST_PLUSH).length, 1, "and its timeline entry");
  const again = await t.finish(body);
  assert.equal(again.body.replay, true);
  assert.equal((await t.state()).wallet.starlight, state.wallet.starlight, "never paid twice");
  assert.equal((await t.state()).owned.plush[liPlushId(KAI)], 1);
});

test("a cheered round with no bible records the steady cheat the play view shows", async () => {
  const t = await clawWorld();
  await t.store.mutateDoc(runDocTarget("unit", unitId(t.runId, KAI)), normalizeUnit, (unit) => ({
    ...unit,
    bible: null,
  }));
  const play = await t.call("GET", "/runs/:run/play");
  assert.equal(play.body.lis[KAI].cheat, "steady");
  assert.equal((await t.finish({ cheered: true })).status, 200);
  assert.equal((await t.state()).claw.rounds[0]!.cheat, "steady");
  const memory = (await readMemorySources(t.store, t.runId)).find((source) => source.id.startsWith("claw:"));
  assert.match(memory!.content, /Kai cheated, steadying the claw by hand/u);
  // Not cheered, nothing to record.
  await t.finish({ cheered: false });
  assert.equal((await t.state()).claw.rounds[1]!.cheat, null);
});

// ── The rules (C/lib/claw-physics.ts) ──

const round = (seed: number, cheat: ClawCheat = "steady", first: "me" | "partner" = "me") =>
  createRound({ seed, first, li: KAI, cheat, style: "careful" });

/** Plays a round to its end: she drops at `mine(round)`, he follows his plan, and cheers come where asked. */
function playOut(start: ClawRoundState, mine: (round: ClawRoundState) => number, cheerOnTurn = -1) {
  let state = start;
  const outcomes = [];
  while (!isRoundOver(state)) {
    if (currentPlayer(state) === "partner") {
      const planned = planPartnerTurn(state);
      state = planned.round;
      if (state.turn === cheerOnTurn) for (let index = 0; index < CHEER_GOAL; index += 1) state = cheer(state).round;
      if (isRoundOver(state)) break;
      const landed = landDrop(state, planned.plan!.aimX);
      state = landed.round;
      outcomes.push(landed.outcome);
    } else {
      const landed = landDrop(state, mine(state));
      state = landed.round;
      outcomes.push(landed.outcome);
    }
  }
  return { state, outcomes };
}

test("grip chance is clamp(0.85 − |offset|·8 − weight·0.1), and nothing beyond the claw's reach", () => {
  assert.equal(gripChance(0, 0), 0.85);
  assert.ok(Math.abs(gripChance(0.02, 0.3) - (0.85 - 0.16 - 0.03)) < 1e-9);
  assert.ok(Math.abs(gripChance(-0.05, 0.9) - (0.85 - 0.4 - 0.09)) < 1e-9);
  assert.equal(gripChance(GEOMETRY.reach + 0.001, 0), 0);
  assert.equal(gripChance(Number.NaN, 0), 0);
  for (let offset = 0; offset <= GEOMETRY.reach; offset += 0.005) {
    const chance = gripChance(offset, 1);
    assert.ok(chance >= 0 && chance <= 1);
  }
});

test("a round is deterministic for its seed: the layout, his plans and every drop", () => {
  const a = round(1234);
  const b = round(1234);
  assert.deepEqual(a, b);
  assert.notDeepEqual(round(1234).prizes, round(98765).prizes, "another seed, another pile");
  assert.deepEqual(
    [...a.prizes.map((prize) => prize.id)].sort(),
    [...PLUSH_SERIES, liPlushId(KAI)].sort(),
    "the six series plushes and his own",
  );
  for (const prize of a.prizes) assert.ok(prize.x >= GEOMETRY.pile.from && prize.x <= GEOMETRY.pile.to);
  assert.deepEqual(a.turns, ["me", "partner", "me", "partner", "me", "partner"]);
  assert.deepEqual(round(1, "steady", "partner").turns, ["partner", "me", "partner", "me", "partner", "me"]);

  const aim = (state: ClawRoundState) => state.prizes[0]!.x + 0.01;
  const first = playOut(round(77), aim);
  const second = playOut(round(77), aim);
  assert.deepEqual(first, second);
  assert.equal(first.outcomes.length, CLAW_DROPS);
  // A drop spends the same draws whatever it does, so a different outcome earlier never reshuffles what comes later.
  const missed = landDrop(round(77), 0.5).round.draws;
  const hit = landDrop(round(77), round(77).prizes[0]!.x).round.draws;
  assert.equal(missed, hit);
});

test("his style comes from bible.play.style, and plays by it", () => {
  assert.equal(clawStyleOf("Careful and patient, lines it up twice before committing."), "careful");
  assert.equal(clawStyleOf("Calculates the angle aloud and quotes the odds."), "clinical");
  assert.equal(clawStyleOf("Plays to an audience, all flourish and a wink."), "showy");
  assert.equal(clawStyleOf("Slams the button the moment the claw moves."), "reckless");
  assert.equal(clawStyleOf("Joue avec élégance."), clawStyleOf("Joue avec élégance."), "stable for any text");
  // Showy goes for his own plush; careful and clinical for the lightest; reckless for any.
  const showy = planPartnerTurn({ ...round(5, "steady", "partner"), style: "showy" }).plan!;
  assert.equal(showy.target.id, liPlushId(KAI));
  assert.ok(showy.overshoot !== 0);
  const careful = planPartnerTurn({ ...round(5, "steady", "partner"), style: "careful" }).plan!;
  assert.equal(careful.target.id, "chick");
  assert.equal(careful.settleMs, STYLE_PLAY.careful.settleMs);
  // Over many seeds, the clinical hand lands nearer than the reckless one.
  const spread = (style: "clinical" | "reckless") => {
    let sum = 0;
    for (let seed = 1; seed <= 300; seed += 1) {
      const plan = planPartnerTurn({ ...round(seed, "steady", "partner"), style }).plan!;
      sum += Math.abs(plan.aimX - plan.target.x);
    }
    return sum / 300;
  };
  assert.ok(spread("clinical") < spread("reckless") / 3);
});

test("each cheat does what it says, on the eighth cheer of his turn, once a round", () => {
  // Cheers count only on his turn.
  const mine = round(11, "steady", "me");
  assert.equal(cheer(mine).round, mine, "her turn: no cheer");
  const partnerTurn = (cheat: ClawCheat, seed = 11) => planPartnerTurn(round(seed, cheat, "partner")).round;
  const cheerAll = (state: ClawRoundState) => {
    let current = state;
    let fired: ClawCheat | null = null;
    for (let index = 0; index < CHEER_GOAL; index += 1) {
      const result = cheer(current);
      current = result.round;
      fired ??= result.fired;
      if (index < CHEER_GOAL - 1) assert.equal(result.fired, null, "not before the eighth");
    }
    return { state: current, fired };
  };

  // steady: his grip is certain, even well off-centre.
  const steady = cheerAll(partnerTurn("steady"));
  assert.equal(steady.fired, "steady");
  assert.equal(steady.state.effects.guaranteed, true);
  const target = steady.state.prizes[0]!;
  const held = landDrop(steady.state, target.x + GEOMETRY.reach * 0.9);
  assert.equal(held.outcome.caught, true);
  assert.equal(held.round.effects.guaranteed, false, "for this drop only");
  assert.equal(cheer(steady.state).round, steady.state, "once a round");

  // nudge: the prize nearest the chute tumbles in, his.
  const before = partnerTurn("nudge");
  const nearest = [...before.prizes].sort((a, b) => a.x - b.x)[0]!;
  const nudge = cheerAll(before);
  assert.deepEqual(nudge.state.caught, [{ prize: nearest.id, by: "partner" }]);
  assert.ok(!nudge.state.prizes.some((prize) => prize.id === nearest.id));

  // extra: a bonus drop of hers, right after his, and labelled the bonus there (not at the end of the round).
  const extra = cheerAll(partnerTurn("extra"));
  assert.deepEqual(extra.state.turns.slice(0, 3), ["partner", "me", "me"]);
  assert.equal(extra.state.turns.length, CLAW_DROPS + 1);
  assert.deepEqual(
    extra.state.turns.map((_, index) => isBonusTurn(extra.state, index)),
    [false, true, false, false, false, false, false],
  );

  // freeze and calculate: her next swing is slowed, or her next drop shows where it lands; both end with that drop.
  const freeze = cheerAll(partnerTurn("freeze"));
  assert.equal(freeze.state.effects.slowed, true);
  assert.equal(freeze.state.turns.length, CLAW_DROPS, "she has a turn after his");
  const calculate = cheerAll(partnerTurn("calculate"));
  assert.equal(calculate.state.effects.guide, true);
  const afterHis = landDrop(calculate.state, 0.5).round;
  assert.equal(afterHis.effects.guide, true, "still waiting for her drop");
  assert.equal(landDrop(afterHis, 0.5).round.effects.guide, false, "spent on her drop");

  // On his last turn with no turn of hers left, a freeze or calculate adds one, so no cheat is wasted.
  let last = round(3, "freeze", "me");
  for (let index = 0; index < CLAW_DROPS - 1; index += 1) {
    if (currentPlayer(last) === "partner") last = planPartnerTurn(last).round;
    last = landDrop(last, 0.02).round;
  }
  assert.equal(currentPlayer(last), "partner");
  const added = cheerAll(planPartnerTurn(last).round);
  assert.deepEqual(added.state.turns.slice(-2), ["partner", "me"]);
  assert.equal(added.state.bonusAt, added.state.turns.length - 1);
  assert.equal(isBonusTurn(added.state, CLAW_DROPS), true);
  assert.equal(round(3).bonusAt, null, "no cheat, no bonus drop");
});

test("a nudge that takes his target sends his plan to the nearest prize left, with his aim error", () => {
  const planned = planPartnerTurn(round(11, "nudge", "partner"));
  const nearest = [...planned.round.prizes].sort((a, b) => a.x - b.x)[0]!;
  // His plan aims at the prize the nudge will take, a little off-centre.
  const plan = { ...planned.plan!, target: nearest, aimX: nearest.x + 0.02 };
  let state = planned.round;
  let nudged: Prize | null = null;
  for (let index = 0; index < CHEER_GOAL; index += 1) {
    const cheered = cheer(state);
    state = cheered.round;
    nudged ??= cheered.nudged;
  }
  assert.equal(nudged?.id, nearest.id);

  const moved = retargetPlan(plan, nudged!, state.prizes);
  assert.notEqual(moved.target.id, nearest.id);
  assert.ok(
    state.prizes.some((prize) => prize.id === moved.target.id),
    "a prize still in the machine",
  );
  assert.ok(Math.abs(moved.aimX - (moved.target.x + 0.02)) < 1e-9, "the same error off the new target");
  assert.ok(moved.aimX >= GEOMETRY.rail.min && moved.aimX <= GEOMETRY.rail.max);
  assert.equal(landDrop(state, moved.aimX).outcome.target?.id, moved.target.id, "his drop closes on it, not on air");

  // A plan aimed at any other prize stands, and so does one with nothing left to aim at.
  const other = state.prizes[0]!;
  const elsewhere = { ...plan, target: other, aimX: other.x };
  assert.equal(retargetPlan(elsewhere, nudged!, state.prizes), elsewhere);
  assert.equal(retargetPlan(plan, nudged!, []), plan);
});

test("the claw moves and swings the same at any frame rate, and a stalled tab never jumps it", () => {
  /** One second of frames at `hz`, chasing the far side of the glass from the chute. */
  const second = (hz: number) => {
    let body = { ...restingBody(), target: 0.8 };
    for (let frame = 0; frame < hz; frame += 1) body = stepBody(body, 1 / hz);
    return body;
  };
  const at60 = second(60);
  assert.ok(at60.x > 0.5, "it crossed the glass");
  assert.ok(Math.abs(at60.sway) > 0.001, "and swings on its cable");
  for (const hz of [75, 90, 120, 144, 165, 240, 300, 360]) {
    const body = second(hz);
    assert.ok(Math.abs(body.x - at60.x) < 1e-9, `${hz} Hz: the same place (${body.x} against ${at60.x})`);
    assert.ok(Math.abs(body.sway - at60.sway) < 1e-9, `${hz} Hz: the same swing`);
  }
  // A frame shorter than a step still moves it, once enough of them add up.
  const tiny = stepBody({ ...restingBody(), target: 0.8 }, 0.004);
  assert.equal(tiny.x, restingBody().x);
  assert.ok(stepBody(stepBody(tiny, 0.004), 0.004).x > tiny.x);
  // A long stall steps at most a quarter of a second, and carries nothing over.
  const stalled = stepBody({ ...restingBody(), target: 0.8 }, 5);
  const quarter = stepBody({ ...restingBody(), target: 0.8 }, 0.25);
  assert.equal(stalled.x, quarter.x);
  assert.equal(stalled.rest, 0);
});

test("no round, with any cheat and any aim, catches more than seven", () => {
  const cheats: ClawCheat[] = ["steady", "nudge", "extra", "freeze", "calculate"];
  for (const cheat of cheats) {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const cheerOnTurn of [0, 1, 3, 5]) {
        // She always aims dead on the lightest prize left: the most a round can catch.
        const { state } = playOut(
          round(seed, cheat, seed % 2 ? "me" : "partner"),
          (current) => [...current.prizes].sort((a, b) => a.weight - b.weight)[0]!.x,
          cheerOnTurn,
        );
        assert.ok(state.caught.length <= CLAW_MAX_CATCHES);
        assert.equal(new Set(state.caught.map((entry) => entry.prize)).size, state.caught.length, "each prize once");
        assert.ok(state.turns.length <= CLAW_DROPS + 1);
      }
    }
  }
});
