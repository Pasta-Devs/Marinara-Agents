import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock, test } from "node:test";

// Slices of the shipped client: the chapter map, the pre-forge progress poll, and the same-screen hold.
const source = readFileSync(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
const cut = (from, to) => {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `slice ${from}`);
  return source.slice(start, end);
};

const Zd = new Function(
  `var Yv=[];var ${cut("Gd=10,za=", "function tt(").replace(/,$/u, "")};${cut("function Yd(", "var Xd=")};` +
    `var ${cut("Jd='<svg", "var Gn=").replace(/;$/u, "")};function u(t){return String(t??"")}` +
    `function tt(t){return String(t)}function zt(){return""}function Jv(){return""}${cut("function Zv(", "function Qd(")};return Zd`,
)();
const plan = {
  title: "Chapter Two",
  nodes: [
    { type: "story", title: "Scene one" },
    { type: "combat", title: "Fight one" },
    { type: "story", title: "Scene two" },
    { type: "combat", title: "Fight two" },
    { type: "story", title: "Scene three" },
  ],
};
const writing = (extra = {}) => ({
  mode: "story",
  chapter: 2,
  total: 3,
  done: 1,
  next: 1,
  running: true,
  locked: true,
  cancelled: false,
  ...extra,
});
const map = (normal, preforge, notice = "") =>
  Zd({ plan, difficulty: "normal", progress: { normal }, chapterNumber: 2, preforge, notice });

test("written scenes stay playable while pre-forge writes the rest of the chapter", () => {
  // Scene one is written and current: Play, with the pre-forge bar still up.
  assert.match(map(0, writing()), /data-play/u);
  assert.match(map(0, writing()), /cap-diff pre/u);
  // Scene one cleared, the fight is current: Start, and Read again for the cleared scene.
  assert.match(map(1, writing()), /data-start/u);
  assert.match(map(1, writing()), /data-replay="0"/u);
  // Scene two is current but not written yet: it waits for the chain, which writes it for free.
  assert.doesNotMatch(map(2, writing()), /data-play/u);
  assert.match(map(2, writing()), /Writing/u);
  // Once it is written, it turns into Play while scene three is still being written.
  assert.match(map(2, writing({ done: 2, next: 2 })), /data-play/u);
  assert.match(map(2, writing({ done: 2, next: 2 })), /Writing/u, "later scenes keep their status");
  // A failed start has somewhere to say so.
  assert.match(map(0, writing(), "That beat could not be started."), /could not be started/u);
  // Without pre-forge, or once it is done, the map is unchanged.
  assert.match(map(2, null), /data-play/u);
  assert.match(map(2, writing({ locked: false, running: false, next: -1, done: 3 })), /data-play/u);
});

const Host = new Function(
  "mk",
  "Qd",
  `return class{${cut("_preforgeKey(){", "_loadStandardBanner(){")}${cut("_wireChapter(){", "_openChapter(e){")}}`,
)(4000, () => {});
function host(reply) {
  const intervals = new Map();
  let id = 0;
  const h = Object.assign(new Host(), {
    _run: { runId: "r1" },
    _planChapter: 2,
    _preforge: writing(),
    _preforgeTimer: null,
    _preforgeRev: 0,
    _preforgeEpoch: 0,
    _preforgeAsked: new Set(["r1:2"]),
    _root: {},
    view: "chapter",
    reads: 0,
    drawn: [],
    _state() {
      return this.view;
    },
    _renderBrowser() {
      if (this.view !== "chapter") return;
      this.drawn.push(this._preforge?.next);
      this._wireChapter();
    },
    _postJson() {
      this.reads += 1;
      return Promise.resolve(reply());
    },
  });
  const timers = {
    setInterval: (callback) => (intervals.set((id += 1), callback), id),
    clearInterval: (key) => intervals.delete(key),
    tick: async () => {
      for (const callback of [...intervals.values()]) callback();
      for (let index = 0; index < 4; index += 1) await new Promise((resolve) => setImmediate(resolve));
    },
    get running() {
      return intervals.size > 0;
    },
  };
  return { h, timers };
}

