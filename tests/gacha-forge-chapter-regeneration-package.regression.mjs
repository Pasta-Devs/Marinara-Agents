import assert from "node:assert/strict";
import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  chapterRunId,
  chapterUnitId,
  createChapterRuntime,
  freshMainPlan,
  freshBondPlan,
  currentCardCanon,
} from "./fixtures/gacha-forge-chapter-runtime.mjs";
import { createForgeStoryCancellation, forgeStoryWork } from "../sources/forge-kit/story-cancel-server.mjs";
import {
  adoptForgeChapterVersion,
  forgeChapterRequest,
} from "../packages/gacha-forge/src/chapter-regeneration-client.mjs";
import { forgeChapterResetEnglish } from "../packages/gacha-forge/src/chapter-regeneration-en.mjs";
import { forgeSeasonalRequest } from "../packages/gacha-forge/src/seasonal-events-client.mjs";
globalThis.forgeChapterResetEnglish = forgeChapterResetEnglish;

const source = await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8");
const start = source.indexOf('var cb="(default)"'),
  end = source.indexOf("var ks=", start);
assert(start >= 0 && end > start, "the actual package generation queue remains identifiable");
const queue = new Function("Qh", "ib", "forgeStoryWork", `${source.slice(start, end)};return{run:Fi};`)(
  AsyncLocalStorage,
  AsyncResource,
  forgeStoryWork,
);
const deferred = () => Promise.withResolvers();
const tick = () => new Promise((resolve) => setImmediate(resolve));
const enteredBeforeReturn = (entered, request) =>
  Promise.race([
    entered,
    request.then((result) => {
      throw new Error(`Expected provider entry before response: ${JSON.stringify(result)}`);
    }),
  ]);

test("actual SDK rejects positional choices and mutations from an old displayed plan until explicit reopening", async () => {
  const f = await createChapterRuntime();
  try {
    // This successful planner needs room for its canon plus the 8192-token answer floor.
    f.transport.maxContext = 262144;
    f.session().progress[2].normal = 0;
    f.docs.get("index").data.runs[0].story.choices = true;
    const oldPlan = f.docs.get(`${chapterRunId}:chapter:2`).data;
    const host = { _run: { runId: chapterRunId }, _plan: oldPlan };
    adoptForgeChapterVersion(
      host,
      "/chapter-plan",
      { runId: chapterRunId },
      { ok: true, plan: oldPlan, storyRevision: 0 },
    );
    assert.equal((await f.post("/chapter/regenerate", { chapter: 2 })).body.ok, true);
    assert.equal((await f.post("/chapter-plan", { chapter: 2, storyRevision: 1 })).body.ok, true);
    const beatId = `${chapterRunId}:beat:2:0`;
    f.seed(beatId, "beat", {
      chapter: 2,
      storyIndex: 0,
      segments: [{ text: "NEW_GENERATION_STORY" }],
      choiceCanon: {},
      choices: [
        {
          id: "choice-1",
          kind: "big",
          at: 0,
          options: [
            { id: "option-1", text: "Destroy the map.", segments: [] },
            { id: "option-2", text: "Keep the map.", segments: [] },
          ],
        },
      ],
    });
    const body = { runId: chapterRunId, chapter: 2, storyIndex: 0, choiceId: "choice-1", optionId: "option-1" };
    const first = forgeChapterRequest(host, "/choice", body);
    const rejected = await f.post("/choice", first);
    assert.equal(rejected.body.error, "story-changed");
    adoptForgeChapterVersion(host, "/choice", first, rejected.body);
    const retry = forgeChapterRequest(host, "/choice", body);
    assert.equal(retry.storyRevision, 0, "Protect the lighthouse must never silently become Destroy the map");
    assert.equal((await f.post("/choice", retry)).body.error, "story-changed");
    const vigor = f.session().wallet.vigor;
    for (const path of ["/complete", "/story/start", "/beat/mark"]) {
      const stale = forgeChapterRequest(host, path, {
        runId: chapterRunId,
        chapter: 2,
        nodeIndex: 0,
        storyIndex: 0,
        at: 7,
      });
      assert.equal(stale.storyRevision, 0);
      assert.equal((await f.post(path, stale)).body.error, "story-changed", path);
    }
    assert.deepEqual(f.docs.get(beatId).data.choiceCanon, {});
    assert.equal(f.session().wallet.vigor, vigor);
    const fresh = await f.post("/chapter-plan", { chapter: 2, storyRevision: 1 });
    adoptForgeChapterVersion(host, "/chapter-plan", { runId: chapterRunId }, fresh.body);
    host._plan = fresh.body.plan;
    const current = forgeChapterRequest(host, "/choice", body);
    assert.equal(current.storyRevision, 1);
    assert.equal((await f.post("/choice", current)).body.ok, true);
    assert.deepEqual(f.docs.get(beatId).data.choiceCanon, { "choice-1": "option-1" });
  } finally {
    await f.close();
  }
});

