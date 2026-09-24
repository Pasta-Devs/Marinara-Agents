import assert from "node:assert/strict";
import test from "node:test";
import {
  appearanceEvidenceFromSource,
  appearanceSourceAccount,
  createSlpAppearanceProfile,
  parseSlpAppearanceCandidate,
  resolveSlpAppearanceProfile,
  shouldAutoAcceptSlpAppearance,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-appearance-profile.ts";
import type { SlpAccount } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social.types.ts";
import {
  ensureSlpImageAppearance,
  selectSlpImageProviderPrompt,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt.ts";
import { slpImageReferencesSupported } from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-references.ts";

const source = {
  publicDisplayName: "A",
  publicHandle: "a",
  name: "A",
  description: "Tall with silver hair.",
  personality: "",
  scenario: "",
  appearance: "",
  backstory: "",
};

test("a Creator resolves its source card even without a linked public account", () => {
  const creator = { kind: "character", entityId: "character-id" } as SlpAccount;
  const linked = { kind: "character", entityId: "linked-id" } as SlpAccount;
  assert.equal(appearanceSourceAccount(creator, null), creator);
  assert.equal(appearanceSourceAccount(creator), creator);
  assert.equal(appearanceSourceAccount(creator, linked), linked);
});

test("source fingerprints survive repeated resolution and use the entity id", () => {
  const first = appearanceEvidenceFromSource(source, "character-id");
  const second = appearanceEvidenceFromSource({ ...source }, "character-id");
  assert.deepEqual(first, second);
  assert.equal(first.sourceEntityId, "character-id");
  assert.notEqual(
    first.sourceRevisionToken,
    appearanceEvidenceFromSource({ ...source, description: "Changed" }, "character-id").sourceRevisionToken,
  );
});

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

test("a live source appearance wins over a cached extraction", () => {
  const result = resolveSlpAppearanceProfile({
    profile: createSlpAppearanceProfile({
      text: "Black hair.",
      source: "description",
      sourceEntityId: "source-1",
      sourceRevisionToken: "old",
      confidence: "high",
      accepted: true,
      now: "2026-09-23",
    }),
    evidence: { sourceEntityId: "source-1", sourceRevisionToken: "new", sourceAppearance: "Silver hair." },
  });
  assert.equal(result.text, "Silver hair.");
  assert.equal(result.needsReview, false);
});

test("a stale cached extraction is reused with review attention", () => {
  const result = resolveSlpAppearanceProfile({
    profile: createSlpAppearanceProfile({
      text: "Black hair.",
      source: "description",
      sourceEntityId: "source-1",
      sourceRevisionToken: "old",
      confidence: "high",
      accepted: true,
      now: "2026-09-23",
    }),
    evidence: { sourceEntityId: "source-1", sourceRevisionToken: "new" },
  });
  assert.equal(result.text, "Black hair.");
  assert.equal(result.needsReview, true);
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

test("description extraction requires a supporting quote and never invents from empty evidence", () => {
  const card = "She has shoulder-length silver hair and green eyes.";
  const supported = JSON.stringify({ appearance: "Silver hair and green eyes.", evidence: card, confidence: "high" });
  assert.equal(parseSlpAppearanceCandidate(supported, card, false)?.confidence, "high");
  assert.equal(parseSlpAppearanceCandidate(supported, "Different card", false), null);
  assert.equal(
    parseSlpAppearanceCandidate(
      JSON.stringify({
        appearance: "Blue eyes.",
        evidence: "She enjoys long walks along the shoreline.",
        confidence: "high",
      }),
      "She enjoys long walks along the shoreline.",
      false,
    ),
    null,
  );
  assert.equal(parseSlpAppearanceCandidate('{"appearance":"Blue eyes","evidence":""}', "", false), null);
  assert.equal(parseSlpAppearanceCandidate('{"appearance":"Blue eyes","evidence":""}', "", true)?.source, "avatar");
});

test("reviewed, rewritten, and fallback prompts all retain appearance", () => {
  for (const rewrittenPrompt of ["A portrait at a bus stop", null]) {
    const selected = selectSlpImageProviderPrompt({
      rewrittenPrompt,
      rawPrompt: "At a bus stop",
      rewriteAttempted: true,
    });
    const final = ensureSlpImageAppearance(selected, "Adult woman with green eyes and dark hair.");
    assert.match(final, /green eyes and dark hair/u);
    assert.match(final, /bus stop/u);
    assert.equal(ensureSlpImageAppearance(final, "Adult woman with green eyes and dark hair."), final);
  }
});

test("unsupported image providers and fallbacks receive text without avatar references", () => {
  assert.equal(slpImageReferencesSupported({ imageService: "novelai", model: "nai-diffusion-4-full" }), false);
  assert.equal(slpImageReferencesSupported({ imageService: "novelai", model: "nai-diffusion-4-5-full" }), true);
  assert.equal(slpImageReferencesSupported({ imageService: "comfyui" }, { serviceHint: "pollinations" }), false);
  assert.equal(slpImageReferencesSupported({ imageService: "pollinations" }), false);
  assert.equal(slpImageReferencesSupported({ imageService: "nanogpt", model: "hidream" }), true);
  assert.equal(slpImageReferencesSupported({ model: "flux-kontext", baseUrl: "https://nano-gpt.com/api/v1" }), true);
  const openRouter = "https://openrouter.ai/api/v1";
  assert.equal(slpImageReferencesSupported({ model: "google/gemini-3.1-flash-image", baseUrl: openRouter }), true);
  assert.equal(slpImageReferencesSupported({ model: "krea/krea-2-medium", baseUrl: openRouter }), false);
});
