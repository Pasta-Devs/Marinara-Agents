import assert from "node:assert/strict";
import { DAY } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/clock.ts";
import {
  BIG_KINDS,
  dealDay,
  type DayBlock,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/deck.ts";
import {
  currentBlock,
  pickSchedule,
  placeOf,
  planLife,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/routine.ts";
import { runCircleNow } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/scheduler.ts";
import {
  configureMeanwhileRuntime,
  defaultCircle,
  readMeanwhile,
  updateMeanwhile,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/store.ts";

const block = (start: number, end: number, activity: string, place: string): DayBlock => ({
  start,
  end,
  activity,
  place,
});
const blocks = {
  a: [block(540, 660, "gym", "gym"), block(1080, 1200, "coffee", "cafe")],
  b: [block(600, 720, "gym", "gym"), block(1140, 1260, "coffee", "cafe"), block(1320, 1440, "drinks", "bar")],
  c: [block(0, 1440, "home", "home")],
};
const circle = { id: "k", pace: "dramatic", allowedKinds: ["friends", "romance"], bigKindsAllowed: [] as string[] };
const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * DAY).toISOString().slice(0, 10);

// Same input, same cards. Pairs only come from overlapping blocks away from home.
assert.deepEqual(
  dealDay({ circle, day: day(3), blocks, recent: [] }),
  dealDay({ circle, day: day(3), blocks, recent: [] }),
);
const all = Array.from({ length: 60 }, (_, n) => dealDay({ circle, day: day(n), blocks, recent: [] })).flat();
assert.ok(all.length > 100);
for (const seed of all.filter((s) => !s.id.endsWith(":w"))) {
  assert.deepEqual(seed.cast, ["a", "b"]);
  assert.ok(seed.place === "gym" || seed.place === "cafe");
  assert.equal(seed.time, seed.place === "gym" ? "10:00" : "19:00");
}
assert.ok(all.length > 0 && all.every((s) => s.status === "dealt" && s.day.startsWith("2026")));

// Cooldown: one possible meeting per kind, so a second seed the same day or within 7 days is blocked.
const one = { ...circle, allowedKinds: ["friends"] };
const first = dealDay({ circle: one, day: day(1), blocks: { a: blocks.a, b: blocks.b }, recent: [] }).filter(
  (s) => !s.id.endsWith(":w"),
);
assert.ok(first.length >= 1 && first.length <= 2); // gym and cafe are two places
const again = dealDay({ circle: one, day: day(5), blocks: { a: blocks.a, b: blocks.b }, recent: first });
assert.equal(again.filter((s) => !s.id.endsWith(":w")).length, 0);
assert.ok(dealDay({ circle: one, day: day(9), blocks: { a: blocks.a, b: blocks.b }, recent: first }).length > 0);

// Big kinds only when allowed.
const wide = Array.from({ length: 200 }, (_, n) => day(n));
const bigOff = wide.flatMap((d) => dealDay({ circle: { ...circle, allowedKinds: [] }, day: d, blocks, recent: [] }));
assert.ok(!bigOff.some((s) => BIG_KINDS.includes(s.kind)));
const bigOn = wide.flatMap((d) =>
  dealDay({ circle: { ...circle, allowedKinds: [], bigKindsAllowed: ["job loss"] }, day: d, blocks, recent: [] }),
);
assert.ok(bigOn.some((s) => s.kind === "job loss"));

// Places and schedule choice: the chat copy wins over the card copy.
assert.equal(placeOf("Morning workout"), "gym");
assert.equal(placeOf("Watching clouds"), "unknown");
const sched = (activity: string) => ({ days: { Monday: [{ time: "09:00-10:00", activity, status: "online" }] } });
assert.deepEqual(
  pickSchedule("x", [{ characterSchedules: { x: sched("chat") } }], {
    extensions: { conversationSchedule: sched("card") },
  }),
  sched("chat"),
);
assert.deepEqual(
  pickSchedule("x", [{}], JSON.stringify({ data: { extensions: { conversationSchedule: sched("card") } } })),
  sched("card"),
);
assert.equal(pickSchedule("x", [], {}), null);

// Routine is never before `from` and is not created twice.
const T0 = Date.UTC(2026, 0, 5); // a Monday
const win = { from: new Date(T0).toISOString(), to: new Date(T0 + 12 * 3600_000).toISOString(), summary: null };
const base = {
  circle: {
    id: "k",
    castIds: ["x", "y"],
    clock: { timezone: "UTC" },
    pace: "cozy",
    allowedKinds: [],
    bigKindsAllowed: [],
  },
  window: win,
  schedules: { x: sched("coffee") },
  chatTruth: { y: T0 + 8 * 3600_000 },
  tags: [],
  seeds: [],
  haveIds: new Set<string>(),
  now: T0,
  dealtDays: new Set<string>(),
};
const plan = planLife(base);
const x = plan.events.filter((e) => e.cast[0] === "x");
assert.deepEqual(
  x.map((e) => [e.text, e.place]),
  [["coffee", "cafe"]],
); // the Monday block replaces the default day
assert.deepEqual(
  plan.events.filter((e) => e.cast[0] === "y").map((e) => [e.text, e.start]),
  [["working", new Date(T0 + 8 * 3600_000).toISOString()]], // the 07:00 block in progress at 08:00 is stored, cut at 08:00
); // default day, but all its blocks start before chat truth 08:00 or after the window
assert.ok(plan.events.every((e) => Date.parse(e.start) < T0 + 12 * 3600_000));
assert.equal(planLife({ ...base, haveIds: new Set(plan.events.map((e) => e.id)) }).events.length, 0);

// A day with no seeds is marked dealt and not dealt again; a block running past midnight is found.
const solo = { ...base, circle: { ...base.circle, castIds: ["x"] }, chatTruth: {} };
const noPairs = planLife({ ...solo, circle: { ...solo.circle, allowedKinds: ["friends"] } });
assert.equal(noPairs.seeds.length, 0);
assert.ok(noPairs.dealtDays.includes("k:2026-01-05"));
assert.equal(planLife({ ...solo, dealtDays: new Set(noPairs.dealtDays) }).dealtDays.length, 0);
const night = {
  days: {
    Sunday: [{ time: "22:00-06:00", activity: "sleeping" }],
    Monday: [{ time: "09:00-10:00", activity: "coffee" }],
  },
};
const nightPlan = planLife({ ...solo, schedules: { x: night } });
assert.deepEqual(
  nightPlan.events.map((e) => [e.text, e.start]),
  [
    ["sleeping", win.from],
    ["coffee", new Date(T0 + 9 * 3600_000).toISOString()],
  ],
);

// "Now" comes from the schedule.
assert.deepEqual(currentBlock(night, T0 + 9.5 * 3600_000, "UTC"), {
  activity: "coffee",
  place: "cafe",
  until: "10:00",
  status: undefined,
  left: 30,
});
assert.deepEqual(currentBlock(night, T0 + 3 * 3600_000, "UTC"), {
  activity: "sleeping",
  place: "home",
  until: "06:00",
  status: undefined,
  left: 180,
});
assert.equal(currentBlock(night, T0 + 11 * 3600_000, "UTC"), null);

async function main() {
  // Store flow: a failed save leaves the mark alone, a good run advances it, routine keeps 14 days, long absence adds a summary.
  let failSave = true;
  let onRead: (() => Promise<void>) | null = null;
  const docs = new Map<string, any>();
  configureMeanwhileRuntime({
    // The model answers {}: no places, no summary text, no beats. The routine still runs.
    languageModels: { resolve: async () => ({ chatComplete: async () => ({ content: "{}", usage: {} }) }) },
    json: { parseJsonish: (raw: string) => JSON.parse(raw) },
    logger: { warn: () => undefined },
    resources: {
      listCharacters: async () => {
        await onRead?.();
        return [];
      },
    },
    persistence: {
      listChats: async () => [],
      documents: {
        getById: async (_p: string, id: string) => docs.get(id) ?? null,
        create: async (input: any) => (docs.set(input.id, { ...input, revision: 1 }), docs.get(input.id)),
        update: async (input: any) => {
          const doc = docs.get(input.id);
          if (
            failSave &&
            input.data.circles.some((c: any) => c.id === "p" && input.data.marks.some((m: any) => m.lastWindow))
          )
            throw new Error("disk");
          if (doc.revision !== input.expectedRevision) return null;
          docs.set(input.id, { ...doc, ...input, revision: doc.revision + 1 });
          return docs.get(input.id);
        },
      },
    },
  } as any);
  const T1 = Date.UTC(2026, 0, 20);
  const start = defaultCircle("p", T1 - 10 * DAY);
  await updateMeanwhile((d) => ({
    ...d,
    circles: [
      { ...start, castIds: ["x"], connectionId: "m" },
      { ...defaultCircle("q", T1 - 10 * DAY), clock: start.clock },
    ],
    seeds: [
      {
        id: "qs",
        circleId: "q",
        day: "2025-01-01",
        kind: "work",
        cast: [],
        place: "cafe",
        time: "10:00",
        status: "dealt" as const,
      },
    ],
    events: [
      {
        id: "qold",
        circleId: "q",
        start: new Date(T1 - 20 * DAY).toISOString(),
        end: "",
        createdAt: 0,
        cast: [],
        kind: "routine",
        weight: "routine",
        text: "",
        source: "schedule",
        status: "accepted",
        visibility: "circle",
      },
      {
        id: "old",
        circleId: "p",
        start: new Date(T1 - 20 * DAY).toISOString(),
        end: "",
        createdAt: 0,
        cast: ["x"],
        kind: "routine",
        weight: "routine",
        text: "",
        source: "schedule",
        status: "accepted",
        visibility: "circle",
      },
      {
        id: "keep",
        circleId: "p",
        start: new Date(T1 - 20 * DAY).toISOString(),
        end: "",
        createdAt: 0,
        cast: ["x"],
        kind: "work",
        weight: "notable",
        text: "",
        source: "generated",
        status: "accepted",
        visibility: "circle",
      },
    ],
  }));
  await assert.rejects(runCircleNow("p", T1), /disk/);
  let doc = await readMeanwhile();
  assert.equal(doc.circles[0]!.lastRunCircle, start.lastRunCircle);
  assert.equal(doc.events.length, 3);
  failSave = false;
  assert.ok(await runCircleNow("p", T1 + 1000)); // the failed run set a backoff mark, but the lease is free
  doc = await readMeanwhile();
  assert.equal(doc.circles[0]!.lastRunCircle, new Date(T1 + 1000).toISOString());
  assert.deepEqual(
    doc.events.filter((e) => e.weight === "summary").map((e) => e.text),
    ["Time passed."],
  );
  assert.ok(doc.events.some((e) => e.weight === "routine" && e.source === "schedule"));
  assert.ok(!doc.events.some((e) => e.id === "old"));
  assert.ok(doc.events.some((e) => e.id === "keep"));
  assert.ok(doc.seeds.length > 0 && doc.placeTags.length === 1);
  // Another Circle keeps its old routine events and seeds.
  assert.ok(doc.events.some((e) => e.id === "qold"));
  assert.ok(doc.seeds.some((s) => s.id === "qs"));
  assert.ok(doc.dealtDays.some((k) => k.startsWith("p:")));

  // A clock change during the run drops the result and frees the lease.
  const before = doc.circles[0]!.lastRunCircle;
  onRead = async () => {
    await updateMeanwhile((d) => ({
      ...d,
      circles: d.circles.map((c) => (c.id === "p" ? { ...c, clock: { ...c.clock, speed: 24 } } : c)),
    }));
  };
  assert.ok(await runCircleNow("p", T1 + 2 * DAY));
  doc = await readMeanwhile();
  assert.equal(doc.circles[0]!.lastRunCircle, before);
  assert.equal(doc.circles[0]!.clock.speed, 24);
  assert.equal(doc.marks.find((m) => m.circleId === "p")!.leaseUntil, 0);
}

main().then(() => console.log("Meanwhile deck and routine tests passed."));
