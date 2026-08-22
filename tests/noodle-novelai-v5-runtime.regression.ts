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
  return source.replace(/:\s*(?:boolean|string)/g, "");
}

const runtime = runInNewContext(`
${executableSource(sourceBetween(imageSource, "function isNovelAiV4Model", "function collectNovelAiReferenceImages"))}
${executableSource(sourceBetween(imageSource, "function sanitizeNovelAiV4Prompt", "function prepareNovelAiPrompt"))}
({ isNovelAiV4Model, isNovelAiV5Model, isNovelAiPreciseReferenceModel, sanitizeNovelAiV4Prompt });
`) as {
  isNovelAiV4Model(model: string): boolean;
  isNovelAiV5Model(model: string): boolean;
  isNovelAiPreciseReferenceModel(model: string): boolean;
  sanitizeNovelAiV4Prompt(prompt: string, allowUnicode?: boolean): string;
};

assert.equal(runtime.isNovelAiV4Model("nai-diffusion-5-full"), true);
assert.equal(runtime.isNovelAiV5Model("nai-diffusion-5-curated"), true);
assert.equal(runtime.isNovelAiPreciseReferenceModel("nai-diffusion-5-full"), false);
assert.equal(runtime.isNovelAiPreciseReferenceModel("nai-diffusion-4-5-full"), true);
assert.equal(runtime.sanitizeNovelAiV4Prompt("少女 naïve 😀", true), "少女 naïve 😀");
assert.equal(runtime.sanitizeNovelAiV4Prompt("少女 naïve 😀"), "naive");
assert.equal(runtime.sanitizeNovelAiV4Prompt("e\u0301", true), "é");

assert.match(imageSource, /NovelAI V5 prompts support up to 1471 tokens/);
assert.match(gameSource, /4-5.*\|5\(\?:-\(\?:curated\|full\)\)\?/s);

for (const packageId of ["noodle", "slurp"]) {
  const bundle = readFileSync(`packages/${packageId}/server.mjs`, "utf8");
  assert.match(bundle, /NovelAI V5 prompts support up to 1471 tokens/);
  assert.match(bundle, /nai-diffusion-5/);
}

console.log("Noodle and Slurp NovelAI V5 runtime regressions passed.");
