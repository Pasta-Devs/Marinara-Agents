import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adoptForgeChapterVersion,
  confirmForgeChapterReset,
  forgeChapterCurrent,
  forgeChapterRequest,
  wireForgeChapterRegeneration,
} from "../packages/gacha-forge/src/chapter-regeneration-client.mjs";
import { forgeChapterResetEnglish } from "../packages/gacha-forge/src/chapter-regeneration-en.mjs";
import { stopForgeStoryRequests } from "../packages/gacha-forge/src/story-cancel-client.mjs";

globalThis.forgeChapterResetEnglish = forgeChapterResetEnglish;
globalThis.stopForgeStoryRequests = stopForgeStoryRequests;

function client(reply = async () => ({ ok: true, storyRevision: 1 })) {
  const request = { runId: "r", chapter: 2, storyRevision: 0, asking: true, pending: false };
  const requests = [],
    loads = [],
    events = [];
  const host = {
    _root: { querySelector: () => null },
    _run: { runId: "r" },
    _hudView: "chapter",
    _plan: { nodes: Array.from({ length: 10 }, () => ({ type: "story" })) },
    _planChapter: 2,
    _planState: "idle",
    _chapterProgress: { normal: 3 },
    _bondUnit: "",
    _bondPart: 1,
    _forgeChapterReset: request,
    _planCache: new Map([
      ["r|1", "completed"],
      ["r|2", "old"],
    ]),
    _preforgeAsked: new Set(["r:1", "r:2"]),
    _stopPreforgeWatch() {
      events.push("stop preforge");
    },
    _clearBeat() {
      events.push("stop beat/audio");
    },
    _renderBrowser() {
      events.push("render");
    },
    _loadChapterPlan() {
      loads.push({ revision: this._forgeStoryRevision, plan: this._plan });
    },
    async _postJson(path, body) {
      requests.push({ path, body });
      return reply(path, body);
    },
  };
  return { host, request, requests, loads, events };
}

test("story versions are confined to the route allowlist and preserve an already captured version", () => {
  const { host } = client();
  host._forgeChapterVersions = new Map([["r", 4]]);
  const body = { runId: "r", bannerId: "b" };
  assert.equal(forgeChapterRequest(host, "/banner/animation", body), body);
  assert.equal(forgeChapterRequest(host, "/chat/send", body), body);
  assert.deepEqual(forgeChapterRequest(host, "/beat/mark", { runId: "r", chapter: 2 }), {
    runId: "r",
    chapter: 2,
    storyRevision: 4,
  });
  assert.equal(forgeChapterRequest(host, "/beat/mark", { runId: "r", chapter: 2, storyRevision: 2 }).storyRevision, 2);
  adoptForgeChapterVersion(host, "/chapter-plan", { runId: "r" }, { storyRevision: 1 });
  assert.equal(host._forgeChapterVersions.get("r"), 4);
});

test("a reset requires the explicit displayed confirmation and ignores a second pending click", async () => {
  const { host, request, requests } = client();
  request.asking = false;
  await confirmForgeChapterReset(host, request);
  assert.deepEqual(requests, []);
  request.asking = true;
  request.pending = true;
  await confirmForgeChapterReset(host, request);
  assert.deepEqual(requests, []);
});

test("confirmed reset clears only selected caches and starts fresh generation after the server response", async () => {
  const gate = Promise.withResolvers(),
    { host, request, requests, loads, events } = client(() => gate.promise);
  const pending = confirmForgeChapterReset(host, request);
  assert.equal(request.pending, true);
  assert.equal(host._planCache.get("r|2"), "old", "keep the displayed plan until transactional success");
  assert.deepEqual(loads, []);
  assert.deepEqual(events.slice(0, 2), ["stop preforge", "stop beat/audio"]);
  assert.deepEqual(requests, [{ path: "/chapter/regenerate", body: { runId: "r", chapter: 2, storyRevision: 0 } }]);
  gate.resolve({ ok: true, storyRevision: 1 });
  await pending;
  assert.equal(host._planCache.has("r|2"), false);
  assert.equal(host._planCache.get("r|1"), "completed");
  assert.deepEqual([...host._preforgeAsked], ["r:1"]);
  assert.equal(host._chapterProgress.normal, 0);
  assert.deepEqual(loads, [{ revision: 1, plan: null }]);
  assert.equal(host._forgeChapterVersions.get("r"), 1);
});

test("failed reset preserves the original plan/progress and offers an honest recoverable message", async () => {
  const { host, request, loads } = client(async () => ({ ok: false, error: "chapter-completed" }));
  const old = host._plan;
  await confirmForgeChapterReset(host, request);
  assert.equal(host._plan, old);
  assert.equal(host._planCache.get("r|2"), "old");
  assert.equal(host._chapterProgress.normal, 3);
  assert.equal(request.error, forgeChapterResetEnglish["chapter.reset.completed"]);
  assert.deepEqual(loads, []);
});

test("a late reset response cannot clear another chapter or world", async () => {
  const gate = Promise.withResolvers(),
    { host, request, loads } = client(() => gate.promise);
  const pending = confirmForgeChapterReset(host, request);
  const another = { nodes: [{ type: "story" }], title: "Another world" };
  host._run = { runId: "other" };
  host._plan = another;
  gate.resolve({ ok: true, storyRevision: 1 });
  await pending;
  assert.equal(host._plan, another);
  assert.equal(host._planCache.get("r|2"), "old");
  assert.deepEqual(loads, []);
});

test("completed ordinary chapters and Character Stories have no reset action", () => {
  const { host } = client();
  let removed = 0;
  host._root.querySelector = () => ({
    remove() {
      removed++;
    },
  });
  host._chapterProgress.normal = 10;
  wireForgeChapterRegeneration(host);
  assert.equal(removed, 1);
  host._bondUnit = "r:unit:arden";
  host._plan = { storyNodes: [{}, {}, {}] };
  host._chapterProgress.normal = 3;
  wireForgeChapterRegeneration(host);
  assert.equal(removed, 2);
});

test("pending completion callbacks lose authority after local reset or target change", () => {
  const { host } = client();
  const beforeReset = forgeChapterCurrent(host);
  assert.equal(beforeReset(), true);
  stopForgeStoryRequests(host);
  assert.equal(beforeReset(), false);
  const beforeNavigation = forgeChapterCurrent(host);
  host._planChapter = 3;
  assert.equal(beforeNavigation(), false);
});
