import assert from "node:assert/strict";
import test from "node:test";
import {
  createSlpAppearanceProfile,
  resolveSlpAppearanceProfile,
  shouldAutoAcceptSlpAppearance,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-appearance-profile.ts";

test("stage appearance wins over a derived profile and source appearance", () => {
  const result = resolveSlpAppearanceProfile({
    stageAppearance: "Slender adult woman with black hair.",
    profile: createSlpAppearanceProfile({
      text: "Tall adult woman with red hair.",
      source: "description",
      sourceEntityId: "source-1",
      sourceRevisionToken: "rev-1",
      confidence: "high",
      accepted: true,
      now: "2026-09-23T00:00:00.000Z",
    }),
    evidence: { sourceEntityId: "source-1", sourceRevisionToken: "rev-1", sourceAppearance: "Blue hair." },
  });

  assert.equal(result.text, "Slender adult woman with black hair.");
  assert.equal(result.missing, false);
});

test("source appearance is usable without creating a Slurp copy", () => {
  const result = resolveSlpAppearanceProfile({
    evidence: {
      sourceEntityId: "source-1",
      sourceRevisionToken: "rev-1",
      sourceAppearance: "Adult woman with short brown hair.",
    },
  });

  assert.equal(result.text, "Adult woman with short brown hair.");
  assert.equal(result.profile, null);
  assert.equal(result.needsReview, false);
});

test("empty evidence is missing even when an avatar may exist", () => {
  const result = resolveSlpAppearanceProfile({
    evidence: {
      sourceEntityId: "source-1",
      sourceRevisionToken: "rev-1",
      avatarAvailable: true,
    },
  });

  assert.equal(result.text, null);
  assert.equal(result.missing, true);
});

test("profile mode only auto-accepts the configured confidence", () => {
  assert.equal(shouldAutoAcceptSlpAppearance("ask", "high"), false);
  assert.equal(shouldAutoAcceptSlpAppearance("high_confidence", "medium"), false);
  assert.equal(shouldAutoAcceptSlpAppearance("high_confidence", "high"), true);
  assert.equal(shouldAutoAcceptSlpAppearance("always", "low"), true);
});
