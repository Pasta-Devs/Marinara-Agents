import assert from "node:assert/strict";
import {
  normalizeSlurpCreatorStrategy,
  slurpCreatorStrategy,
  slurpStrategyInstruction,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-strategy.ts";
import { slurpProductionProfile } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-production-profile.ts";
import {
  slurpOnlyIntent,
  slurpPostAxes,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-content-axes.ts";
import { slurpPlanSlot } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-planner.ts";
import { slpCreatorStrategyPatchSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social.schema.ts";
import { slurp2Source } from "./slurp2-source";

// Nothing saved: the strategy is fully derived, stable, and follows the production style the
// Creator already had, so existing Creators do not change.
const derived = slurpCreatorStrategy("creator-a");
assert.deepEqual(derived, slurpCreatorStrategy("creator-a"));
assert.equal(derived.production.style, slurpProductionProfile("creator-a").style);
assert.deepEqual(derived.intentWeights, {});
assert.equal(derived.strategyText, "");

// A saved value overrides only itself.
const styled = slurpCreatorStrategy("creator-a", { style: "theatrical" });
assert.equal(styled.production.style, "theatrical");
assert.deepEqual(styled.production, slurpProductionProfile("creator-a", "theatrical"));
const quiet = slurpCreatorStrategy("creator-a", { skipRate: 30 });
assert.equal(quiet.skipRate, 30);
assert.equal(quiet.textOnlyRate, derived.textOnlyRate, "one control must not move another");

// Out-of-range input is clamped at resolve time and dropped at save time.
assert.equal(slurpCreatorStrategy("creator-a", { skipRate: 99 }).skipRate, 40);
assert.equal(slurpCreatorStrategy("creator-a", { style: "studio" }).production.style, derived.production.style);
assert.equal(normalizeSlurpCreatorStrategy({ style: "studio", skipRate: "a lot" }), undefined);
assert.deepEqual(normalizeSlurpCreatorStrategy({ skipRate: 20, intentWeights: { casual: 5, nonsense: 9 } }), {
  skipRate: 20,
  intentWeights: { casual: 5 },
});
assert.equal(normalizeSlurpCreatorStrategy("x".repeat(3)), undefined);
assert.equal(normalizeSlurpCreatorStrategy({ strategyText: "y".repeat(5000) })?.strategyText?.length, 2000);
assert.ok(!slpCreatorStrategyPatchSchema.safeParse({ skipRate: 41 }).success);
assert.ok(!slpCreatorStrategyPatchSchema.safeParse({ voice: "different person" }).success, "no identity fields");
assert.ok(slpCreatorStrategyPatchSchema.safeParse({ skipRate: null }).success, "null resets to derived");

// The skip rate reaches the planner.
const skipsAt = (rate: number) =>
  Array.from({ length: 400 }, (_, sequence) => slurpPlanSlot("creator-a", sequence, { skipRate: rate })).filter(
    (decision) => decision.skip,
  ).length;
assert.equal(skipsAt(0), 0, "a Creator set to never go quiet never does");
assert.ok(skipsAt(40) > skipsAt(5));

// The text lean reaches the delivery draw, and never turns a set into text.
const textAt = (rate: number) =>
  Array.from({ length: 400 }, (_, sequence) =>
    slurpPostAxes("creator-a", sequence, { images: true, textOnlyRate: rate }),
  );
const wordy = textAt(100);
assert.ok(
  wordy.filter((axes) => axes.delivery === "text_only").length >
    textAt(0).filter((axes) => axes.delivery === "text_only").length,
);
assert.equal(textAt(0).filter((axes) => axes.delivery === "text_only").length, 0);
assert.ok(!wordy.some((axes) => axes.intent === "set" && axes.delivery === "text_only"));
// Unset means the shipped balance: the default draw is unchanged.
assert.deepEqual(
  textAt(50),
  Array.from({ length: 400 }, (_, sequence) => slurpPostAxes("creator-a", sequence, { images: true })),
);

// Intent weights reach the intent draw; all-zero falls back rather than throwing.
const onlyCasual = Array.from({ length: 100 }, (_, sequence) =>
  slurpPostAxes("creator-a", sequence, {
    images: true,
    intentWeights: { set: 0, callback: 0, request: 0, behind_the_scenes: 0, appreciation: 0, business: 0 },
  }),
);
assert.ok(onlyCasual.every((axes) => axes.intent === "casual"));
assert.doesNotThrow(() =>
  slurpPostAxes("creator-a", 1, {
    images: true,
    intentWeights: { casual: 0, set: 0, callback: 0, request: 0, behind_the_scenes: 0, appreciation: 0, business: 0 },
  }),
);

// The note is framed as a habit and rides in the production block, never as a new identity.
assert.match(
  slurpStrategyInstruction(slurpCreatorStrategy("creator-a", { strategyText: "Posts mostly at night." })),
  /How you run your page, in your own words: Posts mostly at night\./u,
);
assert.doesNotMatch(slurpStrategyInstruction(derived), /in your own words/u);

// Wiring: every planner call site reads the saved strategy, and saving merges key by key.
for (const file of [
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts",
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-prompt-preview-service.ts",
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/reserve/slp-reserve-operation.ts",
]) {
  assert.match(
    slurp2Source(file),
    /slurpCreatorStrategy\((?:selectedAccount|account)\.id, (?:selectedAccount|account)\.settings\.strategy\)/u,
    file,
  );
}
const storage = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/data/creators/slp-creators-storage-4.ts",
);
assert.match(storage, /if \(value === null\) delete merged\[key\];/u);

// One-shot purpose from the composer: certain for this post, never saved to the strategy.
for (const intent of ["casual", "set", "business", "appreciation"] as const) {
  for (let sequence = 0; sequence < 20; sequence += 1) {
    assert.equal(
      slurpPostAxes("creator-a", sequence, { images: true, intentWeights: slurpOnlyIntent(intent) }).intent,
      intent,
    );
  }
}
const oneShot = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts",
);
assert.match(oneShot, /const chosen = input\.request\.contentIntent;/u);
assert.match(oneShot, /teaser: chosen \? chosen === "teaser" : isTeaser,/u);
assert.match(oneShot, /intentWeights: chosen \? slurpOnlyIntent\(chosen\) : strategy\.intentWeights,/u);
assert.doesNotMatch(oneShot, /subtree: "strategy"/u, "a one-shot choice must not write the saved strategy");
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/client/src/slp/app/slp-home-actions.ts"),
  /\.\.\.\(contentIntent \? \{ contentIntent \} : \{\}\),/u,
);

console.log("slurp creator strategy regression checks passed");
