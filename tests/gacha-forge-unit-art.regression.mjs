import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { captureForgeUnitPortrait, restoreForgeUnitPortrait } from "../packages/gacha-forge/src/unit-art-client.mjs";

const source = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
const start = source.indexOf("_loadRoster(){");
const end = source.indexOf("_openUnit(", start);
assert.ok(start >= 0 && end > start);
const Client = new Function(`return class {${source.slice(start, end)}}`)();
const cards = [{ id: "keeper", name: "Keeper", portrait: "fixture://saved-portrait" }];
const tick = () => new Promise(setImmediate);
function fixture(initial = cards, state = "ready") {
  const host = Object.assign(new Client(), {
    _run: { runId: "synthetic-art-proof" },
    _hudView: "roster",
    _roster: initial,
    _rosterState: state,
    _rosterCount: 0,
    _rosterRev: 7,
  });
  const rendered = [];
  let resolve;
  host._renderBrowser = () => rendered.push(host._rosterState);
  host._postJson = (path, body) => {
    assert.equal(path, "/roster");
    assert.equal(body.runId, host._run.runId);
    return new Promise((done) => {
      resolve = done;
    });
  };
  host._loadRoster();
  return { host, rendered, respond: (response) => resolve(response) };
}

test("identical cached cards preserve their array and render revision while refreshing ready/count metadata", async () => {
  const f = fixture(cards, "idle");
  f.respond({ ok: true, cards: structuredClone(cards) });
  await tick();
  assert.equal(f.host._roster, cards);
  assert.equal(f.host._rosterRev, 7);
  assert.equal(f.host._rosterState, "ready");
  assert.equal(f.host._rosterCount, 1);
});

test("changed artwork and card details replace the cached payload and advance its revision once", async () => {
  const updated = [{ ...cards[0], name: "Keeper updated", portrait: "fixture://new-portrait" }];
  const f = fixture();
  f.respond({ ok: true, cards: updated });
  await tick();
  assert.equal(f.host._roster, updated);
  assert.equal(f.host._rosterRev, 8);
  assert.equal(f.host._rosterCount, 1);
  assert.equal(f.host._rosterState, "ready");
});

test("an empty first load still leaves loading and adopts new cards", async () => {
  const f = fixture([], "idle");
  assert.equal(f.rendered[0], "loading");
  f.respond({ ok: true, cards: structuredClone(cards) });
  await tick();
  assert.equal(f.host._rosterRev, 8);
  assert.equal(f.host._rosterCount, 1);
  assert.equal(f.host._rosterState, "ready");
});

test("an unchanged empty response still updates loading metadata without a redundant card revision", async () => {
  const initial = [];
  const f = fixture(initial, "idle");
  assert.equal(f.rendered[0], "loading");
  f.respond({ ok: true, cards: [] });
  await tick();
  assert.equal(f.host._roster, initial);
  assert.equal(f.host._rosterRev, 7);
  assert.equal(f.host._rosterCount, 0);
  assert.equal(f.host._rosterState, "ready");
});

test("a rejected background refresh keeps the saved cards and their revision", async () => {
  const f = fixture();
  f.respond({ ok: false, error: "controlled-unavailable" });
  await tick();
  assert.equal(f.host._roster, cards);
  assert.equal(f.host._rosterRev, 7);
  assert.equal(f.host._rosterState, "ready");
});

function portraitFixture() {
  const host = {
    _lastScreen: "unit",
    _rosterUnitId: "keeper",
    _portraitOpen: false,
    ownerDocument: { baseURI: "https://forge.test/game/" },
  };
  const frame = (unitId = "keeper", source = "/saved/portrait.png", loaded = true) => {
    const image = {
      complete: loaded,
      naturalWidth: loaded ? 200 : 0,
      currentSrc: new URL(source, host.ownerDocument.baseURI).href,
      getAttribute: () => source,
    };
    const node = {
      image,
      querySelector: () => image,
      closest: () => ({ getAttribute: () => unitId }),
      replaceWith: (replacement) => {
        host.current = replacement;
      },
    };
    return node;
  };
  host.current = frame();
  host._root = { querySelector: () => host.current };
  return { host, frame };
}

test("an unchanged successfully decoded portrait is retained across a unit render with normalized URLs", () => {
  const f = portraitFixture();
  const original = f.host.current;
  const saved = captureForgeUnitPortrait(f.host, "unit");
  assert.ok(saved);
  f.host.current = f.frame("keeper", "https://forge.test/saved/portrait.png", false);
  restoreForgeUnitPortrait(f.host, saved);
  assert.equal(f.host.current, original);
  assert.equal(f.host.current.image.complete, true);
});

test("a different unit, artwork URL or selected outfit keeps its new portrait", () => {
  for (const [unitId, source] of [
    ["another-unit", "/saved/portrait.png"],
    ["keeper", "/replacement/portrait.png"],
    ["keeper", "/outfits/raincoat.png"],
  ]) {
    const f = portraitFixture();
    const saved = captureForgeUnitPortrait(f.host, "unit");
    f.host._rosterUnitId = unitId;
    const replacement = f.frame(unitId, source);
    f.host.current = replacement;
    restoreForgeUnitPortrait(f.host, saved);
    assert.equal(f.host.current, replacement);
  }
});

test("initial unit entry, other screens and the portrait studio use their normal rendering", () => {
  for (const mutate of [
    (f) => {
      f.host._lastScreen = "roster";
    },
    (f) => {
      f.host._portraitOpen = true;
    },
  ]) {
    const f = portraitFixture();
    mutate(f);
    assert.equal(captureForgeUnitPortrait(f.host, "unit"), null);
  }
  assert.equal(captureForgeUnitPortrait(portraitFixture().host, "roster"), null);
});

test("loading, failed, missing or replaced image resources are never captured as decoded art", () => {
  for (const mutate of [
    (f) => {
      f.host.current.image.complete = false;
    },
    (f) => {
      f.host.current.image.naturalWidth = 0;
    },
    (f) => {
      f.host.current.querySelector = () => null;
    },
    (f) => {
      f.host.current.image.getAttribute = () => "";
    },
    (f) => {
      f.host.current.image.currentSrc = "https://forge.test/previous/portrait.png";
    },
  ]) {
    const f = portraitFixture();
    mutate(f);
    assert.equal(captureForgeUnitPortrait(f.host, "unit"), null);
  }
});

test("a portrait that stops being decoded before restoration cannot replace fresh markup", () => {
  const f = portraitFixture();
  const saved = captureForgeUnitPortrait(f.host, "unit");
  saved.image.naturalWidth = 0;
  const replacement = f.frame();
  f.host.current = replacement;
  restoreForgeUnitPortrait(f.host, saved);
  assert.equal(f.host.current, replacement);
});
