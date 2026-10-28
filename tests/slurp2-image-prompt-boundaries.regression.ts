import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import { selectSlpImageProviderPrompt } from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-prompt.ts";

const read = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/${path}`);

const rewrite = read("server/src/slp/base/media/slp-image-prompt-rewrite.ts");
const imageService = read("server/src/slp/features/media/slp-images-service.ts");
const publicImageService = read("server/src/slp/features/media/slp-public-images-service.ts");
const messageService = read("server/src/slp/features/messages/slp-message-generation-service.ts");
// The image-prompt defaults moved beside the settings (800-line cap); read them as one.
const settings = [
  read("server/src/slp/modules/settings/slp-settings.ts"),
  read("server/src/slp/modules/settings/slp-settings-image-prompts.ts"),
].join("\n");
const brief = read("server/src/slp/base/media/slp-visual-brief.ts");
const briefBuilder = read("server/src/slp/modules/feed/slp-visual-brief.ts");
const preview = read("client/src/slp/features/settings/SlpPromptPreviewInspector.tsx");

assert.match(rewrite, /postContent\?: string/u);
assert.match(rewrite, /<post_context>/u);
assert.match(rewrite, /Do not increase the sexual intensity/u);
// A fenced answer with a line break inside the prompt is valid to a reader; strict JSON.parse dropped it.
assert.match(rewrite, /parseGameJsonish\(requireModelAnswer\(value,/u);
assert.doesNotMatch(rewrite, /JSON\.parse\(/u);
// The AI budget refusing the rewrite is a setting, not a failure: no "rewrite unusable" warning, no cap.
assert.match(rewrite, /input\.onBudgetSkip\?\.\(\);\s*return null;/u);
for (const caller of [
  "server/src/slp/features/media/slp-images-service.ts",
  "server/src/slp/features/media/slp-public-images-service.ts",
  "server/src/slp/features/ads/slp-garnish-image-service.ts",
]) {
  assert.match(read(caller), /onBudgetSkip: \(\) => \{\s*rewriteAttempted = false;/u, caller);
  // The "rewrite unusable" warning names what failed (empty, cut off, bad JSON, no connection), not a guess.
  assert.match(read(caller), /onFailure: \(reason\) => \{\s*rewriteFailure = reason;/u, caller);
  assert.match(read(caller), /rewriteFailure[,:]/u, caller);
}
// Every fixed output-token limit yields to the connection's own max-tokens setting (reasoning models spend a small limit thinking).
for (const file of [
  "server/src/slp/base/media/slp-image-prompt-rewrite.ts",
  "server/src/slp/features/creators/slp-creator-page-service.ts",
  "server/src/slp/features/creators/slp-page-style-service.ts",
  "server/src/slp/features/media/slp-appearance-service.ts",
  "server/src/slp/features/audience/slp-fan-voice-draft-service.ts",
  "server/src/slp/features/assist/slp-stir-service.ts",
  "server/src/slp/features/assist/slp-assist-service.ts",
]) {
  const text = read(file);
  assert.match(text, /Math\.max\(\s*resolveStoredMaxTokens\([\w.]+\.defaultParameters, [\d_]+\),\s*[\d_]+/u, file);
  assert.match(text, /maxTokensOverride: \w+\.maxTokensOverride/u, file);
  assert.doesNotMatch(text, /maxTokens: [\d_]+[,\s}]/u, `${file} sends a fixed maxTokens`);
}
assert.match(
  rewrite,
  /max output tokens \$\{[^}]*"provider default" : maxTokens\}/u,
  "the failure names the limit that was sent",
);
assert.match(rewrite, /the answer looks cut off after/u);
assert.match(rewrite, /the JSON answer has no "prompt" text/u);
assert.match(rewrite, /no text connection:/u);
{
  const reasons: string[] = [];
  selectSlpImageProviderPrompt({
    rewrittenPrompt: null,
    rawPrompt: "a cat on a sofa",
    rewriteAttempted: true,
    rewriteFailure: "the answer is not valid JSON",
    onFallback: (reason) => reasons.push(reason),
  });
  selectSlpImageProviderPrompt({
    rewrittenPrompt: null,
    rawPrompt: "a cat on a sofa",
    rewriteAttempted: true,
    onFallback: (reason) => reasons.push(reason),
  });
  assert.deepEqual(reasons, [
    "the answer is not valid JSON",
    "the rewrite did not run or returned nothing (check the agent text connection)",
  ]);
}
assert.match(imageService, /postContent: input\.postContent/u);
assert.match(imageService, /providerPrompt: finalPrompt/u, "the private result carries the exact provider prompt");
assert.match(publicImageService, /postContent: input\.postContent/u);
assert.match(messageService, /Keep the image inside the Creator content menu and relationship boundaries/u);
assert.match(settings, /LEGACY_GRAPHIC_SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT/u);
assert.match(settings, /record\.id === "image-style"/u);
assert.match(settings, /record\.text === LEGACY_GRAPHIC_SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT/u);
assert.match(settings, /Do not turn an ordinary update into a fashion shoot or erotic image/u);
assert.match(brief, /sexualLevel: SlurpVisualSexualLevel/u);
assert.match(brief, /visual brief is authoritative/u);
// Was `sexualLevel: intent === "teaser" ? "suggestive" : "none"`, which briefed every locked post
// as non-sexual. The level is the Creator's own now, stepped down for anything unpaid.
assert.match(briefBuilder, /sexualLevel: slurpPostSexualLevel\(/u);
assert.doesNotMatch(briefBuilder, /intent === "teaser" \? "suggestive"/u);
assert.match(brief, /slurpVisualBriefPromptViolatesPolicy/u);
assert.match(preview, /Runtime data can add more context during generation/u);
assert.match(preview, /runs the post generator with the selected Creator/u);
assert.match(preview, /Final image-provider prompt/u);

console.log("slurp2 image prompt boundaries regression passed");