test("after a chapter reset, a seasonal event fight still loads with the story version its route checks", async () => {
  // _postJson versions the path it was called with, then maps an event chapter's path to its /story-event route.
  const client = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  assert.ok(client.includes("a=forgeChapterRequest(this,e,a);e=forgeSeasonalRequest(e,a);"));
  const f = await createChapterRuntime();
  try {
    assert.equal((await f.post("/chapter/regenerate", { chapter: 2 })).body.storyRevision, 1);
    f.docs.get("index").data.runs[0].story.seasonalEvents = true;
    const session = f.session();
    session.progress["event-1"] = { normal: 1 };
    session.presets = [{ name: "Team", board: { front: [chapterUnitId, null, null], back: [null, null, null] } }];
    const leader = `${chapterRunId}:unit:protagonist`;
    f.seed(leader, "unit", { ...f.docs.get(chapterUnitId).data, name: "Mari", cardId: "", isProtagonist: true });
    session.roster[leader] = { level: 1 };
    f.seed(`${chapterRunId}:story-event:1`, "story-event", {
      seq: 1,
      chapter: "event-1",
      state: "ready",
      title: "The lantern trial",
      theme: "Friends keep the coast alight.",
      premise: "A friendly festival trial.",
      cast: [chapterUnitId],
      after: 1,
      opened: Date.now(),
      endsAt: Date.now() + 86400000,
      rewards: [],
    });
    f.seed(`${chapterRunId}:chapter:event-1`, "chapter-plan", { ...freshMainPlan, chapter: "event-1", after: 1 });
    const enemy = { name: "Sentinel", role: "Warrior", affinity: "Fire", position: "front", tier: "soldier" };
    f.seed(`${chapterRunId}:combat:event-1:0`, "combat", {
      chapter: "event-1",
      combatIndex: 0,
      enemy: "Sentinel",
      tier: "soldier",
      opening: "The festival ward wakes.",
      objective: "Win the trial.",
      outcomeOnWin: "The procession continues.",
      formation: [
        {
          ...enemy,
          stats: { hp: 1, atk: 1, def: 1, spd: 1 },
          skill: { name: "Tap", effect: "damage", power: 10, target: "enemy" },
        },
      ],
    });
    const host = { _run: { runId: chapterRunId } };
    adoptForgeChapterVersion(host, "/story-events", { runId: chapterRunId }, { ok: true, storyRevision: 1 });
    // The combat screen's load, exactly as _loadBattle posts it for the event's first fight.
    const sent = { runId: chapterRunId, chapter: "event-1", combatIndex: 0, difficulty: "normal", presetIndex: null };
    const body = forgeChapterRequest(host, "/battle", sent);
    const preview = await f.post(forgeSeasonalRequest("/battle", body), body);
    assert.equal(preview.body.ok, true, JSON.stringify(preview.body));
    assert.equal(preview.body.enemies.length, 1);
    assert.equal(f.calls.length, 0, "the cached fight design is reused");
  } finally {
    await f.close();
  }
});

test("the actual detached generation queue stays in the story drain after its route returned", async (context) => {
  const runtime = createForgeStoryCancellation(),
    entered = deferred(),
    release = deferred();
  let work,
    reset,
    cleaned = false;
  context.after(async () => {
    release.resolve();
    await Promise.allSettled([work, reset].filter(Boolean));
    runtime.dispose();
  });
  await runtime.run("world", async () => {
    work = queue.run("same-provider", {}, async () => {
      entered.resolve();
      await release.promise;
    });
    void work.catch(() => {});
    return "route returned";
  });
  await enteredBeforeReturn(entered.promise, work);
  reset = runtime.reset("world", async () => {
    cleaned = true;
  });
  await tick();
  assert.equal(cleaned, false, "reset must join the real detached provider promise");
  release.resolve();
  await reset;
  await work;
  assert.equal(cleaned, true);
  runtime.dispose();
});

