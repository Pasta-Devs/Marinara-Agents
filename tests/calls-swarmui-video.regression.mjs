import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(root, "sources/engine/packages/server/src");
const storage = await mkdtemp(join(tmpdir(), "calls-swarm-"));
const requests = [];
const mp4 = Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex");
// Provider I/O belongs to Engine. Keep the real Calls request shaping and disk/job lifecycle.
const mocks = new Map([
  [join(server, "utils/data-dir.js"), `export const DATA_DIR = ${JSON.stringify(storage)};`],
  [join(server, "utils/id-generator.js"), 'export { randomUUID as newId } from "node:crypto";'],
  [
    join(server, "lib/logger.js"),
    "export const logger = {debug(){},info(){},warn(){},error(){}}; export function logDebugOverride(){}",
  ],
  [join(server, "config/runtime-config.js"), "export function isDebugAgentsEnabled(){return false}"],
  [
    join(server, "utils/security.js"),
    `
    import { resolve, relative } from "node:path";
    export function assertInsideDir(root, path) { const target = resolve(path); if (relative(root, target).startsWith("..")) throw Error("Unsafe path"); return target; }
    export function safeFetch(){ throw Error("Package must use the host video service"); }
    export function isAllowedImageBuffer(){ throw Error("Unexpected avatar decoding"); }
  `,
  ],
  [join(server, "services/generation/fallback-notification.js"), "export async function notifyGenerationFallback(){}"],
  [
    join(server, "services/prompt-overrides/index.js"),
    `
    export const CONVERSATION_CALL_CUSTOM_VIDEO_PROMPT = {};
    export const CONVERSATION_CALL_VIDEO_CLIP_INSTRUCTION_BY_KIND = new Map();
    export const CONVERSATION_CALL_VIDEO_CLIP_LABEL_BY_KIND = new Map();
    export const CONVERSATION_CALL_VIDEO_PROMPT_BY_KIND = new Map();
    export async function loadPrompt(_storage, _definition, values){return JSON.stringify(values)}
  `,
  ],
]);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@marinara-engine/shared") {
      return { url: pathToFileURL(join(root, "sources/package-shared.ts")).href, shortCircuit: true };
    }
    if (specifier.startsWith(".") && context.parentURL) {
      const path = fileURLToPath(new URL(specifier, context.parentURL));
      if (path === join(server, "services/video/video-generation.js"))
        return {
          url: pathToFileURL(
            join(root, "sources/host-integrations/packages/server/src/services/video/video-generation.ts"),
          ).href,
          shortCircuit: true,
        };
      if (mocks.has(path)) return { url: pathToFileURL(path).href, shortCircuit: true };
      if (path.endsWith(".js") && !existsSync(path) && existsSync(path.replace(/\.js$/u, ".ts"))) {
        return { url: pathToFileURL(path.replace(/\.js$/u, ".ts")).href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    const source = url.startsWith("file:") ? mocks.get(fileURLToPath(url)) : undefined;
    return source === undefined ? next(url, context) : { source, format: "module", shortCircuit: true };
  },
});
try {
  const { bindPackageIntegrations } =
    await import("../sources/host-integrations/packages/server/src/services/package-host.ts");
  const release = bindPackageIntegrations({
    videos: {
      async generate(source, baseUrl, apiKey, serviceHint, request) {
        requests.push({ source, baseUrl, apiKey, serviceHint, request });
        return { base64: mp4.toString("base64"), mimeType: "video/mp4", ext: "mp4" };
      },
      resolveDuration(_source, _hint, request) {
        return request.durationSeconds;
      },
      resolveReferenceUpload() {
        return null;
      },
    },
  });
  const calls =
    await import("../sources/engine/packages/server/src/services/conversation/call-character-videos.service.ts");
  const workflow = JSON.stringify({
    node: { inputs: { text: "%prompt%", fps: "%fps%", frames: "%length%", width: "%width%", lora: "%LORA_1%" } },
  });
  const input = {
    characterId: "swarm-character",
    characterName: "Fixture",
    avatarPath: null,
    includeAvatarReference: false,
    clipKinds: ["idle"],
    promptOverridesStorage: {},
    connection: {
      id: "swarm",
      videoGenerationSource: "swarmui",
      videoService: "comfyui",
      baseUrl: "http://swarm:7801",
      model: "workflow-model",
      comfyuiWorkflow: workflow,
      defaultParameters: JSON.stringify({
        videoGeneration: {
          service: "comfyui",
          comfyui: { fps: 30, resolution: "480p", loras: [{ model: "portrait.safetensors", strength: 0.8 }] },
        },
      }),
    },
  };
  await calls.startConversationCallCharacterVideoGeneration(input);
  let manifest;
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    manifest = await calls.getConversationCallCharacterVideoManifest(input);
    if (!manifest.generating) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(manifest.generating, false);
  assert.equal(manifest.clips.find((clip) => clip.kind === "idle")?.status, "ready");
  const generated = requests.at(-1);
  assert.equal(generated.source, "swarmui");
  assert.equal(generated.baseUrl, "http://swarm:7801");
  assert.equal(generated.serviceHint, "swarmui");
  assert.equal(generated.request.comfyWorkflow, workflow);
  assert.equal(generated.request.fps, 30);
  assert.equal(generated.request.resolution, "480p");
  assert.equal(generated.request.comfyLoras[0].model, "portrait.safetensors");
  const file = calls.getConversationCallCharacterVideoFile(input.characterId, "idle");
  assert.deepEqual(await readFile(file), mp4);
  release();
  console.log("Calls forwards SwarmUI settings to the host and persists generated character clips.");
} finally {
  hooks.deregister();
  await rm(storage, { recursive: true, force: true });
}
