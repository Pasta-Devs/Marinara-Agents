import assert from "node:assert/strict";
import {
  checkBeat,
  bannedWords,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/beats.ts";
import { DAY, HOUR } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/clock.ts";
import {
  placeNudges,
  type Seed,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/deck.ts";
import { planLife } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/routine.ts";
import { meanwhileRoutes } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/routes.ts";
import { runCircleNow } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/scheduler.ts";
import {
  configureMeanwhileRuntime,
  defaultCircle,
  readMeanwhile,
  updateMeanwhile,
  type Nudge,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/store.ts";

const T0 = Date.UTC(2026, 0, 5); // a Monday
const REAL0 = Date.UTC(2026, 8, 2);
const iso = (ms: number) => new Date(ms).toISOString();

const docs = new Map<string, any>();
let beatsWork = true;
const card = { data: { name: "Lily", extensions: { conversationSchedule: { days: {} } } } };
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
configureMeanwhileRuntime({
  logger: { warn: () => undefined },
  json: { parseJsonish: (raw: string) => JSON.parse(raw) },
  languageModels: {
    resolve: async () => ({
      chatComplete: async (msgs: { content: string }[]) => {
        const reply = (value: unknown) => ({
          content: JSON.stringify(value),
          usage: { promptTokens: 1, completionTokens: 1 },
        });
        if (msgs[0]!.content.startsWith("You read chat messages")) return reply({ promises: [] });
        if (msgs[0]!.content.startsWith("You summarise")) return reply({ text: "Quiet.", diary: {} });
        if (msgs[0]!.content.startsWith("Sort each")) return reply({});
        const seeds = new Map<string, { time: string }>();
        for (const l of msgs.at(-1)!.content.split("\n")) {
          if (l.startsWith('{"seed"')) {
            const s = JSON.parse(l);
            if (!seeds.has(s.seed)) seeds.set(s.seed, s);
          }
        }
        if (!beatsWork) return reply({ beats: [] });
        return reply({
          beats: [...seeds.values()].map((s: any) => {
            const m = Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3)) + 30;
            return { seed: s.seed, start: s.time, end: hhmm(m), text: "They met up." };
          }),
        });
      },
    }),
  },
  resources: {
    listCharacters: async () => [
      { id: "x", data: card },
      { id: "y", data: card },
    ],
  },
  persistence: {
    listChats: async () => [],
    documents: {
      getById: async (_p: string, id: string) => docs.get(id) ?? null,
      create: async (input: any) => (docs.set(input.id, { ...input, revision: 1 }), docs.get(input.id)),
      update: async (input: any) => {
        const doc = docs.get(input.id);
        if (doc.revision !== input.expectedRevision) return null;
        docs.set(input.id, { ...doc, ...input, revision: doc.revision + 1 });
        return docs.get(input.id);
      },
    },
  },
} as any);

const nudge = (over: Partial<Nudge> = {}): Nudge => ({
  id: "n1",
  circleId: "q",
  cast: ["x"],
  text: "Lily gets a job offer",
  kind: "friends",
  withinDays: 3,
  createdCircle: iso(T0 + HOUR),
  status: "open",
  ...over,
});
const circle = {
  ...defaultCircle("q", REAL0),
  castIds: ["x", "y"],
  connectionId: "m",
  budgetCallsPerDay: 50,
  allowedKinds: ["friends", "work"],
  bigKindsAllowed: ["job loss"],
  clock: { anchorCircle: iso(T0 + 23 * HOUR), anchorReal: REAL0, speed: 1, timezone: "UTC" },
  lastRunCircle: iso(T0),
};
const reset = async (nudges: Nudge[], extra: Record<string, unknown> = {}, c = circle) => {
  docs.clear();
  await updateMeanwhile((d) => ({ ...d, circles: [c], nudges, ...extra }));
};

async function main() {
  // Placement: deterministic, once inside the window, forced by its last day, nothing after it.
  const plan = (day: number, over: Record<string, unknown> = {}) =>
    planLife({
      circle: {
        id: "q",
        castIds: ["x", "y"],
        clock: { timezone: "UTC" },
        pace: "cozy",
        allowedKinds: ["friends"],
        bigKindsAllowed: [],
      },
      window: { from: iso(T0 + day * DAY), to: iso(T0 + day * DAY + 23 * HOUR) } as any,
      schedules: {},
      chatTruth: {},
      tags: [],
      seeds: [],
      haveIds: new Set(),
      dealtDays: new Set(),
      nudges: [nudge()],
      now: T0,
      ...over,
    }).seeds.filter((s) => s.nudgeId);
  const days = [0, 1, 2, 3].map((d) => plan(d).length);
  const first = days.indexOf(1);
  assert.ok(
    first >= 0 && first <= 2 && days.slice(first, 3).every((n) => n === 1),
    "placed from its day, forced by the last",
  );
  assert.equal(days[3], 0, "no seed after the window");
  assert.deepEqual(plan(2), plan(2), "same input, same seed");
  assert.equal(plan(2)[0]!.nudge, "Lily gets a job offer");
  assert.equal(plan(2, { holdIds: new Set(["x"]) }).length, 0, "pending big event: the nudge waits");

  // One run that deals several days places the nudge once.
  const many = planLife({
    circle: {
      id: "q",
      castIds: ["x", "y"],
      clock: { timezone: "UTC" },
      pace: "cozy",
      allowedKinds: ["friends"],
      bigKindsAllowed: [],
    },
    window: { from: iso(T0), to: iso(T0 + 3 * DAY + 23 * HOUR) } as any,
    schedules: {},
    chatTruth: {},
    tags: [],
    seeds: [],
    haveIds: new Set(),
    dealtDays: new Set(),
    nudges: [nudge()],
    now: T0,
  }).seeds.filter((s) => s.nudgeId);
  assert.equal(many.length, 1, "one seed per nudge");

  // A full day gives up a normal card; a day with room gets one more. Big kinds are never replaced.
  const card_ = (n: number, kind: string): Seed => ({
    id: `c${n}`,
    circleId: "q",
    day: "2026-01-05",
    kind,
    cast: ["x"],
    place: "cafe",
    time: "10:00",
    status: "dealt",
  });
  const input = { circleId: "q", day: "2026-01-07", pace: "cozy", nudges: [{ ...nudge(), startDay: "2026-01-05" }] };
  const full = placeNudges([card_(1, "friends"), card_(2, "work"), card_(3, "death")], input);
  assert.equal(full.length, 3);
  assert.ok(full[1]!.nudge && full[0]!.id === "c1" && full[2]!.kind === "death", "the last normal card goes");
  assert.equal(placeNudges([card_(1, "friends")], input).length, 2);

  // The beat: a nudge on a big kind is accepted, not proposed.
  const seed: Seed = { ...card_(1, "job loss"), cast: ["x"], time: "10:00", day: "2026-01-05", nudge: "x" };
  const check = (s: Seed) =>
    checkBeat({ seed: "s1", start: "10:10", end: "10:40", text: "Lily lost her job." }, {
      promiseCount: 0,
      circle: { ...circle, bigKindsAllowed: ["job loss"] },
      day: "2026-01-05",
      labels: new Map([["s1", s]]),
      used: new Set(),
      kinds: new Set(["friends", "job loss"]),
      chatTruth: {},
      banned: bannedWords([], []),
      bannedHook: bannedWords([], [], false),
      now: T0 + DAY,
      toMs: T0 + DAY,
    } as any) as any;
  assert.equal(check(seed).event.status, "accepted");
  assert.equal(check({ ...seed, nudge: undefined }).event.status, "proposed");

  // A run: used with its event; routine-only day keeps it open; past its window it expires.
  const run = async (over: Partial<Nudge>, working: boolean) => {
    beatsWork = working;
    await reset([nudge({ withinDays: 1, ...over })]);
    assert.ok(await runCircleNow("q", REAL0));
    return readMeanwhile();
  };
  let doc = await run({}, true);
  const used = doc.nudges[0]!;
  assert.equal(used.status, "used");
  assert.equal(doc.events.find((e) => e.id === used.eventId)?.status, "accepted");
  doc = await run({ withinDays: 2 }, false);
  assert.equal(doc.nudges[0]!.status, "open", "routine only: stays open");
  doc = await run({ createdCircle: iso(T0 - DAY + HOUR) }, false);
  assert.equal(doc.nudges[0]!.status, "expired", "past its window");

  doc = await run({ id: "old", status: "used", createdCircle: iso(T0 - 30 * DAY) }, true);
  assert.equal(doc.nudges.filter((n) => n.id === "old").length, 0, "old finished nudges are dropped");

  // Routes.
  const handlers = new Map<string, (request: any, reply: any) => Promise<any>>();
  const app: any = {};
  for (const method of ["get", "post", "patch", "delete"])
    app[method] = (path: string, h: any) => handlers.set(`${method.toUpperCase()} ${path}`, h);
  await meanwhileRoutes(app, {});
  async function call(method: string, url: string, body?: unknown) {
    for (const [key, h] of handlers) {
      const [m, pattern] = key.split(" ");
      const hit = m === method && new RegExp(`^${pattern!.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`).exec(url);
      if (!hit) continue;
      const reply: any = { code: (n: number) => ({ send: (b: unknown) => ({ replied: true, status: n, body: b }) }) };
      const out = await h({ params: { ...hit.groups }, body }, reply);
      return out?.replied ? out : { status: 200, body: out };
    }
    throw new Error(`no route ${method} ${url}`);
  }
  await reset([], { dealtDays: ["q:2026-01-05"] }, { ...circle, clock: { ...circle.clock, speed: 0 } });
  const lateOne = await call("POST", "/circles/q/nudges", {
    cast: ["x"],
    text: "Late",
    kind: "friends",
    withinDays: 1,
  });
  assert.equal(lateOne.body.createdCircle, "2026-01-06T00:00:00.000Z", "window starts at the first undealt day");
  await reset([]);
  const ok = { cast: ["x"], text: "Lily gets a job offer", kind: "friends", withinDays: 3 };
  for (const bad of [
    { ...ok, cast: ["zzz"] },
    { ...ok, cast: [] },
    { ...ok, text: "x".repeat(141) },
    { ...ok, text: "  " },
    { ...ok, kind: "death" },
    { ...ok, withinDays: 0 },
    { ...ok, withinDays: 8 },
  ])
    assert.equal((await call("POST", "/circles/q/nudges", bad)).status, 400);
  assert.equal((await call("POST", "/circles/nope/nudges", ok)).status, 404);
  const made = await call("POST", "/circles/q/nudges", { ...ok, withinDays: undefined, kind: "job loss" });
  assert.equal(made.body.withinDays, 7);
  for (let i = 0; i < 9; i++) assert.equal((await call("POST", "/circles/q/nudges", ok)).status, 200);
  assert.equal((await call("POST", "/circles/q/nudges", ok)).status, 409, "10 open nudges at most");
  assert.equal((await call("GET", "/circles/q/nudges")).body.nudges.length, 10);
  assert.equal((await call("DELETE", `/circles/q/nudges/${made.body.id}`)).status, 200);
  await reset([nudge({ status: "used" })]);
  assert.equal((await call("DELETE", "/circles/q/nudges/n1")).status, 409, "only open nudges go");

  console.log("meanwhile nudge tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
