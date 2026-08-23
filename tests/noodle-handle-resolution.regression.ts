import assert from "node:assert/strict";
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

// A selected account's display-name alias must never claim a handle another
// account owns exactly, or persistence would resolve it to that other account.
const collision = createNoodleHandleResolver([
  { handle: "lenak", displayName: "Persona" },
  { handle: "lena_k", displayName: "Lena K" },
]);
assert.equal(collision("lenak")?.handle, "lenak");
assert.equal(collision("Lena K")?.handle, "lena_k");

const keys = noodleHandleKeySet(accounts);
assert.ok(noodleHandleKeySetHas(keys, "@Lena Kowalska"));
assert.ok(!noodleHandleKeySetHas(keys, "@ghost"));

// Clipping is covered behaviorally in tests/noodle-generated-refresh.regression.ts.