test("the actual queued callback preserves its old scope and skips paid work after reset", async (context) => {
  const runtime = createForgeStoryCancellation(),
    firstStarted = deferred(),
    firstRelease = deferred();
  const first = queue.run("blocked-provider", {}, async () => {
    firstStarted.resolve();
    await firstRelease.promise;
  });
  await enteredBeforeReturn(firstStarted.promise, first);
  let selected,
    reset,
    paidCalls = 0,
    cleaned = false;
  context.after(async () => {
    firstRelease.resolve();
    await Promise.allSettled([first, selected, reset].filter(Boolean));
    runtime.dispose();
  });
  await runtime.run("selected-world", async () => {
    selected = queue.run("blocked-provider", {}, async () => {
      paidCalls++;
    });
    void selected.catch(() => {});
  });
  reset = runtime.reset("selected-world", async () => {
    cleaned = true;
  });
  await tick();
  assert.equal(cleaned, false);
  firstRelease.resolve();
  await first;
  await assert.rejects(selected, { name: "AbortError" });
  await reset;
  assert.equal(paidCalls, 0);
  assert.equal(cleaned, true);
  runtime.dispose();
});

test("actual SDK reset writes a fresh main plan and retains first-clear rewards and unrelated canon", async () => {
  const f = await createChapterRuntime();
  try {
    // This successful planner needs room for its canon plus the 8192-token answer floor.
    f.transport.maxContext = 262144;
    const wallet = structuredClone(f.session().wallet),
      account = structuredClone(f.session().account);
    const completed = structuredClone(f.docs.get(`${chapterRunId}:beat:1:0`));
    const conversation = structuredClone(f.docs.get(`${chapterRunId}:chat:arden`));
    const card = structuredClone(f.docs.get(chapterUnitId));
    const reset = await f.post("/chapter/regenerate", { chapter: 2 });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.ok, true, JSON.stringify(reset));
    assert.equal(reset.body.storyRevision, 1);
    assert.equal(f.docs.has(`${chapterRunId}:chapter:2`), false);
    assert.deepEqual(f.docs.get(`${chapterRunId}:beat:1:0`), completed);
    assert.deepEqual(f.docs.get(`${chapterRunId}:chat:arden`), conversation);
    assert.deepEqual(f.docs.get(chapterUnitId), card);
    assert.deepEqual(f.session().wallet, wallet);
    assert.deepEqual(f.session().account, account);
    assert.equal(f.session().storyRewardProgress[2], 3);
    const fresh = await f.post("/chapter-plan", { chapter: 2, storyRevision: 1 });
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.ok, true, JSON.stringify(fresh));
    assert.equal(fresh.body.cached, undefined, "the existing fresh-plan response omits cached");
    assert.equal(fresh.body.plan.title, freshMainPlan.title);
    const planners = f.calls.filter((call) => call.kind !== "summary");
    assert.equal(planners.length, 1, "fresh main plan calls the controlled model once");
    assert.doesNotMatch(JSON.stringify(planners[0].body), /DISCARDED_CURRENT_ONLY/);
    assert.match(JSON.stringify(planners[0].body), /PRESERVED_COMPLETED_CANON/);
    assert.ok(JSON.stringify(planners[0].body).includes(currentCardCanon));
    assert.doesNotMatch(JSON.stringify(planners[0].body), /DISALLOWED_CARD_SCENARIO/);
    f.seed(`${chapterRunId}:beat:2:0`, "beat", {
      chapter: 2,
      storyIndex: 0,
      segments: [{ text: "A freshly written first beat." }],
    });
    const paid = structuredClone(f.session().wallet);
    const replay = await f.post("/complete", { chapter: 2, nodeIndex: 0, difficulty: "normal", storyRevision: 1 });
    assert.equal(replay.body.ok, true);
    assert.equal(replay.body.reward, null);
    assert.equal(replay.body.rank, null);
    assert.equal(f.session().wallet.funds, paid.funds);
    assert.equal(f.session().wallet.aether, paid.aether);
    f.session().progress[2].normal = 3;
    f.seed(`${chapterRunId}:beat:2:2`, "beat", {
      chapter: 2,
      storyIndex: 2,
      segments: [{ text: "The next unpaid canonical beat." }],
    });
    const advance = await f.post("/complete", { chapter: 2, nodeIndex: 3, difficulty: "normal", storyRevision: 1 });
    assert.equal(advance.body.ok, true);
    assert.ok(advance.body.reward);
    assert.ok(advance.body.rank?.gain > 0);
    const progress = structuredClone(f.session().progress);
    const stale = await f.post("/beat/mark", { chapter: 2, storyIndex: 0, at: 7, storyRevision: 0 });
    assert.equal(stale.body.error, "story-changed");
    assert.equal(f.session().reading, undefined);
    assert.deepEqual(f.session().progress, progress);
  } finally {
    await f.close();
  }
});