test("returning to the chapter map reads pre-forge once and resumes its poll, without looping on a failed read", async () => {
  const realSet = globalThis.setInterval;
  const realClear = globalThis.clearInterval;
  let state = writing();
  const { h, timers } = host(() => ({ ok: true, preforge: state }));
  globalThis.setInterval = timers.setInterval;
  globalThis.clearInterval = timers.clearInterval;
  try {
    h._preforgeWatch();
    await timers.tick();
    h.view = "beat";
    await timers.tick();
    assert.equal(timers.running, false, "the poll stops while a scene is open");
    state = writing({ done: 2, next: 2 });
    const before = h.reads;
    h.view = "chapter";
    h._renderBrowser();
    await timers.tick();
    assert.equal(h.reads - before, 1, "one read on return");
    assert.equal(h._preforge.next, 2);
    assert.equal(h.drawn.at(-1), 2, "the map is drawn again from that read, so the scene written meanwhile is Play");
    assert.equal(timers.running, true, "the poll resumes while the chain still writes");
    state = writing({ done: 3, next: -1, running: false, locked: false });
    await timers.tick();
    assert.equal(timers.running, false, "the poll ends with the chain");
    // A read that fails on return is not retried by every redraw.
    let failing = true;
    const broken = host(() => (failing ? null : { ok: true, preforge: writing() }));
    globalThis.setInterval = broken.timers.setInterval;
    globalThis.clearInterval = broken.timers.clearInterval;
    broken.h._preforgeWatch();
    broken.h.view = "beat";
    await broken.timers.tick();
    broken.h.view = "chapter";
    broken.h._renderBrowser();
    await broken.timers.tick();
    broken.h._renderBrowser();
    await broken.timers.tick();
    assert.equal(broken.h.reads, 1);
    failing = false;
  } finally {
    globalThis.setInterval = realSet;
    globalThis.clearInterval = realClear;
  }
});

const Swap = new Function("an", "fs", "ps", `return class{${cut("_holdSwap(e){", "_motionPage(e){")}}`);
function held(screen, unitState, extra = {}) {
  const calls = [];
  const Held = Swap(
    () => () => calls.push("release"),
    () => (calls.push("swap"), { at: 0, end() {} }),
    250,
  );
  const h = Object.assign(new Held(), { _root: {}, _lastScreen: screen, _unitState: unitState, ...extra });
  h._holdSwap({ node: {}, base: "", box: {} });
  return { h, calls };
}

test("opening a weapon's page or a relic's Upgrade keeps the old view until the new one has loaded", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    for (const [screen, unitState, extra] of [
      ["unit", "loading"],
      ["inventory", "ready", { _invGear: { kind: "upgrade" }, _relicsState: "loading" }],
      ["unit", "ready", { _gearView: { kind: "upgrade" }, _relicsState: "loading" }],
    ]) {
      const { h, calls } = held(screen, unitState, extra);
      mock.timers.tick(260);
      assert.deepEqual(calls, [], `${screen} stays held while loading`);
      h._heldSwap.end();
      assert.deepEqual(calls, ["release"], "the next render ends the hold");
    }
    for (const [screen, unitState, extra] of [
      ["unit", "ready"],
      ["unit", "error"],
      ["inventory", "loading"],
      ["summon", "loading", { _relicsState: "loading" }],
    ]) {
      const { h, calls } = held(screen, unitState, extra);
      mock.timers.tick(260);
      assert.deepEqual(calls, ["release", "swap"], `${screen}:${unitState} still swaps after 250 ms`);
      assert.equal(h._heldSwap, null);
    }
  } finally {
    mock.timers.reset();
  }
  assert.match(source, /\.tile\.target\[disabled\] \{ opacity: 1; \}/u, "the relic being upgraded is not faded");
  // A relic Upgrade opened while the screen still slides in ends that entrance, so its view is held as well.
  assert.match(cut("_gearOpenUpgrade(e,a,r){", "_loadRelics(e){"), /this\._tr=null,this\._renderBrowser\(\)/u);
});

test("Settings and Help say written scenes can be played while pre-forge writes the rest", () => {
  assert.doesNotMatch(source, /menu stays shut/u);
  assert.equal(source.split("Scenes already written can be played while it writes the rest").length - 1, 1);
  assert.equal(source.split("scenes already written can be played while it writes the rest").length - 1, 1);
});
