import assert from "node:assert/strict";
import { test } from "node:test";
import { HAFENKAI_PLACE as kit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import {
  runTask,
  tasks,
  type CardsDayInput,
  type FeelingLinesInput,
  type ModelCall,
  type ScenePartInput,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";

const offer = [
  { tier: "strong" as const, stance: "invest" },
  { tier: "middle" as const, stance: "cheap_fix" },
  { tier: "weak" as const, stance: "refuse" },
];
const cards: CardsDayInput = {
  kit,
  rng: 7,
  seeds: [
    { id: "s1", asker: "tomasz", need: "output", severity: 2, offer },
    { id: "s2", asker: "dilek", need: "money", severity: 1, offer },
  ],
};
const arrival: ScenePartInput = {
  kit,
  rng: 7,
  blueprint: "arrival",
  goal: "Henrike shows you the office.",
  room: "office",
  people: ["henrike", "tomasz"],
  offer: ["invest", "delay"],
};
const hearing: ScenePartInput = { ...arrival, blueprint: "hearing", people: ["henrike", "gunnar"], offer: [] };
const feeling: FeelingLinesInput = {
  kit,
  rng: 7,
  people: [
    { person: "henrike", band: "wary" },
    { person: "tomasz", band: "loyal" },
  ],
};
const cases = [
  ["cards.day", cards],
  ["scene.part", arrival],
  ["scene.part", hearing],
  ["feeling.lines", feeling],
  ["answer.tag", { kit, text: "Not this week, Tomasz.", asker: "tomasz" }],
] as const;

const say =
  (v: unknown): ModelCall =>
  async () =>
    "Here you go:\n```json\n" + JSON.stringify(v) + "\n```";

test("Lite path returns valid output for every task and is repeatable", async () => {
  for (const [task, input] of cases) {
    const a = await runTask(task, input as never);
    assert.equal(a.source, "lite");
    // The Lite output must pass its own validator.
    assert.deepEqual(tasks[task].parse(a.output as never, input as never), a.output);
    assert.deepEqual((await runTask(task, input as never)).output, a.output);
  }
});

test("a valid model reply is used", async () => {
  const lite = (await runTask("cards.day", cards)).output;
  const r = await runTask("cards.day", cards, { model: say(lite) });
  assert.equal(r.source, "model");
  assert.deepEqual(r.output, lite);
});

test("the model reply is rebuilt from known fields, so smuggled numbers are dropped", async () => {
  const lite = (await runTask("feeling.lines", feeling)).output;
  const r = await runTask("feeling.lines", feeling, {
    model: say({ ...lite, lines: lite.lines.map((l) => ({ ...l, trust: 99 })) }),
  });
  assert.equal(r.source, "model");
  assert.ok(r.output.lines.every((l) => !("trust" in l)));
});

test("validators reject bad model output", () => {
  const c = tasks["cards.day"].lite(cards);
  const bad = (v: unknown) => assert.throws(() => tasks["cards.day"].parse(v, cards));
  bad({ cards: [c.cards[0]] }); // missing card
  bad({ cards: [c.cards[1], c.cards[0]] }); // seeds out of order
  bad({ cards: [{ ...c.cards[0], text: undefined }, c.cards[1]] }); // missing field
  bad({ cards: [{ ...c.cards[0], answers: [...c.cards[0]!.answers].reverse() }, c.cards[1]] }); // stances out of order
  bad({
    cards: [{ ...c.cards[0], answers: c.cards[0]!.answers.map((a) => ({ ...a, text: "Pay 500 now" })) }, c.cards[1]],
  }); // digit
  bad({
    cards: [{ ...c.cards[0], answers: c.cards[0]!.answers.map((a) => ({ ...a, text: "Ok — fine then" })) }, c.cards[1]],
  }); // em dash
  bad({ cards: [{ ...c.cards[0], text: "x".repeat(300) }, c.cards[1]] }); // over-long line

  const f = tasks["feeling.lines"].lite(feeling);
  const badF = (v: unknown) => assert.throws(() => tasks["feeling.lines"].parse(v, feeling));
  badF({ lines: [{ ...f.lines[0], person: "nobody" }, f.lines[1]] }); // unknown person
  badF({ lines: [{ ...f.lines[0], band: "warm" }, f.lines[1]] }); // band mismatch

  const s = tasks["scene.part"].lite(arrival);
  const badS = (v: unknown) => assert.throws(() => tasks["scene.part"].parse(v, arrival));
  badS({ ...s, lines: [{ who: "mira", text: "Hello there." }, ...s.lines] }); // not on stage
  badS({ ...s, summary: "x".repeat(121) });
  badS({ ...s, suggestions: [...s.suggestions].reverse() });

  const t = tasks["answer.tag"];
  const ti = { kit, text: "no" };
  assert.throws(() => t.parse({ stance: "decree" }, ti)); // not a core stance
  assert.throws(() => t.parse({ stance: "delay", promise: { to: "nobody", what: "a boat" } }, ti));
});

test("runTask falls back to Lite when the model throws, rambles or times out", async () => {
  const lite = (await runTask("cards.day", cards)).output;
  for (const model of [
    (async () => {
      throw new Error("offline");
    }) as ModelCall,
    (async () => "I cannot help with that.") as ModelCall,
    say({ cards: [] }),
    (() => new Promise<string>(() => {})) as ModelCall, // never answers
  ]) {
    const r = await runTask("cards.day", cards, { model, timeoutMs: 30 });
    assert.equal(r.source, "lite");
    assert.deepEqual(r.output, lite);
  }
});

test("answer.tag Lite keyword matcher", async () => {
  const tag = async (text: string, allowed?: string[]) => (await runTask("answer.tag", { kit, text, allowed })).output;
  assert.equal((await tag("Buy a new one today")).stance, "invest");
  assert.equal((await tag("Tape it for now")).stance, "cheap_fix");
  assert.equal((await tag("Not this week")).stance, "delay");
  assert.equal((await tag("Never")).stance, "refuse");
  assert.equal((await tag("Ask the crew")).stance, "ask_others");
  assert.equal((await tag("Let Dilek handle it")).stance, "delegate");
  assert.equal((await tag("Buy a new one", ["delay", "refuse"])).stance, "delay"); // not allowed here
  const p = (await runTask("answer.tag", { kit, text: "I promise a new radio", asker: "tomasz" })).output;
  assert.equal(p.promise?.to, "tomasz");
});
