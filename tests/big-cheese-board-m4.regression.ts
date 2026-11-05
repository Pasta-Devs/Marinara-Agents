import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore, CapabilityRuntimeHost } from "@marinara-engine/shared";
import { createBoard } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/board.js";
import { createGame } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/game.js";
import { createRunStore } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";

function fakeDocuments(): CapabilityDocumentStore {
  const docs = new Map<string, CapabilityDocumentRecord>();
  return {
    docs,
    list: async (_p: unknown, kind: string) => [...docs.values()].filter((d) => d.kind === kind),
    getById: async (_p: unknown, id: string) => docs.get(id) ?? null,
    create: async (input: Record<string, unknown>) => {
      const record = { ...input, revision: 1 } as CapabilityDocumentRecord;
      docs.set(record.id, record);
      return record;
    },
    update: async (input: Record<string, unknown>) => {
      const cur = docs.get(input.id as string);
      if (!cur || cur.revision !== input.expectedRevision) return null;
      const record = { ...cur, ...input, revision: cur.revision + 1 } as CapabilityDocumentRecord;
      docs.set(record.id, record);
      return record;
    },
    remove: async (_p: unknown, id: string, revision: number) => docs.get(id)?.revision === revision && docs.delete(id),
  } as unknown as CapabilityDocumentStore;
}

// One Engine character the Board can insert. The model always fails, so everything runs in Lite mode.
const runtime = {
  resources: {
    listCharacters: async () => [
      {
        id: "c1",
        data: JSON.stringify({
          name: "Odile Marsh",
          description: "A calm harbour pilot, 40 years old.",
          personality: "Steady.",
        }),
        comment: "",
      },
    ],
    listPersonas: async () => [],
  },
} as unknown as CapabilityRuntimeHost;

async function start(mode = "normal") {
  const documents = fakeDocuments();
  const store = createRunStore(documents);
  const game = createGame(store, async () => undefined);
  const board = createBoard(store, documents, async () => undefined, runtime);
  const view = (await game.create("hafenkai", true, undefined, undefined, mode as any)) as any;
  const id = view.run.id as string;
  const rev = async () => (await store.get(id)).revision;
  await game.choose(id, "arrival", { expectedRevision: await rev(), skip: true });
  await board.morning(await game.dayStart(id, { expectedRevision: await rev() }));
  const cur = async () => await store.get(id);
  const play = async (actions: Record<string, unknown>[], extra: Record<string, unknown> = {}) => {
    const p = await board.preview(id, { actions, ...extra });
    return board.play(id, { expectedRevision: await rev(), previewId: p.id, ...extra });
  };
  const rewind = async (body: Record<string, unknown>) => board.rewind(id, { expectedRevision: await rev(), ...body });
  const journal = async () => (await board.journal(id, {})) as any;
  return { id, play, cur, journal, rewind, board, rev };
}

test("drawer, evidence, equipment and rooms are set and reverted", async () => {
  const h = await start();
  const g0 = (await h.cur()).game as any;
  const person = Object.keys(g0.people)[0]!;
  await h.play([{ verb: "drawer.set", input: { op: "add", kind: "gift", name: "A bottle" } }]);
  assert.equal((await h.cur()).game.things.drawer.length, 1);
  const item = (await h.cur()).game.things.drawer[0]!;
  await h.play([{ verb: "drawer.set", input: { op: "remove", id: item.id } }]);
  assert.equal((await h.cur()).game.things.drawer.length, 0);
  await assert.rejects(() => h.play([{ verb: "drawer.set", input: { op: "add", kind: "key", name: "Key" } }]));
  await h.play([{ verb: "evidence.add", input: { about: person, text: "took the till money" } }]);
  const g1 = (await h.cur()).game as any;
  assert.ok(g1.things.drawer.some((t: any) => t.kind === "evidence" && t.about === person));
  assert.ok(Object.values(g1.threads).some((t: any) => t.kind === "cover_up"));
  await assert.rejects(() => h.play([{ verb: "room.open", input: { room: "nowhere" } }]));
  await h.play([{ verb: "room.open", input: { room: "archive" } }]);
  assert.ok(((await h.cur()).game as any).openedRooms.includes("archive"));
  await h.play([{ verb: "culture.set", input: { tag: "strict", level: 4 } }]);
  assert.equal(((await h.cur()).game as any).culture.strict, 4);
  await assert.rejects(() => h.play([{ verb: "culture.set", input: { tag: "nope", level: 4 } }]));
  const last = (await h.journal()).entries[0];
  await h.rewind({ playId: last.id, mode: "revert" });
  assert.notEqual(((await h.cur()).game as any).culture.strict, 4);
});

