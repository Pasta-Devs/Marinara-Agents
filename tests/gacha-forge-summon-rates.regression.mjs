// Exercise the actual shipped roll, without provider calls or player data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url), "utf8");
const constants = source.slice(source.indexOf("var ny=.006,"), source.indexOf("function NA("));
const rollSource = source.slice(source.indexOf("function MA("), source.indexOf("function RA("));
assert.ok(constants.startsWith("var ny=.006,"));
assert.ok(rollSource.startsWith("function MA("));

function fixture(random) {
  const math = Object.create(Math);
  math.random = random;
  const context = vm.createContext({ Math: math });
  vm.runInContext(constants + rollSource, context);
  return (state, weapon = false) => {
    context.state = state;
    context.weapon = weapon;
    return vm.runInContext("MA(state, weapon ? ay : ny, weapon ? oy : ry)", context);
  };
}

test("characters and weapons can roll five stars on the first pull, below their published thresholds", () => {
  for (const [weapon, probability] of [
    [false, 0.006],
    [true, 0.007],
  ]) {
    const state = { count: 0, since4: 0 };
    assert.equal(fixture(() => probability - 0.000001)(state, weapon), 5);
    assert.equal(state.count, 0);
    assert.notEqual(fixture(() => probability)({ count: 0, since4: 0 }, weapon), 5);
  }
});

test("soft pity ramps from pull 74, hard pity guarantees 80, and four-star pity remains independent", () => {
  const high = fixture(() => 0.999999);
  assert.notEqual(high({ count: 78, since4: 0 }), 5);
  assert.equal(high({ count: 79, since4: 0 }), 5);
  assert.notEqual(fixture(() => 0.01)({ count: 72, since4: 0 }), 5);
  assert.equal(fixture(() => 0.01)({ count: 73, since4: 0 }), 5);
  assert.equal(high({ count: 0, since4: 9 }), 4);
  const state = { count: 79, since4: 9 };
  assert.equal(high(state), 5);
  assert.deepEqual(state, { count: 0, since4: 0 });
});

test("a seeded distribution of ordinary pulls agrees with both base rates", () => {
  let seed = 0x6f726765;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0), seed / 2 ** 32);
  const roll = fixture(random);
  const count = 100000;
  for (const [weapon, rate] of [
    [false, 0.006],
    [true, 0.007],
  ]) {
    let fives = 0;
    for (let index = 0; index < count; index += 1) if (roll({ count: 0, since4: 0 }, weapon) === 5) fives += 1;
    const expected = count * rate;
    assert.ok(Math.abs(fives - expected) < 5 * Math.sqrt(expected * (1 - rate)), `${fives}/${count}, expected ${rate}`);
    process.stdout.write(`${weapon ? "Weapon" : "Character"} ordinary five-star rolls: ${fives}/${count}.\n`);
  }
});
