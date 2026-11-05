import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { setForgeStoryPortrait } from "../packages/gacha-forge/src/browser-presentation.mjs";
import { forgeChoiceLabel } from "../sources/forge-kit/player-choice-text.mjs";
import { prepareForgeStoryEntry, takeForgeStoryEntry } from "../packages/gacha-forge/src/story-entry.mjs";

test("a speaker change replaces both image buffers and never exposes a previous bitmap while loading", () => {
  const images = [0, 1].map(() => ({
    src: "old-character.png",
    hidden: false,
    complete: false,
    naturalWidth: 0,
    removeAttribute(name) {
      delete this[name];
    },
    setAttribute(name, value) {
      this[name] = value;
    },
    getAttribute(name) {
      return this[name];
    },
  }));
  const figures = [0, 1].map(() => ({
    attributes: new Set(),
    toggleAttribute(name, force) {
      if (force) this.attributes.add(name);
      else this.attributes.delete(name);
    },
    removeAttribute(name) {
      this.attributes.delete(name);
    },
    hasAttribute(name) {
      return this.attributes.has(name);
    },
  }));
  const plate = {
    querySelectorAll: () =>
      images.map((image, index) => ({
        querySelector: (selector) => (selector === "[data-img]" ? image : figures[index]),
      })),
    setAttribute() {},
  };
  setForgeStoryPortrait(plate, { art: "mari.png" });
  assert.ok(
    figures.every((figure) => figure.hasAttribute("hidden")),
    "Both SVG buffers hide their fallback",
  );
  assert.deepEqual(
    images.map((image) => [image.src, image.hidden]),
    [
      ["mari.png", true],
      ["mari.png", true],
    ],
  );
  const oldLoad = images[0].onload;
  setForgeStoryPortrait(plate, { art: "lev.png" });
  oldLoad();
  assert.equal(images[0].hidden, true, "A previous request cannot reveal the new pending bitmap");
  images[0].onload();
  assert.equal(images[0].hidden, false);
  assert.equal(images[0].src, "lev.png");
  images[1].onerror();
  assert.equal(images[1].hidden, true);
  assert.equal(
    figures[1].hasAttribute("hidden"),
    false,
    "A failed portrait leaves a neutral placeholder instead of a blank card",
  );
});

test("choice punctuation keeps existing endings and dialogue quotes intact", () => {
  assert.equal(forgeChoiceLabel("Tell him the dogs are safe"), "Tell him the dogs are safe.");
  assert.equal(forgeChoiceLabel("Ask, “Are they safe?”"), "Ask, “Are they safe?”");
  assert.equal(forgeChoiceLabel("犬を守る"), "犬を守る。");
  assert.equal(forgeChoiceLabel("Wait…"), "Wait…");
  for (const [label, expected] of [
    ["「ごめん。」", "「ごめん。」"],
    ["『ごめん！』", "『ごめん！』"],
    ["（本当に？）", "（本当に？）"],
    ["〈ごめん。〉", "〈ごめん。〉"],
    ["《ごめん。》", "《ごめん。》"],
    ["「犬を守る」", "「犬を守る」。"],
    ["犬を守る（笑）", "犬を守る（笑）。"],
  ]) {
    assert.equal(forgeChoiceLabel(label), expected);
    assert.equal(forgeChoiceLabel(forgeChoiceLabel(label)), expected, "Saved labels remain stable at display time");
  }
});

test("only a fresh scene consumes a first-line reveal; saved positions, replay and remount retain their line", () => {
  const host = { _run: { runId: "fresh-world" }, _activeStoryNode: { chapter: 2, storyIndex: 0 } };
  prepareForgeStoryEntry(host);
  assert.equal(takeForgeStoryEntry(host), true);
  assert.equal(takeForgeStoryEntry(host), false, "A fullscreen or settings remount does not restart the line");
  for (const saved of [{ resumeAt: 3 }, { startAt: 4 }, { replay: true }]) {
    prepareForgeStoryEntry(host, saved);
    assert.equal(takeForgeStoryEntry(host), false);
  }
  prepareForgeStoryEntry(host);
  host._activeStoryNode = { chapter: 3, storyIndex: 0 };
  assert.equal(takeForgeStoryEntry(host), false, "A stale scene cannot animate a different chapter");
});

test("the shipped typewriter reveals the entire dialogue or narration before showing its pending choice", async () => {
  const bundle = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  const source = bundle.slice(bundle.indexOf("function mg("), bundle.indexOf("function gg("));
  for (const speaker of ["Lev Ostrog", ""]) {
    const text =
      "The dogs. Who's got the dogs? Belka won't eat if you watch her. You've gotta turn your back, somebody has to turn their—";
    const shown = [];
    let tick;
    let rootClick;
    const textNode = { textContent: "" };
    const root = {
      addEventListener: (_name, handler) => {
        rootClick = handler;
      },
    };
    const context = vm.createContext({
      window: { matchMedia: () => ({ matches: false }) },
      Xl: () => null,
      Vo: () => "",
      Jl: () => null,
      Zl: () => "",
      Go: String,
      Ql: (segment) => segment.speaker || "Narration",
      createForgeVoiceLine: () => ({ start() {}, reveal() {}, ready: () => true, dispose() {} }),
      forgeVoiceCharacter: () => null,
      forgeStoryExpressionArt: (character) => character,
      setInterval: (handler) => {
        tick = handler;
        return 1;
      },
      clearInterval() {},
      setTimeout() {},
      clearTimeout() {},
    });
    const mg = vm.runInContext(`${source};mg`, context);
    const nodes = new Map([
      [".root", root],
      ["[data-text]", textNode],
    ]);
    const node = () => ({ hidden: false, setAttribute() {}, removeAttribute() {}, addEventListener() {} });
    const host = { querySelector: (selector) => nodes.get(selector) || (selector.includes("plate") ? null : node()) };
    const choices = {
      show(index) {
        if (index === 1) {
          assert.equal(textNode.textContent, text);
          shown.push(index);
          return true;
        }
        return false;
      },
      mainIndex: (index) => index,
      blocked: (index) => index === 1,
      hasPending: () => true,
      attach() {},
    };
    mg(host, {
      segments: [
        { speaker: "", text: "Before the choice." },
        { speaker, text },
      ],
      choicePlayback: choices,
      revealFirst: true,
    });
    assert.equal(textNode.textContent, "", "A new chapter enters with its first line still unrevealed");
    for (let index = 0; index < "Before the choice.".length; index += 1) tick();
    assert.equal(textNode.textContent, "Before the choice.");
    rootClick({ target: { closest: () => null } });
    for (let index = 0; index < text.length - 1; index += 1) tick();
    assert.equal(shown.length, 0);
    tick();
    assert.deepEqual(shown, [1]);
    assert.equal(textNode.textContent, text);
  }
});
