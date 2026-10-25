// Source-level DOM seam for the cached-window expiry edge; no browser or provider calls.
import assert from "node:assert/strict";
import { test } from "node:test";
import { wireForgeSeasonalEvents } from "../packages/gacha-forge/src/seasonal-events-client.mjs";
import { forgeSeasonalEnglish } from "../packages/gacha-forge/src/seasonal-events-en.mjs";

Object.assign(globalThis, {
  forgeSeasonalEnglish,
  wireForgeBannerAnimation() {},
  syncForgeAudio() {},
});
let requests = 0;
const root = {
  querySelector: (selector) => (selector === "[data-forge-seasonal-layout]" ? {} : null),
  querySelectorAll: () => [],
};
const host = {
  _root: root,
  _run: { runId: "review-world", story: { seasonalEvents: true } },
  _forgeSeasonalRunId: "review-world",
  _forgeSeasonalEnabled: true,
  _forgeSeasonalState: {
    events: [{ seq: 1, chapter: "event-1", endsAt: Date.now() - 1000, live: true, canStart: true, played: 0 }],
  },
  _forgeSeasonalLoadedAt: Date.now() - 22 * 86400000,
  _hudView: "hud",
  _eventSlots: [],
  async _postJson() {
    requests++;
    return { ok: true, events: [] };
  },
  _renderBrowser() {},
};
wireForgeSeasonalEvents(host);
host._hudView = "events";
host._eventId = "story-events";
wireForgeSeasonalEvents(host);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(requests, 1, "A previously live cached window crossing expiry needs one guarded refresh");
wireForgeSeasonalEvents(host);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(requests, 1, "The consumed expiry edge must not start a paid retry loop");
let chapterRefreshes = 0;
host._hudView = "chapters";
host._fillChapters = () => {
  chapterRefreshes++;
};
host._forgeSeasonalState = null;
wireForgeSeasonalEvents(host);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(
  chapterRefreshes,
  1,
  "Async event state must refresh the existing Chapters list even if the main render key is unchanged",
);
requests = 1;
// Failed overview preparation stays an explicit retry rather than a paid render loop.
host._forgeSeasonalState = { events: [{ seq: 2, endsAt: Date.now() - 1, live: true }] };
host._postJson = async () => {
  requests++;
  throw new Error("Controlled transport rejection");
};
wireForgeSeasonalEvents(host);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(requests, 2);
wireForgeSeasonalEvents(host);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(requests, 2);
assert.equal(host._forgeSeasonalState.error, true);
// Late responses from an earlier world cannot replace the current world's state.
let finish;
host._forgeSeasonalState = null;
host._postJson = () =>
  new Promise((resolve) => {
    finish = resolve;
  });
wireForgeSeasonalEvents(host);
host._run = { runId: "next-world", story: { seasonalEvents: true } };
const { prepareForgeSeasonalEvents, forgeSeasonalRequest } =
  await import("../packages/gacha-forge/src/seasonal-events-client.mjs");
prepareForgeSeasonalEvents(host);
finish({ ok: true, events: [{ title: "Stale world" }] });
await new Promise((resolve) => setImmediate(resolve));
assert.equal(host._forgeSeasonalState, null);
assert.equal(host._forgeSeasonalLoading, false);
assert.equal(host._forgeSeasonalServerTime, null);
assert.equal(host._forgeSeasonalExpired.size, 0);
assert.equal(forgeSeasonalRequest("/battle/start", { chapter: "event-1" }), "/story-event/battle/start");
assert.equal(forgeSeasonalRequest("/beat", { chapter: 2 }), "/beat");
console.info(JSON.stringify({ pass: true, requests, staleWorldIgnored: true, explicitRetry: true }));
// Setup has no active run; its two options must still be styled and grouped.
let grouped = false;
const parent = {};
const choice = { parentElement: parent, closest: () => null, before: () => {} };
const seasonal = { parentElement: parent };
globalThis.document = {
  createElement: () => ({
    append: (...fields) => {
      grouped = fields[0] === choice && fields[1] === seasonal;
    },
  }),
};
wireForgeSeasonalEvents({
  _root: {
    querySelector: (selector) =>
      selector === "[data-forge-seasonal-layout]"
        ? {}
        : selector === '[data-field="story.choices"]'
          ? choice
          : selector === '[data-field="story.seasonalEvents"]'
            ? seasonal
            : null,
  },
  _run: null,
});
assert.equal(grouped, true, "Setup options group before an active world exists");

