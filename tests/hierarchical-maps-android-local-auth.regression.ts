// World Maps reads and saves its agent settings through app.inject, which arrives from 127.0.0.1. On an Android app
// install (MARINARA_ANDROID_SECRET set) the Engine's androidLocalAuthHook refuses such a request without the app's
// local secret, so saving the World Maps agent failed (#2358). This runs the committed server.mjs on a Fastify app
// guarded by the Engine's own hook. It needs an Engine checkout with its dependencies installed:
//   MARINARA_ENGINE_ROOT=../Marinara-Engine npx tsx tests/hierarchical-maps-android-local-auth.regression.ts
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const SECRET = "f6".repeat(32);
process.env.MARINARA_ANDROID_SECRET = SECRET;

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "marinara-maps-android-auth-"));
  try {
    // The bundle imports zod and nanoid, which an installed package gets from the Engine.
    symlinkSync(join(engineRoot, "packages/server/node_modules"), join(directory, "node_modules"), "junction");
    copyFileSync(join(repoRoot, "packages/hierarchical-maps/server.mjs"), join(directory, "server.mjs"));
    const { androidLocalAuthHook } = await import(
      pathToFileURL(join(engineRoot, "packages/server/src/middleware/android-local-auth.ts")).href
    );
    const fastify = createRequire(join(engineRoot, "packages/server/package.json"))("fastify");
    const app = fastify();
    app.addHook("onRequest", androidLocalAuthHook);
    let config: Record<string, unknown> = { type: "hierarchical-maps", connectionId: null, settings: {} };
    const agentCalls: string[] = [];
    app.get("/api/agents", async () => {
      agentCalls.push("GET");
      return [config];
    });
    app.patch("/api/agents/type/:type", async (request: { body: Record<string, unknown> }) => {
      agentCalls.push("PATCH");
      config = { ...config, ...request.body };
      return config;
    });
    const { activate } = await import(pathToFileURL(join(directory, "server.mjs")).href);
    const quiet = () => {};
    const cleanup = await activate({
      app,
      api: {
        registerService: () => () => {},
        runtime: {
          logger: { debug: quiet, info: quiet, warn: quiet, error: quiet, debugOverride: quiet },
          persistence: { documents: {} },
          resources: {},
          languageModels: {},
          json: { parseJsonish: JSON.parse },
        },
      },
    });
    try {
      // The browser's own request carries the secret (or its session); World Maps' calls behind it must too.
      const saved = await app.inject({
        method: "PATCH",
        url: "/api/chats/spatial-context/agent-configuration",
        headers: { "x-marinara-android-secret": SECRET, "x-marinara-csrf": "1" },
        payload: { description: "Maps", phase: "pre_generation", connectionId: null, settings: { author: "Mari" } },
      });
      assert.equal(saved.statusCode, 200, saved.body);
      assert.deepEqual(agentCalls, ["GET", "PATCH"], "both agent calls passed the Android local auth hook");
      assert.deepEqual((config.settings as Record<string, unknown>).author, "Mari");
      // The hook is live: the same agent read without the secret is refused.
      assert.equal((await app.inject({ method: "GET", url: "/api/agents" })).statusCode, 401);
    } finally {
      cleanup();
      await app.close();
    }
    process.stdout.write("World Maps Android local auth regression passed.\n");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
