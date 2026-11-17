// Runs the committed World Maps server.mjs the way an Engine runs an installed package, on a Fastify app guarded by the
// Engine's own androidLocalAuthHook. It needs an Engine checkout (2.5.2 or later) with its dependencies installed:
//   MARINARA_ENGINE_ROOT=../Marinara-Engine npx tsx tests/hierarchical-maps-engine-runtime.regression.ts
// - World Maps reads and saves its agent settings through app.inject, which arrives from 127.0.0.1. On an Android app
//   install (MARINARA_ANDROID_SECRET set) the hook refuses such a request without the app's local secret, so saving
//   the World Maps agent failed (#2358).
// - The bundle's imports resolve through the Engine's own package links, which give API-1 packages zod 3 (`zod-v3`)
//   while this repository's tests run zod 4. A map schema written for zod 4 alone rejected every map there.
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const SECRET = "f6".repeat(32);
process.env.MARINARA_ANDROID_SECRET = SECRET;

const place = (id: string, parentId: string | null, sortOrder: number) => ({
  id,
  parentId,
  name: id,
  kind: "place",
  description: "",
  lorebookEntryIds: [],
  childPresentation: "list",
  links: [],
  status: "active",
  sortOrder,
});

async function main() {
  const directory = mkdtempSync(join(tmpdir(), "marinara-maps-engine-runtime-"));
  try {
    const { linkCapabilitySnapshotDependencies } = await import(
      pathToFileURL(
        join(engineRoot, "packages/server/src/services/capability-packages/capability-native-dependencies.service.ts"),
      ).href
    );
    await linkCapabilitySnapshotDependencies(directory, join(engineRoot, "packages/server/node_modules"));
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
          persistence: {
            documents: { create: async (document: Record<string, unknown>) => ({ ...document, revision: 1 }) },
          },
          resources: {},
          languageModels: {},
          json: { parseJsonish: JSON.parse },
        },
      },
    });
    const headers = { "x-marinara-android-secret": SECRET, "x-marinara-csrf": "1" };
    try {
      // The browser's own request carries the secret (or its session); World Maps' calls behind it must too.
      const saved = await app.inject({
        method: "PATCH",
        url: "/api/chats/spatial-context/agent-configuration",
        headers,
        payload: { description: "Maps", phase: "pre_generation", connectionId: null, settings: { author: "Mari" } },
      });
      assert.equal(saved.statusCode, 200, saved.body);
      assert.deepEqual(agentCalls, ["GET", "PATCH"], "both agent calls passed the Android local auth hook");
      assert.deepEqual((config.settings as Record<string, unknown>).author, "Mari");
      // The hook is live: the same agent read without the secret is refused.
      assert.equal((await app.inject({ method: "GET", url: "/api/agents" })).statusCode, 401);

      // Saving a map as a template parses it with the package's map schema on the Engine's package zod. A template is
      // stored disabled, so this map is too and comes back unchanged.
      const definition = {
        schemaVersion: 1,
        ownerMode: "roleplay",
        enabled: false,
        revision: 0,
        startingLocationId: "harbor",
        locations: [place("harbor", null, 0), place("lighthouse", "harbor", 0)],
      };
      const hierarchyProfile = {
        version: 1,
        mode: "custom",
        name: "Coast",
        types: [{ id: "type_place", label: "Place", baseKind: "place" }],
      };
      const template = await app.inject({
        method: "POST",
        url: "/api/chats/spatial-context/templates",
        headers,
        payload: { name: "Coast", definition, hierarchyProfile },
      });
      assert.equal(template.statusCode, 201, template.body);
      assert.deepEqual(template.json().data.definition, definition, "the saved map keeps every field");
      // The package ceiling still replaces the vendored 500.
      const large = {
        ...definition,
        locations: Array.from({ length: 501 }, (_, index) => place(`place-${index}`, null, index)),
        startingLocationId: "place-0",
      };
      const largeTemplate = await app.inject({
        method: "POST",
        url: "/api/chats/spatial-context/templates",
        headers,
        payload: { name: "Large", definition: large, hierarchyProfile },
      });
      assert.equal(largeTemplate.statusCode, 201, largeTemplate.body);
    } finally {
      cleanup();
      await app.close();
    }
    process.stdout.write("World Maps Engine runtime regression passed.\n");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
