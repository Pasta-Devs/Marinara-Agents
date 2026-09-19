import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const client = "packages/slurp2/src/engine/packages/client/src";

const router = read(`${client}/slp/app/SlpRouter.tsx`);
const homeState = read(`${client}/slp/app/slp-home-state.ts`);
const actions = read(`${client}/slp/app/slp-home-actions.ts`);
const creatorFlow = read(`${client}/slp/app/screens/SlpHomeCreatorFlow.tsx`);
const destinations = read(`${client}/slp/app/screens/SlpHomeDestinations.tsx`);

assert.doesNotMatch(router, /if \(navigation\.mode !== "creator"\) return null/u);
assert.match(homeState, /export interface SlurpHomeProps \{\s*navigation: SlurpNavigationState;/u);
assert.match(homeState, /return \{\s*navigation,/u);
assert.match(actions, /const \{\s*navigation,/u);
assert.match(creatorFlow, /const \{[\s\S]*?localizeUi,\s*navigation,/u);
assert.match(destinations, /const \{[\s\S]*?localizeUi,\s*navigation,/u);

console.log("slurp2 navigation regressions passed");
