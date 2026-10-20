// Beholder outlives its host element.
//
// Since Engine 2.5.0 the shortcut's eye button lives in a control window that minimizes
// on any click elsewhere in the chat, and a minimized window unmounts its content. The
// dock used to close Beholder whenever its last host element went, so that click closed
// the paper doll too (Pasta-Devs/Marinara-Agents#1474). The maintainer's decision: an
// open panel stays open until the user closes it.
//
// This loads the real dock and first-open note modules against a small fake page and
// proves: the open panel survives losing its host; pressing the shortcut again toggles
// the same panel; closing it later leaves no observer, listener or note behind; and a
// hostless panel still closes once its chat leaves the screen, because nothing else
// would tell it the chat changed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import vm from "node:vm";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const srcDir = join(repoRoot, "packages/beholder/src");

// ── A page just big enough for the dock ──────────────────────────────────────
const observers = new Set<FakeMutationObserver>();
const pendingObservers = new Set<FakeMutationObserver>();

function mutated(target: FakeElement, attribute?: string) {
  if (!target.isConnected) return;
  for (const observer of observers) {
    if (attribute && !observer.attributeFilter.includes(attribute)) continue;
    pendingObservers.add(observer);
  }
}

class FakeMutationObserver {
  attributeFilter: string[] = [];
  constructor(private readonly callback: () => void) {}
  observe(_target: FakeElement, options: { attributeFilter?: string[] }) {
    this.attributeFilter = options.attributeFilter ?? [];
    observers.add(this);
  }
  disconnect() {
    observers.delete(this);
    pendingObservers.delete(this);
  }
  deliver() {
    pendingObservers.delete(this);
    this.callback();
  }
}

/** Mutation callbacks run after the change, as a browser delivers them. */
function flushMutations() {
  for (let round = 0; pendingObservers.size > 0; round += 1) {
    assert.ok(round < 10, "mutation callbacks must settle");
    for (const observer of [...pendingObservers]) observer.deliver();
  }
}

class FakeElement {
  parentElement: FakeElement | null = null;
  children: FakeElement[] = [];
  attributes = new Map<string, string>();
  classes: Set<string>;
  style: Record<string, unknown> = { setProperty() {}, removeProperty() {} };
  dataset: Record<string, string> = {};
  innerHTML = "";
  clientWidth = 1200;
  clientHeight = 900;
  classList = {
    add: (...names: string[]) => names.forEach((name) => this.classes.add(name)),
    remove: (...names: string[]) => names.forEach((name) => this.classes.delete(name)),
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, force?: boolean) => {
      const on = force ?? !this.classes.has(name);
      if (on) this.classes.add(name);
      else this.classes.delete(name);
      return on;
    },
  };

  constructor(className = "", attributes: Record<string, string> = {}) {
    this.classes = new Set(className.split(/\s+/u).filter(Boolean));
    for (const [name, value] of Object.entries(attributes)) this.attributes.set(name, value);
  }

  get className() {
    return [...this.classes].join(" ");
  }

  set className(value: string) {
    this.classes = new Set(value.split(/\s+/u).filter(Boolean));
  }

  get isConnected(): boolean {
    return this === body || (this.parentElement?.isConnected ?? false);
  }

  appendChild(child: FakeElement) {
    child.remove();
    child.parentElement = this;
    this.children.push(child);
    mutated(this);
    return child;
  }

  remove() {
    const parent = this.parentElement;
    if (!parent) return;
    parent.children.splice(parent.children.indexOf(this), 1);
    this.parentElement = null;
    mutated(parent);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
    mutated(this, name);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  /** Class and attribute selectors, and comma lists of them: all the dock asks for. */
  matches(selector: string): boolean {
    return selector.split(",").some((compound) => {
      const parts = compound.trim().match(/\.[\w-]+|\[[^\]]+\]/gu) ?? [];
      assert.equal(parts.join(""), compound.trim(), `the fake page does not understand "${compound}"`);
      return parts.every((part) => {
        if (part.startsWith(".")) return this.classes.has(part.slice(1));
        const [name, value] = part.slice(1, -1).split("=");
        return (
          this.attributes.has(name) && (value === undefined || this.attributes.get(name) === value.replace(/"/gu, ""))
        );
      });
    });
  }

  closest(selector: string): FakeElement | null {
    return this.matches(selector) ? this : (this.parentElement?.closest(selector) ?? null);
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: 1200, height: 900 };
  }

  addEventListener() {}
  removeEventListener() {}
  focus() {}
}

