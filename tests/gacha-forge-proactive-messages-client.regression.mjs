import assert from "node:assert/strict";
import * as chatContinuity from "../packages/gacha-forge/src/chat-continuity-client.mjs";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { normalizeForgeAudio } from "../sources/forge-kit/audio-settings.mjs";

const english = await readFile(
  new URL("../packages/gacha-forge/src/proactive-messages-en.mjs", import.meta.url),
  "utf8",
);
const client = await readFile(
  new URL("../packages/gacha-forge/src/proactive-messages-client.mjs", import.meta.url),
  "utf8",
);
const audioClient = await readFile(new URL("../packages/gacha-forge/src/audio-client.mjs", import.meta.url), "utf8");
const flush = () => new Promise(setImmediate);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
const incoming = (unitId = "world:unit:arden", id = "incoming-1", unitName = "Arden") => ({
  ok: true,
  status: "sent",
  unitId,
  unitName,
  said: { id, who: "unit", text: "How has your day been?", proactive: true },
});

const deep = (item) => [item, ...(item?.children || []).flatMap(deep)];
const noticeText = (notice) =>
  deep(notice)
    .filter((item) => item.tag === "p")
    .map((item) => item.textContent)
    .join(" ");
const noticeButtons = (notice) => deep(notice).filter((item) => item.tag === "button");

function fixture({ count = 2, view = "browser", field = false } = {}) {
  let clock = 0;
  let serial = 0;
  let zone = "Europe/Warsaw";
  const timers = new Map();
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.children = [];
      this.listeners = new Map();
      this.listenerCounts = new Map();
      this.dataset = {};
      this.isConnected = false;
      this.textContent = "";
      this.style = {};
    }
    append(...items) {
      for (const item of items) {
        item.parent = this;
        item.isConnected = this.isConnected;
        this.children.push(item);
      }
    }
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
      this.isConnected = false;
    }
    setAttribute() {}
    addEventListener(name, callback, capture) {
      this.listenerCounts.set(name, (this.listenerCounts.get(name) || 0) + 1);
      this.listeners.set(name, { callback, capture });
    }
    click() {
      this.listeners.get("click")?.callback({ stopPropagation() {} });
    }
  }
  const stage = new Element("stage");
  stage.isConnected = true;
  // The mocked view is always the Home screen.
  stage.querySelector = (selector) => (selector === ".hm-screen" ? {} : null);
  const input = field ? new Element("input") : null;
  if (input) {
    input.value = "0";
    input.setCustomValidity = (value) => (input.validationMessage = value);
    input.reportValidity = () => (input.reported = true);
  }
  let log = { scrollTop: 200, scrollHeight: 300, clientHeight: 100, style: {} };
  const root = {
    activeElement: null,
    querySelector(selector) {
      if (selector === ".gf-stage > .gf-view") return stage;
      if (selector === "[data-chat-log]") return log;
      if (selector === '[data-field="story.dailyUnitMessages"] input') return input;
      return null;
    },
  };
  const requests = [];
  const renders = [];
  const navigation = [];
  let transport = async () => ({ ok: true, status: "waiting" });
  const host = {
    isConnected: true,
    ownerDocument: { hidden: false },
    getAttribute: () => view,
    closest: () => null,
    getBoundingClientRect: () => ({ width: 874, height: 402 }),
    _root: root,
    _run: { runId: "world", story: { dailyUnitMessages: count } },
    _chat: { open: true, unit: { id: "world:unit:arden" }, messages: [], activeCount: 0 },
    _chatDraft: "",
    _chatRev: 0,
    _renderBrowser() {
      renders.push({ quiet: this._forgeChatQuietRefresh, draft: this._chatDraft });
      log = { ...log, scrollTop: 0 };
    },
    async _postJson(path, body) {
      requests.push({ path, body });
      return transport(path, body);
    },
    _chatReload: () => navigation.push("reload"),
    _chatWith: (id) => navigation.push(id),
  };
  const context = vm.createContext({
    forgeChatGenerationError: chatContinuity.forgeChatGenerationError,
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: zone }) }) },
    document: { createElement: (tag) => new Element(tag) },
    getComputedStyle: () => ({ visibility: "visible" }),
    setTimeout(callback, delay) {
      const id = ++serial;
      timers.set(id, { callback, at: clock + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  vm.runInContext(
    `${english.replace(/^export /gmu, "")}\n${client.replace(/^export /gmu, "")}\nglobalThis.api={wireForgeUnitMessages,disposeForgeUnitMessages,adoptForgeUnitMessage};`,
    context,
  );
  const api = context.api;
  return {
    host,
    root,
    input,
    stage,
    requests,
    renders,
    navigation,
    timers,
    wire: () => api.wireForgeUnitMessages(host),
    dispose: () => api.disposeForgeUnitMessages(host),
    adopt: (delivery) => api.adoptForgeUnitMessage(host, delivery),
    transport: (operation) => (transport = operation),
    zone: (value) => (zone = value),
    log: () => log,
    notice: () => stage.children.find((item) => item.tag === "aside"),
    async advance(milliseconds) {
      const target = clock + milliseconds;
      for (;;) {
        const due = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        clock = due[1].at;
        timers.delete(due[0]);
        due[1].callback();
        await flush();
      }
      clock = target;
      await flush();
    },
  };
}

test("default zero and missing or invalid counts schedule no autonomous requests", async () => {
  for (const count of [0, undefined, null, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "invalid"]) {
    const f = fixture({ count });
    if (count === undefined) delete f.host._run.story.dailyUnitMessages;
    f.wire();
    await f.advance(180_000);
    assert.equal(f.requests.length, 0, String(count));
    assert.equal(f.timers.size, 0, String(count));
  }
});

test("repeated renders retain one timer and a visible active world first polls after sixty seconds", async () => {
  const f = fixture();
  for (let index = 0; index < 12; index++) f.wire();
  assert.equal(f.timers.size, 1);
  await f.advance(59_999);
  assert.equal(f.requests.length, 0);
  await f.advance(1);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].path, "/chat/proactive/due");
  assert.equal(f.requests[0].body.runId, "world");
  assert.equal(f.timers.size, 1);
  f.dispose();
});

