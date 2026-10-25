import assert from "node:assert/strict";
import {
  createForgeSeasonalEvents,
  forgeSeasonalEnabled,
  normalizeForgeSeasonalOverview,
} from "../packages/gacha-forge/src/seasonal-events-server.mjs";
import {
  forgeAddCalendarDays,
  forgeTimeZoneRoutes,
  forgeWallDate,
} from "../packages/gacha-forge/src/time-zone-server.mjs";

const runId = "season-proof",
  packageId = "gacha-forge";
const nodes = Array.from({ length: 10 }, (_, index) => ({
  type: [2, 4, 7].includes(index) ? "combat" : "story",
  title: `Node ${index + 1}`,
}));
const brief = {
  title: "The Lantern Crossing",
  theme: "A winter river festival about keeping promises.",
  premise: "Friends prepare the crossing.",
  cast: [`${runId}:unit:arden`],
  rewards: { funds: 5000, aether: 320, insight: 6 },
  special: "character",
};
function fixture({ enabled = true } = {}) {
  const docs = new Map();
  const put = (id, kind, data) =>
    docs.set(id, { id, packageId, kind, data: structuredClone(data), revision: 1, name: id, description: "fixture" });
  put("index", "index", {
    runs: [{ runId, scenario: "The lighthouse coast", story: enabled ? { seasonalEvents: true } : {} }],
  });
  put(`${runId}:session`, "session", { progress: { 1: { normal: 10 } }, wallet: { funds: 0, aether: 0 } });
  put(`${runId}:chapter:1`, "chapter-plan", { title: "Completed main canon", nodes });
  let time = Date.parse("2026-10-20T10:00:00Z"),
    overviewCalls = 0,
    planCalls = 0,
    grants = 0,
    mediaCalls = 0;
  const documents = {
    getById: async (_id, id) => structuredClone(docs.get(id) || null),
    list: async (_id, kind) => structuredClone([...docs.values()].filter((doc) => doc.kind === kind)),
    create: async (row) => {
      if (docs.has(row.id)) return null;
      const value = { ...structuredClone(row), revision: 1 };
      docs.set(row.id, value);
      return structuredClone(value);
    },
    update: async (row) => {
      const doc = docs.get(row.id);
      if (!doc || doc.revision !== row.expectedRevision) return null;
      const value = { ...doc, ...structuredClone(row), revision: doc.revision + 1 };
      delete value.expectedRevision;
      docs.set(row.id, value);
      return structuredClone(value);
    },
  };
  let transactionTail = Promise.resolve(),
    generatePlan;
  const persistence = {
    documents,
    transaction: (operation) => {
      const task = transactionTail.then(async () => {
        const before = structuredClone(docs);
        try {
          return await operation({ documents });
        } catch (error) {
          docs.clear();
          for (const [id, row] of before) docs.set(id, row);
          throw error;
        }
      });
      transactionTail = task.catch(() => {});
      return task;
    },
  };
  const readRun = async () => structuredClone(docs.get("index").data.runs[0]);
  const session = () => docs.get(`${runId}:session`).data;
  const service = createForgeSeasonalEvents({
    packageId,
    persistence,
    readRun,
    readSession: async () => structuredClone(session()),
    cast: async () => [{ id: `${runId}:unit:arden`, name: "Arden", rarity: 4 }],
    addCalendarDays: forgeAddCalendarDays,
    localDate: (stamp) => forgeWallDate(stamp).toISOString().slice(0, 10),
    generateOverview: async () => {
      overviewCalls++;
      return { ok: true, value: structuredClone(brief) };
    },
    generatePlan: async () => {
      planCalls++;
      return generatePlan ? generatePlan() : { ok: true, plan: { title: "A crossing with friends", nodes } };
    },
    prepareMedia: async () => {
      mediaCalls++;
      return {};
    },
    grantReward: async ({ data, reward }) => {
      grants++;
      data.wallet[reward.kind] = (data.wallet[reward.kind] || 0) + reward.qty;
      return [{ ...reward }];
    },
    allNodes: (plan) => plan?.nodes || [],
    readBeat: async (_run, chapter, index) => docs.get(`${runId}:beat:${chapter}:${index}`)?.data,
    choices: { guard: async () => null, completeGuard: async () => null },
    battle: async () => ({ ok: true }),
    replayBattle: (_fight, log) => (log?.valid ? "win" : "lose"),
    spendVigor: (data) => {
      data.wallet.vigor = (data.wallet.vigor || 20) - 2;
      return { ok: true, spent: 2, wallet: data.wallet };
    },
    onComplete: () => {},
    now: () => time,
  });
  const body = { runId, chapter: "event-1" };
  const seedBeats = () => {
    for (let index = 0; index < 7; index++)
      put(`${runId}:beat:event-1:${index}`, "beat", {
        chapter: "event-1",
        storyIndex: index,
        segments: [{ text: `Played event canon ${index}` }],
      });
  };
  return {
    docs,
    put,
    service,
    session,
    body,
    seedBeats,
    readRun,
    setTime: (value) => {
      time = value;
    },
    time: () => time,
    setPlan: (work) => {
      generatePlan = work;
    },
    counts: () => ({ overviewCalls, planCalls, grants, mediaCalls }),
  };
}