const body = new FakeElement();
const windowListeners = new Map<string, Set<unknown>>();
const frames: Array<() => void> = [];
const runFrames = () => frames.splice(0).forEach((callback) => callback());

const calls = { noteboxUnmount: 0, badgesStop: 0, badgesWatch: 0 };
const BH: Record<string, any> = {
  syncToggles() {},
  fetchState: async () => ({}),
  banner: { refresh: async () => {}, refreshUpdate: async () => {} },
  locks: { enforce: async () => false, decorate() {} },
  notebox: {
    mount() {},
    unmount: () => (calls.noteboxUnmount += 1),
  },
  badges: {
    watch: () => (calls.badgesWatch += 1),
    stop: () => (calls.badgesStop += 1),
    refresh: async () => 0,
  },
  backfill: { closeMenu() {} },
  views: { close() {} },
  editor: { close() {} },
  sheet: { close() {} },
};

const context = vm.createContext({
  BH,
  console,
  document: {
    body,
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector),
    createElement: () => new FakeElement(),
  },
  window: {
    innerWidth: 1600,
    // Never seen: the first open shows the note, so closing has to take it down.
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false }),
    addEventListener(name: string, listener: unknown) {
      if (!windowListeners.has(name)) windowListeners.set(name, new Set());
      windowListeners.get(name)!.add(listener);
    },
    removeEventListener(name: string, listener: unknown) {
      windowListeners.get(name)?.delete(listener);
    },
  },
  requestAnimationFrame: (callback: () => void) => frames.push(callback),
  MutationObserver: FakeMutationObserver,
});
vm.runInContext(
  ["76-onboard.js", "80-dock.js"].map((name) => readFileSync(join(srcDir, name), "utf8")).join("\n"),
  context,
);
const dock = BH.dock;

const resizeListeners = () => windowListeners.get("resize")?.size ?? 0;

/** A Roleplay chat: the chat area with its composer, and the panel inside it. */
function chatPage(chatId: string | null) {
  body.children.splice(0).forEach((child) => (child.parentElement = null));
  const area = body.appendChild(new FakeElement("rpg-chat-area", { "data-chat-mode": "roleplay" }));
  const composerAttributes: Record<string, string> = { "data-chat-composer": "true" };
  // Engines before 2.5.0 do not name the chat on the composer.
  if (chatId) composerAttributes["data-chat-id"] = chatId;
  const composer = area.appendChild(new FakeElement("", composerAttributes));
  const panel = area.appendChild(new FakeElement("beholder-panel bh-collapsed", { "data-chat-floating-panel": "" }));
  dock.panel = panel;
  dock.hostArea = null;
  dock.chatId = "chat-a";
  dock.hostElements.clear();
  return { area, composer, panel };
}

/** The shortcut's control window sits outside the chat area, as it does since Engine 2.5.0. */
function mountShortcut() {
  const controlWindow = body.appendChild(new FakeElement("mari-window", { "data-chat-control-window": "beholder" }));
  const host = controlWindow.appendChild(new FakeElement());
  dock.registerHost(host);
  return { controlWindow, host };
}

/** A click elsewhere minimizes the control window, which unmounts the host element. */
function minimize(shortcut: { controlWindow: FakeElement; host: FakeElement }) {
  shortcut.controlWindow.remove();
  dock.releaseHost(shortcut.host);
  runFrames();
  flushMutations();
}

function assertCleanedUp(label: string) {
  assert.equal(dock.isOpen(), false, `${label}: the panel is closed`);
  assert.equal(observers.size, 0, `${label}: no observer is left watching the page`);
  assert.equal(resizeListeners(), 0, `${label}: the first-open note's resize listener is gone`);
  assert.equal(body.querySelectorAll(".beholder-onboard").length, 0, `${label}: the first-open note is gone`);
  assert.equal(frames.length, 0, `${label}: no frame callback is pending`);
}

