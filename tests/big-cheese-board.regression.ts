import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import {
  MAX_SNAPSHOTS,
  createBoard,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/board.js";
import { createGame } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/game.js";
import { createRunStore } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";

function fakeDocuments(): CapabilityDocumentStore & { docs: Map<string, CapabilityDocumentRecord> } {
  const docs = new Map<string, CapabilityDocumentRecord>();
  return {
    docs,
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
  } as CapabilityDocumentStore & { docs: Map<string, CapabilityDocumentRecord> };
}

type Action = Record<string, unknown>;

/** A Lite run past the arrival scene and the first "Start the day", with the morning snapshot taken like the route does. */
async function harness(finishArrival = true) {
  const documents = fakeDocuments();
  const store = createRunStore(documents);
  const game = createGame(store, async () => undefined);
  const board = createBoard(store, documents);
  const { run } = await game.create("hafenkai", true);
  const id: string = (run as any).id;
  const rev = async () => (await store.get(id)).revision;
  const cur = async () => (await store.get(id)).game as any;
  if (finishArrival) {
    await game.choose(id, "arrival", { expectedRevision: await rev(), skip: true });
    await board.morning(await game.dayStart(id, { expectedRevision: await rev() }));
  }
  const play = async (actions: Action[], extra: object = {}) => {
    const p = await board.preview(id, { actions });
    return board.play(id, { expectedRevision: await rev(), previewId: p.id, ...extra });
  };
  const rewind = async (playId: string, mode: string, confirmLater?: boolean) =>
    board.rewind(id, { expectedRevision: await rev(), playId, mode, confirmLater });
  const journal = async () => (await board.journal(id, {})).entries as any[];
  const startDay = async () => board.morning(await game.dayStart(id, { expectedRevision: await rev() }));
  return { documents, store, game, board, id, rev, cur, play, rewind, journal, startDay };
}

const code = (c: string) => (e: any) => e.code === c;
const meter = (v: number) => ({ verb: "meter.set", target: { kind: "meter", id: "money" }, input: { value: v } });

test("each Set clamps to the core ranges and writes a journal entry with exact before and after", async () => {
  const h = await harness();
  await h.play([meter(150)]);
  assert.equal((await h.cur()).meters.money, 100);
  await h.play([meter(-5)]);
  assert.equal((await h.cur()).meters.money, 0);
  await h.play([{ verb: "meter.set", target: { kind: "meter", id: "output" }, input: { delta: 20 } }]);
  assert.equal((await h.cur()).meters.output, 70);
  await h.play([
    {
      verb: "person.feelings",
      target: { kind: "person", id: "henrike" },
      input: { trust: 500, stress: -3, mood: "great" },
    },
    { verb: "time.hours", input: { hours: 99 } },
  ]);
  const g = await h.cur();
  assert.deepEqual(
    [g.people.henrike.trust, g.people.henrike.stress, g.people.henrike.mood, g.clock.hoursLeft],
    [100, 0, "great", 5],
  );
  const [last, , , first] = await h.journal();
  assert.equal(last.actions.length, 2);
  assert.deepEqual([first.actions[0].before["meters.money"], first.actions[0].after["meters.money"]], [55, 100]);
  assert.equal(first.state, "done");
});

test("bad ids, prototype keys and bad numbers are refused", async () => {
  const h = await harness();
  const bad = code("bad-request");
  for (const id of ["__proto__", "constructor", "toString", "nobody"]) {
    await assert.rejects(
      () => h.play([{ verb: "person.feelings", target: { kind: "person", id }, input: { trust: 5 } }]),
      bad,
      id,
    );
    await assert.rejects(() => h.play([{ verb: "card.remove", target: { kind: "card", id } }]), bad, id);
    await assert.rejects(
      () => h.play([{ verb: "card.add", input: { asker: id, need: "money", severity: 1 } }]),
      bad,
      id,
    );
    await assert.rejects(
      () => h.play([{ verb: "meter.set", target: { kind: "meter", id }, input: { value: 1 } }]),
      bad,
      id,
    );
  }
  await assert.rejects(() => h.play([{ verb: "nope" }]), bad);
  await assert.rejects(() => h.play([meter(Number.NaN)]), bad);
  await assert.rejects(() => h.play([{ ...meter(1), input: { value: 1, delta: 1 } }]), bad);
  await assert.rejects(() => h.play(Array.from({ length: 9 }, () => meter(1))), bad);
  await assert.rejects(() => h.play([{ verb: "time.rewind", input: { days: 1 } }, meter(1)]), bad);
});

test("the Board is refused while a scene is open and on an ended run", async () => {
  const open = await harness(false);
  await assert.rejects(() => open.play([meter(10)]), code("wrong-phase"));
  const h = await harness();
  const p = await h.board.preview(h.id, { actions: [meter(10)] });
  await h.store.update(h.id, await h.rev(), (r) => ({ ...r, game: { ...r.game, status: "ended" } }) as typeof r);
  await assert.rejects(() => h.play([meter(10)]), code("wrong-phase"));
  await assert.rejects(() => h.board.play(h.id, { expectedRevision: 0, previewId: p.id }), code("conflict"));
  await assert.rejects(
    () => h.board.rewind(h.id, { expectedRevision: 0, playId: "p0", mode: "rewind" }),
    code("conflict"),
  );
});

test("a stale preview is not played, and a stale revision is a conflict", async () => {
  const h = await harness();
  const old = await h.board.preview(h.id, { actions: [meter(10)] });
  await h.play([meter(20)]);
  await assert.rejects(
    async () => h.board.play(h.id, { expectedRevision: await h.rev(), previewId: old.id }),
    code("stale-preview"),
  );
  await assert.rejects(
    async () => h.board.play(h.id, { expectedRevision: await h.rev(), previewId: "v-none" }),
    code("not-found"),
  );
  assert.equal((await h.cur()).meters.money, 20);
});

test("rewind restores the exact state including the rng, so the next day replays identically", async () => {
  const h = await harness();
  const before = await h.cur();
  await h.play([{ verb: "card.add", input: { asker: "henrike", need: "money", severity: 2 } }]);
  const g1 = await h.cur();
  assert.equal(g1.inbox.length, before.inbox.length + 1);
  assert.ok(Object.values<any>(g1.threads).some((t) => t.origin === "board"));
  assert.notEqual(g1.rng, before.rng);

  const [entry] = await h.journal();
  await h.rewind(entry.id, "rewind");
  assert.deepEqual(await h.cur(), before);
  assert.equal((await h.journal())[0].state, "rewound");

  // The same skip and the same morning twice give the same day.
  const day = async () => {
    const skip = await h.play([{ verb: "time.skip", input: { days: 1 } }]);
    await h.startDay();
    return { skip, game: await h.cur(), id: (await h.journal())[0].id };
  };
  const a = await day();
  await h.rewind(a.id, "rewind", true);
  assert.deepEqual(await h.cur(), before);
  const b = await day();
  assert.deepEqual(b.game, a.game);
});

test("rewinding past later plays needs a confirmation and greys them out", async () => {
  const h = await harness();
  await h.play([meter(10)]);
  await h.play([meter(20)]);
  const [second, first] = await h.journal();
  assert.equal(first.later, 1);
  await assert.rejects(() => h.rewind(first.id, "rewind"), code("confirm-later"));
  await h.rewind(first.id, "rewind", true);
  assert.equal((await h.cur()).meters.money, 55);
  assert.deepEqual(
    (await h.journal()).map((e) => e.state),
    ["rewound", "rewound"],
  );
  await assert.rejects(() => h.rewind(second.id, "rewind"), code("bad-request"));
});

test("revert writes the old values back as a new play and keeps time played since", async () => {
  const h = await harness();
  await h.play([meter(10)]);
  const [set] = await h.journal();
  await h.play([{ verb: "time.hours", input: { hours: 2 } }]);
  assert.equal(set.changed, false);
  await h.rewind(set.id, "revert");
  const g = await h.cur();
  assert.deepEqual([g.meters.money, g.clock.hoursLeft], [55, 2]);
  const [revert, , reverted] = await h.journal();
  assert.equal(revert.actions[0].verb, "revert");
  assert.equal(reverted.state, "reverted");
  // Values that changed again need a confirmation.
  await h.play([meter(30)]);
  await h.play([meter(40)]);
  const [, mid] = await h.journal();
  assert.equal(mid.changed, true);
  await assert.rejects(() => h.rewind(mid.id, "revert"), code("confirm-later"));
  await h.rewind(mid.id, "revert", true);
  assert.equal((await h.cur()).meters.money, 55);
  // Skips cannot be reverted.
  await h.play([{ verb: "time.skip", input: { days: 1 } }]);
  assert.equal((await h.journal())[0].canRevert, false);
});

test("the snapshot count is capped, and plays past the cap cannot be rewound", async () => {
  const h = await harness();
  for (let i = 0; i < MAX_SNAPSHOTS + 5; i++) await h.play([meter(i)]);
  const data = [...h.documents.docs.values()].find((d) => d.kind === "board-snapshots")!.data as any;
  assert.ok(data.snaps.length <= MAX_SNAPSHOTS);
  const entries = (await h.board.journal(h.id, { page: 0 })).entries as any[];
  assert.equal(entries[0].canRewind, true);
  const oldest = (await h.board.journal(h.id, { page: 1 })).entries.at(-1) as any;
  assert.equal(oldest.canRewind, false);
  await assert.rejects(() => h.rewind(oldest.id, "rewind", true), code("not-found"));
  assert.equal(oldest.canRevert, false);
  assert.equal(data.journal.length, MAX_SNAPSHOTS + 5);
  assert.ok(data.journal[0].actions.every((a: any) => !a.revertable));
});

test("Rewind a day goes back to that morning, and refuses a day with no snapshot", async () => {
  const h = await harness();
  const monday = await h.cur();
  await h.play([{ verb: "time.skip", input: { days: 1 } }]);
  await h.startDay();
  assert.equal((await h.cur()).clock.day, 1);
  await assert.rejects(() => h.play([{ verb: "time.rewind", input: { days: 3 } }]), code("not-found"));
  await h.play([{ verb: "time.rewind", input: { days: 1 } }]);
  assert.deepEqual(await h.cur(), monday);
});

test("card add and card remove keep the inbox and threads in step", async () => {
  const h = await harness();
  const start = (await h.cur()).inbox.length;
  await h.play([{ verb: "card.add", input: { asker: "tomasz", need: "people", severity: 3 } }]);
  const g = await h.cur();
  const card = g.inbox.at(-1);
  assert.equal(g.inbox.length, start + 1);
  assert.deepEqual([card.asker, card.need, card.severity, card.age], ["tomasz", "people", 3, 0]);
  assert.equal(card.answers.length, 3);
  await h.play([{ verb: "card.remove", target: { kind: "card", id: card.id } }]);
  const after = await h.cur();
  assert.equal(after.inbox.length, start);
  assert.equal(after.threads[card.thread], undefined);
});

test("deleting a run deletes its Board document", async () => {
  const h = await harness();
  await h.play([meter(10)]);
  assert.ok([...h.documents.docs.values()].some((d) => d.kind === "board-snapshots"));
  await h.store.remove(h.id);
  await h.board.remove(h.id);
  assert.ok(![...h.documents.docs.values()].some((d) => d.kind === "board-snapshots"));
});
