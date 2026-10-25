import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  cancelForgeStoryGeneration,
  forgeStoryRequest,
  wireForgeStoryCancel,
} from "../packages/gacha-forge/src/story-cancel-client.mjs";
import { forgeStoryCancelEnglish } from "../packages/gacha-forge/src/story-cancel-en.mjs";
import { forgeUserTimeZone } from "../packages/gacha-forge/src/browser-presentation.mjs";
import {
  adoptForgeChapterVersion,
  forgeChapterCurrent,
  forgeChapterOriginCurrent,
  forgeChapterRequest,
} from "../packages/gacha-forge/src/chapter-regeneration-client.mjs";

const source = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
const method = (name, globals = {}) => {
  let start = source.search(new RegExp(`${name}\\([^)]*\\)\\{`, "u"));
  assert(start >= 0, `${name} is present in the shipped client`);
  if (source.slice(start - 6, start) === "async ") start -= 6;
  const rest = source.slice(start);
  const end = rest.search(/\}(?:async )?_[A-Za-z0-9]+\([^)]*\)\{/u);
  assert(end >= 0);
  return vm.runInNewContext(`({${rest.slice(0, end + 1)}})`, {
    forgeUserTimeZone,
    adoptForgeChapterVersion,
    forgeChapterCurrent,
    forgeChapterOriginCurrent,
    forgeChapterRequest,
    ...globals,
  })[name];
};
const deferred = () => Promise.withResolvers();
const tick = () => new Promise((resolve) => setImmediate(resolve));

// A fetch implementation that ignores abort must still lose the right to adopt its late response.
{
  const late = deferred(),
    adopted = [];
  let signal;
  const post = method("_postJson", {
    forgeStoryRequest,
    Bm: () => false,
    Ia: "/api/gacha-forge",
    refreshForgeUnitStep() {},
    Ze: (path, options) => {
      if (path.endsWith("/story/cancel")) return Promise.resolve({ json: async () => null });
      signal = options.signal;
      return late.promise;
    },
  });
  const host = {
    _run: { runId: "late-world" },
    _postJson: post,
    _adoptFromResponse: (value) => {
      if (value) adopted.push(value);
    },
    _renderBrowser() {},
    _clearBeat() {},
  };
  const pending = host._postJson("/chapter-plan", { runId: "late-world" });
  cancelForgeStoryGeneration(host);
  late.resolve({ json: async () => ({ wallet: { aether: 999 } }) });
  assert.equal(await pending, null);
  assert.equal(signal.aborted, true);
  assert.deepEqual(adopted, [], "a late cancelled fetch cannot publish wallet or state changes");
}

// Resolve an old plan after a new load begins: it must not reset the new loading state or preforge.
{
  const old = deferred(),
    fresh = deferred();
  let reads = 0,
    prewarm = 0,
    preforge = 0;
  const host = {
    _run: { runId: "plan-world" },
    _planChapter: 1,
    _bondUnit: "",
    _bondPart: 1,
    _plan: null,
    _difficulty: "normal",
    _hudView: "chapter",
    _planState: "idle",
    _renderBrowser() {},
    _clearBeat() {},
    _rememberPlan() {},
    _loadLocations() {},
    _openPrologueIfOwed() {},
    _openPostponedScene() {},
    _postJson: (path) =>
      path === "/story/cancel" ? Promise.resolve(null) : ++reads === 1 ? old.promise : fresh.promise,
    _prewarmCombats: async () => {
      prewarm++;
    },
    _preforgeCheck: async () => {
      preforge++;
    },
  };
  const load = method("_loadChapterPlan", { qa: () => 0, Ir: (difficulty) => difficulty });
  load.call(host);
  cancelForgeStoryGeneration(host);
  host._hudView = "chapter";
  load.call(host);
  old.resolve({ ok: true, plan: { title: "Old", nodes: [] } });
  await tick();
  assert.equal(host._planState, "loading", "the cancelled plan cannot reset a newer load to idle");
  assert.equal(host._plan, null);
  assert.equal(prewarm, 0);
  assert.equal(preforge, 0);
  fresh.resolve({ ok: true, plan: { title: "Fresh", nodes: [] } });
  await tick();
  assert.equal(host._plan.title, "Fresh");
  assert.equal(preforge, 1, "only the fresh successful request can start preforge");
}

// Queued artwork has no fetch/controller yet. Cancelling must also fence its eventual dispatch.
{
  const lateArtworkPosts = [];
  for (const [name, args] of [
    ["_paintBeatPlaces", [[{ name: "Lighthouse", slug: "lighthouse", tags: "coast" }]]],
    ["_paintBeatCg", [{ from: 0, to: 1, title: "The key" }, { chapter: 1, storyIndex: 0 }, 1]],
  ]) {
    const slot = deferred();
    let queued;
    const host = {
      _run: { runId: "queued-art-world" },
      _planChapter: 1,
      _renderBrowser() {},
      _clearBeat() {},
      _loadLocations: async () => {},
      _imageSlot(operation) {
        queued = operation;
        return slot.promise;
      },
      _postJson: async (path) => {
        if (path === "/background" || path === "/cg-art") lateArtworkPosts.push([name, path]);
        return { ok: true, url: "fixture-art" };
      },
    };
    const pending = method(name).apply(host, args);
    assert.equal(typeof queued, "function", "the artwork request is waiting for an image slot");
    cancelForgeStoryGeneration(host);
    slot.resolve(await queued());
    await pending;
    assert.equal(host._hudView, "home");
  }
  assert.deepEqual(lateArtworkPosts, [], "queued artwork cannot start a paid request after cancellation");
}