assert.equal(forgeSeasonalEnabled({}), false, "Old worlds must opt in");
assert.equal(
  normalizeForgeSeasonalOverview({ ...brief, rewards: { funds: 1e30, aether: -3, insight: 1000 } }, []).rewards[0].qty,
  20000,
);
assert.equal(
  normalizeForgeSeasonalOverview({ ...brief, cast: ["outside-world"] }, [{ id: "known", name: "Known" }]).cast[0],
  "known",
);

{
  const f = fixture({ enabled: false });
  assert.equal((await f.service.list({ runId })).enabled, false);
  assert.deepEqual(f.counts(), { overviewCalls: 0, planCalls: 0, grants: 0, mediaCalls: 0 });
  assert.equal([...f.docs.values()].filter((row) => row.kind === "story-event").length, 0);
}
{
  const f = fixture();
  let route;
  forgeTimeZoneRoutes({
    post: (_path, handler) => {
      route = handler;
    },
  }).post("/events", (request) => f.service.list(request.body));
  await Promise.all([
    route({ body: { runId, timeZone: "Europe/Warsaw" } }),
    route({ body: { runId, timeZone: "Europe/Warsaw" } }),
  ]);
  const row = f.docs.get(`${runId}:story-event:1`).data;
  assert.equal(
    row.endsAt - row.startedAt,
    (21 * 24 + 1) * 60 * 60 * 1000,
    "A DST change must preserve 21 local calendar days",
  );
  assert.deepEqual(
    f.counts(),
    { overviewCalls: 1, planCalls: 0, grants: 0, mediaCalls: 1 },
    "Detailed story is deferred until opt-in",
  );
  assert.equal((await f.service.plan(f.body)).ok, true);
  assert.equal(f.counts().planCalls, 1);
  assert.equal((await f.service.plan(f.body)).cached, true);
}
{
  const f = fixture();
  f.put(`${runId}:chapter:2`, "chapter-plan", { title: "Ongoing main chapter", nodes });
  await f.service.list({ runId });
  assert.equal((await f.service.plan(f.body)).error, "event-needs-chapter-boundary");
  assert.equal(f.counts().planCalls, 0);
}
{
  const f = fixture();
  await f.service.list({ runId });
  let entered, release;
  const started = new Promise((resolve) => {
      entered = resolve;
    }),
    paused = new Promise((resolve) => {
      release = resolve;
    });
  f.setPlan(async () => {
    entered();
    await paused;
    return { ok: true, plan: { nodes, title: "Stale event plan" } };
  });
  const opening = f.service.plan(f.body);
  await started;
  f.put(`${runId}:chapter:2`, "chapter-plan", { title: "Concurrent new main chapter", nodes });
  release();
  assert.equal((await opening).error, "event-needs-chapter-boundary");
  assert.equal(
    f.docs.has(`${runId}:chapter:event-1`),
    false,
    "An old provider result must not cross a changed boundary",
  );
}
{
  const f = fixture();
  await f.service.list({ runId });
  await f.service.plan(f.body);
  f.docs.get("index").data.runs[0].story.seasonalEvents = false;
  assert.equal((await f.service.guardNode({ ...f.body, storyIndex: 0 }, "story", "storyIndex")).error, "events-off");
  assert.equal((await f.service.startStory({ ...f.body, storyIndex: 0 })).error, "events-off");
  f.session().progress["event-1"] = { normal: 1 };
  f.seedBeats();
  assert.equal((await f.service.guardNode({ ...f.body, storyIndex: 0 }, "story", "storyIndex")).replay, true);
  assert.equal((await f.service.list({ runId })).events[0].played, 1, "Turning off preserves played history");
}
{
  const f = fixture();
  await f.service.list({ runId });
  await f.service.plan(f.body);
  const first = await f.service.startStory({ ...f.body, storyIndex: 0 }),
    second = await f.service.startStory({ ...f.body, storyIndex: 0 });
  assert.equal(first.spent, 2);
  assert.equal(second.spent, 0, "An interrupted generation does not repeatedly charge this scene");
  assert.equal(f.session().wallet.vigor, 18);
}
{
  const f = fixture();
  await f.service.list({ runId });
  await f.service.plan(f.body);
  f.seedBeats();
  assert.equal((await f.service.complete({ ...f.body, nodeIndex: 1 })).error, "event-node-locked");
  await f.service.complete({ ...f.body, nodeIndex: 0 });
  await f.service.complete({ ...f.body, nodeIndex: 1 });
  assert.equal(
    (await f.service.complete({ ...f.body, nodeIndex: 2, log: { valid: true } })).error,
    "battle-not-started",
  );
  f.session().combatPending = { chapter: "event-1", nodeIndex: 2, fight: { seed: 1 } };
  assert.equal((await f.service.complete({ ...f.body, nodeIndex: 2, log: { valid: false } })).error, "lost");
  assert.equal(f.session().progress["event-1"].normal, 2);
  const results = await Promise.all([
    f.service.complete({ ...f.body, nodeIndex: 2, log: { valid: true } }),
    f.service.complete({ ...f.body, nodeIndex: 2, log: { valid: true } }),
  ]);
  assert.ok(results.every((result) => result.ok));
  assert.equal(f.session().wallet.funds, 5000);
  assert.equal(f.counts().grants, 1);
  assert.equal(f.session().progress["event-1"].normal, 3);
}
{
  const f = fixture();
  await f.service.list({ runId });
  await f.service.plan(f.body);
  f.seedBeats();
  await f.service.complete({ ...f.body, nodeIndex: 0 });
  const expiry = f.docs.get(`${runId}:story-event:1`).data.endsAt;
  f.setTime(expiry);
  assert.equal((await f.service.complete({ ...f.body, nodeIndex: 1 })).error, "event-expired");
  assert.equal((await f.service.guardNode({ ...f.body, storyIndex: 0 }, "story", "storyIndex")).replay, true);
  assert.equal((await f.service.guardNode({ ...f.body, storyIndex: 1 }, "story", "storyIndex")).error, "event-expired");
  f.setTime(expiry + 90 * 86400000);
  const state = await f.service.list({ runId });
  assert.equal(f.counts().overviewCalls, 2, "Offline gaps create only one new current overview");
  assert.equal(state.events.find((event) => event.seq === 1).archived, true);
  assert.equal(state.events.find((event) => event.seq === 1).played, 1);
  assert.equal(state.events.find((event) => event.seq === 2).live, true);
}
console.log(
  "Seasonal story event windows, deferred generation, boundary races, opt-out, replay, rewards and expiry regressions passed.",
);
