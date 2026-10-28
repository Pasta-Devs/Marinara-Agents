import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slurp2Source } from "./slurp2-source";

const source = slurp2Source("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");
const expected = readFileSync(join(import.meta.dirname, "fixtures/slurp2-storage-methods.txt"), "utf8")
  .trim()
  .split("\n")
  .filter(Boolean);
const methods = [...source.matchAll(/^\s*async ([A-Za-z_$][\w$]*)\s*\(/gmu)].map((match) => match[1]);
assert.equal(new Set(methods).size, methods.length, "storage method names must be unique");
assert.deepEqual([...methods].sort(), [...expected].sort());
assert.match(source, /createSlurpStorageContext/u);
assert.match(source, /createCreatorsStorage|createFeedPostStorage|createEconomyStorage/u);
assert.match(source, /transaction\(/u);
console.log(`slurp2 storage methods: ${methods.length}`);
console.log(methods.sort().join("\n"));