const originalDocument = globalThis.document,
  originalEnglish = globalThis.forgeStoryCancelEnglish;
globalThis.forgeStoryCancelEnglish = forgeStoryCancelEnglish;
try {
  const posts = [],
    run = { runId: "saved-world", progress: { 1: { normal: 4 } } },
    plan = { nodes: ["saved"] };
  let renders = 0,
    stoppedWatch = 0,
    button;
  const center = { append: (value) => (button = value), querySelector: () => button };
  const host = {
    _run: run,
    _plan: plan,
    _planChapter: 2,
    _bannerReady: true,
    _planState: "loading",
    _beatState: "loading",
    _activeStoryNode: { chapter: 1 },
    _prologue: true,
    _storyWriteAsked: true,
    _hudView: "chapter",
    _state: () => "forge",
    _stopPreforgeWatch: () => stoppedWatch++,
    _clearBeat() {
      this._activeStoryNode = null;
      this._beatState = "idle";
    },
    _renderBrowser: () => renders++,
    _postJson: (path, body) => {
      posts.push([path, body]);
      return new Promise(() => {});
    },
    _root: { querySelector: (selector) => (selector === ".gf-stage > .gf-view .forge-center" ? center : undefined) },
  };
  const requests = [
    "/chapter-plan",
    "/bond-chapter/plan",
    "/beat",
    "/bond-chapter/beat",
    "/combat-guide",
    "/background",
    "/cg-art",
    "/preforge/start",
    "/preforge/retry",
  ].map((path) => forgeStoryRequest(host, path));
  const unrelated = forgeStoryRequest(host, "/summon");
  assert.equal(unrelated.signal, undefined);
  globalThis.document = {
    createElement: () => ({
      setAttribute() {},
      addEventListener(_event, listener) {
        this.click = listener;
      },
      remove() {
        button = undefined;
      },
    }),
  };
  wireForgeStoryCancel(host);
  assert.equal(button.textContent, "Cancel");
  assert.equal(button.type, "button");
  button.click();
  assert.equal(host._hudView, "home", "Home is immediate even when cancellation POST never settles");
  assert.equal(host._planEscaped, true);
  assert.equal(host._prologue, false);
  assert.equal(host._storyWriteAsked, false);
  assert.equal(host._activeStoryNode, null, "late beat callbacks lose their node identity");
  assert.equal(host._beatState, "idle");
  assert.equal(host._planState, "idle");
  assert.equal(host._forgeStoryRevision, 1);
  assert.equal(host._preforgeEpoch, 1);
  assert.equal(stoppedWatch, 1);
  assert.equal(renders, 1);
  assert.equal(host._run, run);
  assert.equal(host._plan, plan, "saved chapter data survives cancellation");
  assert.deepEqual(run.progress, { 1: { normal: 4 } });
  assert.deepEqual(posts, [["/story/cancel", { runId: "saved-world", chapter: 2 }]]);
  assert(requests.every((request) => request.signal.aborted && !request.current()));
  assert.equal(host._forgeStoryRequests.size, 0);
  assert.equal(unrelated.current(), true);
  const next = forgeStoryRequest(host, "/chapter-plan");
  assert.equal(next.signal.aborted, false, "the next intentional generation gets a fresh signal");
  assert.equal(next.current(), true);
  assert.equal(host._forgeStoryRequests.size, 0, "settled requests release their controller");
  const differentWorld = forgeStoryRequest(host, "/beat");
  host._run = { runId: "another-world" };
  assert.equal(differentWorld.current(), false);
  host._run = run;
  host._bondUnit = "bond-character";
  host._preforgeKey = () => "bond:character:part1";
  host._leaveBond = () => {
    host._bondUnit = "";
    host._planChapter = 2;
  };
  cancelForgeStoryGeneration(host);
  assert.equal(host._bondUnit, "");
  assert.equal(host._plan, null, "a Bond plan cannot be mistaken for the ordinary chapter after returning Home");
  assert.deepEqual(posts.at(-1), ["/story/cancel", { runId: "saved-world", chapter: "bond:character:part1" }]);
  assert.deepEqual(plan, { nodes: ["saved"] }, "clearing a displayed Bond plan does not modify its saved data");
  host._postJson = () => {
    throw new Error("offline");
  };
  assert.doesNotThrow(() => cancelForgeStoryGeneration(host));
  host._postJson = () => Promise.reject(new Error("offline"));
  cancelForgeStoryGeneration(host);
  await Promise.resolve();
  button = undefined;
  host._state = () => "beat";
  host._beatState = "loading";
  wireForgeStoryCancel(host);
  assert(button, "a stale loading screen with no active request still offers Cancel");
  host._beatState = "ready";
  wireForgeStoryCancel(host);
  assert.equal(button, undefined, "the ready story keeps its ordinary controls");
  host._state = () => "forge";
  host._creatingNew = true;
  wireForgeStoryCancel(host);
  assert.equal(button, undefined, "world creation retains its existing cancellation behavior");
  console.info(
    "Story cancellation client: immediate Home, request fencing, retained saves and stale-screen escape passed.",
  );
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalEnglish === undefined) delete globalThis.forgeStoryCancelEnglish;
  else globalThis.forgeStoryCancelEnglish = originalEnglish;
}
