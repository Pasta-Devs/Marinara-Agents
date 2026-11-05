import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore, CapabilityRuntimeHost } from "@marinara-engine/shared";
import { createBoard } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/board.js";
import { createGame } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/game.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { termWeeks } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/mutators.js";
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
  const view = (await game.create("hafenkai", true, undefined, undefined, mode as "normal")) as any;
  const id = view.run.id as string;
  const rev = async () => (await store.get(id)).revision;
  await game.choose(id, "arrival", { expectedRevision: await rev(), skip: true });
  await board.morning(await game.dayStart(id, { expectedRevision: await rev() }));
  const cur = async () => await store.get(id);
  const play = async (actions: Record<string, unknown>[], extra: Record<string, unknown> = {}) => {
    const p = await board.preview(id, { actions });
    return board.play(id, { expectedRevision: await rev(), previewId: p.id, ...extra });
  };
  const journal = async () => (await board.journal(id, {})).entries as any[];
  const rewind = async (playId: string, m: string, confirmLater = true) =>
    board.rewind(id, { expectedRevision: await rev(), playId, mode: m, confirmLater });
  return { id, store, board, rev, cur, play, journal, rewind };
}

const code = (c: string) => (e: any) => e.code === c;

test("a mutator switches on, applies its start effect and reverts", async () => {
  const h = await start();
  await h.play([{ verb: "mutator.set", input: { mutator: "everyone_hates_you", on: true } }]);
  assert.ok(Object.values((await h.cur()).game.people).every((p: any) => p.trust <= 20));
  const [last] = await h.journal();
  await h.rewind(last.id, "revert");
  assert.ok(Object.values((await h.cur()).game.people).some((p: any) => p.trust > 20));
  await h.play([{ verb: "mutator.set", input: { mutator: "inherited_mess", on: true } }]);
  const open = Object.values((await h.cur()).game.threads).filter((t: any) => t.state === "open");
  assert.ok(open.length >= 5);
  await h.play([{ verb: "mutator.set", input: { mutator: "speed_run", on: true } }]);
  assert.equal(termWeeks((await h.cur()).game), 4);
  await assert.rejects(() => h.play([{ verb: "mutator.set", input: { mutator: "ironman", on: true } }]));
});

test("layers, systems, dials and rules change now and cost nothing", async () => {
  const h = await start();
  await h.play([{ verb: "layer.set", input: { layer: "romance", dial: 0 } }]);
  assert.equal((await h.cur()).game.layers.romance, 0);
  await h.play([{ verb: "layer.set", input: { layer: "romance", dial: 40 } }]);
  const g = (await h.cur()).game;
  assert.equal(g.layers.romance, 40);
  assert.ok(Object.values(g.threads).some((t: any) => t.layer === "romance"));
  await h.play([{ verb: "dials.set", input: { difficulty: "hard" } }]);
  assert.equal((await h.cur()).game.difficulty, "hard");
  const rule = HAFENKAI_PLACE.houseRules![0]!;
  const option = rule.options[0]!;
  const hours = (await h.cur()).game.clock.hoursLeft;
  await h.play([{ verb: "rule.set", input: { rule: rule.id, option } }]);
  const after = (await h.cur()).game;
  assert.equal(after.houseRules[rule.id], option);
  assert.equal(after.clock.hoursLeft, hours);
  await assert.rejects(() => h.play([{ verb: "system.set", input: { system: "99", on: true } }]));
  await assert.rejects(() => h.play([{ verb: "authority.set", input: { fear: 50 } }]), /absolute/);
  await assert.rejects(() => h.play([{ verb: "decree", input: { rule: rule.id, option } }]));
});

test("the adult switch needs the confirm", async () => {
  const h = await start();
  await assert.rejects(() => h.play([{ verb: "adult.set", input: { on: true } }]), /onfirm/);
  assert.equal((await h.cur()).game.adult, null);
  await h.play([{ verb: "adult.set", input: { on: true, confirm: true } }]);
  assert.ok((await h.cur()).game.adult);
});

test("a kit.edit play reverts and rewinds", async () => {
  const h = await start();
  const before = (await h.cur()).kit;
  assert.equal(before, undefined);
  await h.play([{ verb: "kit.edit", input: { kit: { ...HAFENKAI_PLACE, name: "Hafenkai Reborn" } } }]);
  assert.equal((await h.cur()).kit?.name, "Hafenkai Reborn");
  const [edit] = await h.journal();
  await h.rewind(edit.id, "revert");
  assert.equal((await h.cur()).kit?.name, HAFENKAI_PLACE.name);
  const h2 = await start();
  await h2.play([{ verb: "kit.edit", input: { kit: { ...HAFENKAI_PLACE, name: "Again" } } }]);
  assert.equal((await h2.cur()).kit?.name, "Again");
  await h2.rewind((await h2.journal())[0]!.id, "rewind");
  assert.equal((await h2.cur()).kit, undefined);
  await assert.rejects(() => h.play([{ verb: "kit.edit", input: { kit: { name: "x" } } }]));
});

