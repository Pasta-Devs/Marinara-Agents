// Package-owned scroll/observer boundaries. Real geometry and caret input are covered by browser QA.
import assert from "node:assert/strict";
import { wireForgeBrowserFullscreen } from "../packages/gacha-forge/src/browser-presentation.mjs";

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
try {
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
