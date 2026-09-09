import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const table = JSON.parse(readFileSync(new URL("../packages/pixelforge/gm-verbs.json", import.meta.url), "utf8"));
const weather = table.verbs.find((verb) => verb.name === "weather");
assert.equal(weather.effect, "state");
assert.equal(weather.metadataKey, "pixelforgeWeather");
assert.deepEqual(
  weather.args.map((arg) => arg.name),
  ["word", "intensity"],
  "the GM cannot supply stale day bounds",
);
assert.deepEqual(weather.args[0].enum, ["fair", "overcast", "rain", "storm", "snow"]);
assert.deepEqual(weather.args[1].enum, ["light", "heavy"]);
assert.equal(weather.args[1].optional, true);
assert.ok(
  !table.verbs.some((verb) => ["advanceDays", "fishBite"].includes(verb.name)),
  "relative and tuning verbs remain deferred",
);
console.log("Pixelforge weather contract remains word/intensity only; day and relative verbs are withheld.");