test("hidden, disconnected, inactive and settings-saving worlds make no requests", async () => {
  const cases = [
    (host) => (host.ownerDocument.hidden = true),
    (host) => (host.isConnected = false),
    (host) => (host._creatingNew = true),
    (host) => (host._showRuns = true),
    (host) => (host._showThemes = true),
    (host) => (host._forgeUnitMessagesSettingsPending = 1),
    (host) => (host.closest = () => ({})),
    (host) => (host.getBoundingClientRect = () => ({ width: 0, height: 0 })),
    (host) => (host.getAttribute = () => "other"),
  ];
  for (const change of cases) {
    const f = fixture();
    change(f.host);
    f.wire();
    await f.advance(120_000);
    assert.equal(f.requests.length, 0, String(change));
    f.dispose();
  }
});

test("the package's default browser view also permits polling without an explicit view attribute", async () => {
  const f = fixture({ view: null });
  f.wire();
  await f.advance(60_000);
  assert.equal(f.requests.length, 1);
  f.dispose();
});

test("a pending request has no overlapping timer and resumes one heartbeat after settling", async () => {
  const f = fixture();
  const waiting = deferred();
  f.transport(() => waiting.promise);
  f.wire();
  await f.advance(60_000);
  assert.equal(f.requests.length, 1);
  assert.equal(f.timers.size, 0);
  for (let index = 0; index < 10; index++) f.wire();
  await f.advance(300_000);
  assert.equal(f.requests.length, 1);
  waiting.resolve({ ok: true, status: "waiting" });
  await flush();
  assert.equal(f.timers.size, 1);
  f.transport(async () => ({ ok: true, status: "waiting" }));
  await f.advance(60_000);
  assert.equal(f.requests.length, 2);
  f.dispose();
});

