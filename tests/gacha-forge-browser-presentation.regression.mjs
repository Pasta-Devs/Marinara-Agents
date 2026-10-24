// Package-owned scroll/observer boundaries. Real geometry and caret input are covered by browser QA.
import assert from "node:assert/strict";
import {
  bindForgeExpandedEditor,
  captureForgeExpandedEditor,
  restoreForgeExpandedEditor,
  wireForgeBrowserFullscreen,
} from "../packages/gacha-forge/src/browser-presentation.mjs";

const original = Object.fromEntries(
  ["ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle"].map((key) => [
    key,
    globalThis[key],
  ]),
);
const frames = new Map();
const observers = [];
let next = 0;
globalThis.requestAnimationFrame = (callback) => (frames.set(++next, callback), next);
globalThis.cancelAnimationFrame = (id) => frames.delete(id);
globalThis.getComputedStyle = (element) => ({ overflowY: element.overflowY ?? "visible" });
globalThis.ResizeObserver = class {
  constructor(callback) {
    this.callback = callback;
    this.targets = [];
    observers.push(this);
  }
  observe(element) {
    this.targets.push(element);
  }
  disconnect() {
    this.disconnected = true;
    this.targets = [];
  }
};
function flush() {
  for (const [id, callback] of [...frames]) {
    frames.delete(id);
    callback();
  }
}
function style() {
  const values = new Map();
  return { setProperty: (name, value) => values.set(name, value), getPropertyValue: (name) => values.get(name) };
}
function fixture() {
  const root = new EventTarget();
  const attributes = new Map();
  const stage = {
    clientHeight: 100,
    style: style(),
    toggleAttribute: (name, value) => attributes.set(name, value),
    getBoundingClientRect: () => ({ top: 20, bottom: 120 }),
    parentElement: root,
  };
  const panel = {
    clientTop: 0,
    clientHeight: 84,
    scrollHeight: 800,
    scrollTop: 0,
    overflowY: "auto",
    getBoundingClientRect: () => ({ top: 28, bottom: 112 }),
    parentElement: stage,
  };
  let fieldTop = 300;
  const field = {
    value: "A draft with a caret at the end.",
    selectionStart: 31,
    matches: () => true,
    getBoundingClientRect: () => ({ top: fieldTop - panel.scrollTop, bottom: fieldTop + 44 - panel.scrollTop }),
    parentElement: panel,
  };
  const arena = {};
  const view = { style: style(), querySelector: () => header };
  const header = { offsetHeight: 44 };
  root.activeElement = field;
  root.querySelectorAll = () => [];
  root.querySelector = (selector) =>
    ({
      "[data-forge-browser-layout]": {},
      ".gf-arena": arena,
      ".gf-stage": stage,
      ".gf-stage > .gf-view": view,
    })[selector] ?? null;
  const host = { _root: root };
  return { host, root, stage, panel, field, view, header, attributes, moveField: (top) => (fieldTop = top) };
}
let count = 0;
function test(name, callback) {
  callback();
  console.info(`ok ${++count} - ${name}`);
}
function editorFixture() {
  const root = new EventTarget();
  const host = { _root: root, _run: { runId: "world-one" }, _lastScreen: "settings", _settingsCategory: "advanced" };
  root.host = host;
  const field = {
    value: "Unsaved words.",
    selectionStart: 2,
    selectionEnd: 7,
    selectionDirection: "backward",
    scrollTop: 30,
    setSelectionRange(start, end, direction) {
      Object.assign(this, { selectionStart: start, selectionEnd: end, selectionDirection: direction });
    },
    focus() {
      root.activeElement = this;
    },
  };
  const close = {
    focus() {
      root.activeElement = this;
    },
  };
  const popup = { contains: (node) => node === field || node === close };
  const source = new EventTarget();
  source.tagName = "TEXTAREA";
  source.value = "Persisted words.";
  const trigger = { getAttribute: () => "guidelines-image" };
  let rebound;
  let attached;
  root.querySelector = (selector) =>
    selector === ".ob-xv"
      ? popup
      : {
          appendChild: (node) => {
            attached = node;
          },
        };
  root.querySelectorAll = () => [trigger];
  root.getElementById = () => source;
  root.activeElement = field;
  bindForgeExpandedEditor(root, popup, "guidelines-image", field, (nextSource, nextTrigger) => {
    rebound = { source: nextSource, trigger: nextTrigger };
  });
  return { host, root, field, close, popup, source, trigger, rebound: () => rebound, attached: () => attached };
}
try {
  test("a text popup retains its native draft, caret and scroll while rebinding the newly rendered field", () => {
    const f = editorFixture();
    const saved = captureForgeExpandedEditor(f.host, "settings");
    let inputs = 0;
    f.source.addEventListener("input", () => inputs++);
    f.root.activeElement = null;
    restoreForgeExpandedEditor(f.host, saved);
    assert.equal(f.attached(), f.popup);
    assert.deepEqual(f.rebound(), { source: f.source, trigger: f.trigger });
    assert.equal(f.source.value, "Unsaved words.");
    assert.equal(inputs, 1);
    assert.equal(f.root.activeElement, f.field);
    assert.deepEqual(
      [f.field.selectionStart, f.field.selectionEnd, f.field.selectionDirection, f.field.scrollTop],
      [2, 7, "backward", 30],
    );
  });
  test("popup retention is fenced to its original world, screen and category and excludes list popups", () => {
    for (const change of [
      (f) => {
        f.host._run = { runId: "world-two" };
      },
      (f) => {
        f.host._settingsCategory = "visual";
      },
      (f) => {
        delete f.popup._forgeEditor;
      },
    ]) {
      const f = editorFixture();
      change(f);
      assert.equal(captureForgeExpandedEditor(f.host, "settings"), null);
    }
    assert.equal(captureForgeExpandedEditor(editorFixture().host, "hud"), null);
    const setup = editorFixture();
    delete setup.popup._forgeEditor;
    setup.host._lastScreen = "setup";
    bindForgeExpandedEditor(setup.root, setup.popup, "guidelines-image", setup.field, () => {});
    assert.equal(captureForgeExpandedEditor(setup.host, "setup"), null);
  });
  test("retention keeps Close focus and does not steal focus back from an Engine control", () => {
    const f = editorFixture();
    f.root.activeElement = f.close;
    restoreForgeExpandedEditor(f.host, captureForgeExpandedEditor(f.host, "settings"));
    assert.equal(f.root.activeElement, f.close);
    const outside = {};
    f.root.activeElement = outside;
    restoreForgeExpandedEditor(f.host, captureForgeExpandedEditor(f.host, "settings"));
    assert.equal(f.root.activeElement, outside);
  });
  test("a focused shadow-root field is revealed inside its own scroll panel without changing its draft or caret", () => {
    const f = fixture();
    wireForgeBrowserFullscreen(f.host);
    assert.equal(f.panel.scrollTop, 236);
    assert.equal(f.field.getBoundingClientRect().bottom, 108);
    assert.equal(f.stage.style.getPropertyValue("--forge-editor-height"), "84px");
    assert.equal(f.attributes.get("data-forge-editing"), true);
    assert.equal(f.field.value, "A draft with a caret at the end.");
    assert.equal(f.field.selectionStart, 31);
    f.host._stopForgeBrowserPresentation();
  });
  test("focus changes reveal fields above the panel and leave already-visible fields alone", () => {
    const f = fixture();
    f.moveField(50);
    wireForgeBrowserFullscreen(f.host);
    assert.equal(f.panel.scrollTop, 0);
    f.panel.scrollTop = 100;
    f.root.dispatchEvent(new Event("focusin"));
    flush();
    assert.equal(f.field.getBoundingClientRect().top, 32);
    f.host._stopForgeBrowserPresentation();
  });
  test("resizing the actual package reveals the same focused field again", () => {
    const f = fixture();
    f.moveField(50);
    wireForgeBrowserFullscreen(f.host);
    f.moveField(240);
    observers.at(-1).callback();
    flush();
    assert.equal(f.field.getBoundingClientRect().bottom, 108);
    f.host._stopForgeBrowserPresentation();
  });
  test("scene framing follows the measured header after a responsive reflow", () => {
    const f = fixture();
    wireForgeBrowserFullscreen(f.host);
    assert.equal(f.view.style.getPropertyValue("--forge-scene-top"), "44px");
    f.header.offsetHeight = 68;
    observers.at(-1).callback();
    flush();
    assert.equal(f.view.style.getPropertyValue("--forge-scene-top"), "68px");
    f.host._stopForgeBrowserPresentation();
  });
  test("non-text controls restore the normal package header", () => {
    const f = fixture();
    wireForgeBrowserFullscreen(f.host);
    f.field.matches = () => false;
    f.root.dispatchEvent(new Event("focusout"));
    flush();
    assert.equal(f.attributes.get("data-forge-editing"), false);
    f.host._stopForgeBrowserPresentation();
  });
  test("render replacement and unmount disconnect observers, focus listeners and queued frames", () => {
    const f = fixture();
    wireForgeBrowserFullscreen(f.host);
    const old = observers.at(-1);
    wireForgeBrowserFullscreen(f.host);
    assert.equal(old.disconnected, true);
    f.root.dispatchEvent(new Event("focusin"));
    assert.equal(frames.size, 1);
    f.host._stopForgeBrowserPresentation();
    assert.equal(observers.at(-1).disconnected, true);
    assert.equal(frames.size, 0);
    f.root.dispatchEvent(new Event("focusin"));
    assert.equal(frames.size, 0);
    assert.equal(f.host._stopForgeBrowserPresentation, null);
  });
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
}
