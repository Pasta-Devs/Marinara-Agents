// T6: Adult module. Off by default, needs the adult confirm, and no adult text leaves the run when it is off.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import {
  runTask,
  tasks,
  type CardsDayInput,
  type ScenePartInput,
  type ThreadBeatInput,
} from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";
import { openStory } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/threads.js";
import type { Run } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/types.js";

const kit = HAFENKAI_PLACE;
const MARK = "Adult themes are on";
const on = { intensity: 2, themes: ["cuckold", "power"] };

const cards: CardsDayInput = {
  kit,
  rng: 3,
  seeds: [{ id: "s1", asker: "tomasz", need: "output", severity: 2, offer: [{ tier: "strong", stance: "invest" }] }],
};
const scene: ScenePartInput = {
  kit,
  rng: 3,
  blueprint: "arrival",
  goal: "Henrike shows you the office.",
  room: "office",
  people: ["henrike"],
  offer: ["invest"],
};
const beat: ThreadBeatInput = {
  kit,
  rng: 3,
  kind: "mystery",
  idea: "a whisper",
  people: ["henrike"],
  need: "people",
  beats: [{ type: "card" }],
};
const text = (m: { content: string }[]) => m.map((x) => x.content).join("\n");

test("the switch needs the adult confirm and is off by default", () => {
  const s = core.newRun(kit, 1);
  assert.equal(s.adult, null);
  assert.throws(() => core.setAdult(s, { on: true }), /adult/);
  assert.throws(() => core.setAdult(s, { on: true, confirm: false }), /adult/);
  core.setAdult(s, { on: true, confirm: true, intensity: 2, themes: ["cuckold", " ", "cuckold"] });
  assert.deepEqual(s.adult, { intensity: 2, themes: ["cuckold"] });
  core.setAdult(s, { on: true, intensity: 0 }); // already on: no new confirm
  assert.equal(s.adult!.intensity, 0);
  core.setAdult(s, { on: false });
  assert.equal(s.adult, null);
});

for (const [name, task, input] of [
  ["cards.day", "cards.day", cards],
  ["scene.part", "scene.part", scene],
  ["thread.beat", "thread.beat", beat],
] as const) {
  test(`${name}: no adult text when the module is off, adult text when on`, () => {
    const t = tasks[task] as unknown as { prompt: (i: unknown) => { content: string }[] };
    assert.ok(!text(t.prompt(input)).includes(MARK));
    assert.ok(!text(t.prompt({ ...input, adult: null })).includes(MARK));
    assert.ok(text(t.prompt({ ...input, adult: on })).includes(MARK));
  });
}

test("a refusal falls back to fade to black, is logged, and the game goes on", async () => {
  const seen: string[] = [];
  const logged: string[] = [];
  const lite = (await runTask("cards.day", cards)).output;
  const model = async (m: { content: string }[]) => {
    seen.push(text(m));
    if (/Explicit/.test(text(m))) throw new Error("refused");
    return JSON.stringify(lite);
  };
  const r = await runTask("cards.day", { ...cards, adult: on }, { model, log: (task) => logged.push(task) });
  assert.equal(r.source, "model");
  assert.equal(seen.length, 2);
  assert.match(seen[1]!, /Fade to black/);
  assert.deepEqual(logged, ["cards.day"]);
  const dead = await runTask(
    "cards.day",
    { ...cards, adult: on },
    {
      model: async () => {
        throw new Error("blocked");
      },
    },
  );
  assert.equal(dead.source, "lite");
});

const week = (s: Run, n: number) => {
  for (let i = 0; i < n; i++) core.adultSeeds(s);
  return Object.values(s.threads).filter((t) => t.layer === "adult");
};

test("affairs open only with the module on, and a faithful person never strays", () => {
  const off = core.newRun(kit, 5);
  assert.equal(week(off, 200).length, 0);
  const s = core.newRun(kit, 5);
  core.setAdult(s, { on: true, confirm: true });
  for (const p of Object.values(s.people)) p.traits = ["faithful"];
  assert.equal(week(s, 200).length, 0);
  Object.values(s.people)[0]!.traits = ["flirty"];
  const found = week(s, 200);
  assert.ok(found.length >= 1 && found.length <= 2);
  assert.equal(found[0]!.people[0], Object.keys(s.people)[0]);
});

test("watch and agree need the cuckolding theme; stop closes the thread", () => {
  const s = core.newRun(kit, 5);
  core.setAdult(s, { on: true, confirm: true });
  const [a, b] = Object.keys(s.people);
  const t = openStory(s, "mystery", {
    title: "x",
    need: "people",
    people: [a!, b!],
    stakes: "affair",
    origin: "block",
  });
  t.layer = "adult";
  assert.throws(() => core.affairChoice(s, t.id, "watch"), /cuckolding/);
  core.setAdult(s, { on: true, themes: ["cuckold"] });
  core.affairChoice(s, t.id, "agree");
  assert.ok(!s.threads[t.id]);
  assert.ok(s.people[a!]!.romance! >= 10);
});

test("people take their traits from the place kit, and a faithful person never strays", () => {
  const place = structuredClone(kit);
  for (const p of place.people) p.traits = ["faithful"];
  const s = core.newRun(kit, 5, place);
  assert.ok(Object.values(s.people).every((p) => p.traits.join() === "faithful"));
  core.setAdult(s, { on: true, confirm: true });
  assert.equal(week(s, 200).length, 0);
});

test("switching the module off drops its open threads", () => {
  const s = core.newRun(kit, 5);
  core.setAdult(s, { on: true, confirm: true });
  assert.ok(week(s, 200).length >= 1);
  core.setAdult(s, { on: false });
  assert.equal(week(s, 0).length, 0);
  assert.equal(s.closed.at(-1)?.state, "dropped");
});
