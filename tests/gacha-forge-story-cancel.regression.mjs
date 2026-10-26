import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  cancelForgeStoryGeneration,
  forgeChapterCanStepAway,
  forgeChapterSettled,
  forgeStoryRequest,
  stepAwayFromForgeChapter,
  stopForgeStoryRequests,
  wireForgeStoryCancel,
} from "../packages/gacha-forge/src/story-cancel-client.mjs";
import { forgeStoryCancelEnglish } from "../packages/gacha-forge/src/story-cancel-en.mjs";
import { forgeUserTimeZone } from "../packages/gacha-forge/src/browser-presentation.mjs";
import { forgeFormationStartRequest } from "../packages/gacha-forge/src/formation-combat-client.mjs";
import {
  forgeSeasonalRequest,
  adoptForgeSeasonalResponse,
  openForgeSeasonalEvent,
} from "../packages/gacha-forge/src/seasonal-events-client.mjs";
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
    forgeFormationStartRequest,
    forgeSeasonalRequest,
    adoptForgeSeasonalResponse,
    ...globals,
  })[name];
};
// The chapter label exactly as the game prints it ("Chapter Three").
const chapterLabel = (() => {
  const at = source.indexOf("function op(t){");
  const words = source.match(/xg=\[[^\]]*\]/u)[0];
  const spell = source.match(/function At\(t\)\{[^}]*\}/u)[0];
  return new Function(`var ${words};${spell}${source.slice(at, source.indexOf("`}", at) + 2)}return op;`)();
})();
const deferred = () => Promise.withResolvers();
// A small DOM: elements keep their children in order, and querySelector matches one [data-*] attribute.
function domElement(tagName) {
  return {
    tagName,
    dataset: {},
    attributes: {},
    children: [],
    parent: null,
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    addEventListener(event, listener) {
      if (event === "click") this.click = listener;
    },
    append(...nodes) {
      for (const node of nodes) {
        node.parent = this;
        this.children.push(node);
      }
    },
    remove() {
      this.parent?.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
    },
    before(node) {
      node.parent = this.parent;
      this.parent.children.splice(this.parent.children.indexOf(this), 0, node);
    },
    after(node) {
      node.parent = this.parent;
      this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, node);
    },
    focus() {
      this.focused = true;
    },
    querySelector(selector) {
      const name = /^\[data-([a-z-]+)\]$/u.exec(selector)?.[1];
      const camel = name?.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      for (const child of this.children) {
        if (name && (`data-${name}` in child.attributes || camel in child.dataset)) return child;
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    },
  };
}
// The loader's .forge-center inside a shadow root; other selectors search the root.
function loaderRoot() {
  const root = domElement("root"),
    center = domElement("div"),
    find = root.querySelector.bind(root);
  root.querySelector = (selector) => (selector === ".gf-stage > .gf-view .forge-center" ? center : find(selector));
  return { root, center };
}
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
  const load = method("_loadChapterPlan", {
    qa: () => 0,
    Ir: (difficulty) => difficulty,
    forgeChapterSettled,
    op: chapterLabel,
  });
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
    stoppedWatch = 0;
  const { root, center } = loaderRoot(),
    cancelButton = () => center.querySelector("[data-forge-story-cancel]");
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
    _root: root,
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
  globalThis.document = { createElement: domElement };
  wireForgeStoryCancel(host);
  const button = cancelButton();
  assert.equal(center.querySelector("[data-forge-keep-playing]"), null, "the prologue cannot be left running");
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
  cancelButton()?.remove();
  host._state = () => "beat";
  host._beatState = "loading";
  wireForgeStoryCancel(host);
  assert(cancelButton(), "a stale loading screen with no active request still offers Cancel");
  host._beatState = "ready";
  wireForgeStoryCancel(host);
  assert.equal(cancelButton(), null, "the ready story keeps its ordinary controls");
  host._state = () => "forge";
  host._creatingNew = true;
  wireForgeStoryCancel(host);
  assert.equal(cancelButton(), null, "world creation retains its existing cancellation behavior");
  console.info(
    "Story cancellation client: immediate Home, request fencing, retained saves and stale-screen escape passed.",
  );
} finally {
  if (originalDocument === undefined) delete globalThis.document;
  else globalThis.document = originalDocument;
  if (originalEnglish === undefined) delete globalThis.forgeStoryCancelEnglish;
  else globalThis.forgeStoryCancelEnglish = originalEnglish;
}

