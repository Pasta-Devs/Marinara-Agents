import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  forgeVigorRemaining,
  stampForgeVigorWallet,
  startForgeVigorClock,
  wireForgeVigorWallet,
} from "../packages/gacha-forge/src/vigor-clock-client.mjs";

const PERIOD = 180_000;

test("a stamped wallet counts down from its reply instead of repeating the reply's delay", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const wallet = stampForgeVigorWallet({ vigor: 75, vigorMax: 78, vigorNextMs: 160_000, vigorPerMs: PERIOD }, null);
  assert.equal(wallet.vigorNextMs, 160_000);
  t.mock.timers.tick(30_000);
  assert.equal(wallet.vigorNextMs, 130_000);
  // Spreading a live wallet copies the current value, so a merge keeps the same deadline.
  const merged = stampForgeVigorWallet({ ...wallet, funds: 10 }, wallet);
  assert.equal(merged.vigorNextMs, 130_000);
  assert.equal(JSON.parse(JSON.stringify(merged)).vigorNextMs, 130_000);
});

test("a reply without a delay keeps the running countdown instead of blanking it", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const host = {};
  wireForgeVigorWallet(host);
  host._wallet = { vigor: 70, vigorMax: 78, vigorNextMs: 90_000, vigorPerMs: PERIOD };
  t.mock.timers.tick(10_000);
  host._wallet = { ...host._wallet, ...{ vigor: 70, funds: 5 } };
  assert.equal(host._wallet.vigorNextMs, 80_000);
  host._wallet = { vigor: 70, vigorMax: 78, funds: 6 };
  assert.equal(host._wallet.vigorNextMs, 80_000);
});

test("spending from full starts the countdown from the server's restore time", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 5_000_000 });
  const host = { _run: { vigorPerMs: PERIOD } };
  wireForgeVigorWallet(host);
  host._wallet = { vigor: 78, vigorMax: 78, vigorNextMs: null, vigorPerMs: PERIOD };
  assert.equal(host._wallet.vigorNextMs, null);
  host._wallet = { ...host._wallet, vigor: 73, vigorAt: 5_000_000, vigorNextMs: undefined };
  assert.equal(host._wallet.vigorNextMs, PERIOD);
});

test("full Vigor never shows a countdown, and a landed point rolls the countdown over", () => {
  assert.equal(forgeVigorRemaining(1_000, 78, 78, PERIOD, 0), null);
  assert.equal(forgeVigorRemaining(1_000, 70, 78, PERIOD, 1_500), PERIOD - 500);
  assert.equal(forgeVigorRemaining(1_000, 77, 78, PERIOD, 1_500), null);
  assert.equal(forgeVigorRemaining(null, 70, 78, PERIOD, 0), null);
});

test("the clock writes the live countdown each second and refreshes once per landed point", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: 0 });
  const node = { textContent: "" };
  const root = { querySelector: (selector) => (selector === "[data-vigor-next]" ? node : null) };
  let deadline = 2_500;
  let landed = 0;
  const stop = startForgeVigorClock(root, {
    read: () => forgeVigorRemaining(deadline, 70, 78, 10_000),
    format: (ms) => `${Math.ceil(ms / 1000)}s`,
    onLanded: () => {
      landed += 1;
    },
  });
  assert.equal(node.textContent, "3s");
  t.mock.timers.tick(2_000);
  assert.equal(node.textContent, "1s");
  t.mock.timers.tick(1_000);
  assert.equal(node.textContent, "10s");
  assert.equal(landed, 1);
  deadline = null;
  t.mock.timers.tick(1_000);
  assert.equal(node.textContent, "");
  assert.equal(landed, 2);
  stop();
});

test("a point that landed while no clock watched asks for fresh state once, not on every re-render", (t) => {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: 10_000 });
  const node = { textContent: "" };
  const root = { querySelector: () => node };
  let landed = 0;
  const options = {
    read: () => forgeVigorRemaining(5_000, 77, 78, 10_000),
    due: () => 5_000,
    format: (ms) => `${ms}`,
    onLanded: () => {
      landed += 1;
    },
  };
  const first = startForgeVigorClock(root, options);
  assert.equal(landed, 1, "the bar came back after the last point landed");
  assert.equal(node.textContent, "", "full Vigor shows no countdown");
  first();
  const second = startForgeVigorClock(root, options);
  t.mock.timers.tick(3_000);
  assert.equal(landed, 1, "a re-rendered clock does not ask again for the same point");
  second();
});

test("the bundles wire the live wallet and clock, and water beats fire", async () => {
  const client = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8");
  const shared = await readFile(
    new URL("../packages/gacha-forge/src/formation-combat-shared.mjs", import.meta.url),
    "utf8",
  );
  assert.ok(client.includes('this._bannerState="idle",wireForgeVigorWallet(this),'));
  assert.ok(
    client.includes(
      "this._stopVigorClock=startForgeVigorClock(this._root,{format:cs,read:()=>this._wallet?this._wallet.vigorNextMs:null,due:()=>this._wallet?this._wallet.vigorNextAt:null,",
    ),
  );
  assert.ok(!client.includes("this._stopVigorClock=fc("));
  // Each element beats the next: water > fire > earth > wind > water. The Home graph draws this map.
  assert.ok(client.includes('var ao={fire:"earth",earth:"wind",wind:"water",water:"fire",light:"dark",dark:"light"}'));
  assert.ok(server.includes('var pc={fire:"earth",earth:"wind",wind:"water",water:"fire",light:"dark",dark:"light"}'));
  assert.ok(
    shared.includes('{ fire: "earth", earth: "wind", wind: "water", water: "fire", light: "dark", dark: "light" }'),
  );
});
