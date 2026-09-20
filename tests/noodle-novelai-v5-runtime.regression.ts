import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { bindPackageIntegrations } from "../sources/host-integrations/packages/server/src/services/package-host.js";
import {
  generateImage,
  resolveNovelAiRequestSize,
} from "../sources/host-integrations/packages/server/src/services/image/image-generation.js";

async function main() {
  const gameSource = readFileSync("sources/engine/packages/server/src/services/game/game-asset-generation.ts", "utf8");
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

  // Native NovelAI normalization is owned by Engine; the package must forward its complete request.
  const request = {
    prompt: "少女 naïve 😀",
    model: "nai-diffusion-5-full",
    characterPrompts: [{ name: "Fixture", prompt: "blue coat" }],
    width: 1024,
    height: 1024,
  };
  const result = { base64: "fixture", mimeType: "image/png", ext: "png" };
  const release = bindPackageIntegrations({
    images: {
      async generate(...args: unknown[]) {
        assert.deepEqual(args.slice(0, 4), ["novelai", "https://image.novelai.net", "synthetic-key", "novelai"]);
        assert.equal(args[4], request);
        return result;
      },
      resolveNovelAiRequestSize(value: unknown) {
        assert.equal(value, request);
        return { width: 1024, height: 1024 };
      },
    },
  } as unknown as Parameters<typeof bindPackageIntegrations>[0]);
  try {
    assert.equal(
      await generateImage("novelai", "https://image.novelai.net", "synthetic-key", "novelai", request),
      result,
    );
    assert.deepEqual(resolveNovelAiRequestSize(request), { width: 1024, height: 1024 });
  } finally {
    release();
  }
  assert.throws(() => resolveNovelAiRequestSize(request), /outside activation/);
  console.log("Package NovelAI character prompts and Unicode reach the live host generation and sizing services.");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