// Keep playing: leaving a forging main chapter keeps its request alive, and its settlement is reported, warmed
// and pre-forged without disturbing the screen the player is on.
{
  const toasts = [],
    previousHost = globalThis.__MARINARA_HOST__,
    previousEnglish = globalThis.forgeStoryCancelEnglish,
    previousDocument = globalThis.document,
    previousStop = globalThis.stopForgeStoryRequests;
  globalThis.forgeStoryCancelEnglish = forgeStoryCancelEnglish;
  globalThis.stopForgeStoryRequests = stopForgeStoryRequests;
  globalThis.__MARINARA_HOST__ = {
    modules: {
      sonner: {
        toast: Object.fromEntries(
          ["success", "info", "error"].map((kind) => [kind, (text) => toasts.push([kind, text])]),
        ),
      },
    },
  };
  const globals = {
    qa: (plan) => plan.combats || 0,
    Ir: (difficulty) => difficulty,
    forgeChapterSettled,
    op: chapterLabel,
  };
  const load = method("_loadChapterPlan", globals),
    prewarm = method("_prewarmCombats", globals),
    settle = async () => {
      for (let turn = 0; turn < 20; turn += 1) await tick();
    };
  // Plan, guide and pre-forge requests answer from per-test queues so each case controls its own timing.
  function world({ chapter = 3, guides = "answer", preforge = { ok: true, allowed: true } } = {}) {
    const requests = [],
      prewarms = [],
      versions = new WeakMap();
    const host = {
      _run: { runId: "keep-world" },
      _planChapter: chapter,
      _bondUnit: "",
      _bondPart: 1,
      _plan: null,
      _difficulty: "normal",
      _hudView: "chapter",
      _planState: "idle",
      _bannerReady: true,
      _preforgeAsked: new Set(),
      _forgeChapterPlanVersions: versions,
      adopted: 0,
      checks: 0,
      _renderBrowser() {},
      _clearBeat() {},
      _rememberPlan() {
        this.adopted += 1;
      },
      _loadLocations() {},
      _openPrologueIfOwed() {},
      _openPostponedScene() {},
      _chapterWritten: () => false,
      async _preforgeCheck() {
        this.checks += 1;
      },
      _loadChapterPlan: load,
      _prewarmCombats(...args) {
        prewarms.push(args);
        return prewarm.apply(this, args);
      },
      _postJson(path, body) {
        const request = { path, body, ...deferred() };
        requests.push(request);
        if (path === "/combat-guide" && guides === "answer") request.resolve({ ok: true });
        if (path === "/preforge/start") request.resolve(preforge);
        if (path === "/story/cancel") request.resolve({ ok: true });
        return request.promise;
      },
    };
    const plans = () => requests.filter((request) => request.path === "/chapter-plan");
    // Bodies built inside the shipped client's VM context are compared as plain data.
    const posted = (path) =>
      requests.filter((request) => request.path === path).map((request) => JSON.parse(JSON.stringify(request.body)));
    const answer = (index, plan, revision = 7) => {
      if (plan) versions.set(plan, revision);
      plans()[index].resolve(plan ? { ok: true, plan, progress: {} } : plan);
    };
    const open = (next) => {
      host._planChapter = next;
      host._plan = null;
      host._hudView = "chapter";
      host._loadChapterPlan();
    };
    return { host, requests, prewarms, plans, posted, answer, open };
  }
  const reset = () => (toasts.length = 0);
  try {
    // 1. Keep playing while the plan is forging; the chapter lands in the background.
    {
      reset();
      const { host, prewarms, plans, posted, answer } = world();
      host._loadChapterPlan();
      assert.equal(forgeChapterCanStepAway(host), true);
      const request = plans()[0];
      stepAwayFromForgeChapter(host);
      assert.equal(host._hudView, "home");
      assert.equal(host._planEscaped, true);
      assert.equal(host._planState, "idle");
      const plan = { title: "Three", combats: 2, nodes: [] };
      answer(0, plan);
      await settle();
      assert.equal(host._plan, null, "the screen the player is on keeps its own plan");
      assert.equal(host._hudView, "home");
      assert.deepEqual(prewarms, [[plan, 3, 7]]);
      assert.deepEqual(posted("/combat-guide"), [
        { runId: "keep-world", chapter: 3, combatIndex: 0, storyRevision: 7 },
        { runId: "keep-world", chapter: 3, combatIndex: 1, storyRevision: 7 },
      ]);
      assert.deepEqual(posted("/preforge/start"), [{ runId: "keep-world", chapter: 3, storyRevision: 7 }]);
      assert.deepEqual(toasts, [["success", "Chapter Three is ready."]]);
      assert.equal(host._forgeAway.size, 0);
      assert.deepEqual(posted("/story/cancel"), []);
      assert.equal(host._forgeStoryRevision || 0, 0, "nothing was cancelled");
      assert.equal(request.body.chapter, 3);
    }
    // 2. Keep playing while the accepted plan warms its fights: one warm-up, one pre-forge, one notice.
    {
      reset();
      const { host, requests, prewarms, posted, answer } = world({ guides: "hold" });
      host._loadChapterPlan();
      const plan = { title: "Three", combats: 1, nodes: [] };
      answer(0, plan);
      await settle();
      assert.equal(prewarms.length, 1, "the foreground load started warming");
      stepAwayFromForgeChapter(host);
      requests.find((request) => request.path === "/combat-guide").resolve({ ok: true });
      await settle();
      assert.equal(prewarms.length, 1);
      assert.equal(host._plan, null);
      assert.deepEqual(posted("/preforge/start"), [{ runId: "keep-world", chapter: 3, storyRevision: 7 }]);
      assert.deepEqual(toasts, [["success", "Chapter Three is ready."]]);
    }
    // 3 and 4. Leave chapter 3, open chapter 1 (and leave it too): each settles for its own chapter.
    for (const leaveBoth of [false, true]) {
      reset();
      const { host, prewarms, posted, answer, open } = world();
      host._loadChapterPlan();
      stepAwayFromForgeChapter(host);
      open(1);
      if (leaveBoth) stepAwayFromForgeChapter(host);
      const three = { title: "Three", combats: 1, nodes: [] },
        one = { title: "One", combats: 1, nodes: [] };
      answer(0, three);
      await settle();
      assert.equal(host._planChapter, 1, "the chapter on screen is untouched");
      assert.equal(host._plan, null);
      assert.deepEqual(posted("/combat-guide")[0].chapter, 3);
      answer(1, one);
      await settle();
      assert.equal(host._plan, leaveBoth ? null : one, "chapter 1 opens normally unless it was left too");
      assert.deepEqual(
        prewarms.map(([plan, chapter]) => [plan.title, chapter]),
        leaveBoth
          ? [
              ["Three", 3],
              ["One", 1],
            ]
          : [
              ["Three", 3],
              ["One", undefined],
            ],
      );
      assert.deepEqual(
        posted("/preforge/start").map((body) => body.chapter),
        leaveBoth ? [3, 1] : [3],
      );
      assert.deepEqual(
        toasts,
        leaveBoth
          ? [
              ["success", "Chapter Three is ready."],
              ["success", "Chapter One is ready."],
            ]
          : [["success", "Chapter Three is ready."]],
      );
      assert.equal(host.checks, leaveBoth ? 0 : 1);
      assert.equal(host._forgeAway.size, 0);
    }
    // 5. Reopening the chapter before it lands adopts it exactly once, whichever request settles first.
    for (const first of [0, 1]) {
      reset();
      const { host, prewarms, plans, answer, open } = world();
      host._loadChapterPlan();
      stepAwayFromForgeChapter(host);
      open(3);
      assert.equal(plans().length, 2);
      const plan = { title: "Three", combats: 1, nodes: [] };
      answer(first, plan);
      await settle();
      answer(1 - first, plan);
      await settle();
      assert.equal(host._plan, plan);
      assert.equal(host.adopted, 1);
      assert.equal(prewarms.length, 1);
      assert.equal(host.checks, 1);
      assert.deepEqual(toasts, []);
      assert.equal(host._forgeAway.size, 0);
    }
    // Two Keep playing and reopen cycles: three loads wait on one request, and exactly one adopts it.
    for (const order of [
      [0, 1, 2],
      [2, 1, 0],
      [1, 0, 2],
      [2, 0, 1],
    ]) {
      reset();
      const { host, prewarms, plans, answer, open } = world();
      host._loadChapterPlan();
      stepAwayFromForgeChapter(host);
      open(3);
      stepAwayFromForgeChapter(host);
      open(3);
      assert.equal(plans().length, 3);
      const plan = { title: "Three", combats: 1, nodes: [] };
      for (const index of order) {
        answer(index, plan);
        await settle();
      }
      assert.equal(host._plan, plan, `order ${order}`);
      assert.equal(host.adopted, 1, `order ${order}`);
      assert.equal(prewarms.length, 1, `order ${order}`);
      assert.equal(host.checks, 1, `order ${order}`);
      assert.deepEqual(toasts, []);
      assert.equal(host._forgeAway.size, 0);
    }
    // A second Keep playing on the reopened loader is still reported once.
    {
      reset();
      const { host, prewarms, answer, open } = world();
      host._loadChapterPlan();
      stepAwayFromForgeChapter(host);
      open(3);
      stepAwayFromForgeChapter(host);
      const plan = { title: "Three", combats: 1, nodes: [] };
      answer(0, plan);
      answer(1, plan);
      await settle();
      assert.equal(host._plan, null);
      assert.equal(prewarms.length, 1);
      assert.deepEqual(toasts, [["success", "Chapter Three is ready."]]);
    }
    // 6. Cancel elsewhere still stops the chapter and says so; Cancel on its own reopened loader is quiet.
    {
      reset();
      const { host, prewarms, posted, answer, open } = world();
      host._loadChapterPlan();
      stepAwayFromForgeChapter(host);
      open(1);
      cancelForgeStoryGeneration(host);
      answer(0, null);
      await settle();
      assert.deepEqual(toasts, [["info", "Chapter Three was interrupted. Open it to continue."]]);
      assert.deepEqual(prewarms, []);
      assert.deepEqual(posted("/preforge/start"), []);
      reset();
      const quiet = world();
      quiet.host._loadChapterPlan();
      stepAwayFromForgeChapter(quiet.host);
      quiet.open(3);
      cancelForgeStoryGeneration(quiet.host);
      quiet.answer(0, null);
      quiet.answer(1, null);
      await settle();
      assert.deepEqual(toasts, []);
      assert.equal(quiet.host._forgeAway.size, 0);
    }
    // Entering a seasonal event only stops tracking the chapter, which keeps forging on the server: no notice.
    {
      reset();
      const { host, prewarms, posted, answer } = world();
      host._loadChapterPlan();
      stepAwayFromForgeChapter(host);
      openForgeSeasonalEvent(host, { chapter: "event-1", title: "Lantern Night" });
      assert.equal(host._planChapter, "event-1");
      assert.equal(host._forgeAway.size, 0, "the event stops tracking the chapter before its request settles");
      answer(0, null);
      await settle();
      assert.deepEqual(toasts, []);
      assert.deepEqual(prewarms, []);
      assert.deepEqual(posted("/preforge/start"), []);
      assert.deepEqual(posted("/story/cancel"), [], "the server is not asked to stop");
      assert.equal(host._forgeAway.size, 0);
    }
    // A request the page stopped waiting on without a Cancel (for example the stale chapter's Reopen) is quiet;
    // after a Cancel or a chapter reset, the same null is a real stop.
    for (const [label, stop, expected] of [
      ["page stopped waiting", (host) => stopForgeStoryRequests(host), []],
      [
        "chapter reset",
        (host) => {
          stopForgeStoryRequests(host);
          host._forgeStoryStoppedAt = host._forgeStoryRevision; // as confirmForgeChapterReset marks it
        },
        [["info", "Chapter Three was interrupted. Open it to continue."]],
      ],
    ]) {
      reset();
      const { host, answer } = world();
      host._loadChapterPlan();
      stepAwayFromForgeChapter(host);
      stop(host);
      answer(0, null);
      await settle();
      assert.deepEqual(toasts, expected, label);
    }
    // 7. Failures, stops and a Character Story holding the chapter.
    for (const [response, expected] of [
      [
        { ok: false, error: "generation-failed" },
        [["error", "Chapter Three could not be forged. Open it to try again."]],
      ],
      [{ ok: false, error: "cancelled" }, [["info", "Chapter Three was interrupted. Open it to continue."]]],
      [null, []],
      [{ ok: false, error: "bond-chapter-open", heldById: "unit-1" }, []],
    ]) {
      reset();
      const { host, prewarms, plans } = world();
      host._loadChapterPlan();
      stepAwayFromForgeChapter(host);
      plans()[0].resolve(response);
      await settle();
      assert.deepEqual(toasts, expected, JSON.stringify(response));
      assert.deepEqual(prewarms, []);
      assert.equal(host._planState, "idle", "a background failure does not open the error screen");
      assert.equal(host._bondUnit, "");
    }
    // 8. A pre-forge start that did not go through is asked again when the chapter is opened.
    {
      reset();
      const { host, answer } = world({ preforge: { ok: false, error: "write-conflict" } });
      host._loadChapterPlan();
      stepAwayFromForgeChapter(host);
      answer(0, { title: "Three", combats: 0, nodes: [] });
      await settle();
      assert.equal(host._preforgeAsked.size, 0);
      assert.deepEqual(toasts, [["success", "Chapter Three is ready."]]);
    }
    // No ready notice when the player already opened the chapter while its fights were warming.
    {
      reset();
      const { host, requests, answer, open } = world({ guides: "hold" });
      host._loadChapterPlan();
      stepAwayFromForgeChapter(host);
      const plan = { title: "Three", combats: 1, nodes: [] };
      answer(0, plan);
      await settle();
      open(3);
      answer(1, plan);
      await settle();
      for (const request of requests.filter((item) => item.path === "/combat-guide")) request.resolve({ ok: true });
      await settle();
      assert.equal(host._plan, plan);
      assert.deepEqual(toasts, []);
    }
    // 9. Warming a given chapter pins its chapter and story revision; the foreground call is unchanged.
    {
      const { host, posted } = world({ chapter: 2 });
      await host._prewarmCombats({ combats: 1 }, 4, 7);
      await host._prewarmCombats({ combats: 1 });
      assert.deepEqual(posted("/combat-guide"), [
        { runId: "keep-world", chapter: 4, combatIndex: 0, storyRevision: 7 },
        { runId: "keep-world", chapter: 2, combatIndex: 0 },
      ]);
    }
    // 10. The portrait pass does not reopen a chapter loader the player left.
    {
      const startArt = method("_startArt");
      for (const escaped of [true, false]) {
        let loads = 0;
        startArt.call({
          _run: { runId: "keep-world" },
          _planState: "idle",
          _plan: null,
          _planEscaped: escaped,
          _storyWaits: () => false,
          _loadChapterPlan: () => (loads += 1),
          _renderBrowser() {},
          _postJson: () => new Promise(() => {}),
        });
        assert.equal(loads, escaped ? 0 : 1);
      }
    }
    // 11. Keep playing is offered before Cancel on a main chapter's forge loader only.
    {
      globalThis.document = { createElement: domElement };
      const loader = (overrides = {}) => {
        const { root, center } = loaderRoot(),
          home = domElement("button");
        home.dataset.openModes = "";
        const host = {
          _run: { runId: "keep-world" },
          _bannerReady: true,
          _planChapter: 3,
          _planState: "loading",
          _bondUnit: "",
          _root: root,
          _state: () => "forge",
          _chapterWritten: () => false,
          _renderBrowser() {
            root.append(home);
          },
          ...overrides,
        };
        wireForgeStoryCancel(host);
        return { host, center, home };
      };
      const { host, center, home } = loader();
      const keep = center.querySelector("[data-forge-keep-playing]"),
        hint = center.querySelector("[data-forge-keep-playing-hint]");
      assert.deepEqual(
        center.children.map((child) => child.textContent),
        [forgeStoryCancelEnglish.keepPlaying, forgeStoryCancelEnglish.keepPlayingHint, forgeStoryCancelEnglish.cancel],
      );
      assert.equal(keep.className, "forge-leave");
      assert.equal(keep.getAttribute("aria-describedby"), hint.id);
      assert.equal(hint.className, "forge-keep-hint", "the hint reads as prose, not as an error report");
      assert.ok(host._root.querySelector("[data-forge-keep-playing-style]"));
      wireForgeStoryCancel(host);
      assert.equal(center.children.length, 3, "wiring again adds nothing");
      keep.click();
      assert.equal(host._hudView, "home");
      assert.equal(home.focused, true, "focus moves to Home's Battle button");
      assert.deepEqual([...host._forgeAway], [["keep-world|3|0", 1]]);
      for (const [label, overrides] of [
        ["the scene loader", { _state: () => "beat", _beatState: "loading" }],
        ["the prologue", { _prologue: true }],
        ["the postponed first scene", { _storyWriteAsked: true }],
        ["a Character Story", { _bondUnit: "keep-world:unit:arden", _planChapter: "bond-arden" }],
        ["a seasonal event", { _planChapter: "event-1" }],
        ["an error", { _planState: "error" }],
        ["a written chapter", { _chapterWritten: () => true }],
        ["world creation", { _creatingNew: true }],
      ]) {
        const { center: other } = loader(overrides);
        assert.equal(other.querySelector("[data-forge-keep-playing]"), null, label);
        assert.equal(other.querySelector("[data-forge-keep-playing-hint]"), null, label);
      }
      // The loader turning into an error removes the offer.
      host._planState = "error";
      host._hudView = "chapter";
      const { center: shown, host: shownHost } = loader();
      shownHost._planState = "error";
      wireForgeStoryCancel(shownHost);
      assert.equal(shown.querySelector("[data-forge-keep-playing]"), null);
      assert.equal(shown.querySelector("[data-forge-keep-playing-hint]"), null);
    }
    console.info("Keep playing: background settlement, single adoption, notices, warm-up and loader offer passed.");
  } finally {
    if (previousHost === undefined) delete globalThis.__MARINARA_HOST__;
    else globalThis.__MARINARA_HOST__ = previousHost;
    if (previousEnglish === undefined) delete globalThis.forgeStoryCancelEnglish;
    else globalThis.forgeStoryCancelEnglish = previousEnglish;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousStop === undefined) delete globalThis.stopForgeStoryRequests;
    else globalThis.stopForgeStoryRequests = previousStop;
  }
}