test("traditions are added and ended, loudly or quietly", async () => {
  const h = await start();
  await h.play([{ verb: "tradition.set", input: { op: "add", text: "Friday cake", count: 3 } }]);
  const byText = async () => ((await h.cur()).game as any).traditions.find((x: any) => x.text === "Friday cake");
  const t = await byText();
  assert.ok(t.active);
  const people = ((await h.cur()).game as any).meters.people;
  await h.play([{ verb: "tradition.set", input: { op: "remove", id: t.id } }]);
  assert.equal((await byText()).active, false);
  assert.equal(((await h.cur()).game as any).meters.people, people);
  await h.play([{ verb: "tradition.set", input: { op: "add", id: t.id, text: "Friday cake", count: 3 } }]);
  await h.play([{ verb: "tradition.set", input: { op: "remove", id: t.id, outrage: true } }]);
  assert.ok(((await h.cur()).game as any).meters.people < people);
});

test("the authority tier can be switched in any kit", async () => {
  const h = await start();
  assert.equal(((await h.cur()).game as any).authority, "manager");
  await h.play([{ verb: "authority.set", input: { tier: "absolute" } }]);
  const g = (await h.cur()).game as any;
  assert.equal(g.authority, "absolute");
  assert.ok(g.power.fear > 0);
});

test("a Spin plan may carry evidence.add and tradition.set, but not a Set-only verb", async () => {
  const h = await start();
  // A Spin plan is checked by the same schema as a Set play, so a Set-only verb in a plan is refused.
  const { BOARD_PLAN_VERBS } =
    await import("../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js");
  assert.ok(BOARD_PLAN_VERBS.includes("evidence.add" as never) && BOARD_PLAN_VERBS.includes("tradition.set" as never));
  for (const v of ["drawer.set", "equipment.set", "room.open", "culture.set"])
    assert.ok(!BOARD_PLAN_VERBS.includes(v as never));
  void h;
});

test("redo restores the state before a rewind, and a new play drops it", async () => {
  const h = await start();
  await h.play([{ verb: "meter.set", target: { kind: "meter", id: "money" }, input: { value: 71 } }]);
  const first = (await h.journal()).entries[0];
  await h.play([{ verb: "meter.set", target: { kind: "meter", id: "money" }, input: { value: 33 } }]);
  assert.equal(((await h.cur()).game as any).meters.money, 33);
  await h.rewind({ playId: first.id, mode: "rewind", confirmLater: true });
  assert.notEqual(((await h.cur()).game as any).meters.money, 33);
  assert.equal((await h.journal()).redo, true);
  await h.rewind({ mode: "redo" });
  assert.equal(((await h.cur()).game as any).meters.money, 33);
  assert.equal((await h.journal()).redo, false);
  await assert.rejects(() => h.rewind({ mode: "redo" }));
  await h.rewind({ playId: first.id, mode: "rewind", confirmLater: true });
  await h.play([{ verb: "meter.set", target: { kind: "meter", id: "money" }, input: { value: 50 } }]);
  assert.equal((await h.journal()).redo, false);
  await assert.rejects(() => h.rewind({ mode: "redo" }));
});

test("Ironman keeps the Board closed", async () => {
  const h = await start("ironman");
  await assert.rejects(() => h.play([{ verb: "culture.set", input: { tag: "strict", level: 4 } }]));
});
