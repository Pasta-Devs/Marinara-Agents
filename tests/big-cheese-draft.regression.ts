// T3: the wish becomes a kit draft. The model's answer is canned; the code must validate and apply it.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ModelCall } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/ai/tasks.js";
import { createDraft } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/draft.js";
import { normalizeKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/normalize.js";
import type { PlaceKit } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/types.js";

const KINDS = ["work", "social", "outside", "private", "hidden"];
const rooms = (n: number, tag = "r") =>
  Array.from({ length: n }, (_, i) => ({
    id: `${tag}${i}`,
    name: `Room ${tag}${i}`,
    kind: KINDS[i % 3],
    text: "A room.",
  }));
const people = (n: number, tag = "p") =>
  Array.from({ length: n }, (_, i) => ({
    id: `${tag}${i}`,
    name: `Name ${tag}${i}`,
    role: `Role ${i}`,
    deputy: i === 0,
    traits: ["strict"],
  }));

const draftJson = (nRooms: number, nPeople: number, tag = "") =>
  JSON.stringify({
    name: `School${tag}`,
    premise: "A school on a cliff.",
    bossTitle: "Head",
    family: "university",
    meters: { money: "Budget", output: "Grades", people: "Mood", standing: "Name" },
    rooms: rooms(nRooms, `r${tag}`),
    people: people(nPeople, `p${tag}`),
    roles: [{ id: "tutor", name: "Tutor", about: "Teaches." }],
    groups: [
      { id: "g1", name: "Board", spokesperson: `p${tag}1`, text: "They vote." },
      { id: "g2", name: "Ghost", spokesperson: "nobody", text: "x" },
    ],
    relations: [
      { a: `p${tag}1`, b: `p${tag}2`, kind: "rival", level: 40 },
      { a: `p${tag}1`, b: "nobody", kind: "friend", level: 40 },
    ],
    traditions: [{ id: "t1", tag: "habit", text: "Tea at four." }],
    surprises: ["A storm hits {place}."],
    crisisDeck: [{ id: "c1", name: "Leak", text: "The roof leaks.", meters: ["money"], stances: ["invest", "delay"] }],
    hearing: { body: "The trustees", ending: "Sacked" },
  });

const peopleJson = (ids: string[], roomIds: string[]) =>
  JSON.stringify({
    people: ids.map((id) => ({
      id,
      core: "Plain core.",
      ambition: "Wants the job.",
      secret: "Hides a debt.",
      voice: { style: "dry", phrases: ["Fine.", "Sure.", "Later."] },
      routine: { morning: roomIds[0], midday: "nowhere", afternoon: roomIds[1], evening: roomIds[2], night: "home" },
    })),
  });

/** A model that answers by task and records every call. */
function fakeModel(draft: (n: number) => string | Error) {
  const calls: { task: string; text: string }[] = [];
  let drafts = 0;
  const model: ModelCall = async (messages) => {
    const text = messages[1]!.content;
    if (text.includes('Shape: {"people":[{"id":"","core"')) {
      calls.push({ task: "people", text });
      const ids = [...text.matchAll(/^- ([a-z0-9-]+): .*, /gm)].map((m) => m[1]!);
      const roomIds = [...text.matchAll(/^- ([a-z0-9-]+): .* \((?:work|social|outside|private|hidden)\)$/gm)].map(
        (m) => m[1]!,
      );
      return peopleJson(ids, roomIds);
    }
    calls.push({ task: "draft", text });
    const out = draft(drafts++);
    if (out instanceof Error) throw out;
    return out;
  };
  return { model, calls };
}

const make = (m?: ModelCall) => createDraft(async () => m);
const consistent = (k: PlaceKit) => {
  const ids = new Set(k.people.map((p) => p.id));
  const roomIds = new Set([...k.rooms.map((r) => r.id), "home"]);
  for (const p of k.people) for (const r of Object.values(p.routine)) assert.ok(roomIds.has(r), `${p.id} routine ${r}`);
  for (const g of k.groups) assert.ok(!g.spokesperson || ids.has(g.spokesperson));
  for (const r of k.relations) assert.ok(ids.has(r.a) && ids.has(r.b));
  for (const m of k.meetings) assert.ok(m.attendees === "all" || ids.has(m.attendees));
  for (const id of k.hearing.members) assert.ok(ids.has(id));
  for (const t of k.openingThreads) for (const id of t.people) assert.ok(ids.has(id));
  for (const l of k.guidedLetters) assert.ok(ids.has(l.person));
  assert.ok(normalizeKit(structuredClone(k)).ok);
};

test("a canned draft normalizes to a valid kit and drops bad references", async () => {
  const { model, calls } = fakeModel(() => draftJson(8, 8));
  const r = await make(model).make({ wish: "A school on a cliff", size: "small" });
  assert.equal(r.kit.name, "School");
  assert.equal(r.kit.rooms.length, 8);
  assert.equal(r.kit.people.length, 8);
  assert.equal(r.kit.roles?.[0]?.name, "Tutor"); // the roles come from the model
  assert.equal(r.kit.groups.length, 1); // the group with an unknown spokesperson is dropped
  assert.equal(r.kit.relations.length, 1);
  assert.equal(r.kit.people[1]!.secret, "Hides a debt.");
  assert.equal(r.kit.people[1]!.routine.midday, "r3"); // "nowhere" goes to a work room
  assert.ok(r.kit.meters.money!.start >= 35 && r.kit.meters.money!.start <= 70);
  assert.equal(r.lite, false);
  assert.equal(calls.length, 2);
  consistent(r.kit);
  assert.equal(r.view.name, "School");
});

test("a part reroll keeps the other parts", async () => {
  const first = await make(fakeModel(() => draftJson(8, 8)).model).make({ wish: "x", size: "small" });
  const kit = first.kit;
  const roomsOnly = JSON.stringify({ rooms: rooms(7, "n") });
  const peopleOnly = JSON.stringify({ people: people(8, "q"), groups: [], relations: [] });
  const nameOnly = JSON.stringify({ name: "Other", premise: "Another premise.", bossTitle: "Boss" });
  const reroll = (part: string, answer: string) =>
    make(fakeModel(() => answer).model).make({ wish: "x", size: "small", part, kit });

  const a = await reroll("rooms", roomsOnly);
  assert.deepEqual(
    a.kit.people.map((p) => p.id),
    kit.people.map((p) => p.id),
  );
  assert.equal(a.kit.name, kit.name);
  assert.deepEqual(
    a.kit.rooms.map((r) => r.id),
    ["n0", "n1", "n2", "n3", "n4", "n5", "n6"],
  );
  assert.equal(a.kit.id, kit.id);
  consistent(a.kit);

  const b = await reroll("people", peopleOnly);
  assert.deepEqual(b.kit.rooms, kit.rooms);
  assert.equal(b.kit.name, kit.name);
  assert.equal(b.kit.people[0]!.id, "q0");
  consistent(b.kit);

  const c = await reroll("name", nameOnly);
  assert.equal(c.kit.name, "Other");
  assert.deepEqual(c.kit.people, kit.people);
  assert.deepEqual(c.kit.rooms, kit.rooms);
});

test("Lite mode fills the family's built-in kit", async () => {
  const r = await make().make({ wish: "a lighthouse school on a cliff", size: "small" });
  assert.equal(r.lite, true);
  assert.equal(r.kit.people.length, 8);
  assert.ok(r.kit.people.some((p) => p.deputy));
  assert.equal(r.kit.premise, "a lighthouse school on a cliff");
  consistent(r.kit);
  const again = await make().make({ wish: "x", part: "people", kit: r.kit });
  assert.deepEqual(again.kit.people, r.kit.people); // a Lite reroll changes nothing
});

test("a refused draft gets one fix-up retry with the reasons", async () => {
  const { model, calls } = fakeModel((n) => (n === 0 ? draftJson(2, 8) : draftJson(7, 8)));
  const r = await make(model).make({ wish: "x", size: "small" });
  assert.equal(r.kit.rooms.length, 7);
  const drafts = calls.filter((c) => c.task === "draft");
  assert.equal(drafts.length, 2);
  assert.ok(!drafts[0]!.text.includes("last answer was refused"));
  assert.match(drafts[1]!.text, /last answer was refused: .*at least/);
  assert.equal(r.lite, false);
  consistent(r.kit);
});

test("a model that keeps failing ends on the built-in kit", async () => {
  const bad = fakeModel(() => "not json");
  const r = await make(bad.model).make({ wish: "x", size: "medium" });
  assert.equal(r.lite, true);
  consistent(r.kit);
  const poor = fakeModel(() => draftJson(2, 3));
  const s = await make(poor.model).make({ wish: "x", size: "medium" });
  assert.equal(poor.calls.filter((c) => c.task === "draft").length, 2); // one retry, not a loop
  assert.equal(s.lite, true);
  consistent(s.kit);
});

test("a large draft stays inside the token budget and survives missing people", async () => {
  const { model, calls } = fakeModel(() => draftJson(10, 16));
  const r = await make(model).make({ wish: "x", size: "large" });
  assert.equal(r.kit.people.length, 16);
  assert.ok(calls[0]!.text.length < 2500, `draft prompt is ${calls[0]!.text.length} characters`);
  // The people call answers for 3 of 16: the rest get plain values, the draft still works.
  const partial: ModelCall = async (messages) =>
    messages[1]!.content.includes('Shape: {"people":[{"id":"","core"')
      ? peopleJson(["p0", "p1", "p2"], ["r0", "r1", "r2"])
      : draftJson(10, 16);
  const s = await make(partial).make({ wish: "x", size: "large" });
  assert.equal(s.kit.people.length, 16);
  assert.equal(s.lite, false);
  consistent(s.kit);
});

test("bad input is refused", async () => {
  await assert.rejects(make().make({ size: "huge" }), { statusCode: 400 });
  await assert.rejects(make().make({ part: "rooms" }), { statusCode: 400 }); // a reroll needs the draft
  await assert.rejects(make().make({ wish: "x", size: "small", part: "rooms" }), { statusCode: 400 });
  await assert.rejects(make().make({ part: "rooms", kit: { __proto__: 1, constructor: 2 } }), { statusCode: 400 });
});
