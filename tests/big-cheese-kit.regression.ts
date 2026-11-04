import assert from "node:assert/strict";
import test from "node:test";
import { HAFENKAI_PLACE as K } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import { HAFENKAI } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kit.js";
import { METERS } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/types.js";

const ids = new Set(K.people.map((p) => p.id));
const rooms = new Set(K.rooms.map((r) => r.id));
const strings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

test("size and one deputy", () => {
  assert.ok(K.people.length >= 8 && K.people.length <= 16);
  assert.equal(K.people.filter((p) => p.deputy).length, 1);
  assert.deepEqual(
    [...ids],
    HAFENKAI.people.map((p) => p.id),
  );
  assert.equal(K.rooms.length, 12);
});

test("every referenced person and room exists", () => {
  const refs = [
    ...K.guidedLetters.map((l) => l.person),
    ...K.openingThreads.flatMap((t) => t.people),
    ...K.hearing.members,
    ...K.groups.flatMap((g) => (g.spokesperson ? [g.spokesperson] : [])),
  ];
  for (const r of refs) assert.ok(ids.has(r), `unknown person ${r}`);
  for (const p of K.people) for (const r of Object.values(p.routine)) assert.ok(rooms.has(r), `unknown room ${r}`);
  assert.ok(K.people.every((p) => p.voice.phrases.length >= 2 && p.voice.phrases.length <= 3));
});

test("five letters on valid days, letter 4 opens the People file", () => {
  assert.equal(K.guidedLetters.length, 5);
  for (const l of K.guidedLetters) assert.ok(Number.isInteger(l.day) && l.day >= -1 && l.day <= 4);
  assert.equal(K.guidedLetters[3]!.screen, "people");
});

test("meter labels, start values and card templates", () => {
  for (const m of METERS) {
    assert.ok(K.meters[m].label);
    assert.equal(K.meters[m].start, HAFENKAI.meters[m]);
    for (const sev of [1, 2, 3] as const) assert.ok(K.templates.cards[m][sev].length >= 3);
  }
  for (const b of Object.values(K.templates.feeling)) assert.ok(b.length >= 3);
});

test("no empty string, none over 300 chars, no AI-speak", () => {
  for (const s of strings(K)) {
    assert.ok(s.trim() !== "" && s.length <= 300, `bad string: ${s.slice(0, 40)}`);
    assert.ok(!/—|\bno \w+, no \w+/i.test(s), `AI-speak: ${s}`);
  }
});
