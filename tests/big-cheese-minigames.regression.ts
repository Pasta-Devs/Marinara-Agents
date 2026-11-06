import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import { createGame } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/game.js";
import { createMinigames } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/minigames.js";
import { createRunStore } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import {
  QUESTIONS,
  SPEECH,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/minigames.js";
import { TRAITS } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/traits.js";
import type { PlaceKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/types.js";

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

// A small crowd: a loyal one, a joker and a strict one, and a hire with one trait.
const kit = {
  people: [
    { id: "a", traits: ["loyal"] },
    { id: "b", traits: ["joker"] },
    { id: "c", traits: ["strict"] },
    { id: "h1", traits: ["loyal"] },
  ],
} as unknown as PlaceKit;

function fresh() {
  const s = core.newRun(core.HAFENKAI, 1);
  const base = Object.values(s.people)[0]!;
  s.people = { a: { ...base }, b: { ...base }, c: { ...base } };
  s.clock.hoursLeft = 4;
  return s;
}

test("the tables only use real traits, and the six questions cover all 30", () => {
  const all = new Set<string>(TRAITS);
  for (const t of Object.values(SPEECH)) for (const x of [...t.like, ...t.dislike]) assert.ok(all.has(x), x);
  const probed = Object.values(QUESTIONS).flatMap((q) => q.probes);
  assert.equal(new Set(probed).size, TRAITS.length);
  assert.equal(probed.length, TRAITS.length);
});

test("a Monday offers a speech, a new hire offers an interview, and neither uses the rng", () => {
  const s = fresh();
  const rng = s.rng;
  s.clock.day = 0;
  core.minigameOffer(s);
  assert.equal(s.minigame?.kind, "speech");
  assert.equal(s.minigame?.options.length, 5);
  assert.equal(s.rng, rng);
  s.people.h1 = { ...s.people.a! };
  core.minigameOffer(s);
  assert.equal(s.minigame?.kind, "speech", "an open game stays for its week");
  s.minigame = null;
  s.clock.day = 1;
  core.minigameOffer(s);
  assert.equal(s.minigame?.kind, "interview");
  assert.deepEqual(s.minigame?.people, ["h1"]);
  s.clock.day = 2;
  core.minigameOffer(s);
  assert.equal(s.minigame?.kind, "interview", "an open interview stays");
  s.clock = { ...s.clock, week: s.clock.week + 1, day: 0 };
  core.minigameOffer(s);
  assert.equal(s.minigame?.kind, "speech", "a skipped interview does not block next Monday's speech");
  s.minigame = null;
  s.clock.day = 1;
  s.people.h1!.status = "quit";
  core.minigameOffer(s);
  assert.notEqual(s.minigame?.kind, "interview", "nobody interviews a person who left");
});

test("a speech: the same picks give the same result, order matters, the closing line counts double", () => {
  const play = (picks: string[]) => {
    const s = fresh();
    s.clock.day = 0;
    core.minigameOffer(s);
    return { s, out: core.playMinigame(s, kit, "speech", picks) };
  };
  const one = play(["warm", "funny", "firm"]);
  const two = play(["warm", "funny", "firm"]);
  assert.deepEqual(one.out.minigame!.done, two.out.minigame!.done);
  // warm: a likes, c dislikes (0). funny: b likes, c dislikes (0). firm: a and c like (2).
  assert.deepEqual(
    one.out.minigame!.done!.steps.map((x) => x.value),
    [0, 0, 2],
  );
  assert.equal(one.out.minigame!.done!.score, 4 / 12);
  assert.equal(one.out.minigame!.done!.outcome, "good");
  const swapped = play(["firm", "funny", "warm"]).out.minigame!.done!;
  assert.notEqual(swapped.score, one.out.minigame!.done!.score, "the last line weighs more");
  assert.equal(one.out.clock.hoursLeft, 3, "a speech costs 1 hour");
  assert.ok(one.out.minigames!.some((k) => k.startsWith("speech:")));
});

test("an interview shows a trait only when a question probes it", () => {
  const s = fresh();
  s.clock.day = 1; // Monday belongs to the speech
  s.people.h1 = { ...s.people.a! };
  core.minigameOffer(s);
  const hitRun = core.playMinigame(s, kit, "interview", ["people", "money", "work"]);
  const hit = hitRun.minigame!.done!;
  assert.deepEqual(hit.revealed, ["loyal"]);
  const s2 = fresh();
  s2.clock.day = 1;
  s2.people.h1 = { ...s2.people.a! };
  core.minigameOffer(s2);
  const missRun = core.playMinigame(s2, kit, "interview", ["money", "work", "heart"]);
  const miss = missRun.minigame!.done!;
  assert.deepEqual(miss.revealed, []);
  assert.equal(miss.outcome, "flat");
  assert.equal(hitRun.people.h1!.trust, missRun.people.h1!.trust + 3, "a shown trait builds trust");
});

test("bad picks, a wrong kind and a second play are refused", () => {
  const s = fresh();
  s.clock.day = 0;
  core.minigameOffer(s);
  assert.throws(() => core.playMinigame(s, kit, "speech", ["warm", "warm", "bold"]), /Pick 3/);
  assert.throws(() => core.playMinigame(s, kit, "speech", ["warm", "bold"]), /Pick 3/);
  assert.throws(() => core.playMinigame(s, kit, "speech", ["warm", "bold", "nope"]), /Pick 3/);
  assert.throws(() => core.playMinigame(s, kit, "interview", ["warm", "bold", "firm"]), /No mini-game/);
  assert.throws(() => core.playMinigame(s, kit, "toString", ["warm", "bold", "firm"]), /No mini-game/);
  const done = core.playMinigame(s, kit, "speech", ["warm", "bold", "firm"]);
  assert.throws(() => core.playMinigame(done, kit, "speech", ["warm", "bold", "firm"]), /No mini-game/);
});

async function start(lite = true, model?: (m: unknown) => Promise<string>) {
  const store = createRunStore(fakeDocuments());
  const game = createGame(store, () => Promise.resolve(undefined));
  const { run } = await game.create("hafenkai", lite);
  const cur = await store.get(run.id);
  await store.update(run.id, cur.revision, (r) => {
    const g = structuredClone(r.game);
    g.clock.hoursLeft = 4;
    g.clock.day = 0;
    core.minigameOffer(g);
    return { ...r, scene: null, game: g };
  });
  const mini = createMinigames(store, () => Promise.resolve(model as never));
  return { store, mini, id: run.id };
}

test("the route plays a speech in Lite: one line per step, 1 hour, a stale revision is a 409", async () => {
  const { store, mini, id } = await start();
  const cur = await store.get(id);
  assert.equal(cur.game.minigame?.kind, "speech");
  const stale: any = await mini
    .play(id, { expectedRevision: cur.revision + 5, kind: "speech", picks: ["warm", "bold", "firm"] })
    .catch((e) => e);
  assert.equal(stale.code, "conflict");
  const bad: any = await mini
    .play(id, { expectedRevision: cur.revision, kind: "speech", picks: ["warm", "warm", "firm"] })
    .catch((e) => e);
  assert.equal(bad.code, "bad-request");
  const out: any = await mini.play(id, {
    expectedRevision: cur.revision,
    kind: "speech",
    picks: ["warm", "bold", "firm"],
  });
  const done = out.run.game.minigame.done;
  assert.equal(done.lines.length, 3);
  assert.equal(out.run.game.clock.hoursLeft, 3);
  const again: any = await mini
    .play(id, { expectedRevision: out.run.revision, kind: "speech", picks: ["warm", "bold", "firm"] })
    .catch((e) => e);
  assert.equal(again.code, "wrong-phase");
});

test("a model line that names a stranger falls back to Lite; good lines are kept", async () => {
  const lines = (who: string) => async () =>
    JSON.stringify({ lines: [1, 2, 3].map(() => ({ who, text: "They nod along." })) });
  const bad = await start(false, lines("nobody"));
  const c1 = await bad.store.get(bad.id);
  const o1: any = await bad.mini.play(bad.id, {
    expectedRevision: c1.revision,
    kind: "speech",
    picks: ["warm", "bold", "firm"],
  });
  assert.ok(
    o1.run.game.minigame.done.lines.every((l: any) => l.text.startsWith("The crowd")),
    "Lite verdicts",
  );
  const good = await start(false, lines(""));
  const c2 = await good.store.get(good.id);
  const o2: any = await good.mini.play(good.id, {
    expectedRevision: c2.revision,
    kind: "speech",
    picks: ["warm", "bold", "firm"],
  });
  assert.ok(o2.run.game.minigame.done.lines.every((l: any) => l.text === "They nod along."));
});
