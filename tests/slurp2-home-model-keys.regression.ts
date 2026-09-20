import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

/**
 * Every Home screen destructures its callbacks out of the one object `useSlurpHomeState` returns.
 * A key missing from that object is not a type error at the call site, so `onNavigate` once went
 * missing and every button on the Creator profile threw "is not a function" on click.
 */
const state = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/slp-home-state.ts");
const actions = slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/slp-home-actions.ts");

/** The shorthand keys of every top-level `return { ... };` block in a module. */
function returnedKeys(source: string): string[] {
  const keys: string[] = [];
  for (let at = source.indexOf("\n  return {"); at !== -1; at = source.indexOf("\n  return {", at + 1)) {
    const end = source.indexOf("\n  };", at);
    if (end === -1) continue;
    for (const line of source.slice(at, end).split("\n")) {
      const key = line.match(/^ {4}([A-Za-z_$][\w$]*),$/)?.[1];
      if (key) keys.push(key);
    }
  }
  return keys;
}

// `useSlurpHomeState` is the base state spread over the actions, so the model is both returns.
// Assert that composition, or dropping a spread would strip a whole half of the model while the
// key scan below still found its keys in the module that no longer reaches the screens.
assert.match(
  actions.slice(actions.indexOf("export function useSlurpHomeState")).replace(/\s+/gu, " "),
  /return \{ \.\.\.state, \.\.\.useSlurpHomeActions\(state\) \};/u,
  "the Home model must stay the base state spread over the actions",
);
const stateKeys = returnedKeys(state);
const modelKeys = new Set([...stateKeys, ...returnedKeys(actions)]);
assert.ok(stateKeys.length > 50, "the Home state return block was not found");
assert.ok(modelKeys.has("onNavigate"), "the Home model must expose onNavigate");

// The drafts map holds post drafts keyed by profile id. A stray callback in it is the bug's twin.
const drafts = state.slice(state.indexOf("const updateNoodlerPostDraft"), state.indexOf("const clearNoodlerPostDraft"));
assert.ok(!drafts.includes("onNavigate"), "post drafts must not carry navigation callbacks");

for (const screen of [
  "packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpHomeCreatorFlow.tsx",
  "packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpHomeDestinations.tsx",
]) {
  const source = slurp2Source(screen);
  const block = source.slice(0, source.indexOf("} = model;"));
  const used = block
    .slice(block.lastIndexOf("const {"))
    .split("\n")
    .flatMap((line) => line.match(/^ {4}([A-Za-z_$][\w$]*),$/)?.slice(1) ?? []);
  assert.ok(used.length > 0, `${screen} destructures nothing from the model`);
  assert.deepEqual(
    used.filter((key) => !modelKeys.has(key)),
    [],
    `${screen} reads model keys the Home model never returns`,
  );
}

console.log("slurp2 home model keys regression passed");
