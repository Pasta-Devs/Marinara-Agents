import assert from "node:assert/strict";
import { DAY, hhmm } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/clock.ts";
import {
  askSummary,
  bannedWords,
  checkBeat,
  runBeats,
  usageRow,
  type BeatRun,
  type Gate,
  type World,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/beats.ts";
import type { Seed } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/deck.ts";
import { planLife } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/routine.ts";
import { runCircleNow } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/scheduler.ts";
import {
  configureMeanwhileRuntime,
  defaultCircle,
  readMeanwhile,
  updateMeanwhile,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/store.ts";

const T0 = Date.UTC(2026, 0, 5); // a Monday
const DAY0 = "2026-01-05";
const circle = { ...defaultCircle("k", T0), castIds: ["x", "y"], bigKindsAllowed: ["job loss"], connectionId: "m" };
const seed = (n: number, kind: string, cast: string[], place: string, time: string): Seed => ({
  id: `k:${DAY0}:${n}`,
  circleId: "k",
  day: DAY0,
  kind,
  cast,
  place,
  time,
  status: "dealt",
});
const seeds = [seed(0, "friends", ["x", "y"], "cafe", "18:00"), seed(1, "job loss", ["x"], "work", "10:00")];
const world = (over: Partial<World> = {}): World => ({
  circle,
  cast: { x: { name: "Lily", about: "shy" }, y: { name: "Mia", about: "" } },
  schedules: {},
  tags: [],
  chatTruth: {},
  promises: [],
  personas: ["Sam"],
  events: [],
  now: T0,
  ...over,
});
const beat = (over: Record<string, unknown> = {}) => ({
  seed: "s1",
  start: "18:10",
  end: "19:30",
  text: "Lily and Mia talk over coffee.",
  diary: { "0": "I told Mia.", "1": "Finally." },
  hook: { "0": "Mia is leaving" },
  ...over,
});
const check = (over: Record<string, unknown> = {}, c: Partial<Parameters<typeof checkBeat>[1]> = {}) =>
  checkBeat(beat(over), {
    circle,
    day: DAY0,
    labels: new Map([
      ["s1", seeds[0]!],
      ["s2", seeds[1]!],
    ]),
    used: new Set<string>(),
    kinds: new Set(["friends", "job loss"]),
    chatTruth: {},
    banned: bannedWords(["Sam"], ["Lily", "Mia"]),
    bannedHook: bannedWords(["Sam"], ["Lily", "Mia"], false),
    now: T0,
    toMs: T0 + 2 * DAY,
    ...c,
  });

/** A gate that plays back replies. An Error reply is a provider error. */
function fakeGate(replies: unknown[], limit = 10): Gate & { sent: { content: string }[][] } {
  const usage = usageRow([], "k", T0);
  const sent: { content: string }[][] = [];
  return {
    usage,
    sent,
    left: () => limit - usage.calls,
    async complete(messages) {
      usage.calls += 1;
      sent.push(messages);
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      return reply ?? null;
    },
  };
}

async function main() {
  // Checks: a good beat, and each way a beat is rejected.
  const good = check();
  assert.ok(typeof good !== "string");
  if (typeof good !== "string") {
    assert.equal(good.event.weight, "notable");
    assert.equal(good.event.status, "accepted");
    assert.deepEqual(good.event.hook, { x: "Mia is leaving" });
    assert.deepEqual(good.event.diary, { x: "I told Mia.", y: "Finally." });
  }
  const major = check({ seed: "s2", start: "10:05", end: "10:30", diary: undefined, hook: undefined });
  assert.ok(typeof major !== "string");
  if (typeof major !== "string") assert.deepEqual([major.event.weight, major.event.status], ["major", "proposed"]); // weight comes from the seed
  for (const [label, over] of [
    ["wrong seed", { seed: "s9" }],
    ["out-of-range cast", { diary: { "7": "x" } }],
    ["cast not in the seed", { seed: "s2", start: "10:00", end: "10:30", diary: { "1": "x" } }],
    ["time far from the seed", { start: "21:00", end: "22:00" }],
    ["end before start", { end: "18:00" }],
    ["bad time", { start: "6pm" }],
    ["too long", { text: "x".repeat(141) }],
    ["persona name", { text: "Sam waves at Lily." }],
    ["second person", { text: "Lily thinks of you." }],
    ["user macro", { text: "Lily texts {{user}}." }],
  ] as const) {
    assert.equal(typeof check(over), "string", label);
  }
  // The {{user}} macro is banned without any persona name, and names that end in a non-ASCII letter match.
  assert.equal(typeof check({ text: "Mira texts {{user}}." }, { banned: bannedWords([], ["Lily", "Mia"]) }), "string");
  assert.equal(typeof check({ text: "Lily met Zoë." }, { banned: bannedWords(["Zoë"], ["Lily"]) }), "string");
  assert.ok(typeof check({ text: "Lily met Zoëtrope." }, { banned: bannedWords(["Zoë"], ["Lily"]) }) !== "string");
  // Diary lines are checked like text; a hook may say "you" but not name the persona; a beat must end before now.
  assert.equal(typeof check({ diary: { "0": "I told Sam." } }), "string");
  assert.ok(typeof check({ hook: { "0": "Wants to show you a cat" } }) !== "string");
  assert.equal(typeof check({ hook: { "0": "Wants to tell Sam" } }), "string");
  assert.equal(typeof check({}, { toMs: T0 + 19 * 3600_000 }), "string");
  // A beat inside the time span of a chat is rejected: 18:10 is before the chat message at 19:00.
  assert.equal(typeof check({}, { chatTruth: { x: T0 + 19 * 3600_000 } }), "string");
  assert.ok(typeof check({}, { chatTruth: { x: T0 + 18 * 3600_000 } }) !== "string");
  assert.equal(typeof check({}, { used: new Set(["s1"]) }), "string"); // a seed is used once
  assert.equal(typeof check({}, { kinds: new Set(["work"]) }), "string");

  // Bad JSON, a wrong seed and a long text: one retry, then the good beat stays.
  const first = {
    beats: [beat(), beat({ seed: "s9" }), beat({ seed: "s2", start: "10:00", end: "10:30", text: "x".repeat(141) })],
  };
  const gate = fakeGate([first, null]);
  const run: BeatRun = { events: [], done: [], stoppedAt: null };
  await runBeats(run, world(), gate, [DAY0], seeds, T0 + DAY);
  assert.equal(gate.usage.calls, 2);
  assert.deepEqual(
    run.events.map((e) => e.seedId),
    [`k:${DAY0}:0`],
  );
  assert.deepEqual(run.done, [DAY0]);
  const retry = gate.sent[1]!.at(-1)!.content;
  assert.ok(retry.includes("Unknown seed s9") && retry.includes("s2"));
  // The user's persona name is in the prompt only as a rule: the cast lines carry the cast.
  assert.ok(gate.sent[0]!.some((m) => m.content.includes("0: Lily, shy")));

  // No beat passes: the day stays routine. Budget at zero: stop before the call, keep the day open.
  const none = fakeGate([null, null]);
  const empty: BeatRun = { events: [], done: [], stoppedAt: null };
  await runBeats(empty, world(), none, [DAY0], seeds, T0 + DAY);
  assert.deepEqual([empty.events.length, empty.done.length, none.usage.calls], [0, 1, 2]);
  const broke = fakeGate([], 0);
  const stopped: BeatRun = { events: [], done: [], stoppedAt: null };
  await runBeats(stopped, world(), broke, [DAY0], seeds, T0 + DAY);
  assert.deepEqual([stopped.stoppedAt, stopped.done.length, broke.usage.calls], [DAY0, 0, 0]);
  // A provider error throws and keeps what the earlier days did.
  const failing: BeatRun = { events: [], done: [], stoppedAt: null };
  await assert.rejects(
    runBeats(failing, world(), fakeGate([new Error("timeout")]), [DAY0], seeds, T0 + DAY),
    /timeout/,
  );
  assert.equal(failing.done.length, 0);

  // One hook per character per day: the earlier beat keeps it.
  const two = fakeGate([
    {
      beats: [
        beat({ seed: "s2", start: "10:00", end: "10:30", diary: undefined, hook: { "0": "lost my job" } }),
        beat({ hook: { "0": "second hook", "1": "Mia's hook" } }),
      ],
    },
  ]);
  const hooks: BeatRun = { events: [], done: [], stoppedAt: null };
  await runBeats(hooks, world(), two, [DAY0], seeds, T0 + DAY);
  assert.deepEqual(
    hooks.events.map((e) => e.hook),
    [{ x: "lost my job" }, { y: "Mia's hook" }],
  );

  // A character with a waiting major event gets no new seeds.
  const sched = { days: { Monday: [{ time: "09:00-10:00", activity: "coffee", status: "online" }] } };
  const plan = (holdIds?: Set<string>) =>
    planLife({
      circle: {
        id: "k",
        castIds: ["x", "y"],
        clock: { timezone: "UTC" },
        pace: "cozy",
        allowedKinds: ["friends"],
        bigKindsAllowed: [],
      },
      window: { from: new Date(T0).toISOString(), to: new Date(T0 + 12 * 3600_000).toISOString(), summary: null },
      schedules: { x: sched, y: sched },
      chatTruth: {},
      tags: [],
      seeds: [],
      haveIds: new Set<string>(),
      now: T0,
      dealtDays: new Set<string>(),
      holdIds,
    });
  assert.ok(plan().seeds.some((s) => s.cast.includes("x")));
  assert.ok(plan(new Set(["x"])).seeds.every((s) => !s.cast.includes("x")));
  assert.ok(plan(new Set(["x"])).events.some((e) => e.cast[0] === "x" && e.weight === "routine")); // routine goes on

  // A long-absence summary gets its text (cut to 280) and per-character diary; a bad reply keeps the placeholder.
  const summary = {
    id: "s:k",
    circleId: "k",
    start: new Date(T0).toISOString(),
    end: new Date(T0 + 9 * DAY).toISOString(),
    createdAt: T0,
    cast: ["x", "y"],
    kind: "summary",
    weight: "summary" as const,
    text: "Time passed.",
    source: "summary" as const,
    status: "accepted" as const,
    visibility: "circle",
  };
  await askSummary(
    world(),
    fakeGate([{ text: "y".repeat(400), diary: { "0": "A quiet stretch.", "5": "dropped" } }]),
    summary,
  );
  assert.equal(summary.text.length, 280);
  assert.deepEqual((summary as { diary?: unknown }).diary, { x: "A quiet stretch." });
  const kept = { ...summary, text: "Time passed." };
  await askSummary(world(), fakeGate([null]), kept);
  assert.equal(kept.text, "Time passed.");

  await schedulerCases();
  console.log("meanwhile beats tests passed");
}

/** Whole runs with a fake model: the budget stops the pass and the mark stays on the first unbeaten day. */
async function schedulerCases() {
  const card = {
    data: {
      extensions: {
        conversationSchedule: {
          days: Object.fromEntries(
            ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => [
              d,
              [{ time: "09:00-10:00", activity: "coffee", status: "online" }],
            ]),
          ),
        },
      },
    },
  };
  let calls = 0;
  let broken = false;
  let onRead: (() => Promise<void>) | null = null;
  const docs = new Map<string, any>();
  configureMeanwhileRuntime({
    logger: { warn: () => undefined },
    json: { parseJsonish: (raw: string) => JSON.parse(raw) },
    languageModels: {
      resolve: async () => ({
        chatComplete: async (messages: { content: string }[]) => {
          calls += 1;
          if (broken) throw new Error("provider down");
          // Answers every seed line of the beat prompt with a beat at the seed time.
          const lines = messages
            .at(-1)!
            .content.split("\n")
            .filter((l) => l.startsWith('{"seed"'));
          const beats = lines.map((l) => {
            const s = JSON.parse(l) as { seed: string; time: string };
            const m = Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3)) + 30;
            return {
              seed: s.seed,
              start: s.time,
              end: hhmm(m),
              text: "They met up.",
              hook: { [String(JSON.parse(l).cast[0])]: "met up" },
            };
          });
          return { content: JSON.stringify({ beats }), usage: { promptTokens: 10, completionTokens: 5 } };
        },
      }),
    },
    resources: {
      listCharacters: async () => (
        await onRead?.(),
        [
          { id: "x", data: card },
          { id: "y", data: card },
        ]
      ),
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
  const real0 = Date.UTC(2026, 0, 8, 2); // Thursday 02:00: Monday to Wednesday are over
  const q = {
    ...defaultCircle("q", T0),
    castIds: ["x", "y"],
    connectionId: "m",
    budgetCallsPerDay: 3,
    clock: {
      anchorCircle: new Date(T0).toISOString(),
      anchorReal: real0 - 3 * DAY - 2 * 3600_000,
      speed: 1,
      timezone: "UTC",
    },
    lastRunCircle: new Date(T0 + 3 * 3600_000).toISOString(), // inside the last 3 days: no summary
  };
  await updateMeanwhile((d) => ({ ...d, circles: [q] }));

  // The model is down: routine is stored, the failure is counted, the mark stays.
  broken = true;
  assert.ok(await runCircleNow("q", real0));
  let doc = await readMeanwhile();
  assert.equal(doc.marks[0]!.failures, 1);
  assert.match(doc.marks[0]!.lastError ?? "", /provider down/);
  assert.equal(doc.circles[0]!.lastRunCircle, q.lastRunCircle);
  assert.ok(doc.events.some((e) => e.weight === "routine"));
  broken = false;
  calls = 0;

  // Budget 3, one call already spent on the failure: Monday and Tuesday are beaten, Wednesday waits and the mark stops at its start.
  assert.ok(await runCircleNow("q", real0 + 50 * 60_000));
  doc = await readMeanwhile();
  assert.equal(calls, 2);
  assert.deepEqual(doc.beatDays.sort(), ["q:2026-01-05", "q:2026-01-06"]);
  assert.equal(doc.circles[0]!.lastRunCircle, new Date(T0 + 2 * DAY).toISOString());
  assert.equal(usageRow(doc.usage, "q", real0).calls, 3); // the failed call counts too
  assert.ok(doc.events.some((e) => e.weight === "notable" && e.source === "generated"));
  assert.equal(doc.marks[0]!.failures, 0);

  // Same real day: nothing new is asked.
  calls = 0;
  await runCircleNow("q", real0 + 3600_000);
  assert.equal(calls, 0);
  assert.equal((await readMeanwhile()).circles[0]!.lastRunCircle, new Date(T0 + 2 * DAY).toISOString());

  // Next real day: the budget is new, Wednesday and Thursday are beaten.
  await runCircleNow("q", real0 + DAY);
  doc = await readMeanwhile();
  assert.ok(calls >= 1 && calls <= 3); // a day with no seeds needs no call
  assert.equal(doc.beatDays.length, 4);
  assert.equal(doc.circles[0]!.lastRunCircle, new Date(T0 + 4 * DAY + 2 * 3600_000).toISOString());

  // Same day: Monday 23:00 is past the last seed time plus 90 minutes, so today gets its one call and is marked done.
  const real1 = Date.UTC(2026, 0, 12, 23);
  const clock = {
    anchorCircle: new Date(T0 + 23 * 3600_000).toISOString(),
    anchorReal: real1,
    speed: 1,
    timezone: "UTC",
  };
  const same = {
    ...defaultCircle("t", T0),
    castIds: ["x", "y"],
    connectionId: "m",
    budgetCallsPerDay: 6,
    clock,
    lastRunCircle: new Date(T0 + 3 * 3600_000).toISOString(),
  };
  await updateMeanwhile((d) => ({ ...d, circles: [...d.circles, same, { ...same, id: "u" }] }));
  calls = 0;
  await runCircleNow("t", real1);
  doc = await readMeanwhile();
  assert.ok(calls >= 1);
  assert.deepEqual(
    doc.beatDays.filter((k) => k.startsWith("t:")),
    ["t:2026-01-05"],
  );
  assert.ok(doc.events.some((e) => e.circleId === "t" && e.weight === "notable"));
  // At 10:00 the last seed (09:00) plus 90 minutes is not over yet: no call.
  const noon = { ...clock, anchorCircle: new Date(T0 + 10 * 3600_000).toISOString() };
  await updateMeanwhile((d) => ({ ...d, circles: d.circles.map((c) => (c.id === "u" ? { ...c, clock: noon } : c)) }));
  calls = 0;
  await runCircleNow("u", real1);
  assert.equal(calls, 0);

  // A stale result is dropped, but the calls it made stay counted.
  await updateMeanwhile((d) => ({
    ...d,
    circles: d.circles.map((c) => (c.id === "u" ? { ...c, clock, lastRunCircle: same.lastRunCircle } : c)),
  }));
  onRead = async () => {
    onRead = null;
    await updateMeanwhile((d) => ({
      ...d,
      circles: d.circles.map((c) => (c.id === "u" ? { ...c, clock: { ...c.clock, speed: 24 } } : c)),
    }));
  };
  await runCircleNow("u", real1);
  doc = await readMeanwhile();
  assert.ok(calls >= 1);
  assert.equal(usageRow(doc.usage, "u", real1).calls, calls);
  assert.equal(doc.circles.find((c) => c.id === "u")!.lastRunCircle, same.lastRunCircle);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
