// Big Cheese M4 T10: term reviews, the award and the yearbook (modules.md 4).
import assert from "node:assert/strict";
import { test } from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import { createChronicle } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/chronicle.js";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { endTerm } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/term.js";
import {
  AWARD_LOSE,
  AWARD_WIN,
  PEER_GAP,
  giveAward,
  reviewPerson,
  termFacts,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/reviews.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { createRunStore } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";

const fresh = () => core.newRun(core.HAFENKAI, 1, HAFENKAI_PLACE);
const termEnd = (s: core.Run, week = 8, kit = HAFENKAI_PLACE) => {
  s.lastTerm = week / 8;
  s.clock.week = week;
  endTerm(s, kit);
  return s.pendingTerm!;
};
// Two people share a role, so they are equal peers.
const PEERS = { ...HAFENKAI_PLACE, people: HAFENKAI_PLACE.people.map((p, i) => (i < 2 ? { ...p, role: "clerk" } : p)) };

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

test("a term end opens the review for up to 4 active people; the last term has none", () => {
  const s = fresh();
  const p = termEnd(s);
  assert.ok(p.review.length >= 1 && p.review.length <= 4);
  assert.deepEqual(p.done, []);
  assert.equal(p.closed, s.closed.length);
  const last = fresh();
  assert.deepEqual(termEnd(last, 24).review, []);
});

test("each review changes trust, and a raise costs Money", () => {
  const s = fresh();
  const [a, b, c, d] = termEnd(s, 8).review.concat(Object.keys(s.people)).slice(0, 4);
  s.pendingTerm!.review = [a!, b!, c!, d!];
  const t0 = (id: string) => s.people[id]!.trust;
  const [ta, tb, tc, td] = [a!, b!, c!, d!].map(t0) as number[];
  const money = s.meters.money;
  const stress = s.people[d!]!.stress;
  const ambition = s.people[c!]!.ambition;
  reviewPerson(s, HAFENKAI_PLACE, a!, "praise");
  reviewPerson(s, HAFENKAI_PLACE, b!, "raise");
  reviewPerson(s, HAFENKAI_PLACE, c!, "role");
  reviewPerson(s, HAFENKAI_PLACE, d!, "warning");
  assert.equal(s.people[a!]!.trust, Math.min(100, ta! + 4));
  assert.equal(s.people[b!]!.trust, Math.min(100, tb! + 8));
  assert.equal(s.people[c!]!.trust, Math.min(100, tc! + 5));
  assert.equal(s.people[c!]!.ambition, Math.min(100, ambition + 10));
  assert.equal(s.people[d!]!.trust, Math.max(0, td! - 5));
  assert.equal(s.people[d!]!.stress, Math.min(100, stress + 6));
  assert.ok(s.meters.money < money);
  assert.deepEqual(s.pendingTerm!.review, []);
  assert.equal(s.pendingTerm!.done!.length, 4);
  assert.throws(() => reviewPerson(s, HAFENKAI_PLACE, a!, "praise"), /not up for a review/);
});

test("a review needs a listed person and a real pick", () => {
  const s = fresh();
  const who = termEnd(s).review[0]!;
  assert.throws(() => reviewPerson(s, HAFENKAI_PLACE, "nobody", "praise"), /not up for a review/);
  assert.throws(() => reviewPerson(s, HAFENKAI_PLACE, who, "toString"), /no such review/);
});

test("an equal peer who got less loses trust, whoever is reviewed first", () => {
  for (const [first, second] of [
    ["raise", "praise"],
    ["praise", "raise"],
  ] as const) {
    const s = fresh();
    termEnd(s, 8, PEERS as never);
    const [x, y] = PEERS.people.slice(0, 2).map((p) => p.id) as [string, string];
    s.pendingTerm!.review = [x, y];
    s.people[x]!.trust = 50;
    s.people[y]!.trust = 50;
    reviewPerson(s, PEERS as never, x, first);
    reviewPerson(s, PEERS as never, y, second);
    const gain = (k: string) => (k === "raise" ? 8 : 4);
    assert.equal(s.people[x]!.trust, 50 + gain(first) - (first === "praise" ? PEER_GAP : 0));
    assert.equal(s.people[y]!.trust, 50 + gain(second) - (second === "praise" ? PEER_GAP : 0));
  }
});

test("the award has one winner who gains and losers who lose a little", () => {
  const s = fresh();
  const ids = termEnd(s).review;
  s.pendingTerm!.review = ids.slice(0, 2);
  const [w, l] = ids.slice(0, 2) as [string, string];
  s.people[w]!.trust = 50;
  s.people[l]!.trust = 50;
  assert.throws(() => giveAward(s, "nobody"), /not up for the award/);
  giveAward(s, w);
  assert.equal(s.people[w]!.trust, 50 + AWARD_WIN);
  assert.equal(s.people[l]!.trust, 50 - AWARD_LOSE);
  assert.equal(s.pendingTerm!.award, w);
  assert.throws(() => giveAward(s, l), /no award/);
});

test("term facts keep adult threads and secrets out unless adult text is chosen", () => {
  const s = fresh();
  const base = { id: "t", state: "won" as const, need: "money" as const, secret: false };
  s.closed.push({ ...base, id: "t1", title: "Fixed the roof", layer: null });
  s.closed.push({ ...base, id: "t2", title: "Velvet affair", layer: "adult" });
  s.closed.push({ ...base, id: "t3", title: "Hidden plot", layer: null, secret: true });
  termEnd(s);
  assert.deepEqual(
    termFacts(s, HAFENKAI_PLACE).closed.map((c) => c.title),
    ["Fixed the roof"],
  );
  assert.deepEqual(
    termFacts(s, HAFENKAI_PLACE, true).closed.map((c) => c.title),
    ["Fixed the roof", "Velvet affair"],
  );
});

test("the yearbook page is one document for each term, so a replay never duplicates it", async () => {
  const documents = fakeDocuments();
  const store = createRunStore(documents);
  const chronicle = createChronicle(store, documents, async () => undefined);
  const { id } = await store.create("hafenkai", true);
  await store.update(id, 0, (r) => {
    const g = structuredClone(r.game);
    g.closed.push({ id: "t2", state: "won", need: "money", secret: false, title: "Velvet affair", layer: "adult" });
    g.closed.push({ id: "t1", state: "won", need: "money", secret: false, title: "Fixed the roof", layer: null });
    g.adult = { intensity: 1, themes: [] };
    termEnd(g);
    return { ...r, game: g };
  });
  const write = async (adult?: boolean) =>
    chronicle.write(id, { expectedRevision: (await store.get(id)).revision, adult });
  await write();
  const page = async () => (await chronicle.list(id)).pages;
  assert.equal((await page()).length, 1);
  assert.ok((await page())[0]!.text.includes("Fixed the roof"));
  assert.ok(!(await page())[0]!.text.includes("Velvet"), "adult text is absent by default");
  await write(); // a Board rewind plus replay writes the same page again
  assert.equal((await page()).length, 1);
  assert.equal((await documents.list("big-cheese", "yearbook")).length, 1);
  assert.match((await documents.list("big-cheese", "yearbook"))[0]!.id, /:1$/);
  assert.equal((await store.get(id)).game.yearbook.length, 1);
  await write(true);
  assert.ok((await page())[0]!.text.includes("Velvet"), "adult text appears when the player chose it");
  await chronicle.remove(id);
  assert.equal((await documents.list("big-cheese", "yearbook")).length, 0);
});

test("review and award routes need the open revision and a playing run", async () => {
  const documents = fakeDocuments();
  const store = createRunStore(documents);
  const chronicle = createChronicle(store, documents, async () => undefined);
  const { id } = await store.create("hafenkai", true);
  await store.update(id, 0, (r) => {
    const g = structuredClone(r.game);
    termEnd(g);
    return { ...r, game: g };
  });
  const run = await store.get(id);
  const who = run.game.pendingTerm!.review[0]!;
  await assert.rejects(chronicle.review(id, { expectedRevision: 99, who, pick: "praise" }), { statusCode: 409 });
  await assert.rejects(chronicle.review(id, { expectedRevision: run.revision, who, pick: "nope" }), {
    statusCode: 400,
  });
  await chronicle.review(id, { expectedRevision: run.revision, who, pick: "praise" });
  const after = await store.get(id);
  assert.deepEqual(after.game.pendingTerm!.done, [{ who, pick: "praise" }]);
  await chronicle.award(id, { expectedRevision: after.revision, who });
  assert.equal((await store.get(id)).game.pendingTerm!.award, who);
});
