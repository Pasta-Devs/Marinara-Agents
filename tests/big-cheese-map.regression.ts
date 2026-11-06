import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/index.js";
import { HAFENKAI_PLACE } from "../packages/big-cheese/src/engine/packages/server/src/services/big-cheese/core/kits/hafenkai.js";
import {
  circleLayout,
  MAP_SIZE,
} from "../packages/big-cheese/src/engine/packages/client/src/features/big-cheese/mapLayout.js";

test("map: hidden relations never leave the server until the boss knows them", () => {
  const s = core.newRun(core.HAFENKAI, 1);
  s.relations = [
    { a: "mira", b: "sven", kind: "crush", level: 70 },
    { a: "henrike", b: "sven", kind: "friend", level: 50 },
  ];
  assert.deepEqual(core.knownMap(s, []), [{ a: "henrike", b: "sven", kind: "friend", secret: false }]);
  const known = core.knownMap(s, ["mira|sven"]);
  assert.equal(known.length, 2);
  assert.equal(known.find((r) => r.kind === "crush")!.secret, true);
  assert.ok(!JSON.stringify(core.knownMap(s, [])).includes("crush"));
});

test("map: people who left are not on the map", () => {
  const s = core.newRun(core.HAFENKAI, 1);
  s.relations = [{ a: "henrike", b: "nobody", kind: "friend", level: 50 }];
  assert.deepEqual(core.knownMap(s, []), []);
});

test("map: the circle layout keeps every person apart and inside the square", () => {
  const ids = HAFENKAI_PLACE.people.map((p) => p.id);
  const at = circleLayout(ids);
  assert.equal(Object.keys(at).length, ids.length);
  assert.equal(at[ids[0]].x, MAP_SIZE / 2);
  assert.ok(at[ids[0]].y < MAP_SIZE / 2);
  const spots = new Set(Object.values(at).map((p) => `${p.x},${p.y}`));
  assert.equal(spots.size, ids.length);
  for (const { x, y } of Object.values(at)) assert.ok(x >= 40 && x <= MAP_SIZE - 40 && y >= 40 && y <= MAP_SIZE - 40);
  assert.deepEqual(circleLayout([]), {});
});
