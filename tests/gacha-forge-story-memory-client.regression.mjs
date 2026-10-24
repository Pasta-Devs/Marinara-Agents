import assert from "node:assert/strict";
import { forgeStoryMemoryEnglish } from "../packages/gacha-forge/src/story-memory-en.mjs";
import {
  adoptForgeStoryMemoryStatus,
  captureForgeStoryMemoryStatus,
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
  let html = "";
  let status;
  let button;
  const mount = {
    dataset: {},
    onclick: null,
    querySelector: (selector) => (selector === '[role="status"]' ? status : button),
    contains: (node) => node === status || node === button,
    get status() {
      return status;
    },
    get button() {
      return button;
    },
  };
  const host = {
    _run: { runId: "world-one" },
    _hudView: "settings",
    _settingsCategory: "continuity",
    isConnected: true,
    _root: { querySelector: () => mount, activeElement: null },
  };
  const element = (textContent) => ({
    textContent,
    hidden: false,
    disabled: false,
    focus() {
      host._root.activeElement = this;
    },
  });
  Object.defineProperty(mount, "innerHTML", {
    configurable: true,
    get: () => html,
    set: (value) => {
      html = value;
      status = element(value.match(/<p role="status"[^>]*>(.*?)<\/p>/u)?.[1] || "");
      button = element(value.match(/<button[^>]*data-forge-memory-retry[^>]*>(.*?)<\/button>/u)?.[1] || "");
      host._root.activeElement = null;
    },
  });
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
    assert.equal(f.mount.button.disabled, true);
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
    assert.match(f.mount.status.textContent, /Could not check/);
    assert.doesNotMatch(f.mount.innerHTML, /<script>/);
    assert.equal(timers.size, 0);
    f.click();
    await settle();
    assert.equal(requests.length, 2);
    assert.ok(requests.every((url) => url.endsWith("/status")));
    assert.match(f.mount.status.textContent, /Engine Connections/);
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
  await test("background polling retains its live-region shell and pending copy", () => {
    const f = fixture("pending");
    let writes = 0;
    const html = Object.getOwnPropertyDescriptor(f.mount, "innerHTML");
    Object.defineProperty(f.mount, "innerHTML", {
      get: html.get,
      set: (value) => {
        html.set(value);
        writes += 1;
      },
    });
    wireForgeStoryMemoryStatus(f.host, () => new Promise(() => {}));
    [...timers.values()][0]();
    assert.equal(writes, 1, "A background read must not replace the live region");
    assert.equal(f.mount.status.textContent, forgeStoryMemoryEnglish["story.memory.pending"]);
    assert.match(f.mount.innerHTML, /Updating story memory/);
    assert.doesNotMatch(f.mount.innerHTML, /Checking story memory/);
    f.host._stopForgeStoryMemoryStatus();
  });
  await test("Check again shows checking after a failed known-phase read without replacing nodes or retrying work", async () => {
    const f = fixture("pending");
    const requests = [];
    let finish;
    wireForgeStoryMemoryStatus(f.host, (url) => {
      requests.push(url);
      return requests.length === 1 ? Promise.resolve({ ok: false }) : new Promise((resolve) => (finish = resolve));
    });
    const status = f.mount.status;
    const button = f.mount.button;
    [...timers.values()][0]();
    await settle();
    assert.equal(status.textContent, forgeStoryMemoryEnglish["story.memory.unavailable"]);
    button.focus();
    f.click();
    assert.equal(status.textContent, forgeStoryMemoryEnglish["story.memory.checking"]);
    assert.equal(button.disabled, true);
    assert.equal(f.host._root.activeElement, status);
    assert.equal(f.mount.status, status);
    assert.equal(f.mount.button, button);
    assert.equal(requests.length, 2);
    assert.ok(requests.every((url) => url.endsWith("/status")));
    finish(response("ready"));
    await settle();
    assert.equal(status.textContent, forgeStoryMemoryEnglish["story.memory.ready"]);
    assert.equal(button.hidden, true);
    assert.equal(f.host._root.activeElement, status);
    f.host._stopForgeStoryMemoryStatus();
  });
  await test("retry keeps stable status/action nodes and deliberate focus through a rewire and completion", async () => {
    const f = fixture("stale");
    let finish;
    const request = () => new Promise((resolve) => (finish = resolve));
    wireForgeStoryMemoryStatus(f.host, request);
    const status = f.mount.status;
    const button = f.mount.button;
    button.focus();
    wireForgeStoryMemoryStatus(f.host, request);
    assert.equal(f.mount.status, status);
    assert.equal(f.mount.button, button);
    assert.equal(f.host._root.activeElement, button);
    f.click();
    assert.equal(f.host._root.activeElement, status);
    assert.equal(button.disabled, true);
    finish(response("ready"));
    await settle();
    assert.equal(f.mount.status, status);
    assert.equal(f.mount.button, button);
    assert.equal(button.hidden, true);
    assert.equal(f.host._root.activeElement, status);
    assert.match(status.textContent, /up to date/);
    f.host._stopForgeStoryMemoryStatus();
  });
  await test("settings rebuild restores the captured native mount only within the same world and Continuity", () => {
    const f = fixture("stale");
    wireForgeStoryMemoryStatus(f.host, () => {});
    const status = f.mount.status;
    const button = f.mount.button;
    button.focus();
    const captured = captureForgeStoryMemoryStatus(f.host, "settings");
    assert.equal(captured.mount, f.mount);
    const placeholder = {
      replaceWith: (mount) => {
        f.host._root.querySelector = () => mount;
      },
    };
    f.host._root.querySelector = () => placeholder;
    f.host._root.activeElement = null;
    wireForgeStoryMemoryStatus(f.host, () => {}, captured);
    assert.equal(f.mount.status, status);
    assert.equal(f.mount.button, button);
    assert.equal(f.host._root.activeElement, button);
    f.host._settingsCategory = "visual";
    assert.equal(captureForgeStoryMemoryStatus(f.host, "settings"), null);
    f.host._settingsCategory = "continuity";
    f.host._run = { runId: "world-two" };
    assert.equal(captureForgeStoryMemoryStatus(f.host, "settings"), null);
    f.host._run = null;
    f.host._root.querySelector = () => null;
    assert.equal(captureForgeStoryMemoryStatus(f.host, "settings"), null);
    f.host._stopForgeStoryMemoryStatus();
  });
  await test("an interrupted retry reconciles once with a read-only status after a rewire or full rebuild", async () => {
    for (const rebuild of [false, true]) {
      const f = fixture("stale");
      const requests = [];
      let finishRetry;
      const request = (url, options) => {
        requests.push({ url, options });
        if (url.endsWith("/retry")) return new Promise((resolve) => (finishRetry = resolve));
        return Promise.resolve(response("ready"));
      };
      wireForgeStoryMemoryStatus(f.host, request);
      const status = f.mount.status;
      const button = f.mount.button;
      button.focus();
      f.click();
      assert.equal(f.host._root.activeElement, status);
      let captured;
      if (rebuild) {
        captured = captureForgeStoryMemoryStatus(f.host, "settings");
        f.host._root.querySelector = () => ({
          replaceWith: (mount) => {
            f.host._root.querySelector = () => mount;
          },
        });
        f.host._root.activeElement = null;
      }
      wireForgeStoryMemoryStatus(f.host, request, captured);
      await settle();
      assert.equal(requests[0].options.signal.aborted, true);
      assert.equal(requests.filter(({ url }) => url.endsWith("/retry")).length, 1);
      assert.equal(requests.filter(({ url }) => url.endsWith("/status")).length, 1);
      assert.equal(f.mount.status, status);
      assert.equal(f.mount.button, button);
      assert.equal(f.host._root.activeElement, status);
      assert.equal(f.host._storyMemoryStatus.phase, "ready");
      finishRetry(response("error", true));
      await settle();
      assert.equal(f.host._storyMemoryStatus.phase, "ready", "aborted retry must not overwrite reconciliation");
      f.host._stopForgeStoryMemoryStatus();
    }
    const f = fixture("stale");
    const requests = [];
    wireForgeStoryMemoryStatus(f.host, (url) => (requests.push(url), new Promise(() => {})));
    f.click();
    f.host._run = { runId: "world-two" };
    adoptForgeStoryMemoryStatus(f.host, { memory: { phase: "context-unknown" } }, "world-two");
    wireForgeStoryMemoryStatus(f.host, (url) => (requests.push(url), Promise.resolve(response("ready"))));
    await settle();
    assert.equal(requests.length, 1, "an old world's interrupted retry must not reconcile into a new world");
    assert.equal(f.host._storyMemoryStatus.phase, "context-unknown");
    f.host._stopForgeStoryMemoryStatus();
  });
} finally {
  globalThis.setTimeout = original.setTimeout;
  globalThis.clearTimeout = original.clearTimeout;
  if (original.english === undefined) delete globalThis.forgeStoryMemoryEnglish;
  else globalThis.forgeStoryMemoryEnglish = original.english;
}