test("a cast play adds a person from an Engine card, and a rewind takes the cast back", async () => {
  const h = await start();
  const sheet = {
    role: "Harbour pilot",
    traits: ["loyal"],
    tone: "calm",
    lines: ["Tide waits."],
    core: "A calm pilot.",
  };
  await h.play([{ verb: "cast.insert", input: { engineId: "c1", mode: "hire", sheet } }]);
  const run = await h.cur();
  const key = Object.keys(run.cast!.people).find((k) => run.cast!.people[k]!.engineId === "c1")!;
  assert.equal(run.game.people[key]!.name, "Odile Marsh");
  const entry = (await h.journal())[0]!;
  await h.play([{ verb: "cast.remove", input: { person: key } }]);
  assert.equal((await h.cur()).game.people[key]!.status, "quit");
  await h.rewind(entry.id, "rewind");
  const back = await h.cur();
  assert.equal(back.cast, undefined);
  assert.equal(back.game.people[key], undefined);
  await assert.rejects(() => h.play([{ verb: "cast.remove", input: { person: "henrike" } }]));
});

test("a play with client edits still reads the person from the Engine card", async () => {
  const h = await start();
  const sheet = {
    role: "Harbour pilot",
    traits: ["loyal"],
    tone: "calm",
    lines: ["Tide waits."],
    core: "A calm pilot.",
  };
  const cast = (avatar = "") => ({
    verb: "cast.insert",
    input: { engineId: "c1", mode: "hire", sheet, person: { engineId: "c1", name: "Fake", ...sheet, avatar } },
  });
  const p = await h.board.preview(h.id, { actions: [cast()] });
  await h.board.play(h.id, {
    expectedRevision: await h.rev(),
    previewId: p.id,
    edits: [cast("https://evil.example/x.png")],
  } as any);
  const run = (await h.cur()).cast!;
  const person = Object.values(run.people).find((x: any) => x.engineId === "c1") as any;
  assert.equal(person.name, "Odile Marsh");
  assert.notEqual(person.avatar, "https://evil.example/x.png");
});

test("a kit edit cannot drop or rename a system, only add at the end", async () => {
  const h = await start();
  const sys = HAFENKAI_PLACE.systems;
  const edit = (systems: unknown[]) => h.play([{ verb: "kit.edit", input: { kit: { ...HAFENKAI_PLACE, systems } } }]);
  await assert.rejects(() => edit(sys.slice(1)), /Keep/);
  await assert.rejects(() => edit([{ ...sys[0]!, name: "Other" }, ...sys.slice(1)]), /Keep/);
  await edit([...sys, { ...sys[0]!, name: "Extra" }]);
  assert.equal((await h.cur()).kit?.systems.length, sys.length + 1);
});

test("Ironman keeps the Board closed until the player ends it", async () => {
  const h = await start("ironman");
  await assert.rejects(
    () => h.board.preview(h.id, { actions: [{ verb: "time.hours", input: { hours: 1 } }] }),
    code("ironman"),
  );
  await assert.rejects(() => h.board.journal(h.id, {}), code("ironman"));
  await h.board.endIronman(h.id, { expectedRevision: await h.rev() });
  const g = (await h.cur()).game;
  assert.equal(g.mode, "normal");
  assert.equal(g.cheeseMark, true);
  await h.play([{ verb: "time.hours", input: { hours: 1 } }]);
});

test("an Honest run gets its mark with the first agreed play, and a rewind keeps it", async () => {
  const h = await start("honest");
  assert.equal((await h.cur()).game.cheeseMark, false);
  await assert.rejects(() => h.play([{ verb: "time.hours", input: { hours: 1 } }]), code("honest-first"));
  assert.equal((await h.cur()).game.cheeseMark, false);
  await h.play([{ verb: "time.hours", input: { hours: 1 } }], { confirmHonest: true });
  assert.equal((await h.cur()).game.cheeseMark, true);
  const [entry] = await h.journal();
  await h.rewind(entry!.id, "rewind");
  assert.equal((await h.cur()).game.cheeseMark, true);
});
