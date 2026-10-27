import assert from "node:assert/strict";
import { test } from "node:test";
import {
  forgeMaterialDestination,
  openForgeMaterial,
  revealForgeMaterialDomain,
} from "../packages/gacha-forge/src/material-navigation.mjs";

test("unit materials lead to their real source, including event-only Mandates", () => {
  assert.deepEqual(forgeMaterialDestination("sigil:fire:2"), { stage: "asc", family: "sigil:fire" });
  assert.deepEqual(forgeMaterialDestination("doctrine:mage:1"), { stage: "asc", family: "doctrine:mage" });
  assert.deepEqual(forgeMaterialDestination("tenet:water:3"), { stage: "form", family: "tenet:water" });
  assert.deepEqual(forgeMaterialDestination("core"), { stage: "xp" });
  assert.deepEqual(forgeMaterialDestination("funds"), { stage: "funds" });
  assert.deepEqual(forgeMaterialDestination("mandate:any:1"), { event: "login" });
  assert.equal(forgeMaterialDestination("unknown"), null);
});

test("opening a material preserves farming locks and does not spend resources or start a battle", async () => {
  const calls = [];
  const host = {
    _run: { runId: "fixture" },
    _farm: { today: 0, locked: ["form"], formWheel: [{ id: "tenet:water", days: [2, 6] }] },
    _farmRev: 0,
    _renderBrowser: () => calls.push("render"),
    _loadFarm: () => calls.push("read"),
  };
  openForgeMaterial(host, "tenet:water:2");
  assert.equal(host._hudView, "farm");
  assert.equal(host._farmView, "root", "A locked domain remains on the ordinary locked Materials overview");
  assert.deepEqual(calls, ["render", "read"]);
  openForgeMaterial(host, "mandate:any:1");
  assert.equal(host._hudView, "events");
  assert.equal(host._eventId, "login");
});

test("a rotated material opens the next available calendar day without unlocking it", async () => {
  let renders = 0;
  const target = { stage: "asc", family: "doctrine:mage" };
  const host = {
    _hudView: "farm",
    _farmView: "asc",
    _farmState: "ready",
    _farmDay: null,
    _forgeMaterialTarget: target,
    _farm: { today: 5, wheel: [{ id: "doctrine:mage", days: [1, 6] }] },
    _renderBrowser: () => {
      renders += 1;
    },
  };
  revealForgeMaterialDomain(host);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(host._farmDay, 6);
  assert.equal(renders, 1);
  assert.deepEqual(host._farm.wheel[0].days, [1, 6]);
});
