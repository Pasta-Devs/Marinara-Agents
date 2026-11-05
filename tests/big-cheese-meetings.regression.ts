import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilityDocumentRecord, CapabilityDocumentStore } from "@marinara-engine/shared";
import { createGame } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/game.js";
import { createMeetings } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/meetings.js";
import { createRunStore } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/store.js";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { support } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/meetings.js";

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

test("score sign: trust above 50 is for, below 50 is against, 50 is open", () => {
  const s = core.newRun(core.HAFENKAI, 1);
  s.people.henrike!.trust = 70;
  s.people.tomasz!.trust = 30;
  s.people.mira!.trust = 50;
  assert.equal(support(s, "henrike", 0), 4);
  assert.equal(support(s, "tomasz", 0), -4);
  assert.equal(support(s, "mira", 0), 0);
  assert.equal(support(s, "mira", 3, -2, 3), 4); // fit, faction and the evidence bonus add up
});

test("a vote needs more than half above 0; an agreement passes at a total of 0", () => {
  assert.equal(core.passes("vote", [1, 1, -1]), true);
  assert.equal(core.passes("vote", [1, -1]), false);
  assert.equal(core.passes("vote", [1, 1, 0, 0]), false);
  assert.equal(core.passes("agreement", [2, -2]), true);
  assert.equal(core.passes("agreement", [2, -3]), false);
});

async function start() {
  const store = createRunStore(fakeDocuments());
  const game = createGame(store, () => Promise.resolve(undefined));
  const { run } = await game.create("hafenkai", true);
  const open = async (change: (g: core.Run) => void = () => {}) => {
    const cur = await store.get(run.id);
    await store.update(run.id, cur.revision, (r) => {
      const g = structuredClone(r.game);
      g.clock.hoursLeft = 4; // the day has started: a meeting cannot be called before it
      change(g);
      return { ...r, scene: null, game: g };
    });
    return store.get(run.id);
  };
  const meetings = createMeetings(store, () => Promise.resolve(undefined));
  return { store, game, meetings, open, id: run.id };
}

test("a meeting: 1 hour, 4-6 attendees, 2-3 items, each answered by one of 3 stances", async () => {
  const { game, meetings, open, id } = await start();
  const cur = await open();
  const hours = cur.game.clock.hoursLeft;
  const view = (await meetings.start(id, { expectedRevision: cur.revision, kind: "board" })) as { run: any };
  const m = view.run.game.meeting;
  assert.equal(view.run.game.clock.hoursLeft, hours - 1);
  const ended: any = await game.dayEnd(id, { expectedRevision: view.run.revision }).catch((e) => e);
  assert.equal(ended.code, "wrong-phase", "the day cannot end while a meeting is open");
  assert.ok(m.people.length >= 4 && m.people.length <= 6);
  assert.ok(m.items.length >= 2 && m.items.length <= 3);
  assert.equal(m.items[0].suggestions.length, 3);
  assert.equal(m.items[1].suggestions.length, 0, "later items wait for their turn");
  let cur2 = view.run;
  for (let i = 0; i < m.items.length; i++) {
    const item = cur2.game.meeting.items.find((x: any) => x.chosen === undefined);
    const bad: any = await meetings.choose(id, { expectedRevision: cur2.revision, stance: "nope" }).catch((e) => e);
    assert.equal(bad.code, "bad-request");
    const next: any = await meetings.choose(id, {
      expectedRevision: cur2.revision,
      stance: item.suggestions[0].stance,
    });
    cur2 = next.run;
    const done = cur2.game.meeting.items.find((x: any) => x.id === item.id);
    assert.equal(Object.keys(done.scores).length, m.people.length);
  }
  assert.equal(cur2.game.meeting.done, true);
  const late: any = await meetings.choose(id, { expectedRevision: cur2.revision, stance: "invest" }).catch((e) => e);
  assert.equal(late.code, "wrong-phase");
});

test("the deputy challenge is the first board item; answerCard only fills the ambition", async () => {
  const { meetings, open, id } = await start();
  const cur = await open((g) => {
    g.deputyAmbition = 100;
  });
  const bad: any = await meetings.start(id, { expectedRevision: cur.revision, kind: "senate" }).catch((e) => e);
  assert.equal(bad.code, "bad-request", "a manager cannot call a senate");
  const v: any = await meetings.start(id, { expectedRevision: cur.revision, kind: "board" });
  const first = v.run.game.meeting.items[0];
  assert.equal(first.deputy, true);
  const next: any = await meetings.choose(id, {
    expectedRevision: v.run.revision,
    stance: first.suggestions[0].stance,
  });
  assert.equal(next.run.game.deputyAmbition, 0);
});