test("late responses cannot append after a run, quota or timezone change", async () => {
  for (const change of [
    (f) => (f.host._run = { runId: "other", story: { dailyUnitMessages: 2 } }),
    (f) => (f.host._run.story.dailyUnitMessages = 3),
    (f) => f.zone("America/New_York"),
  ]) {
    const f = fixture();
    const waiting = deferred();
    f.transport(() => waiting.promise);
    f.wire();
    await f.advance(60_000);
    change(f);
    f.wire();
    waiting.resolve(incoming());
    await flush();
    assert.equal(f.host._chat.messages.length, 0);
    assert.equal(f.renders.length, 0);
    assert.equal(f.notice(), undefined);
    assert.equal(f.timers.size, 1);
    f.dispose();
  }
});

test("disposal clears the heartbeat and ignores an in-flight delivery", async () => {
  const f = fixture();
  const waiting = deferred();
  f.transport(() => waiting.promise);
  f.wire();
  await f.advance(60_000);
  f.dispose();
  waiting.resolve(incoming());
  await flush();
  assert.equal(f.host._forgeUnitMessages, null);
  assert.equal(f.host._chat.messages.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.notice(), undefined);
});

test("passive incoming rows preserve a draft, focused input and active chat operations", () => {
  for (const change of [
    (f) => (f.host._chatDraft = "A draft stays here"),
    (f) => (f.root.activeElement = { matches: () => true }),
    (f) => (f.host._chatSending = "world:unit:arden"),
    (f) => (f.host._chatClosing = "world:unit:arden"),
    (f) => (f.host._chatArchive = { list: [] }),
  ]) {
    const f = fixture();
    change(f);
    const draft = f.host._chatDraft;
    assert.equal(f.adopt(incoming()), false, String(change));
    assert.equal(f.host._chat.messages.length, 0);
    assert.equal(f.host._chatDraft, draft);
    assert.equal(f.renders.length, 0);
  }
});

test("passive incoming rows deduplicate, use quiet rendering and preserve history position", () => {
  for (const top of [20, 200]) {
    const f = fixture();
    f.log().scrollTop = top;
    assert.equal(f.adopt(incoming()), true);
    assert.equal(f.host._chat.messages.length, 1);
    assert.equal(f.host._chat.activeCount, 1);
    assert.equal(f.renders.length, 1);
    assert.equal(f.renders[0].quiet, true);
    assert.equal(f.host._forgeChatQuietRefresh, false);
    assert.equal(f.log().scrollTop, top === 20 ? top : f.log().scrollHeight);
    assert.equal(f.log().style.overflowAnchor, top === 20 ? "none" : undefined);
    assert.equal(f.adopt(incoming()), true);
    assert.equal(f.host._chat.messages.length, 1);
    assert.equal(f.renders.length, 1);
  }
});

test("a hidden world retains an in-flight delivery until visible without changing its chat", async () => {
  const f = fixture();
  const waiting = deferred();
  f.transport(() => waiting.promise);
  f.wire();
  await f.advance(60_000);
  f.host.ownerDocument.hidden = true;
  waiting.resolve(incoming());
  await flush();
  assert.equal(f.host._chat.messages.length, 0);
  assert.equal(f.renders.length, 0);
  assert.equal(f.notice(), undefined);
  f.host.ownerDocument.hidden = false;
  f.wire();
  assert.equal(f.host._chat.messages.length, 1);
  f.dispose();
});

test("a second pending delivery updates the notice name and Read action together", async () => {
  const f = fixture();
  f.host._chat = null;
  const deliveries = [
    incoming("world:unit:arden", "incoming-1", "Arden"),
    incoming("world:unit:vale", "incoming-2", "Vale"),
  ];
  f.transport(async () => deliveries.shift());
  f.wire();
  await f.advance(60_000);
  assert.match(noticeText(f.notice()), /Arden/u);
  await f.advance(60_000);
  const notice = f.notice();
  assert.match(noticeText(notice), /Vale/u);
  noticeButtons(notice)
    .find((item) => item.textContent === "Read message")
    .click();
  assert.deepEqual(f.navigation, ["world:unit:vale"]);
  assert.equal(f.notice(), undefined);
  f.dispose();
});

