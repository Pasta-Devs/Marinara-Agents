import assert from "node:assert/strict";
import { forgeStoryMemoryEnglish } from "../packages/gacha-forge/src/story-memory-en.mjs";
import {
  adoptForgeStoryMemoryStatus,
  forgeStoryMemoryStatusHtml,
  wireForgeStoryMemoryStatus,
} from "../packages/gacha-forge/src/story-memory-client.mjs";

const original = { setTimeout, clearTimeout, english: globalThis.forgeStoryMemoryEnglish };
globalThis.forgeStoryMemoryEnglish = forgeStoryMemoryEnglish;
const timers = new Map();
let next = 0;
globalThis.setTimeout = (callback) => (timers.set(++next, callback), next);
globalThis.clearTimeout = (id) => timers.delete(id);
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const response = (phase, retryable = false) => ({
  ok: true,
  json: async () => ({ ok: true, memory: { phase, retryable } }),
});
function fixture(phase) {
  const mount = { innerHTML: "", onclick: null };
  const host = {
    _run: { runId: "world-one" },
    _hudView: "settings",
    _settingsCategory: "continuity",
    isConnected: true,
    _root: { querySelector: () => mount },
  };
  if (phase)
    adoptForgeStoryMemoryStatus(
      host,
      { memory: { phase, retryable: phase === "error" || phase === "stale" } },
      "world-one",
    );
  return { host, mount, click: () => mount.onclick({ target: { closest: () => ({}) } }) };
}
let count = 0;
async function test(name, callback) {
  timers.clear();
  await callback();
  console.info(`ok ${++count} - ${name}`);
}
try {
  await test("status uses allowlisted copy and points unknown context to Engine Connections", () => {
    const html = forgeStoryMemoryStatusHtml({ phase: "context-unknown", reason: "<img onerror=bad>" });
    assert.match(html, /Engine Connections/);
    assert.doesNotMatch(html, /onerror/);
    assert.match(html, /Check context/);
    assert.match(forgeStoryMemoryStatusHtml({ phase: "ready" }), /up to date/);
    assert.match(forgeStoryMemoryStatusHtml({ phase: "error", retryable: true }), /Retry memory update/);
  });
  await test("late status cannot replace another world's cache", () => {
    const f = fixture("ready");
    adoptForgeStoryMemoryStatus(f.host, { memory: { phase: "error" } }, "old-world");
    assert.equal(f.host._storyMemoryStatus.phase, "ready");
  });
  await test("pending polls a read-only status endpoint then stops when ready", async () => {
    const f = fixture("pending");
    const requests = [];
    wireForgeStoryMemoryStatus(f.host, async (url, options) => {
      requests.push({ url, options });
      return response("ready");
    });
    assert.equal(timers.size, 1);
    [...timers.values()][0]();
    await settle();
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/story-memory\/status$/);
    assert.deepEqual(JSON.parse(requests[0].options.body), { runId: "world-one" });
    assert.equal(f.host._storyMemoryStatus.phase, "ready");
    assert.equal(timers.size, 0);
    f.host._stopForgeStoryMemoryStatus();
  });
  await test("retry is explicit, coalesces repeated taps and discards an aborted old-world result", async () => {
    const f = fixture("error");
    let finish;
    const requests = [];
    wireForgeStoryMemoryStatus(f.host, (url, options) => {
      requests.push({ url, options });
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    assert.equal(requests.length, 0);
    f.click();
    f.click();
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/story-memory\/retry$/);
    assert.match(f.mount.innerHTML, /disabled/);
    f.host._run = { runId: "world-two" };
    f.host._stopForgeStoryMemoryStatus();
    const html = f.mount.innerHTML;
    assert.equal(requests[0].options.signal.aborted, true);
    finish(response("ready"));
    await settle();
    assert.equal(f.mount.innerHTML, html);
    assert.equal(f.host._storyMemoryStatus.phase, "error");
    assert.equal(timers.size, 0);
  });
  await test("unknown context, stale and error never spin; Check context explicitly resolves again", async () => {
    for (const phase of ["context-unknown", "stale", "error", "ready"]) {
      const f = fixture(phase);
      const requests = [];
      wireForgeStoryMemoryStatus(f.host, async (url) => {
        requests.push(url);
        return response("ready");
      });
      assert.equal(timers.size, 0);
      assert.equal(requests.length, 0);
      if (phase === "context-unknown") {
        f.click();
        await settle();
        assert.equal(requests.length, 1);
        assert.match(requests[0], /\/retry$/);
        assert.equal(f.host._storyMemoryStatus.phase, "ready");
      }
      f.host._stopForgeStoryMemoryStatus();
    }
  });
  await test("malformed status offers a read-only Check again instead of retrying model work", async () => {
    const f = fixture();
    const requests = [];
    wireForgeStoryMemoryStatus(f.host, async (url) => {
      requests.push(url);
      return requests.length === 1
        ? { ok: true, json: async () => ({ ok: true, memory: { phase: "<script>" } }) }
        : response("context-unknown");
    });
    await settle();
    assert.match(f.mount.innerHTML, /Could not check/);
    assert.doesNotMatch(f.mount.innerHTML, /<script>/);
    assert.equal(timers.size, 0);
    f.click();
    await settle();
    assert.equal(requests.length, 2);
    assert.ok(requests.every((url) => url.endsWith("/status")));
    assert.match(f.mount.innerHTML, /Engine Connections/);
    f.host._stopForgeStoryMemoryStatus();
  });
  await test("leaving Continuity cancels pending polling and removes its click listener", () => {
    const f = fixture("pending");
    wireForgeStoryMemoryStatus(f.host, () => {
      throw new Error("must not request");
    });
    assert.equal(timers.size, 1);
    f.host._hudView = "home";
    f.host._root.querySelector = () => null;
    wireForgeStoryMemoryStatus(f.host, () => {});
    assert.equal(timers.size, 0);
    assert.equal(f.mount.onclick, null);
  });
} finally {
  globalThis.setTimeout = original.setTimeout;
  globalThis.clearTimeout = original.clearTimeout;
  if (original.english === undefined) delete globalThis.forgeStoryMemoryEnglish;
  else globalThis.forgeStoryMemoryEnglish = original.english;
}