test("a locally expired window still live on the server triggers one reconciliation without a render loop", async () => {
  const clock = Date.now;
  let current = 2_000_000;
  Date.now = () => current;
  let calls = 0;
  let serverExpired = false;
  const event = { seq: 1, chapter: "event-1", endsAt: current - 1000, live: true, played: 0 };
  const skewed = {
    _root: root,
    _run: { runId: "skewed-world", story: { seasonalEvents: true } },
    _forgeSeasonalRunId: "skewed-world",
    _forgeSeasonalEnabled: true,
    _forgeSeasonalState: { events: [structuredClone(event)] },
    _hudView: "hud",
    _eventSlots: [],
    async _postJson() {
      calls++;
      // Stop an unfixed recursive render after eight responses, retaining its observable request count.
      return {
        ok: true,
        serverNow: current - 2000,
        events: [{ ...event, live: !serverExpired && calls < 8, archived: serverExpired }],
      };
    },
    _renderBrowser() {
      wireForgeSeasonalEvents(this);
    },
  };
  try {
    wireForgeSeasonalEvents(skewed);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1, "a live server response must not immediately refetch the same window");
    assert.equal(skewed._forgeSeasonalState.events[0].live, true, "the server owns the window's live state");
    wireForgeSeasonalEvents(skewed);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
    current += 1001;
    serverExpired = true;
    wireForgeSeasonalEvents(skewed);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 2, "the reconciled window refreshes when the authoritative deadline arrives");
    assert.equal(skewed._forgeSeasonalState.events[0].live, false);
    assert.equal(skewed._forgeSeasonalState.events[0].archived, true);
    wireForgeSeasonalEvents(skewed);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 2);
    skewed._run.story.seasonalEvents = false;
    prepareForgeSeasonalEvents(skewed);
    assert.equal(skewed._forgeSeasonalServerTime, null);
    assert.equal(skewed._forgeSeasonalExpired.size, 0, "changing enabled state resets the window guard");
  } finally {
    Date.now = clock;
  }
});

test("a live response without a usable server clock still consumes its expiry edge only once", async () => {
  let calls = 0;
  const event = { seq: 1, chapter: "event-1", endsAt: Date.now() - 1000, live: true, played: 0 };
  const skewed = {
    _root: root,
    _run: { runId: "unknown-clock", story: { seasonalEvents: true } },
    _forgeSeasonalRunId: "unknown-clock",
    _forgeSeasonalEnabled: true,
    _forgeSeasonalState: { events: [event] },
    _hudView: "hud",
    _eventSlots: [],
    async _postJson() {
      calls++;
      return { ok: true, events: [{ ...event, live: calls < 8 }] };
    },
    _renderBrowser() {
      wireForgeSeasonalEvents(this);
    },
  };
  wireForgeSeasonalEvents(skewed);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(skewed._forgeSeasonalState.events[0].live, true);
});

test("a failed expiry refresh stays explicit retry even after its window edge was handled", async () => {
  const bodies = [];
  let retry;
  const button = {
    dataset: {},
    addEventListener: (_event, listener) => {
      retry = listener;
    },
  };
  const event = { seq: 1, chapter: "event-1", endsAt: Date.now() - 1000, live: true, played: 0 };
  const failed = {
    _root: { ...root, querySelectorAll: (selector) => (selector === "[data-story-event-retry]" ? [button] : []) },
    _run: { runId: "retry-world", story: { seasonalEvents: true } },
    _forgeSeasonalRunId: "retry-world",
    _forgeSeasonalEnabled: true,
    _forgeSeasonalState: { events: [event] },
    _hudView: "hud",
    _eventSlots: [],
    async _postJson(_path, body) {
      bodies.push(body);
      if (bodies.length === 1) throw new Error("controlled failure");
      return { ok: true, events: [event] };
    },
    _renderBrowser() {
      wireForgeSeasonalEvents(this);
    },
  };
  wireForgeSeasonalEvents(failed);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failed._forgeSeasonalState.error, true);
  assert.equal(bodies.length, 1);
  retry();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(
    bodies.map((body) => body.retry),
    [false, true],
  );
  assert.equal(failed._forgeSeasonalState.events[0].live, true);
});