test("explicitly reading a same-unit notification leaves the archive and preserves the draft", async () => {
  const f = fixture();
  f.host._chatArchive = { messages: [{ who: "unit", text: "Older archived session." }] };
  f.host._chatDraft = "Keep this draft";
  f.transport(async () => incoming());
  f.wire();
  await f.advance(60_000);
  assert.equal(f.host._chat.messages.length, 0, "passive delivery must not replace the archive");
  const read = noticeButtons(f.notice()).find((item) => item.textContent === "Read message");
  assert.ok(read, "the player can explicitly read the incoming message without losing their draft");
  read.click();
  assert.equal(f.host._chatArchive, null);
  assert.equal(f.host._chatDraft, "Keep this draft");
  assert.deepEqual(f.navigation, ["reload"]);
  f.dispose();
});

test("the daily count validates whole numbers before the generic settings change handler", () => {
  const f = fixture({ count: 0, field: true });
  for (let index = 0; index < 8; index++) f.wire();
  assert.equal(f.input.listenerCounts.get("change"), 1, "repeated renders bind count validation once");
  assert.equal(f.input.listenerCounts.get("input"), 1, "repeated renders bind validity reset once");
  const listener = f.input.listeners.get("change");
  assert.equal(listener.capture, true);
  let stopped = false;
  f.input.value = "1.5";
  listener.callback({ stopImmediatePropagation: () => (stopped = true) });
  assert.equal(stopped, true);
  assert.equal(f.input.reported, true);
  assert.match(f.input.validationMessage, /whole number/u);
  f.input.value = "10000";
  listener.callback({
    stopImmediatePropagation() {
      assert.fail("a valid count must be saved");
    },
  });
  assert.equal(f.input.validationMessage, "");
  assert.equal(f.input.value, "10000");
  f.input.value = "";
  listener.callback({
    stopImmediatePropagation() {
      assert.fail("clearing the field disables messages");
    },
  });
  assert.equal(f.input.value, "0");
});

test("a failed paid attempt offers a dismissible explanation without a misleading Read action", async () => {
  const f = fixture();
  f.transport(async () => ({ ok: false, error: "generation-failed", retry: false }));
  f.wire();
  await f.advance(60_000);
  const notice = f.notice();
  assert.match(noticeText(notice), /could not be prepared/u);
  const buttons = noticeButtons(notice);
  assert.deepEqual(
    buttons.map((item) => item.textContent),
    ["Dismiss"],
  );
  assert.equal(f.host._chat.messages.length, 0);
  buttons[0].click();
  assert.equal(f.notice(), undefined);
  f.dispose();
});

test("a proactive capacity notice explains settings and preserves the draft without a Read or retry action", async () => {
  const f = fixture();
  f.host._chatDraft = "Keep my draft.";
  f.transport(async () => ({
    ok: false,
    error: "generation-failed",
    detail: "generation-output-capacity",
    capacity: { minimumOutputTokens: 8192, availableContextTokens: 7000, configuredMaxOutputTokens: 4096 },
    retry: false,
  }));
  f.wire();
  await f.advance(60_000);
  const notice = f.notice();
  const text = noticeText(notice);
  for (const expected of ["8192", "7000", "4096", "context", "Max Output Tokens Override"])
    assert.ok(text.includes(expected), expected);
  assert.deepEqual(
    noticeButtons(notice).map((item) => item.textContent),
    ["Dismiss"],
  );
  assert.equal(f.host._chatDraft, "Keep my draft.");
  assert.equal(f.host._chat.messages.length, 0);
  assert.equal(f.requests.length, 1);
  f.dispose();
});

