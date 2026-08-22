import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createNoodleHandleResolver,
  noodleHandleKeySet,
  noodleHandleKeySetHas,
} from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-handle";

const accounts = [
  { handle: "lena_k", displayName: "Lena Kowalska" },
  { handle: "mari", displayName: "Professor Mari" },
  { handle: "lenak", displayName: "Lena K" },
];
const resolve = createNoodleHandleResolver(accounts);

// Exact handles always win, including when another account's alias collides.
assert.equal(resolve("@lena_k")?.handle, "lena_k");
assert.equal(resolve("lenak")?.handle, "lenak");
assert.equal(resolve("MARI")?.handle, "mari");

// Punctuation loss and display names are the common local-model answers.
assert.equal(resolve("@Lena Kowalska")?.handle, "lena_k");
assert.equal(resolve("Professor Mari")?.handle, "mari");
assert.equal(resolve("nobody"), undefined);
assert.equal(resolve(null), undefined);

const keys = noodleHandleKeySet(accounts);
assert.ok(noodleHandleKeySetHas(keys, "@Lena Kowalska"));
assert.ok(!noodleHandleKeySetHas(keys, "@ghost"));

// Over-long generated text is clipped, not discarded with the whole row.
const generatedRefresh = readFileSync(
  "packages/noodle/src/engine/packages/server/src/services/noodle/noodle-generated-refresh.ts",
  "utf8",
);
assert.match(generatedRefresh, /clipGeneratedContent\(collection, row\)/u);
assert.match(generatedRefresh, /content: content\.slice\(0, limit\)/u);
