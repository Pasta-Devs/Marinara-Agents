import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import type { ModelCall } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";
import { createGame } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/game.js";
import { activate } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/server-entry.js";
import { createRunStore } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";

function fakeDocuments(): CapabilityDocumentStore {
  const docs = new Map<string, CapabilityDocumentRecord>();
  return {
    list: async (_p, kind) => [...docs.values()].filter((d) => d.kind === kind),
    getById: async (_p, id) => docs.get(id) ?? null,
    create: async (input) => {
      const record = { ...input, revision: 1 } as CapabilityDocumentRecord;
      docs.set(record.id, record);
      return record;
    },
    update: async (input) => {
      const current = docs.get(input.id);
      if (!current || current.revision !== input.expectedRevision) return null;
      const record = { ...current, ...input, revision: current.revision + 1 } as CapabilityDocumentRecord;
      docs.set(record.id, record);
      return record;
    },
    remove: async (_p, id, expectedRevision) => docs.get(id)?.revision === expectedRevision && docs.delete(id),
  } as CapabilityDocumentStore;
}

type Doc = { run: any; kit: any };

// Starts the real routes on a fake Engine. The language model always fails, so `lite: false` falls back to Lite too.
async function harness() {
  const documents = fakeDocuments();
  const routes: {
    method: string;
    re: RegExp;
    names: string[];
    handler: (req: unknown, reply: unknown) => Promise<unknown>;
  }[] = [];
  const add = (method: string) => (path: string, handler: never) => {
    const names: string[] = [];
    const re = new RegExp("^" + path.replace(/:(\w+)/g, (_m, n) => (names.push(n), "([^/]+)")) + "$");
    routes.push({ method, re, names, handler });
  };
  const api = {
    runtime: {
      persistence: { documents },
      logger: { error() {} },
      languageModels: { resolveForRequest: async () => Promise.reject(new Error("no model")) },
    },
    registerPrivilegedRoutes: async (fn: (router: unknown) => Promise<void>) => {
      await fn({ get: add("GET"), post: add("POST"), delete: add("DELETE") });
      return () => {};
    },
  };
  await activate({ api } as never);
  async function call(method: string, url: string, body?: unknown) {
    const route = routes.find((r) => r.method === method && r.re.test(url))!;
    const m = route.re.exec(url)!;
    const params = Object.fromEntries(route.names.map((n, i) => [n, m[i + 1]]));
    const reply = {
      code: 200,
      status(c: number) {
        this.code = c;
        return this;
      },
      send: (p: unknown) => p,
    };
    const out: any = await route.handler({ params, body }, reply);
    return { code: reply.code, body: out };
  }
  let cur: Doc;
  const start = async (lite = true) => {
    const r = await call("POST", "/runs", { kitId: "hafenkai", lite });
    assert.equal(r.code, 200);
    return (cur = r.body);
  };
  // POST an action with the current revision; returns the status and keeps the new document on success.
  const act = async (path: string, extra: object = {}) => {
    const r = await call("POST", `/runs/${cur.run.id}/${path}`, { expectedRevision: cur.run.revision, ...extra });
    if (r.code === 200) cur = r.body;
    return r;
  };
  return { call, start, act, documents, doc: () => cur };
}

const finishArrival = async (h: Awaited<ReturnType<typeof harness>>) => {
  for (let i = 0; i < 3; i++) {
    const last = h.doc().run.text.scenes.arrival.parts.at(-1);
    assert.equal((await h.act("scenes/arrival/choose", { stance: last.suggestions[0].stance })).code, 200);
  }
};

test("a new run opens the arrival scene and the kit view has no secrets", async () => {
  const h = await harness();
  const { run, kit } = await h.start();
  assert.equal(run.scene, "arrival");
  assert.equal(run.lite, true);
  const s = run.text.scenes.arrival;
  assert.equal(s.parts.length, 1);
  assert.equal(s.total, 3);
  assert.equal(s.parts[0].suggestions.length, 3);
  assert.ok(kit.people.length >= 6 && kit.letters.length === 5 && kit.meters.money.label);
  assert.ok(!/secret|ambition/.test(JSON.stringify(kit)), "the kit view must not leak secrets or ambitions");
  assert.deepEqual((await h.call("GET", `/runs/${run.id}`)).body, { run, kit });
  // Only the scene's choose route works while it is open.
  for (const path of ["day/start", "day/end", "letters/0/read", "hearing/start"]) {
    const r = await h.act(path);
    assert.equal(r.code, 409, path);
    assert.equal(r.body.code, "wrong-phase", path);
  }
});

test("arrival choices write parts, nudge trust and close the scene", async () => {
  const h = await harness();
  await h.start();
  const before = h.doc().run.game.people.henrike.trust;
  await finishArrival(h);
  const { run } = h.doc();
  assert.equal(run.scene, null);
  assert.ok(run.text.scenes.arrival.done && run.text.scenes.arrival.outcome);
  assert.ok(run.text.scenes.arrival.parts.every((p: any) => p.chosen && p.lines.length >= 3));
  assert.notEqual(run.game.people.henrike.trust, before);
  assert.equal((await h.act("scenes/arrival/choose", { skip: true })).body.code, "wrong-phase");
});