test("context changes and cancellations do not display a provider-failure notice", async () => {
  for (const error of ["context-changed", "cancelled"]) {
    const f = fixture();
    f.transport(async () => ({ ok: false, error, retry: false }));
    f.wire();
    await f.advance(60_000);
    assert.equal(f.notice(), undefined);
    assert.equal(f.host._chat.messages.length, 0);
    f.dispose();
  }
});

test("story and audio saves share one queue without injecting audio into a story-only update", async () => {
  const start = audioClient.indexOf("export function saveForgeAudioSources(");
  const end = audioClient.indexOf("export function forgeCombatSound(", start);
  assert.ok(start >= 0 && end > start, "Exercise the maintained save function, not a copy of its implementation");
  const context = vm.createContext({
    normalizeForgeAudio,
    // Only the completion UI is omitted; source queue and normalization execute unchanged.
    wireForgeAudio() {},
  });
  vm.runInContext(audioClient.slice(start, end).replace(/^export /gmu, ""), context);
  const save = context.saveForgeAudioSources;
  const gate = deferred();
  const calls = [];
  let active = 0;
  let maximum = 0;
  const host = {
    _run: {
      runId: "world",
      story: { dailyUnitMessages: 0, choices: false, preforge: "off" },
      audio: normalizeForgeAudio({ musicVolume: 0.25 }),
    },
    async _setSourcesNow(sources) {
      active++;
      maximum = Math.max(maximum, active);
      calls.push(structuredClone(sources));
      if (calls.length === 1) await gate.promise;
      if (sources.story) this._run.story = { ...this._run.story, ...sources.story };
      if (sources.audio) this._run.audio = sources.audio;
      active--;
    },
  };
  const first = save(host, { audio: { muted: true } });
  const second = save(host, { story: { dailyUnitMessages: 10000 } });
  const third = save(host, { audio: { tts: true } });
  await flush();
  assert.equal(calls.length, 1, "story cannot race the in-flight audio index write");
  gate.resolve();
  await Promise.all([first, second, third]);
  assert.equal(maximum, 1);
  assert.equal(calls.length, 3);
  assert.equal(Object.hasOwn(calls[1], "audio"), false, "a story-only save preserves the audio object as-is");
  assert.equal(host._run.story.dailyUnitMessages, 10000);
  assert.equal(host._run.story.choices, false);
  assert.equal(host._run.story.preforge, "off");
  assert.equal(host._run.audio.muted, true);
  assert.equal(host._run.audio.tts, true);
  assert.equal(host._run.audio.musicVolume, 0.25);
  const stale = save(host, { story: { dailyUnitMessages: 5 } });
  host._run = { runId: "other", story: { dailyUnitMessages: 0 }, audio: normalizeForgeAudio() };
  await stale;
  assert.equal(calls.length, 3, "a queued story update must not follow the player into another world");
  assert.equal(host._run.story.dailyUnitMessages, 0);
});

test("a letter waits for Home, then shows its channel, sender and opening lines", async () => {
  const f = fixture();
  f.host._chat = null;
  f.host._run.chatChannel = { name: "Letters", blurb: "An older saved channel record." };
  let screen = "summon";
  f.host._state = () => screen;
  f.transport(async () => incoming("world:unit:arden", "incoming-1", "Arden"));
  f.wire();
  await f.advance(60_000);
  assert.equal(f.notice(), undefined, "no card over Banners, a fight or a story");
  screen = "hud";
  f.wire();
  const notice = f.notice();
  assert.ok(notice, "the pending letter appears once the player is Home");
  const text = noticeText(notice);
  assert.match(text, /^Letters /u);
  assert.match(text, /Arden sent you a message\. How has your day been\?$/u);
  assert.deepEqual(
    noticeButtons(notice).map((item) => [item.textContent, item.className || ""]),
    [
      ["Dismiss", ""],
      ["Read message", "go"],
    ],
  );
  screen = "summon";
  f.wire();
  assert.equal(f.notice(), undefined, "leaving Home hides the card but keeps the letter");
  screen = "hud";
  f.wire();
  assert.equal(f.notice().style.animation, "none", "the same letter does not replay its arrival");
  f.dispose();
});
