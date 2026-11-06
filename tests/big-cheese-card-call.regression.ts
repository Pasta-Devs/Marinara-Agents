// M4 T21: the V2 character card file and "Call someone". Both stay inside Big Cheese.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { cardFromPerson } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/export.js";
import { createCall } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/call.js";
import { runTask } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";
import type { Run, RunStore } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";

const makeRun = (): Run => {
  const game = core.newRun(HAFENKAI_PLACE, 1);
  const [pid] = Object.keys(game.people);
  const thread = (id: string, title: string, extra: object) => ({
    id,
    kind: "personal_arc",
    title,
    people: [pid],
    stakes: "x",
    state: "won",
    ...extra,
  });
  game.threads = {
    t1: thread("t1", "The leaky roof", { layer: "drama" }),
    t2: thread("t2", "The private affair", { layer: "adult" }),
    t3: thread("t3", "The hidden ledger", { layer: "drama", secret: true }),
  } as never;
  game.people[pid].memories = ["t1", "t2", "t3"].map((t, i) => ({
    week: i + 1,
    about: "c",
    thread: t,
    stance: "invest",
    weight: 1,
  })) as never;
  return {
    id: "r1",
    saveVersion: 3,
    revision: 4,
    kitId: "hafenkai",
    createdAt: "",
    lite: true,
    text: { cards: {}, scenes: {}, feelings: {} },
    game,
  } as never;
};

test("the card is a V2 file with voice, traits and public memories only", () => {
  const run = makeRun();
  const [pid] = Object.keys(run.game.people);
  const kitPerson = HAFENKAI_PLACE.people.find((p) => p.id === pid)!;
  const card = cardFromPerson(run, pid);
  assert.equal(card.spec, "chara_card_v2");
  assert.equal(card.data.name, run.game.people[pid].name ?? kitPerson.name);
  assert.match(card.data.personality, new RegExp(kitPerson.traits[0]));
  assert.equal(card.data.first_mes, kitPerson.voice.phrases[0]);
  const text = JSON.stringify(card);
  assert.match(text, /leaky roof/);
  assert.doesNotMatch(text, /private affair/); // adult thread, not chosen
  assert.doesNotMatch(text, /hidden ledger/); // secret thread
  assert.equal(text.includes(kitPerson.secret), false); // the person's own secret
});

test("an adult thread joins the card only when the module is on and the player ticks it", () => {
  const run = makeRun();
  const [pid] = Object.keys(run.game.people);
  assert.doesNotMatch(JSON.stringify(cardFromPerson(run, pid, true)), /private affair/); // module off
  run.game.adult = { intensity: 1, themes: [] } as never;
  assert.doesNotMatch(JSON.stringify(cardFromPerson(run, pid, false)), /private affair/);
  assert.match(JSON.stringify(cardFromPerson(run, pid, true)), /private affair/);
  assert.doesNotMatch(JSON.stringify(cardFromPerson(run, pid, true)), /hidden ledger/);
});

test("a person who is already a library card has no card to make", () => {
  const run = makeRun();
  const [pid] = Object.keys(run.game.people);
  run.cast = {
    people: { [pid]: { engineId: "e1", name: "Rhea", core: "", traits: [], tone: "", lines: [], avatar: "" } },
  } as never;
  assert.throws(() => cardFromPerson(run, pid), /no card/);
  assert.throws(() => cardFromPerson(run, "nobody"), /no card/);
});

const input = (pid: string) => ({
  kit: HAFENKAI_PLACE,
  rng: 7,
  person: pid,
  band: "warm" as const,
  topic: "work",
  earlier: [],
});

test("the call line falls back to Lite when there is no model, or the model fails", async () => {
  const [pid] = Object.keys(makeRun().game.people);
  const lite = await runTask("call.line", input(pid));
  assert.equal(lite.source, "lite");
  assert.ok(lite.output.line.length > 3);
  const broken = await runTask("call.line", input(pid), { model: async () => "not json" });
  assert.equal(broken.source, "lite");
  const good = await runTask("call.line", input(pid), { model: async () => '{"line":"Fine, thanks for asking."}' });
  assert.deepEqual(good, { output: { line: "Fine, thanks for asking." }, source: "model" });
});

test("the call route is guarded and changes nothing in the run", async () => {
  const run = makeRun();
  const [pid] = Object.keys(run.game.people);
  const store = { get: async () => run } as unknown as RunStore;
  const phone = createCall(store, async () => undefined);
  const before = JSON.stringify(run);
  const body = { expectedRevision: 4, topic: "feeling", earlier: [] };
  const reply = await phone.call("r1", pid, body);
  assert.ok(reply.line.length > 3);
  assert.equal(JSON.stringify(run), before);
  await assert.rejects(phone.call("r1", pid, { ...body, expectedRevision: 3 }), /changed/);
  await assert.rejects(phone.call("r1", pid, { ...body, topic: "money" }), /Invalid/);
  await assert.rejects(phone.call("r1", "nobody", body), /not here/);
  run.game.people[pid].status = "quit";
  await assert.rejects(phone.call("r1", pid, body), /not here/);
  run.game.people[pid].status = "active";
  run.scene = {} as never;
  await assert.rejects(phone.call("r1", pid, body), /scene/);
  run.scene = null as never;
  run.game.status = "ended" as never;
  await assert.rejects(phone.call("r1", pid, body), /over/);
});
