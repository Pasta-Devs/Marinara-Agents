import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { slurp2Source } from "./slurp2-source";

const cardSource = readFileSync(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpCreatorProfileCard.tsx",
  "utf8",
);
const homeSource = slurp2Source("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx");

test("creator discovery cards expose profile and discovery-only subscription actions", () => {
  assert.match(cardSource, /ui\.slurp\.settings\.creators\.viewProfile/);
  assert.match(cardSource, /showDiscoveryActions/);
  assert.match(cardSource, /onToggleSubscription/);
  assert.match(cardSource, /subscriptionPrice/);
  assert.match(cardSource, /Cancel subscription\?/);
  assert.doesNotMatch(cardSource, /onToggleFollow|showFollow/);
});

test("every creator discovery surface uses the shared card", () => {
  assert.equal(homeSource.match(/<SlurpCreatorProfileCard/g)?.length, 5);
  assert.equal(homeSource.match(/showDiscoveryActions/g)?.length, 1, "only Discover enables subscription actions");
});
