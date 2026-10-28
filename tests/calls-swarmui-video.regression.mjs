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
let output = `data:video/mp4;base64,${mp4.toString("base64")}`;
globalThis.__callsSwarmFetch = async (url, options) => {
  assert.equal(options.policy.allowLocal, true);
  assert.equal(options.policy.allowLoopback, true);
  assert.deepEqual(options.policy.allowedOrigins, [new URL(url).origin]);
  assert.ok(options.maxResponseBytes > 0);
  options.signal?.throwIfAborted();
  const body = options.body ? JSON.parse(options.body) : null;
  requests.push({ url: String(url), body, headers: options.headers });
  if (String(url).endsWith("/Output/clip.mp4")) return new Response(mp4, { headers: { "Content-Type": "video/mp4" } });
  if (String(url).endsWith("/API/GetNewSession")) return Response.json({ session_id: "fixture-session" });
  assert.ok(String(url).endsWith("/API/GenerateText2Image"));
  return Response.json({ images: [output] });
};

// Keep the real provider, queue, workflow resolver, and Calls disk/job lifecycle.
// External network/logging and unrelated prompt/avatar infrastructure are fixture boundaries.
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
    export const safeFetch = (...args) => globalThis.__callsSwarmFetch(...args);
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
  const { generateVideo } = await import("../sources/engine/packages/server/src/services/video/video-generation.ts");
  const calls =
    await import("../sources/engine/packages/server/src/services/conversation/call-character-videos.service.ts");
  const workflow = JSON.stringify({
    node: { inputs: { text: "%prompt%", fps: "%fps%", frames: "%length%", width: "%width%", lora: "%LORA_1%" } },
  });
  const settings = {
    prompt: "A quiet portrait",
    model: "local-video",
    durationSeconds: 4,
    aspectRatio: "16:9",
    comfyWorkflow: workflow,
    fps: 24,
  };
  assert.equal(
    (await generateVideo("swarmui", "http://swarm:7801", "key", "comfyui", settings)).base64,
    mp4.toString("base64"),
  );
  assert.equal(requests[0].headers.Cookie, "swarm_token=key");
  assert.equal(requests[1].body.session_id, "fixture-session");
  assert.equal(JSON.parse(requests[1].body.comfyworkflowraw).node.inputs.frames, 96);
  assert.equal(requests[1].body.model, "local-video");

  output = "/Output/clip.mp4";
  assert.equal(
    (await generateVideo("swarmui", "http://swarm:7801", "key", "swarmui", settings)).base64,
    mp4.toString("base64"),
  );
  assert.equal(requests.at(-1).url, "http://swarm:7801/Output/clip.mp4");
  assert.equal(requests.at(-1).headers.Cookie, "swarm_token=key");

  output = "data:video/mp4;base64,aW52YWxpZA==";
  await assert.rejects(generateVideo("swarmui", "http://swarm:7801", "", "swarmui", settings), /non-MP4/u);
  output = "https://outside.example/clip.mp4";
  const beforeForeignOutput = requests.length;
  await assert.rejects(
    generateVideo("swarmui", "http://swarm:7801", "secret", "swarmui", settings),
    /outside its configured origin/u,
  );
  assert.equal(
    requests.length,
    beforeForeignOutput + 2,
    "foreign output is rejected before any authenticated download",
  );
  output = `data:video/mp4;base64,${mp4.toString("base64")}`;
  await generateVideo("unsupported-fixture", "http://primary", "", "unsupported-fixture", {
    ...settings,
    fallback: {
      connectionId: "backup",
      connectionName: "Backup",
      source: "swarmui",
      baseUrl: "http://backup:7801",
      apiKey: "",
      serviceHint: "comfyui",
      model: "backup-model",
      comfyWorkflow: workflow,
      fps: 12,
    },
  });
  assert.equal(JSON.parse(requests.at(-1).body.comfyworkflowraw).node.inputs.frames, 48);
  assert.equal(requests.at(-1).body.model, "backup-model");
  const beforeAbort = requests.length;
  await assert.rejects(
    generateVideo("swarmui", "http://swarm:7801", "", "swarmui", {
      ...settings,
      signal: AbortSignal.abort(new Error("cancelled")),
    }),
    /cancelled/u,
  );
  assert.equal(requests.length, beforeAbort);
  await assert.rejects(
    generateVideo("swarmui", "http://swarm:7801", "", "swarmui", {
      ...settings,
      comfyWorkflow: "{} %reference_image_name%",
    }),
    /backend-local filenames/u,
  );

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
  const generatedWorkflow = JSON.parse(requests.at(-1).body.comfyworkflowraw);
  assert.equal(generatedWorkflow.node.inputs.fps, 30);
  assert.equal(generatedWorkflow.node.inputs.width, 832);
  assert.equal(generatedWorkflow.node.inputs.lora, "portrait.safetensors");
  const file = calls.getConversationCallCharacterVideoFile(input.characterId, "idle");
  assert.deepEqual(await readFile(file), mp4);
  console.log("Calls SwarmUI provider and character-clip regressions passed.");
} finally {
  hooks.deregister();
  delete globalThis.__callsSwarmFetch;
  await rm(storage, { recursive: true, force: true });
}