// ── 1. Clicking elsewhere does not close an open panel ───────────────────────
{
  const { area, panel } = chatPage("chat-a");
  const shortcut = mountShortcut();
  dock.toggle();
  assert.equal(dock.isOpen(), true, "the eye button opens the panel");
  assert.equal(body.querySelectorAll(".beholder-onboard").length, 1, "the first open shows the note");
  assert.equal(resizeListeners(), 1, "the note follows the panel on resize");

  minimize(shortcut);
  assert.equal(dock.isOpen(), true, "losing the host after a click elsewhere must not close the panel");
  assert.equal(panel.isConnected, true, "the panel stays in the chat area");
  assert.equal(calls.noteboxUnmount, 0, "the note box stays with the open panel");
  assert.equal(observers.size, 1, "a hostless panel watches for its chat leaving the screen");

  // The chat keeps changing around it (a new message, say); that alone closes nothing.
  area.appendChild(new FakeElement("mari-message", { "data-message-id": "m1" }));
  flushMutations();
  assert.equal(dock.isOpen(), true, "unrelated page changes leave the panel open");

  // ── 2. The shortcut again: the same panel, toggled, never a second copy ──
  const again = mountShortcut();
  assert.equal(observers.size, 0, "a returning host takes over from the hostless watch");
  assert.equal(dock.isOpen(), true, "the eye button shows the panel as open");
  dock.toggle();
  assert.equal(body.querySelectorAll(".beholder-panel").length, 1, "there is only ever one panel");
  assertCleanedUp("toggled shut from the shortcut");
  assert.equal(calls.noteboxUnmount, 1, "closing unmounts the note box");
  assert.equal(calls.badgesStop, 1, "closing stops the message badges");
  again.controlWindow.remove();
  dock.releaseHost(again.host);
  runFrames();
}

// ── 3. Closed later with its own x: everything it set up goes with it ─────────
{
  chatPage("chat-a");
  const shortcut = mountShortcut();
  dock.toggle();
  minimize(shortcut);
  assert.equal(dock.isOpen(), true, "open and hostless before the user closes it");
  dock.close();
  assertCleanedUp("closed with its x while hostless");
}

// ── 4. Hostless, a chat switch closes it: it must not show or write the old chat ──
{
  const { area, composer } = chatPage("chat-a");
  const shortcut = mountShortcut();
  dock.toggle();
  minimize(shortcut);
  // The Engine keys the composer by chat, so a switch replaces it.
  composer.remove();
  area.appendChild(new FakeElement("", { "data-chat-composer": "true", "data-chat-id": "chat-b" }));
  flushMutations();
  assertCleanedUp("switched to another chat while hostless");
}

// ── 5. Hostless, leaving the chat view closes it ─────────────────────────────
{
  const { area } = chatPage("chat-a");
  const shortcut = mountShortcut();
  dock.toggle();
  minimize(shortcut);
  area.remove();
  flushMutations();
  assertCleanedUp("left the Roleplay chat while hostless");
}

// ── 6. Another host still mounted: the panel follows that host, unwatched ────
{
  chatPage("chat-a");
  const trackerPanel = body.appendChild(new FakeElement("tracker-panel"));
  const trackerHost = trackerPanel.appendChild(new FakeElement());
  dock.registerHost(trackerHost);
  const shortcut = mountShortcut();
  dock.toggle();
  minimize(shortcut);
  assert.equal(dock.isOpen(), true, "the Tracker Panel launcher still hosts the open panel");
  assert.equal(observers.size, 0, "with a host mounted, the host keeps the panel on the right chat");
  dock.close();
  assertCleanedUp("closed while the Tracker Panel host is mounted");
  trackerPanel.remove();
  dock.releaseHost(trackerHost);
  runFrames();
}

// ── 7. An Engine that does not name the chat: closes with its host, as before ─
{
  chatPage(null);
  const shortcut = mountShortcut();
  dock.toggle();
  minimize(shortcut);
  assertCleanedUp("hostless on an Engine without the composer's chat id");
}

// ── 8. A closed panel losing its host stays closed and unwatched ─────────────
{
  chatPage("chat-a");
  const shortcut = mountShortcut();
  minimize(shortcut);
  assert.equal(dock.isOpen(), false, "a closed panel stays closed");
  assert.equal(observers.size, 0, "nothing watches for a panel that is not open");
}

console.log("beholder host release: open panel outlives its host, and cleans up when it closes");