test("actual SDK current Character Story reset preserves completed parts and regenerates with its existing placement", async () => {
  const f = await createChapterRuntime({ bond: true });
  try {
    // This successful planner needs room for its canon plus the 8192-token answer floor.
    f.transport.maxContext = 262144;
    const chapter = "bond-arden-2",
      before = structuredClone(f.session().bondChapters[chapterUnitId]);
    const completed = structuredClone(f.docs.get(`${chapterRunId}:chapter:bond-arden`));
    const normal = structuredClone(f.docs.get(`${chapterRunId}:chapter:2`));
    const blocked = await f.post("/chapter/regenerate", { chapter: 2 });
    assert.equal(blocked.body.error, "bond-chapter-open");
    const reset = await f.post("/chapter/regenerate", { unitId: chapterUnitId, part: 2 });
    assert.equal(reset.body.ok, true, JSON.stringify(reset));
    assert.deepEqual(f.session().bondChapters[chapterUnitId], { ...before, beats2: 0 });
    assert.deepEqual(f.docs.get(`${chapterRunId}:chapter:bond-arden`), completed);
    assert.deepEqual(f.docs.get(`${chapterRunId}:chapter:2`), normal);
    const fresh = await f.post("/bond-chapter/plan", { unitId: chapterUnitId, part: 2, storyRevision: 1 });
    assert.equal(fresh.body.ok, true, JSON.stringify(fresh));
    assert.equal(fresh.body.cached, false);
    assert.equal(fresh.body.plan.title, freshBondPlan.title);
    assert.equal(f.session().bondChapters[chapterUnitId].after2, before.after2);
    const plans = f.calls.filter((call) => call.kind !== "summary");
    assert.equal(plans.length, 1);
    assert.doesNotMatch(JSON.stringify(plans[0].body), /DISCARDED_BOND_ONLY/);
    assert.ok(JSON.stringify(plans[0].body).includes(currentCardCanon));
    f.seed(`${chapterRunId}:beat:${chapter}:0`, "beat", {
      chapter,
      storyIndex: 0,
      segments: [{ text: "Fresh Character Story first beat." }],
    });
    const replay = await f.post("/bond-chapter/complete", {
      unitId: chapterUnitId,
      part: 2,
      storyIndex: 0,
      storyRevision: 1,
    });
    assert.equal(replay.body.ok, true);
    assert.equal(replay.body.reward, null);
    assert.equal(replay.body.rank, null);
    f.seed(`${chapterRunId}:beat:${chapter}:1`, "beat", {
      chapter,
      storyIndex: 1,
      segments: [{ text: "Fresh Character Story next beat." }],
    });
    const next = await f.post("/bond-chapter/complete", {
      unitId: chapterUnitId,
      part: 2,
      storyIndex: 1,
      storyRevision: 1,
    });
    assert.equal(next.body.ok, true);
    assert.ok(next.body.rank?.gain > 0);
    assert.ok(next.body.reward);
  } finally {
    await f.close();
  }
});

test("actual SDK cleanup conflict rolls back all records and completed requests make no changes", async () => {
  const f = await createChapterRuntime();
  try {
    const before = structuredClone(f.docs);
    assert.equal((await f.post("/chapter/regenerate", { chapter: 1 })).body.error, "chapter-completed");
    assert.deepEqual(f.docs, before);
    assert.equal(f.calls.length, 0);
    f.faults.removeId = `${chapterRunId}:cg:2:0`;
    const reset = await f.post("/chapter/regenerate", { chapter: 2 });
    assert.equal(reset.status, 500);
    assert.match(reset.body.error, /chapter-reset-write-conflict/);
    assert.deepEqual(f.docs, before);
  } finally {
    await f.close();
  }
});

test("actual SDK reset drains an abort-ignoring model and never restores its late beat", async () => {
  const f = await createChapterRuntime(),
    started = deferred(),
    release = deferred();
  let reset;
  try {
    f.docs.delete(`${chapterRunId}:beat:2:6`);
    // Unsummarized canon is sent in full (1.24.9 never summarizes in front of a scene), so give it room.
    f.transport.maxContext = 262144;
    f.transport.ignoreAbort = true;
    f.transport.started = started.resolve;
    f.transport.release = release.promise;
    const beat = f.post("/beat", { chapter: 2, storyIndex: 6 });
    await enteredBeforeReturn(started.promise, beat);
    let resetFinished = false;
    reset = f.post("/chapter/regenerate", { chapter: 2 }).then((result) => {
      resetFinished = true;
      return result;
    });
    await tick();
    assert.equal(resetFinished, false);
    assert.equal((await beat).body.error, "cancelled");
    assert.equal((await f.post("/beat", { chapter: 2, storyIndex: 6 })).body.error, "reset-in-progress");
    release.resolve();
    assert.equal((await reset).body.ok, true);
    assert.equal(f.docs.has(`${chapterRunId}:beat:2:6`), false);
    assert.equal(f.calls.length, 1, "cancellation must not trigger another provider attempt");
  } finally {
    release.resolve();
    await reset?.catch(() => {});
    await f.close();
  }
});