test("an answer that is not on offer, bad bodies and a stale revision are refused", async () => {
  const h = await harness();
  await h.start();
  assert.equal((await h.act("scenes/arrival/choose", { stance: "decree" })).body.code, "bad-request");
  assert.equal((await h.act("scenes/arrival/choose", { stance: "delay", text: "x" })).body.code, "bad-request");
  assert.equal((await h.act("scenes/nowhere/choose", { skip: true })).body.code, "not-found");
  const stale = await h.call("POST", `/runs/${h.doc().run.id}/scenes/arrival/choose`, {
    expectedRevision: 99,
    skip: true,
  });
  assert.equal(stale.code, 409);
  assert.equal(stale.body.code, "conflict");
  assert.equal((await h.call("POST", `/runs/${h.doc().run.id}/day/start`, {})).code, 400);
});

test("skip takes the middle answer for every part left", async () => {
  const h = await harness();
  await h.start();
  const r = await h.act("scenes/arrival/choose", { skip: true });
  assert.equal(r.code, 200);
  const s = r.body.run.text.scenes.arrival;
  assert.equal(r.body.run.scene, null);
  assert.equal(s.parts.length, 3);
  assert.ok(s.done && s.parts.every((p: any) => p.chosen));
});

test("a week: cards get text, phases hold, Friday writes feelings", async () => {
  const h = await harness();
  await h.start();
  await finishArrival(h);
  assert.equal((await h.act("letters/0/read")).code, 200);
  assert.equal(
    h.doc().run.game.threads &&
      Object.values<any>(h.doc().run.game.threads).find((t) => t.kind === "guided").beats[0].read,
    true,
  );
  assert.equal((await h.act("letters/4/read")).body.code, "wrong-phase"); // Friday's letter has not arrived
  assert.equal((await h.act("letters/99/read")).body.code, "not-found");

  for (let day = 0; day < 5; day++) {
    assert.equal((await h.act("day/start")).code, 200);
    const { run } = h.doc();
    const fresh = run.game.inbox.filter((c: any) => c.age === 0);
    assert.ok(fresh.length >= 2);
    for (const c of fresh) {
      const t = run.text.cards[c.id];
      assert.ok(t.line && t.source === "lite" && t.answers.length === 3);
    }
    assert.equal((await h.act("day/start")).body.code, "wrong-phase");
    for (const c of fresh) {
      if (h.doc().run.game.clock.hoursLeft < 1) break;
      const pick = c.answers[0].stance;
      // Alternate between a button and a typed answer.
      const r = await h.act(`cards/${c.id}/answer`, day % 2 ? { text: "Fix it properly, please" } : { stance: pick });
      assert.equal(r.code, 200);
      assert.ok(!r.body.run.game.inbox.some((x: any) => x.id === c.id));
    }
    assert.equal((await h.act("day/end")).code, 200);
  }
  const { run } = h.doc();
  assert.equal(run.game.clock.week, 2);
  assert.equal(run.game.report.week, 1);
  const lines = run.text.feelings["1"];
  assert.ok(lines.length >= 5);
  for (const l of lines) assert.ok(l.person && l.line && ["cold", "wary", "neutral", "warm", "loyal"].includes(l.band));
  assert.ok(run.revision > 10);
});

test("an answer needs a card in the inbox and an hour", async () => {
  const h = await harness();
  await h.start();
  await finishArrival(h);
  await h.act("day/start");
  assert.equal((await h.act("cards/nope/answer", { stance: "invest" })).body.code, "not-found");
  const card = h.doc().run.game.inbox[0];
  const off = ["invest", "cheap_fix", "delay", "delegate", "refuse", "ask_others"].find(
    (s) => !card.answers.some((a: any) => a.stance === s),
  )!;
  assert.equal((await h.act(`cards/${card.id}/answer`, { stance: off })).body.code, "bad-request");
  const store = createRunStore(h.documents);
  const { id, revision } = h.doc().run;
  await store.update(id, revision, (r) => ({ ...r, game: { ...r.game, clock: { ...r.game.clock, hoursLeft: 0 } } }));
  await h.call("GET", `/runs/${id}`).then((r) => (h.doc().run = r.body.run));
  const r = await h.act(`cards/${card.id}/answer`, { stance: card.answers[0].stance });
  assert.equal(r.code, 409);
  assert.equal(r.body.code, "no-hours");
});

test("a typed answer with a promise opens a promise thread", async () => {
  const h = await harness();
  await h.start();
  await finishArrival(h);
  await h.act("day/start");
  const card = h.doc().run.game.inbox[0];
  const r = await h.act(`cards/${card.id}/answer`, {
    stance: card.answers[0].stance,
    promise: { what: "a new radio" },
  });
  assert.equal(r.code, 200);
  const promise = Object.values<any>(r.body.run.game.threads).find((t) => t.kind === "promise");
  assert.equal(promise.promise.what, "a new radio");
  assert.equal(promise.promise.to, card.asker);
  const hours = r.body.run.game.clock.hoursLeft;
  const kept = await h.act(`promises/${promise.id}/keep`, {});
  assert.equal(kept.code, 200);
  assert.equal(kept.body.run.game.threads[promise.id].promise.kept, true);
  assert.equal(kept.body.run.game.clock.hoursLeft, hours - 1);
  assert.equal((await h.act(`promises/${promise.id}/keep`, {})).code, 404);
});

