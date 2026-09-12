import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const cardSource = readFileSync(
  "packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpCreatorProfileCard.tsx",
  "utf8",
);
const homeSource = readFileSync("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpHome.tsx", "utf8");

test("creator discovery cards expose one dedicated View profile action", () => {
  assert.match(cardSource, /ui\.slurp\.settings\.creators\.viewProfile/);
  assert.match(cardSource, /mt-auto flex min-h-14 items-end justify-end border-t/);
  assert.doesNotMatch(cardSource, /onToggleFollow|onToggleSubscription|showFollow|showSubscription/);
});

test("every creator discovery surface uses the shared card", () => {
  assert.equal(homeSource.match(/<SlurpCreatorProfileCard/g)?.length, 5);
  assert.doesNotMatch(homeSource, /<SlurpCreatorProfileCard[\s\S]{0,240}onToggleSubscription/);
});
