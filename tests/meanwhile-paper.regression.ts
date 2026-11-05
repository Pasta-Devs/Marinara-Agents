import assert from "node:assert/strict";
import { DAY, lastWeek } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/clock.ts";
import {
  askPaper,
  bannedWords,
  usageRow,
  type Gate,
  type World,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/beats.ts";
import { meanwhileRoutes } from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/routes.ts";
import {
  previewFastForward,
  runCircleNow,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/scheduler.ts";
import {
  configureMeanwhileRuntime,
  defaultCircle,
  readMeanwhile,
  updateMeanwhile,
  type LifeEvent,
} from "../packages/meanwhile/src/engine/packages/server/src/services/meanwhile/store.ts";

// Monday 2026-01-12, 02:00 UTC: the week of Jan 5 is over.
const REAL = Date.UTC(2026, 0, 12, 2);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const card = {
  data: {
    extensions: {
      conversationSchedule: {
        days: Object.fromEntries(DAYS.map((d) => [d, [{ time: "09:00-10:00", activity: "coffee", status: "online" }]])),
      },
    },
  },
};
const good = {
  title: "The Harbour Post",
  items: [
    { headline: "Coffee at nine", text: "Lily and Mia met for coffee." },
    { headline: "A quiet week", text: "Nothing else happened." },
  ],
};

const docs = new Map<string, any>();
const paperCalls: { content: string }[][] = [];
let otherCalls = 0;
let replies: unknown[] = [];
configureMeanwhileRuntime({
  logger: { warn: () => undefined },
  json: { parseJsonish: (raw: string) => JSON.parse(raw) },
  languageModels: {
    resolve: async () => ({
      chatComplete: async (messages: { content: string }[]) => {
        if (messages[0]!.content.includes("weekly paper")) {
          paperCalls.push(messages);
          return { content: JSON.stringify(replies.shift()), usage: {} };
        }
        otherCalls++;
        return { content: "{}", usage: {} };
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

const ev = (id: string, circleId: string, day: string, over: Partial<LifeEvent> = {}): LifeEvent => ({
  id,
  circleId,
  start: `${day}T10:00:00.000Z`,
  end: `${day}T11:00:00.000Z`,
  createdAt: REAL,
  cast: ["x", "y"],
  kind: "friends",
  weight: "notable",
  text: `Lily and Mia did ${id}.`,
  source: "generated",
  status: "accepted",
  visibility: "circle",
  ...over,
});

async function addCircle(id: string, events: LifeEvent[], usageCalls = 0) {
  const c = {
    ...defaultCircle(id, REAL),
    castIds: ["x", "y"],
    connectionId: "m",
    // Circle now = REAL, 90 minutes after the last run: no Circle day ends, so no beat call is made.
    clock: { anchorCircle: new Date(REAL).toISOString(), anchorReal: REAL, speed: 1, timezone: "UTC" },
    lastRunCircle: new Date(REAL - 90 * 60_000).toISOString(),
  };
  const usage = usageCalls
    ? [{ realDay: "2026-01-12", circleId: id, calls: usageCalls, promptTokens: 0, outputTokens: 0 }]
    : [];
  await updateMeanwhile((d) => ({
    ...d,
    circles: [...d.circles, c],
    events: [...d.events, ...events],
    usage: [...d.usage, ...usage],
  }));
}

const fakeGate = (replies: unknown[]): Gate & { calls: number } => {
  const usage = usageRow([], "k", REAL);
  const g = {
    usage,
    calls: 0,
    left: () => 10 - usage.calls,
    async complete() {
      usage.calls++;
      g.calls++;
      return replies.shift();
    },
  };
  return g;
};

async function main() {
  // Week boundary: Monday 00:00 in the Circle's own zone.
  const sunNoonUtc = Date.UTC(2026, 0, 11, 12);
  assert.deepEqual(lastWeek(sunNoonUtc, "UTC"), { start: "2025-12-29", end: "2026-01-05" });
  assert.deepEqual(lastWeek(sunNoonUtc, "Pacific/Auckland"), { start: "2026-01-05", end: "2026-01-12" });
  assert.deepEqual(lastWeek(REAL, "UTC"), { start: "2026-01-05", end: "2026-01-12" });

  // askPaper: bad JSON twice -> no paper; persona name -> one retry; wrong item count -> retry.
  const world = {
    circle: { ...defaultCircle("k", REAL), castIds: ["x", "y"] },
    cast: { x: { name: "Lily", about: "" }, y: { name: "Mia", about: "" } },
    personas: ["Sam"],
    events: [],
  } as unknown as World;
  const week = { start: "2026-01-05", end: "2026-01-12" };
  const some = [ev("a", "k", "2026-01-06")];
  const g1 = fakeGate([null, "nope"]);
  assert.equal(await askPaper(world, g1, week, some), null);
  assert.equal(g1.calls, 2);
  const named = { ...good, items: [{ headline: "Sam waves", text: "Sam waved." }, good.items[1]] };
  const g2 = fakeGate([named, { ...good, items: [good.items[0]] }, good]);
  assert.equal(await askPaper(world, g2, week, some), null);
  assert.equal(g2.calls, 2);
  const g3 = fakeGate([{ title: "x".repeat(81), items: good.items }, good]);
  assert.deepEqual(await askPaper(world, g3, week, some), good);
  assert.ok(bannedWords(["Sam"], ["Lily"], false).test("Sam"));

  // Newest finished week, two qualifying events: one call, one paper, then never again.
  replies = [good];
  await addCircle("p", [
    ev("e1", "p", "2026-01-06"),
    ev("e2", "p", "2026-01-08", { weight: "major" }),
    ev("r", "p", "2026-01-07", { weight: "routine" }),
    ev("sp", "p", "2026-01-07", { kind: "spicy" }),
    ev("hid", "p", "2026-01-07", { visibility: "chat:a" }),
    ev("pr", "p", "2026-01-07", { status: "proposed" }),
    ev("old", "p", "2025-12-30"),
  ]);
  assert.ok(await runCircleNow("p", REAL));
  let doc = await readMeanwhile();
  assert.equal(paperCalls.length, 1);
  assert.deepEqual(
    doc.papers.map((p) => [p.circleId, p.weekStart, p.title]),
    [["p", "2026-01-05", "The Harbour Post"]],
  );
  assert.deepEqual([...doc.papers[0]!.eventIds].sort(), ["e1", "e2"]);
  assert.ok(doc.paperWeeks.includes("p:2026-01-05"));
  assert.equal(usageRow(doc.usage, "p", REAL).calls, paperCalls.length + otherCalls);
  assert.ok(!paperCalls[0]!.some((m) => m.content.includes("did sp.") || m.content.includes("did hid.")));
  await runCircleNow("p", REAL + 60_000);
  assert.equal(paperCalls.length, 1);

  // Fewer than 2 events: no call, marked done.
  const before = paperCalls.length;
  await addCircle("q", [ev("only", "q", "2026-01-06")]);
  await runCircleNow("q", REAL);
  doc = await readMeanwhile();
  assert.equal(paperCalls.length, before);
  assert.ok(doc.paperWeeks.includes("q:2026-01-05") && !doc.papers.some((p) => p.circleId === "q"));

  // Budget used up: no call and not marked done. The next real day makes it.
  await addCircle("r", [ev("r1", "r", "2026-01-06"), ev("r2", "r", "2026-01-07")], 12);
  await runCircleNow("r", REAL);
  doc = await readMeanwhile();
  assert.equal(paperCalls.length, before);
  assert.ok(!doc.paperWeeks.includes("r:2026-01-05"));
  replies = [good];
  await runCircleNow("r", REAL + DAY);
  doc = await readMeanwhile();
  assert.equal(paperCalls.length, before + 1);
  assert.ok(doc.paperWeeks.includes("r:2026-01-05") && doc.papers.some((p) => p.circleId === "r"));
  // The fast forward preview counts the paper call (at most 1) until the week is done.
  const withDone = (await previewFastForward("p", DAY, REAL))!.calls;
  const saved = (await readMeanwhile()).paperWeeks;
  await updateMeanwhile((d) => ({ ...d, paperWeeks: [] }));
  assert.equal((await previewFastForward("p", DAY, REAL))!.calls, withDone + 1);
  await updateMeanwhile((d) => ({ ...d, paperWeeks: saved }));

  // One call left and the reply is bad: no budget for the retry, so the week is NOT marked done and the next day makes it.
  await addCircle("u", [ev("u1", "u", "2026-01-06"), ev("u2", "u", "2026-01-07")], 11);
  const left1 = paperCalls.length;
  replies = [null];
  await runCircleNow("u", REAL);
  doc = await readMeanwhile();
  assert.equal(paperCalls.length, left1 + 1);
  assert.ok(!doc.paperWeeks.includes("u:2026-01-05") && !doc.papers.some((p) => p.circleId === "u"));
  replies = [good];
  await runCircleNow("u", REAL + DAY);
  doc = await readMeanwhile();
  assert.ok(doc.paperWeeks.includes("u:2026-01-05") && doc.papers.some((p) => p.circleId === "u"));

  // Old week keys of the Circle are pruned; other Circles keep theirs.
  await addCircle("v", []);
  await updateMeanwhile((d) => ({ ...d, paperWeeks: [...d.paperWeeks, "v:2025-10-06", "zz:2025-10-06"] }));
  await runCircleNow("v", REAL);
  doc = await readMeanwhile();
  assert.ok(doc.paperWeeks.includes("v:2026-01-05") && !doc.paperWeeks.includes("v:2025-10-06"));
  assert.ok(doc.paperWeeks.includes("zz:2025-10-06"));

  // Bad JSON: one retry, then no paper, and the week is marked done so it is not retried forever.
  replies = [null, null];
  const bad = paperCalls.length;
  await addCircle("s", [ev("s1", "s", "2026-01-06"), ev("s2", "s", "2026-01-07")]);
  await runCircleNow("s", REAL);
  doc = await readMeanwhile();
  assert.equal(paperCalls.length, bad + 2);
  assert.ok(doc.paperWeeks.includes("s:2026-01-05") && !doc.papers.some((p) => p.circleId === "s"));

  // Route: newest first; a vetoed event hides the paper; a stale one too.
  const handlers = new Map<string, (request: any, reply: any) => Promise<any>>();
  const app: any = {};
  for (const method of ["get", "post", "patch", "delete"])
    app[method] = (path: string, handler: any) => handlers.set(`${method.toUpperCase()} ${path}`, handler);
  await meanwhileRoutes(app, {});
  const reply = { code: (status: number) => ({ send: (body: unknown) => ({ status, body }) }) };
  const papers = async (id: string) =>
    (await handlers.get("GET /circles/:id/papers")!({ params: { id } }, reply)) as { papers: { weekStart: string }[] };
  await updateMeanwhile((d) => ({
    ...d,
    papers: [
      ...d.papers,
      { ...d.papers.find((p) => p.circleId === "p")!, id: "p:2025-12-29", weekStart: "2025-12-29", eventIds: [] },
    ],
  }));
  assert.deepEqual(
    (await papers("p")).papers.map((p) => p.weekStart),
    ["2026-01-05", "2025-12-29"],
  );
  for (const status of ["vetoed", "stale"] as const) {
    await updateMeanwhile((d) => ({ ...d, events: d.events.map((e) => (e.id === "e1" ? { ...e, status } : e)) }));
    assert.deepEqual(
      (await papers("p")).papers.map((p) => p.weekStart),
      ["2025-12-29"],
    );
    await updateMeanwhile((d) => ({
      ...d,
      events: d.events.map((e) => (e.id === "e1" ? { ...e, status: "accepted" } : e)),
    }));
  }
  assert.equal((await papers("p")).papers.length, 2);

  console.log("meanwhile paper tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
