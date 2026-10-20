import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const imageSourcePath = "sources/engine/packages/server/src/services/image/image-generation.ts";
const gameSourcePath = "sources/engine/packages/server/src/services/game/game-asset-generation.ts";
const imageSource = readFileSync(imageSourcePath, "utf8");
const gameSource = readFileSync(gameSourcePath, "utf8");

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `expected ${start} before ${end}`);
  return source.slice(startIndex, endIndex);
}

function executableSource(source: string): string {
  return source
    .replace(/^export /gm, "")
    .replace(/:\s*Pick<[^>]+>/g, "")
    .replace(/:\s*(?:boolean|string)/g, "");
}

type NovelAiRuntime = {
  isNovelAiV4Model(model: string): boolean;
  isNovelAiV5Model(model: string): boolean;
  isNovelAiPreciseReferenceModel(model: string): boolean;
  sanitizeNovelAiV4Prompt(prompt: string, allowUnicode?: boolean): string;
};

function assertNovelAiV5Runtime(runtime: NovelAiRuntime): void {
  assert.equal(runtime.isNovelAiV4Model("nai-diffusion-5-full"), true);
  assert.equal(runtime.isNovelAiV5Model("nai-diffusion-5-curated"), true);
  assert.equal(runtime.isNovelAiPreciseReferenceModel("nai-diffusion-5-full"), false);
  assert.equal(runtime.isNovelAiPreciseReferenceModel("nai-diffusion-4-5-full"), true);
  assert.equal(runtime.sanitizeNovelAiV4Prompt("少女 naïve 😀", true), "少女 naïve 😀");
  assert.equal(runtime.sanitizeNovelAiV4Prompt("少女 naïve 😀"), "naive");
  assert.equal(runtime.sanitizeNovelAiV4Prompt("e\u0301", true), "é");
}

const sourceRuntime = runInNewContext(`
${executableSource(sourceBetween(imageSource, "function isNovelAiV4Model", "function collectNovelAiReferenceImages"))}
${executableSource(sourceBetween(imageSource, "function sanitizeNovelAiV4Prompt", "function prepareNovelAiPrompt"))}
({ isNovelAiV4Model, isNovelAiV5Model, isNovelAiPreciseReferenceModel, sanitizeNovelAiV4Prompt });
`) as NovelAiRuntime;

assertNovelAiV5Runtime(sourceRuntime);

assert.match(imageSource, /NovelAI V5 prompts support up to 1471 tokens/);
const gameRuntime = runInNewContext(`
function resolveSceneIllustrationImageBackend(req) { return req.imgService; }
${executableSource(
  sourceBetween(
    gameSource,
    "export function supportsSceneIllustrationStructuredCharacterPrompts",
    "export function resolveSceneIllustrationReferenceImageLimit",
  ),
)}
({ supportsSceneIllustrationStructuredCharacterPrompts });
`) as {
  supportsSceneIllustrationStructuredCharacterPrompts(request: {
    imgSource: string;
    imgModel: string;
    imgBaseUrl: string;
    imgService: string;
  }): boolean;
};
assert.equal(
  gameRuntime.supportsSceneIllustrationStructuredCharacterPrompts({
    imgSource: "novelai",
    imgModel: "nai-diffusion-5-full",
    imgBaseUrl: "https://image.novelai.net",
    imgService: "novelai",
  }),
  true,
);
assert.equal(
  gameRuntime.supportsSceneIllustrationStructuredCharacterPrompts({
    imgSource: "openai",
    imgModel: "nai-diffusion-5-full",
    imgBaseUrl: "https://image.novelai.net",
    imgService: "openai",
  }),
  false,
);

// Noodle generates images through the Engine's image service (api.runtime, Pasta-Devs/Marinara-Agents#1487), so the
// NovelAI V5 runtime that runs is the Engine's. Noodle's server must not carry its own copy of it.
assert.doesNotMatch(readFileSync("packages/noodle/server.mjs", "utf8"), /NovelAI V5 prompts support up to \d+ tokens/);

console.log("Noodle and Slurp NovelAI V5 runtime regressions passed.");
