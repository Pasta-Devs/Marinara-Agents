import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import {
  finishOutside,
  invitation,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/outside.js";
import { createGame } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/game.js";
import { placeKitOf } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/index.js";
import { createBoard } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/board.js";
import { createOutside } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/outside.js";
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

async function setup() {
  const store = createRunStore(fakeDocuments());
  const game = createGame(store, async () => undefined);
  const outside = createOutside(store, async () => undefined, game.openScene);
  let v = await game.create("hafenkai", true);
  const id = v.run.id;
  const rev = () => ({ expectedRevision: v.run.revision });
  v = await game.choose(id, "arrival", { ...rev(), skip: true });
  v = await game.dayStart(id, rev());
  const people = Object.keys(v.run.game.people);
  return {
    store,
    game,
    outside,
    id,
    rev,
    people,
    get v() {
      return v;
    },
    set v(x) {
      v = x;
    },
  };
}

test("a trip costs 2 hours and books once a week; a walk costs 1 hour", async () => {
  const t = await setup();
  const hours = () => t.v.run.game.clock.hoursLeft;
  const before = hours();
  await assert.rejects(t.outside.trip(t.id, { ...t.rev(), room: "office", people: [t.people[0]] }), /No such room/);
  t.v = await t.outside.trip(t.id, { ...t.rev(), room: "fence", people: t.people.slice(0, 4) });
  assert.equal(hours(), before - 2);
  assert.equal(t.v.run.scene, "out-trip-1");
  t.v = await t.game.choose(t.id, "out-trip-1", { ...t.rev(), skip: true });
  assert.ok(t.v.run.text.scenes["out-trip-1"]!.outcome);
  await assert.rejects(
    t.outside.trip(t.id, { ...t.rev(), room: "fence", people: [t.people[0]] }),
    /already took a trip/,
  );
  const room = Object.keys(t.v.run.game.rooms)[0]!;
  t.v = await t.outside.walk(t.id, { ...t.rev(), room, person: t.people[0] });
  assert.equal(hours(), before - 3);
});

test("a declined invitation is the weak stance: no trust, no hours", async () => {
  const t = await setup();
  await t.store.update(t.id, t.v.run.revision, (r) => ({
    ...r,
    game: { ...r.game, clock: { week: 1, day: 1, hoursLeft: 2 } },
  }));
  const run = await t.store.get(t.id);
  const inv = invitation(run.game, run.game.tally)!;
  assert.ok(inv && inv.people.length >= 2);
  const trust = Object.fromEntries(inv.people.map((p) => [p, run.game.people[p]!.trust]));
  let v = await t.outside.afterWork(t.id, { expectedRevision: run.revision });
  assert.equal(v.run.game.clock.hoursLeft, 2);
  // skip takes the middle pick, which is "decline"
  v = await t.game.choose(t.id, v.run.scene!, { expectedRevision: v.run.revision, skip: true });
  for (const p of inv.people) assert.equal(v.run.game.people[p]!.trust, trust[p]);
  assert.equal(invitation(v.run.game, v.run.game.tally), null, "one invitation a day");
});

test("going gives the host and the guests +4 trust", () => {
  const s = core.newRun(core.HAFENKAI, 7);
  const [a, b] = Object.keys(s.people) as [string, string];
  const t0 = [s.people[a]!.trust, s.people[b]!.trust];
  const scene = { blueprint: "after_work", people: [a, b], parts: [{ chosen: "go" }] };
  finishOutside(s, scene);
  assert.equal(s.people[a]!.trust, Math.min(100, t0[0]! + 4));
  assert.equal(s.people[b]!.trust, Math.min(100, t0[1]! + 4));
});

test("a walk rejects a locked hidden room and a guest who is not active", async () => {
  const t = await setup();
  const run = (await t.store.get(t.id))!;
  const hidden = placeKitOf(run).rooms.find((r) => r.kind === "hidden")!.id;
  const rev = async () => ({ expectedRevision: (await t.store.get(t.id))!.revision });
  await assert.rejects(t.outside.walk(t.id, { ...(await rev()), room: hidden, person: t.people[0] }), /locked/);
  const out = placeKitOf(run).rooms.find((r) => r.kind === "outside")!.id;
  await t.store.update(t.id, run.revision, (r) => ({
    ...r,
    game: {
      ...r.game,
      people: { ...r.game.people, [t.people[0]!]: { ...r.game.people[t.people[0]!]!, status: "sick" } },
    },
  }));
  await assert.rejects(t.outside.walk(t.id, { ...(await rev()), room: out, person: t.people[0] }), /No such person/);
});

test("a Board rewind frees the week's trip", async () => {
  const documents = fakeDocuments();
  const store = createRunStore(documents);
  const game = createGame(store, async () => undefined);
  const outside = createOutside(store, async () => undefined, game.openScene);
  const board = createBoard(store, documents, async () => undefined);
  const v0 = (await game.create("hafenkai", true)) as any;
  const id = v0.run.id as string;
  const rev = async () => (await store.get(id))!.revision;
  await game.choose(id, "arrival", { expectedRevision: await rev(), skip: true });
  await board.morning(await game.dayStart(id, { expectedRevision: await rev() }));
  const actions = [{ verb: "mutator.set", input: { mutator: "speed_run", on: true } }];
  const p = (await board.preview(id, { expectedRevision: await rev(), actions })) as any;
  await board.play(id, { expectedRevision: await rev(), previewId: p.id, actions });
  const run = (await store.get(id))!;
  const people = Object.keys(run.game.people).slice(0, 2);
  const room = placeKitOf(run).rooms.find((r) => r.kind === "outside")!.id;
  await outside.trip(id, { expectedRevision: await rev(), room, people });
  await game.choose(id, "out-trip-1", { expectedRevision: await rev(), skip: true });
  await assert.rejects(outside.trip(id, { expectedRevision: await rev(), room, people }), /already took a trip/);
  const last = ((await board.journal(id, {})).entries as any[])[0]!;
  await board.rewind(id, { expectedRevision: await rev(), playId: last.id, mode: "rewind", confirmLater: true });
  await outside.trip(id, { expectedRevision: await rev(), room, people });
});
