import assert from "node:assert/strict";
import { test } from "node:test";
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
import { forgeCreateChoiceRuntime } from "../packages/gacha-forge/src/player-choices-server.mjs";
import { createForgeBannerAnimations } from "../packages/gacha-forge/src/animation-server.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
    documents,
    persistence,
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

const choicesFor = (f) =>
  forgeCreateChoiceRuntime({
    documents: f.documents,
    packageId,
    readSession: async () => ({ data: structuredClone(f.session()) }),
    readRun: f.readRun,
    beatId: (run, chapter, index) => `${run}:beat:${chapter}:${index}`,
    planId: (run, chapter) => `${run}:chapter:${chapter}`,
    storyNodes: (plan) => (plan?.nodes || []).filter((node) => node.type === "story"),
    allNodes: (plan) => plan?.nodes || [],
    bondHistory: () => [],
    resolveChapter: (body) => body.chapter,
    choiceChapterActive: (run, chapter) => f.service.choiceActive(run, chapter),
  });

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
  const state = await f.service.list({ runId });
  assert.equal(state.enabled, false);
  assert.equal(state.serverNow, f.time(), "Event expiry reconciliation uses the authoritative clock");
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
for (const inactive of ["expiry", "opt-out"]) {
  const f = fixture();
  await f.service.list({ runId });
  await f.service.plan(f.body);
  f.session().progress["event-1"] = { normal: 9 };
  f.put(`${runId}:beat:event-1:6`, "beat", {
    chapter: "event-1",
    storyIndex: 6,
    segments: [{ text: "Choose the festival's final promise." }],
    choices: [
      {
        id: "final",
        kind: "big",
        at: 0,
        options: [
          {
            id: "accept",
            text: "Keep the promise.",
            selection: { kind: "dialogue", text: "I will keep the promise." },
            segments: [],
          },
          {
            id: "decline",
            text: "Decline gently.",
            selection: { kind: "dialogue", text: "I cannot promise that." },
            segments: [],
          },
        ],
      },
    ],
    choiceCanon: {},
  });
  const choices = choicesFor(f);
  assert.equal(
    (await choices.planGuard(runId, 2)).error,
    "choice-required",
    "Live event big choices retain their authority",
  );
  if (inactive === "expiry") f.setTime(f.docs.get(`${runId}:story-event:1`).data.endsAt);
  else f.docs.get("index").data.runs[0].story.seasonalEvents = false;
  assert.equal(await f.service.guardMain(runId, 2), null);
  assert.equal(await choices.planGuard(runId, 2), null, `${inactive} must release global main-story generation`);
  assert.equal(
    (await choices.guard(runId, { chapter: "event-1" })).error,
    "choice-required",
    "Chapter-scoped guards stay strict",
  );
  assert.equal(
    (await f.service.guardNode({ ...f.body, storyIndex: 6 }, "story", "storyIndex")).error,
    inactive === "expiry" ? "event-expired" : "events-off",
  );
  f.docs.get(`${runId}:beat:event-1:6`).data.choiceCanon.final = "accept";
  assert.match(
    await choices.continuity(runId, 2, 0),
    /I will keep the promise/u,
    "Previously selected event fate remains canon",
  );
}
for (const inactive of ["expiry", "opt-out"]) {
  const f = fixture();
  await f.service.list({ runId });
  await f.service.plan(f.body);
  f.session().progress["event-1"] = { normal: 2 };
  f.session().combatPending = { chapter: "event-1", nodeIndex: 2, fight: { seed: 8 } };
  const wallet = structuredClone(f.session().wallet);
  if (inactive === "expiry") f.setTime(f.docs.get(`${runId}:story-event:1`).data.endsAt);
  else f.docs.get("index").data.runs[0].story.seasonalEvents = false;
  assert.equal(
    (await f.service.complete({ ...f.body, nodeIndex: 2, log: { valid: true } })).error,
    inactive === "expiry" ? "event-expired" : "events-off",
  );
  assert.equal(f.session().combatPending, undefined, "An inaccessible event fight is retired");
  assert.deepEqual(f.session().wallet, wallet, "Retirement pays nothing");
  assert.equal(f.session().progress["event-1"].normal, 2);
  f.session().combatPending = { chapter: 2, fight: { seed: 9 } };
  assert.equal(await f.service.retireInactiveFight(runId), false);
  assert.equal(f.session().combatPending.chapter, 2, "An ordinary chapter's fight is never retired");
}
{
  const f = fixture();
  await f.service.list({ runId });
  const run = f.docs.get("index").data.runs[0];
  run.animationConnectionId = "fixture-video";
  Object.assign(f.docs.get(`${runId}:story-event:1`).data, {
    art: "fixture://poster",
    artRef: "global-gallery:event-poster",
  });
  const dataDir = await mkdtemp(join(tmpdir(), "seasonal-animation-proof-"));
  let paidCalls = 0;
  const bytes = Buffer.alloc(20);
  bytes.write("ftyp", 4, "ascii");
  const animations = createForgeBannerAnimations({
    dataDir,
    runtime: {
      logger: { warn() {} },
      integrations: {
        videos: {
          animateGalleryImage: async () => {
            paidCalls++;
            return { mimeType: "video/mp4", base64: bytes.toString("base64") };
          },
        },
      },
    },
    readBanner: (id, banner) => f.service.mediaBanner(id, banner),
  });
  try {
    assert.equal((await animations.generate({ runId, banner: "story-event-1" })).ok, true);
    assert.equal(paidCalls, 1);
    run.story.seasonalEvents = false;
    assert.equal(
      await f.service.mediaBanner(runId, "story-event-1"),
      null,
      "Disabled unplayed events cannot authorize a video",
    );
    assert.equal((await animations.generate({ runId, banner: "story-event-1" })).error, "animations-off");
    f.session().progress["event-1"] = { normal: 1 };
    assert.equal(
      (await animations.generate({ runId, banner: "story-event-1" })).cached,
      true,
      "Played archive reuses existing bytes",
    );
    assert.equal((await animations.generate({ runId, banner: "story-event-1", retry: true })).error, "animations-off");
    assert.equal(paidCalls, 1, "Opt-out cannot start a replacement paid request");
  } finally {
    animations.dispose();
    await rm(dataDir, { recursive: true, force: true });
  }
}
console.log(
  "Seasonal story event windows, deferred generation, boundary races, opt-out, replay, rewards and expiry regressions passed.",
);

