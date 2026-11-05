import { PACKAGE_ID } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import {} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";
import { activate } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/server-entry.js";

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

import {
  pickStance,
  drama,
  watch,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/viewer.js";

// Opens a run past the arrival scene and starts day 1, so cards wait in the inbox.
const ready = async () => {
  const h = await harness();
  await h.start();
  await finishArrival(h);
  assert.equal((await h.act("day/start")).code, 200);
  return h;
};
const raw = async (h: Awaited<ReturnType<typeof harness>>) => {
  // The fake store hands out its own record, so a test can edit the saved run.
  const [rec] = await h.documents.list(PACKAGE_ID, "run");
  return rec as unknown as { data: { game: any; text: any } };
};

test("a skip of n slots keeps the inbox unaged and answers nothing", async () => {
  const h = await ready();
  const before = h.doc().run.game;
  assert.ok(before.inbox.length > 0);
  const ids = before.inbox.map((c: any) => c.id);
  const r = await h.act("advance", { slots: 2, skip: true });
  assert.equal(r.code, 200);
  assert.equal(r.body.advanced, 2);
  assert.equal(r.body.run.game.clock.hoursLeft, before.clock.hoursLeft - 2);
  assert.deepEqual(
    r.body.run.game.inbox.map((c: any) => [c.id, c.age]),
    ids.map((id: string) => [id, 0]),
  );
  assert.equal(typeof r.body.digest, "string");
});

test("a skip across a day end keeps old cards unaged and starts the next day", async () => {
  const h = await ready();
  const ids = h.doc().run.game.inbox.map((c: any) => c.id);
  const r = await h.act("advance", { slots: 5, skip: true });
  assert.equal(r.code, 200);
  const g = r.body.run.game;
  assert.equal(g.clock.day, 1);
  assert.equal(g.clock.hoursLeft, 5);
  assert.ok(ids.every((id: string) => g.inbox.some((c: any) => c.id === id && c.age === 0)));
});

test("a due hearing pauses the timer before any slot runs", async () => {
  const h = await ready();
  const rec = await raw(h);
  const c = rec.data.game.clock;
  rec.data.game.hearing = { meter: "money", week: c.week, day: c.day, witnesses: [], evidence: [] };
  const hours = h.doc().run.game.clock.hoursLeft;
  for (const body of [
    { slots: 3, skip: true },
    { slots: 1, policy: "kind" },
  ]) {
    const r = await h.act("advance", body);
    assert.equal(r.code, 200);
    assert.equal(r.body.paused, "hearing");
    assert.equal(r.body.advanced, 0);
    assert.equal(r.body.run.game.clock.hoursLeft, hours);
    assert.equal(r.body.run.revision, h.doc().run.revision, "a pause with nothing done writes nothing");
  }
});

test("advance waits for Start the day, and a skip's cards come back when the day starts", async () => {
  const h = await harness();
  await h.start();
  await finishArrival(h);
  assert.equal((await h.act("advance", { slots: 1 })).code, 409, "the day has not started");
  assert.equal((await h.act("day/start")).code, 200);
  const ids = h.doc().run.game.inbox.map((c: any) => c.id);
  const r = await h.act("advance", { slots: 5, skip: true });
  assert.equal(r.code, 200);
  assert.equal(r.body.run.game.away, undefined, "nothing is left aside after the next day starts");
  assert.ok(ids.every((id: string) => r.body.run.game.inbox.some((c: any) => c.id === id)));
});

test("a tick with an AI boss answers one card; nobody lets the hour pass", async () => {
  const h = await ready();
  const n = h.doc().run.game.inbox.length;
  assert.equal((await h.act("advance", { slots: 1, policy: "kind" })).body.run.game.inbox.length, n - 1);
  const hours = h.doc().run.game.clock.hoursLeft;
  const r = await h.act("advance", { slots: 1 });
  assert.equal(r.body.run.game.clock.hoursLeft, hours - 1);
  assert.equal(r.body.run.game.inbox.length, n - 1);
});

test("advance refuses a stale revision, a finished run, an open scene and a bad body", async () => {
  const h = await ready();
  const url = `/runs/${h.doc().run.id}/advance`;
  assert.equal((await h.call("POST", url, { expectedRevision: 999, slots: 1 })).body.code, "conflict");
  assert.equal((await h.act("advance", { slots: 0 })).body.code, "bad-request");
  assert.equal((await h.act("advance", { slots: 1, policy: "wild" })).body.code, "bad-request");
  const fresh = await harness();
  await fresh.start();
  assert.equal((await fresh.act("advance", { slots: 1 })).body.code, "wrong-phase"); // the arrival scene is open
  const rec = await raw(h);
  rec.data.game.meeting = { kind: "staff", mode: "vote", title: "t", people: [], items: [], done: false };
  assert.equal((await h.act("advance", { slots: 1 })).body.code, "wrong-phase");
  rec.data.game.meeting = null;
  rec.data.game.status = "complete";
  const over = await h.act("advance", { slots: 1 });
  assert.equal(over.code, 409);
  assert.equal(over.body.code, "wrong-phase");
});

test("an AI boss follows its style, and drama stops the timer", async () => {
  const h = await ready();
  const s = structuredClone(h.doc().run.game);
  const card = {
    ...s.inbox[0],
    severity: 2,
    answers: ["invest", "cheap_fix", "refuse"].map((stance) => ({ tier: "middle", stance })),
  };
  const count = (policy: any) => {
    const t: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      const k = pickStance(s, card, policy);
      t[k] = (t[k] ?? 0) + 1;
    }
    return t;
  };
  assert.equal(count("greedy").invest ?? 0, 0);
  assert.equal(count("kind").refuse ?? 0, 0);
  assert.ok((count("strict").refuse ?? 0) > (count("strict").invest ?? 0));
  const w = watch(s);
  assert.equal(drama(w, s), null);
  s.meters.money = 10;
  assert.equal(drama(w, s), "low");
});
