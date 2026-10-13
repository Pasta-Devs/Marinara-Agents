import assert from "node:assert/strict";
import test from "node:test";
import {
  appearanceEvidenceFromSource,
  appearanceSourceAccount,
  createSlpAppearanceProfile,
  parseSlpAppearanceCandidate,
  resolveSlpAppearanceProfile,
  shouldAutoAcceptSlpAppearance,
  slpCardImageAppearance,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-appearance-profile.ts";
import type { SlpAccount } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social.types.ts";
import {
  ensureSlpImageAppearance,
  selectSlpImageProviderPrompt,
  slurpApplyImageLook,
  slurpLookForWriter,
} from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt.ts";
import { slurp2Source } from "./slurp2-source.ts";
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

test("a card's image tags are offered only while its Image Appearance Override is on", () => {
  const tags = "1girl, solo, silver hair";
  // A character keeps a boolean in extensions; a persona row keeps the text "true".
  assert.equal(slpCardImageAppearance({ imageAppearanceEnabled: true, imageAppearance: `  ${tags}  ` }), tags);
  assert.equal(slpCardImageAppearance({ imageAppearanceEnabled: "true", imageAppearance: tags }), tags);
  for (const imageAppearanceEnabled of [false, "false", undefined, "", 1]) {
    assert.equal(slpCardImageAppearance({ imageAppearanceEnabled, imageAppearance: tags }), "");
  }
  assert.equal(slpCardImageAppearance({ imageAppearanceEnabled: true, imageAppearance: "   " }), "");
  assert.equal(slpCardImageAppearance({ imageAppearanceEnabled: true, imageAppearance: 7 }), "");
  // A Creator appearance holds 2000 characters, so the button never offers more than can be saved.
  assert.equal(
    slpCardImageAppearance({ imageAppearanceEnabled: true, imageAppearance: "a".repeat(2500) }).length,
    2000,
  );
  // Saving trims, so a cut that lands on a space must not leave the button showing for ever.
  const cutOnSpace = slpCardImageAppearance({
    imageAppearanceEnabled: true,
    imageAppearance: `${"a".repeat(1999)} tail`,
  });
  assert.equal(cutOnSpace.length, 1999);
  const storage = slurp2Source(
    "packages/slurp2/src/engine/packages/server/src/slp/data/creators/slp-creators-storage-3.ts",
  );
  assert.match(
    storage,
    /imageAppearance: publicAccount \? await resolveCreatorImageAppearance\(db, publicAccount\) : "",/u,
  );
  const section = slurp2Source(
    "packages/slurp2/src/engine/packages/client/src/slp/features/creators/settings/SlpCreatorSettingsSections.tsx",
  );
  assert.match(section, /appearance\.imageAppearance && appearance\.imageAppearance !== appearance\.text && \(/u);
  assert.match(section, /runAppearanceAction\("edit_override", appearance\.imageAppearance\)/u);
  assert.match(section, /appearance\.source === "override" &&\s+!\(await showConfirmDialog\(/u);
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
  // SpicyAPI (#1337): edit models get the avatar, text-to-image models do not, and a fallback must take it too.
  const spicyEdit = { imageService: "spicyapi", model: "bytedance/seedream-5.0-pro/edit" };
  const spicyText = { imageService: "spicyapi", model: "alibaba/z-image-spicy-pro/text-to-image" };
  assert.equal(slpImageReferencesSupported(spicyEdit), true);
  assert.equal(slpImageReferencesSupported(spicyText), false);
  assert.equal(slpImageReferencesSupported({ imageService: "comfyui" }, spicyEdit), true);
  assert.equal(slpImageReferencesSupported(spicyEdit, spicyText), false);
  assert.equal(slpImageReferencesSupported({ model: "flux-kontext", baseUrl: "https://nano-gpt.com/api/v1" }), true);
  const openRouter = "https://openrouter.ai/api/v1";
  assert.equal(slpImageReferencesSupported({ model: "google/gemini-3.1-flash-image", baseUrl: openRouter }), true);
  assert.equal(slpImageReferencesSupported({ model: "krea/krea-2-medium", baseUrl: openRouter }), false);
});

test("the look reaches a picture prompt once, the way the player chose (0.3.0 report A)", () => {
  const look = "Adult woman with green eyes and dark hair.";
  const rewrite = "A woman with dark hair and green eyes waits at a bus stop in the rain.";
  const count = (text: string) => text.match(/green eyes/gu)?.length ?? 0;
  // The prompt writer sees the look in `writer` and `both`, never in `insert`.
  assert.deepEqual((["writer", "insert", "both"] as const).map(slurpLookForWriter), [true, false, true]);
  // Writer: its rewrite is sent as written, no second injection.
  assert.equal(slurpApplyImageLook(rewrite, look, "writer", true), rewrite);
  // Insert: the writer never saw the look, so Slurp adds it once.
  const inserted = slurpApplyImageLook("A woman waits at a bus stop in the rain.", look, "insert", true);
  assert.equal(count(inserted), 1);
  assert.match(inserted, /dark hair/u);
  // Both: only what the writer missed is added; a worded look is not repeated.
  assert.equal(slurpApplyImageLook(rewrite, look, "both", true), rewrite);
  assert.equal(count(slurpApplyImageLook("A woman at a bus stop.", look, "both", true)), 1);
  // No rewrite (enhance off, failed or rejected): every mode inserts, or nobody would be drawn.
  for (const mode of ["writer", "insert", "both"] as const) {
    const fallback = slurpApplyImageLook("At a bus stop.", look, mode, false);
    assert.equal(count(fallback), 1, mode);
    assert.equal(slurpApplyImageLook(fallback, look, mode, false), fallback, `${mode}: a second pass adds nothing`);
  }
  // Both image paths use the setting for the writer context and the final prompt.
  for (const path of ["slp-images-service.ts", "slp-public-images-service.ts"]) {
    const service = slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/features/media/${path}`);
    assert.match(service, /characterDescription && slurpLookForWriter\(lookMode\) \? `Appearance:/u, path);
    assert.match(service, /slurpApplyImageLook\([\s\S]{0,260}lookMode,\s+usedRewrite,\s+\)/u, path);
    assert.match(service, /onFallback: \(reason\) => \{\s+usedRewrite = false;/u, path);
    assert.doesNotMatch(service, /ensureSlpImageAppearance\(/u, path);
  }
  const settings = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/modules/settings/slp-settings.ts");
  assert.match(settings, /imageAppearanceMode: z\.enum\(\["writer", "insert", "both"\]\)/u);
  assert.match(settings, /imageAppearanceMode: "writer",/u);
});