test("the hearing: prep actions, a scene of 3 parts, and the last choice holds the hearing", async () => {
  const h = await harness();
  await h.start();
  await finishArrival(h);
  assert.equal((await h.act("hearing/start")).body.code, "wrong-phase"); // nothing pending
  assert.equal((await h.act("hearing/talk", { person: "marlene" })).body.code, "wrong-phase");
  const store = createRunStore(h.documents);
  const { id, revision, game } = h.doc().run;
  const hearing = {
    meter: "money",
    thread: "none",
    week: game.clock.week,
    day: game.clock.day,
    witnesses: [],
    evidence: [],
  };
  await store.update(id, revision, (r) => ({ ...r, game: { ...r.game, hearing } as never }));
  h.doc().run = (await h.call("GET", `/runs/${id}`)).body.run;

  assert.equal((await h.act("hearing/witness", { person: "nobody" })).body.code, "bad-request");
  assert.equal((await h.act("hearing/witness", { person: "__proto__" })).body.code, "bad-request");
  assert.equal((await h.act("hearing/talk", { person: "henrike" })).body.code, "bad-request"); // not a member
  assert.equal((await h.act("hearing/talk", { person: "marlene" })).code, 200);
  assert.equal(h.doc().run.game.clock.hoursLeft, 4);

  assert.equal((await h.act("hearing/start")).code, 200);
  const sceneId = `hearing-w${game.clock.week}`;
  assert.equal(h.doc().run.scene, sceneId);
  assert.deepEqual(h.doc().run.text.scenes[sceneId].people.sort(), ["gunnar", "leila", "marlene"]);
  assert.equal((await h.act("hearing/start")).body.code, "wrong-phase");
  for (let i = 0; i < 3; i++) {
    assert.ok(h.doc().run.game.hearing, "the hearing waits until the last choice");
    const last = h.doc().run.text.scenes[sceneId].parts.at(-1);
    assert.equal((await h.act(`scenes/${sceneId}/choose`, { stance: last.suggestions[1].stance })).code, 200);
  }
  const { run } = h.doc();
  assert.equal(run.scene, null);
  assert.equal(run.game.hearing, null);
  assert.ok(run.game.lastHearing);
  assert.match(run.text.scenes[sceneId].outcome, /of 3/);
});

test("prototype keys and ended runs are refused", async () => {
  const h = await harness();
  assert.equal((await h.call("POST", "/runs", { kitId: "constructor" })).code, 400);
  await h.start();
  assert.equal((await h.act("scenes/__proto__/choose", { skip: true })).code, 404);
  await finishArrival(h);
  const store = createRunStore(h.documents);
  const { id, revision, game } = h.doc().run;
  await store.update(id, revision, (r) => ({ ...r, game: { ...game, status: "ended" } }));
  h.doc().run = (await h.call("GET", `/runs/${id}`)).body.run;
  assert.equal((await h.act("letters/0/read")).body.code, "wrong-phase");
});

test("model text is used when the model answers, and cannot change state", async () => {
  const store = createRunStore(fakeDocuments());
  const seen: string[] = [];
  const model: ModelCall = async (messages) => {
    const user = JSON.parse(messages[1].content);
    seen.push(user.scene ?? "other");
    return JSON.stringify({
      lines: ["one", "two", "three"].map((n) => ({ who: "narrator", text: `Model line ${n}`, trust: 99 })),
      suggestions: user.stances.map((stance: string) => ({ stance, text: "A short answer here" })),
      summary: "The model wrote this.",
      meters: { money: 100 },
    });
  };
  const game = createGame(store, async () => model);
  const { run } = await game.create("hafenkai", false);
  assert.deepEqual(seen, ["arrival"]);
  assert.equal(run.text.scenes.arrival.parts[0].lines[0].text, "Model line one");
  assert.ok(!("trust" in run.text.scenes.arrival.parts[0].lines[0]));
  assert.equal(run.game.meters.money, 55);
  // lite: true never calls the model, and a missing model falls back to Lite.
  seen.length = 0;
  await game.create("hafenkai", true);
  assert.deepEqual(seen, []);
  const noModel = createGame(store, async () => undefined);
  assert.match((await noModel.create("hafenkai", false)).run.text.scenes.arrival.parts[0].lines[0].text, /\S/);
});

test("Lite text moves on between calls: the rng advances", async () => {
  const h = await harness();
  await h.start();
  const first = h.doc().run.game.rng;
  await h.act("scenes/arrival/choose", { stance: h.doc().run.text.scenes.arrival.parts[0].suggestions[0].stance });
  assert.notEqual(h.doc().run.game.rng, first);
});