// An interrupted/failed optional outfit painting cannot strand the terminal node.
{
  const f = fixture();
  await f.service.list({ runId });
  await f.service.plan(f.body);
  f.seedBeats();
  const event = f.docs.get(`${runId}:story-event:1`);
  event.data.rewards = [
    { nodeIndex: 9, kind: "outfit", qty: 1, unitId: `${runId}:unit:arden`, name: "Unprepared festival coat" },
  ];
  f.session().progress["event-1"] = { normal: 9 };
  const shown = (await f.service.list({ runId })).events[0].rewards[0];
  assert.deepEqual(shown, { nodeIndex: 9, kind: "aether", qty: 320 });
  const result = await f.service.complete({ ...f.body, nodeIndex: 9 });
  assert.equal(result.ok, true);
  assert.equal(f.session().wallet.aether, 320);
  assert.equal(f.session().progress["event-1"].normal, 10);
  assert.equal((await f.service.complete({ ...f.body, nodeIndex: 9 })).cached, true);
  assert.equal(f.session().wallet.aether, 320);
}

for (const inactive of ["expiry", "opt-out"])
  test(`played event completion remains cached after ${inactive}`, async () => {
    const f = fixture();
    await f.service.list({ runId });
    await f.service.plan(f.body);
    f.seedBeats();
    await f.service.complete({ ...f.body, nodeIndex: 0 });
    const wallet = structuredClone(f.session().wallet),
      progress = structuredClone(f.session().progress);
    if (inactive === "expiry") f.setTime(f.docs.get(`${runId}:story-event:1`).data.endsAt);
    else f.docs.get("index").data.runs[0].story.seasonalEvents = false;
    const replay = await f.service.complete({ ...f.body, nodeIndex: 0 });
    assert.equal(replay.ok, true, JSON.stringify(replay));
    assert.equal(replay.cached, true);
    assert.deepEqual(replay.gained, []);
    assert.deepEqual(f.session().wallet, wallet);
    assert.deepEqual(f.session().progress, progress);
    assert.equal(
      (await f.service.complete({ ...f.body, nodeIndex: 1 })).error,
      inactive === "expiry" ? "event-expired" : "events-off",
    );
  });

for (const inactive of ["expiry", "opt-out"])
  test(`concurrent event completion remains cached when ${inactive} happens before its transaction`, async () => {
    const f = fixture();
    await f.service.list({ runId });
    await f.service.plan(f.body);
    f.seedBeats();
    const wallet = structuredClone(f.session().wallet),
      transaction = f.persistence.transaction;
    f.persistence.transaction = (operation) =>
      transaction(async (context) => {
        f.session().progress["event-1"] = { normal: 1 };
        if (inactive === "expiry") f.setTime(f.docs.get(`${runId}:story-event:1`).data.endsAt);
        else f.docs.get("index").data.runs[0].story.seasonalEvents = false;
        return operation(context);
      });
    const result = await f.service.complete({ ...f.body, nodeIndex: 0 });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.cached, true);
    assert.deepEqual(f.session().wallet, wallet);
  });
