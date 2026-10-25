// Source-level DOM seam for the cached-window expiry edge; no browser or provider calls.
import assert from "node:assert/strict";
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
