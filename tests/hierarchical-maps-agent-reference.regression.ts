import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const directory = mkdtempSync(join(tmpdir(), "marinara-maps-agent-reference-"));
process.env.DATA_DIR = directory;
process.env.FILE_STORAGE_DIR = join(directory, "storage");
process.env.MARINARA_ENV_FILE = join(directory, ".env");
process.env.NODE_ENV = "test";
process.env.MARINARA_LITE = "true";
process.env.LOG_LEVEL = "silent";
const serverRequire = createRequire(join(engineRoot, "packages/server/package.json"));
const engine = (path: string) => import(pathToFileURL(join(engineRoot, path)).href);
async function main() {
  const { getDB, closeDB } = await engine("packages/server/src/db/connection.ts");
  const { createChatsStorage } = await engine("packages/server/src/services/storage/chats.storage.ts");
  const { createLorebooksStorage } = await engine("packages/server/src/services/storage/lorebooks.storage.ts");
  const { createConnectionsStorage } = await engine("packages/server/src/services/storage/connections.storage.ts");
  const { capabilityModuleRuntime } = await engine(
    "packages/server/src/services/capability-packages/capability-module-runtime.service.ts",
  );
  const { OpenAIProvider } = await engine("packages/server/src/services/llm/providers/openai.provider.ts");
  const { agentsRoutes } = await engine("packages/server/src/routes/agents.routes.ts");
  const { createCapabilityPersistenceHost } = await engine(
    "packages/server/src/services/capability-packages/capability-persistence.service.ts",
  );
  const { createCapabilityLanguageModelHost } = await engine(
    "packages/server/src/services/capability-packages/capability-language-model.service.ts",
  );
  const { createCapabilityResourceHost } = await engine(
    "packages/server/src/services/capability-packages/capability-resources.service.ts",
  );
  const originalComplete = OpenAIProvider.prototype.chatComplete;
  const prompts: string[] = [];
  OpenAIProvider.prototype.chatComplete = async (messages: Array<{ content: string }>) => {
    prompts.push(messages.map((message) => message.content).join("\n\n"));
    const plan = prompts.at(-1)!.includes("You expand an existing hierarchical world map")
      ? {
          locations: [
            {
              key: "reference_garden",
              parentKey: null,
              name: "Reference Garden",
              kind: "place",
              description: "A garden added to the existing map.",
              sourceKeys: [],
              origin: "added_by_ai",
              childPresentation: "list",
              links: [],
            },
          ],
        }
      : {
          worldName: "Reference World",
          startingLocationKey: "reference_world",
          locations: [
            {
              key: "reference_world",
              parentKey: null,
              name: "Reference World",
              kind: "region",
              description: "A reference fixture.",
              icon: "🌍",
              sourceKeys: [],
              origin: "added_by_ai",
              childPresentation: "list",
              links: [],
            },
            {
              key: "reference_harbor",
              parentKey: "reference_world",
              name: "Reference Harbor",
              kind: "settlement",
              description: "A harbor.",
              icon: "⚓",
              sourceKeys: [],
              origin: "added_by_ai",
              childPresentation: "list",
              links: [],
            },
          ],
        };
    return {
      content: JSON.stringify(plan),
      toolCalls: [],
      finishReason: "stop",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    };
  };
  const version =
    process.env.MAPS_REFERENCE_ARTIFACT_VERSION ||
    JSON.parse(readFileSync(join(repoRoot, "packages/hierarchical-maps/manifest.json"), "utf8")).version;
  const archive = join(repoRoot, "artifacts", `hierarchical-maps-${version}.zip`);
  const manifest = JSON.parse(execFileSync("unzip", ["-p", archive, "manifest.json"], { encoding: "utf8" }));
  const packageRoot = join(directory, "capability-packages", "versions", manifest.id, version);
  mkdirSync(packageRoot, { recursive: true });
  execFileSync("unzip", ["-q", archive, "-d", packageRoot]);
  writeFileSync(
    join(directory, "capability-packages", "installed.json"),
    JSON.stringify({
      schemaVersion: 1,
      packages: [
        {
          id: manifest.id,
          version,
          manifest,
          installedAt: new Date().toISOString(),
          status: "active",
          readiness: "ready",
          error: null,
          legacy: false,
        },
      ],
    }),
  );
  const db = await getDB();
  const app = serverRequire("fastify")();
  app.decorate("db", db);
  app.register(agentsRoutes, { prefix: "/api/agents" });
  try {
    assert.equal((await capabilityModuleRuntime.activatePackage(app, manifest.id)).readiness, "ready");
    const chats = createChatsStorage(db);
    const books = createLorebooksStorage(db);
    const connection = await createConnectionsStorage(db).create({
      name: "Maps reference fixture",
      provider: "custom",
      baseUrl: "http://127.0.0.1:1/v1",
      model: "fixture",
      apiKey: "fixture",
    });
    const reference = await books.create({ name: "Agent-only reference" });
    const otherReference = await books.create({ name: "Other chat reference" });
    const explicit = await books.create({ name: "Explicit map sources" });
    assert(reference && otherReference && explicit && connection);
    await books.createEntry({
      lorebookId: reference.id,
      name: "Matched",
      keys: ["crystal"],
      content: "MAPS_AGENT_ONLY_REFERENCE",
    });
    await books.createEntry({
      lorebookId: reference.id,
      name: "Unmatched",
      keys: ["never-spoken"],
      content: "UNMATCHED_REFERENCE",
    });
    await books.createEntry({
      lorebookId: reference.id,
      name: "Over budget",
      keys: ["crystal"],
      content: `OVERSIZED_REFERENCE ${"x".repeat(100_000)}`,
    });
    await books.createEntry({
      lorebookId: otherReference.id,
      name: "Other chat",
      keys: ["crystal"],
      content: "OTHER_CHAT_REFERENCE",
    });
    await books.createEntry({ lorebookId: explicit.id, name: "Explicit source", content: "EXPLICIT_MAP_SOURCE" });
    const chat = await chats.create({
      name: "Maps references",
      mode: "roleplay",
      characterIds: [],
      connectionId: connection.id,
    });
    const otherChat = await chats.create({
      name: "Other Maps references",
      mode: "game",
      characterIds: [],
      connectionId: connection.id,
    });
    const defaultChat = await chats.create({ name: "No attachment", mode: "roleplay", characterIds: [] });
    assert(chat && otherChat);
    for (const id of [chat.id, otherChat.id])
      await chats.createMessage({ chatId: id, role: "user", content: "Inspect the crystal." });
    const attach = (id: string, enabled: boolean, lorebookId: string) =>
      chats.patchMetadata(id, { agentLorebookAttachments: { "hierarchical-maps": { enabled, lorebookId } } });
    await attach(chat.id, true, reference.id);
    await attach(otherChat.id, true, otherReference.id);
    const body = {
      operation: "create",
      size: "small",
      groundingMode: "lore_expand",
      sourceLorebookIds: [explicit.id],
      sourceEntryIds: [],
      connectionId: connection.id,
      instructions: "Design a navigable harbor.",
      debugMode: false,
    };
    const request = async (url: string, payload: Record<string, unknown> = body) => {
      const response = await app.inject({ method: "POST", url, payload });
      assert.equal(response.statusCode, 200, response.body);
      return response.json();
    };
    const preview = async (id: string, payload: Record<string, unknown> = body) =>
      request(`/api/chats/${id}/spatial-context/generation-prompt/preview`, payload);
    const first = await preview(chat.id);
    assert.match(
      first.user,
      /MAPS_AGENT_ONLY_REFERENCE/,
      "the actual installed package preview includes triggered reference context",
    );
    assert.match(first.user, /EXPLICIT_MAP_SOURCE/, "reference context stays additive to explicit map sources");
    assert.doesNotMatch(first.user, /OTHER_CHAT_REFERENCE|UNMATCHED_REFERENCE|OVERSIZED_REFERENCE/);
    assert.equal(prompts.length, 0, "prompt previews never call the model");
    assert(defaultChat);
    assert.doesNotMatch((await preview(defaultChat.id)).user, /MAPS_AGENT_ONLY_REFERENCE|OTHER_CHAT_REFERENCE/);
    assert.match((await preview(otherChat.id)).user, /OTHER_CHAT_REFERENCE/);
    assert.doesNotMatch((await preview(otherChat.id)).user, /MAPS_AGENT_ONLY_REFERENCE/);
    // Per-agent references supplement setup/context. They do not replace the explicit,
    // cited catalog that the existing lore-grounded modes require as authoritative canon.
    assert.match(
      (await preview(chat.id, { ...body, groundingMode: "setup", sourceLorebookIds: [] })).user,
      /MAPS_AGENT_ONLY_REFERENCE/,
    );
    for (const groundingMode of ["lore_expand", "lore_strict"]) {
      for (const sourceLorebookIds of [[], ["missing-source"]]) {
        for (const suffix of ["generation-prompt/preview", "generate"]) {
          const response = await app.inject({
            method: "POST",
            url: `/api/chats/${chat.id}/spatial-context/${suffix}`,
            payload: { ...body, groundingMode, sourceLorebookIds },
          });
          assert.equal(response.statusCode, 400, response.body);
          assert.equal(
            response.json().code,
            sourceLorebookIds.length ? "spatial_ai_lore_sources_unavailable" : "spatial_ai_request_invalid",
          );
        }
      }
    }
    assert.equal(prompts.length, 0, "reference data does not bypass authoritative catalog validation");
    await attach(chat.id, false, reference.id);
    assert.doesNotMatch((await preview(chat.id)).user, /MAPS_AGENT_ONLY_REFERENCE/);
    await attach(chat.id, true, "missing-book");
    assert.doesNotMatch((await preview(chat.id)).user, /MAPS_AGENT_ONLY_REFERENCE/);
    await attach(chat.id, true, reference.id);
    await books.update(reference.id, { enabled: false });
    assert.doesNotMatch((await preview(chat.id)).user, /MAPS_AGENT_ONLY_REFERENCE/);
    await books.update(reference.id, { enabled: true });
    const limitedConnection = await createConnectionsStorage(db).create({
      name: "Maps finite-context fixture",
      provider: "custom",
      baseUrl: "http://127.0.0.1:1/v1",
      model: "fixture",
      apiKey: "fixture",
      maxContext: 32_768,
    });
    assert(limitedConnection);
    const limitedModel = await createCapabilityLanguageModelHost(db).resolve(limitedConnection.id);
    const ordinaryFit = limitedModel.fitContext(
      [
        { role: "system", content: first.system },
        { role: "user", content: first.user },
      ],
      { maxTokens: first.maxTokens },
    );
    assert.equal(ordinaryFit.trimmed, false, "the ordinary complete map prompt fits this connection");
    assert.equal(ordinaryFit.maxTokens, first.maxTokens, "the ordinary map response reserve also fits");
    await chats.patchMetadata(chat.id, { lorebookTokenBudget: 0 });
    assert.match(
      (await preview(chat.id)).user,
      /OVERSIZED_REFERENCE/,
      "explicit unlimited lorebook budget is preserved",
    );
    const callsBeforeOversized = prompts.length;
    const oversizedResponse = await app.inject({
      method: "POST",
      url: `/api/chats/${chat.id}/spatial-context/generate`,
      payload: { ...body, connectionId: limitedConnection.id },
    });
    assert.equal(oversizedResponse.statusCode, 400, oversizedResponse.body);
    assert.equal(oversizedResponse.json().code, "spatial_ai_context_too_large");
    assert.match(oversizedResponse.json().error, /complete map request.*context/i);
    assert.equal(prompts.length, callsBeforeOversized, "an oversized complete prompt never calls the model");
    const cappedConnection = await createConnectionsStorage(db).create({
      name: "Maps configured-output fixture",
      provider: "custom",
      baseUrl: "http://127.0.0.1:1/v1",
      model: "fixture",
      apiKey: "fixture",
      maxContext: 32_768,
      maxTokensOverride: 2_048,
    });
    assert(cappedConnection);
    await request(`/api/chats/${chat.id}/spatial-context/generate`, {
      ...body,
      connectionId: cappedConnection.id,
    });
    assert.match(
      prompts.at(-1)!,
      /OVERSIZED_REFERENCE/,
      "the configured output cap leaves room for complete references",
    );
    assert(prompts.at(-1)!.includes(first.system), "the complete map instructions are preserved");
    assert.match(prompts.at(-1)!, /Design a navigable harbor\./);
    await chats.patchMetadata(chat.id, { lorebookTokenBudget: null });
    const created = await request(`/api/chats/${chat.id}/spatial-context/generate`, {
      ...body,
      connectionId: limitedConnection.id,
    });
    assert.match(prompts.at(-1)!, /MAPS_AGENT_ONLY_REFERENCE/);
    assert.match(prompts.at(-1)!, /EXPLICIT_MAP_SOURCE/);
    assert.doesNotMatch(prompts.at(-1)!, /OTHER_CHAT_REFERENCE|UNMATCHED_REFERENCE/);
    await chats.patchMetadata(chat.id, { spatialContext: created.definition });
    for (const operation of ["replace", "expand"]) {
      const payload = {
        ...body,
        operation,
        ...(operation === "expand" ? { targetLocationId: created.definition.locations[0].id } : {}),
      };
      assert.match((await preview(chat.id, payload)).user, /MAPS_AGENT_ONLY_REFERENCE/);
    }
    await request(`/api/chats/${chat.id}/spatial-context/generate`, { ...body, operation: "replace" });
    assert.match(prompts.at(-1)!, /MAPS_AGENT_ONLY_REFERENCE/);
    await request(`/api/chats/${chat.id}/spatial-context/generate`, {
      ...body,
      operation: "expand",
      targetLocationId: created.definition.locations[0].id,
    });
    assert.match(prompts.at(-1)!, /MAPS_AGENT_ONLY_REFERENCE/);
    assert.match(prompts.at(-1)!, /EXPLICIT_MAP_SOURCE/);
    await request("/api/chats/spatial-context/templates/generate", {
      ...body,
      groundingMode: "setup",
      sourceLorebookIds: [],
    });
    assert.doesNotMatch(
      prompts.at(-1)!,
      /MAPS_AGENT_ONLY_REFERENCE|OTHER_CHAT_REFERENCE/,
      "global templates have no chat attachment",
    );

    // Execute the exact ZIP entrypoint with held public-host operations. The request must
    // retain its unavailable-runtime classification even when an inner catch relabels an error.
    const packagedModule = await import(pathToFileURL(join(packageRoot, manifest.entrypoints.server)).href);
    let heldCases = 0;
    const stages = [
      "reference",
      "reference-generation",
      "configuration",
      "connection",
      "generation",
      "repair",
    ] as const;
    for (const stage of stages) {
      for (const template of stage.startsWith("reference") ? [false] : [false, true]) {
        for (const rejectHeld of stage.startsWith("reference") ? [false] : [false, true]) {
          for (const teardown of [false, true]) {
            let enter!: () => void;
            let resume!: () => void;
            const entered = new Promise<void>((resolve) => {
              enter = resolve;
            });
            const released = new Promise<void>((resolve) => {
              resume = resolve;
            });
            const hold = async () => {
              enter();
              await released;
              if (rejectHeld) throw new Error("Held fixture operation failed");
            };
            const scopedApp = serverRequire("fastify")();
            let configReads = 0;
            let modelCalls = 0;
            scopedApp.get("/api/agents", async () => {
              configReads += 1;
              if (stage === "configuration" && configReads === (template ? 2 : 1)) await hold();
              return [];
            });
            const cleanup = await packagedModule.activate({
              app: scopedApp,
              api: {
                registerService: () => () => {},
                runtime: {
                  isDebugAgentsEnabled: () => false,
                  logger: { debug() {}, info() {}, warn() {}, error() {}, debugOverride() {} },
                  persistence: createCapabilityPersistenceHost(db),
                  resources: createCapabilityResourceHost(db),
                  resolveAgentLorebookEntries: async () => {
                    if (stage.startsWith("reference")) await hold();
                    return [{ id: "held-reference", content: "HELD_REFERENCE" }];
                  },
                  languageModels: {
                    resolve: async () => {
                      if (stage === "connection") await hold();
                      return {
                        name: "Maps pending request fixture",
                        model: "pending-request-fixture",
                        maxContext: 32_768,
                        fitContext: (messages: unknown[]) => ({ messages, trimmed: false }),
                        chatComplete: async (messages: Array<{ content: string }>) => {
                          modelCalls += 1;
                          if (stage === "generation" || (stage === "repair" && modelCalls === 2)) await hold();
                          const result = await OpenAIProvider.prototype.chatComplete(messages);
                          return stage === "repair" && modelCalls === 1
                            ? { ...result, content: "{invalid JSON}" }
                            : result;
                        },
                      };
                    },
                  },
                  json: { parseJsonish: JSON.parse },
                },
              },
            });
            try {
              const suffix = stage === "reference" ? "generation-prompt/preview" : "generate";
              const pending = scopedApp
                .inject({
                  method: "POST",
                  url: template
                    ? "/api/chats/spatial-context/templates/generate"
                    : `/api/chats/${otherChat.id}/spatial-context/${suffix}`,
                  payload: { ...body, groundingMode: "setup", sourceLorebookIds: [] },
                })
                .then((response: { statusCode: number; body: string; json(): Record<string, unknown> }) => response);
              let timeout: ReturnType<typeof setTimeout> | undefined;
              try {
                await Promise.race([
                  entered,
                  new Promise<never>((_, reject) => {
                    timeout = setTimeout(() => reject(new Error(`Request never reached held ${stage}`)), 5_000);
                  }),
                ]);
              } finally {
                clearTimeout(timeout);
              }
              const callsAtTeardown = modelCalls;
              if (teardown) await cleanup();
              resume();
              const response = await pending;
              const context = `${stage} template=${template} rejected=${rejectHeld} teardown=${teardown}: ${response.body}`;
              if (teardown) {
                assert.equal(response.statusCode, 503, context);
                assert.equal(response.json().code, "spatial_runtime_unavailable", context);
                assert.match(String(response.json().error), /runtime is not configured/, context);
                assert.equal(modelCalls, callsAtTeardown, "teardown never starts another generation/repair call");
              } else {
                const expected =
                  rejectHeld && (stage === "connection" || (stage === "configuration" && template))
                    ? 400
                    : rejectHeld && (stage === "generation" || stage === "repair")
                      ? 502
                      : 200;
                assert.equal(response.statusCode, expected, context);
              }
              heldCases += 1;
            } finally {
              resume();
              await cleanup();
              await scopedApp.close();
            }
          }
        }
      }
    }

    process.stdout.write(
      `World Maps exact ZIP: ${heldCases} held-await controls passed (preview, generation, configuration, connection, provider and JSON repair).\n`,
    );

    // Exercise the real routes against valid public host variants, without bundling a private scanner.
    const esbuild = createRequire(join(engineRoot, "packages/client/package.json"))("esbuild");
    const adapterPath = join(directory, "maps-runtime-adapter.mjs");
    await esbuild.build({
      stdin: {
        contents: `export { configurePackageRuntime, resolvePackageAgentLorebookEntries } from ${JSON.stringify(join(repoRoot, "packages/hierarchical-maps/src/engine/packages/server/src/services/spatial-context/package-runtime.ts"))};
export { spatialContextRoutes } from ${JSON.stringify(join(repoRoot, "packages/hierarchical-maps/src/engine/packages/server/src/routes/spatial-context.routes.ts"))};`,
        resolveDir: repoRoot,
        loader: "ts",
      },
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: adapterPath,
      nodePaths: [join(engineRoot, "packages/server/node_modules"), join(engineRoot, "packages/shared/node_modules")],
      alias: { "@marinara-engine/shared": join(engineRoot, "packages/shared/dist/index.js") },
    });
    const adapter = await import(pathToFileURL(adapterPath).href);
    const { resolvePackageAgentLorebookEntries } = await engine(
      "packages/server/src/services/capability-packages/capability-agent-lorebook.service.ts",
    );
    let budgetEcho: number | undefined;
    let publicOutputCap: number | null = null;
    let fittedReserve: number | undefined;
    let completedReserve: number | undefined;
    const fitReserves: Array<number | undefined> = [];
    const completionReserves: Array<number | undefined> = [];
    let malformedNext = false;
    let repairContent: string | null = null;
    const releasePublicHost = adapter.configurePackageRuntime(
      {
        isDebugAgentsEnabled: () => false,
        logger: { debug() {}, info() {}, warn() {}, error() {}, debugOverride() {} },
        persistence: createCapabilityPersistenceHost(db),
        resources: createCapabilityResourceHost(db),
        resolveAgentLorebookEntries: (options: { chatId: string; signal?: AbortSignal }) =>
          resolvePackageAgentLorebookEntries(db, "hierarchical-maps", options),
        languageModels: {
          resolve: async () => ({
            name: "Maps public contract fixture",
            connectionId: connection.id,
            model: "public-contract-fixture",
            maxContext: 32_768,
            maxOutputTokens: publicOutputCap,
            fitContext: (messages: Array<{ role: string; content: string }>, options: { maxTokens?: number }) => {
              fittedReserve = options.maxTokens;
              fitReserves.push(options.maxTokens);
              return {
                messages,
                trimmed: false,
                estimatedTokensBefore: 1,
                estimatedTokensAfter: 1,
                ...(budgetEcho === undefined ? {} : { maxTokens: budgetEcho }),
              };
            },
            chatComplete: async (messages: Array<{ content: string }>, options: { maxTokens?: number }) => {
              completedReserve = options.maxTokens;
              completionReserves.push(options.maxTokens);
              const result = await OpenAIProvider.prototype.chatComplete(messages);
              if (malformedNext) {
                malformedNext = false;
                repairContent = result.content;
                return { ...result, content: "{invalid JSON}" };
              }
              if (repairContent) {
                const content = repairContent;
                repairContent = null;
                return { ...result, content };
              }
              return result;
            },
          }),
        },
        json: { parseJsonish: JSON.parse },
      },
      async () => null,
      async () => null,
    );
    const publicHostApp = serverRequire("fastify")();
    try {
      await publicHostApp.register(adapter.spatialContextRoutes, { prefix: "/api/chats" });
      const cases = [
        { id: otherChat.id, payload: body, reference: /OTHER_CHAT_REFERENCE/ },
        {
          id: chat.id,
          payload: { ...body, operation: "expand", targetLocationId: created.definition.locations[0].id },
          reference: /MAPS_AGENT_ONLY_REFERENCE/,
        },
      ];
      for (const sample of cases) {
        const response = await publicHostApp.inject({
          method: "POST",
          url: `/api/chats/${sample.id}/spatial-context/generate`,
          payload: sample.payload,
        });
        assert.equal(response.statusCode, 200, response.body);
        assert.match(prompts.at(-1)!, sample.reference, "an omitted budget echo preserves reference context");
        assert.match(prompts.at(-1)!, /Design a navigable harbor\./);
      }
      for (publicOutputCap of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.5, 1.5]) {
        for (const sample of cases) {
          const response = await publicHostApp.inject({
            method: "POST",
            url: `/api/chats/${sample.id}/spatial-context/generate`,
            payload: sample.payload,
          });
          assert.equal(response.statusCode, 200, response.body);
          assert.equal(
            fittedReserve,
            first.maxTokens,
            "invalid output-cap metadata does not replace the valid requested reserve",
          );
          assert.equal(completedReserve, first.maxTokens, "the actual call keeps that valid output reserve");
        }
      }
      publicOutputCap = 2_048;
      for (const sample of cases) {
        const response = await publicHostApp.inject({
          method: "POST",
          url: `/api/chats/${sample.id}/spatial-context/generate`,
          payload: sample.payload,
        });
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(fittedReserve, 2_048);
        assert.equal(completedReserve, fittedReserve, "the actual call requests the same output reserve proven to fit");
      }
      for (const sample of cases) {
        malformedNext = true;
        const response = await publicHostApp.inject({
          method: "POST",
          url: `/api/chats/${sample.id}/spatial-context/generate`,
          payload: sample.payload,
        });
        assert.equal(response.statusCode, 200, response.body);
        assert.deepEqual(fitReserves.slice(-2), [2_048, 2_048], "the formatting repair fits the same capped reserve");
        assert.deepEqual(completionReserves.slice(-2), [2_048, 2_048], "both actual calls use that capped reserve");
      }
      const callsBeforeReducedEcho = prompts.length;
      for (budgetEcho of [0, 1]) {
        for (const sample of cases) {
          const response = await publicHostApp.inject({
            method: "POST",
            url: `/api/chats/${sample.id}/spatial-context/generate`,
            payload: sample.payload,
          });
          assert.equal(response.statusCode, 400, response.body);
          assert.equal(response.json().code, "spatial_ai_context_too_large");
        }
      }
      assert.equal(prompts.length, callsBeforeReducedEcho, "explicitly smaller reserves never call the model");
    } finally {
      await publicHostApp.close();
      releasePublicHost();
    }
    const release = adapter.configurePackageRuntime(
      {
        persistence: createCapabilityPersistenceHost(db),
        resources: createCapabilityResourceHost(db),
        languageModels: {},
        json: { parseJsonish: JSON.parse },
      },
      async () => null,
      async () => null,
    );
    try {
      await assert.rejects(() => adapter.resolvePackageAgentLorebookEntries(chat.id), {
        code: "host_feature_unavailable",
        statusCode: 501,
      });
      const oldHostApp = serverRequire("fastify")();
      try {
        await oldHostApp.register(adapter.spatialContextRoutes, { prefix: "/api/chats" });
        const completedCalls = prompts.length;
        for (const suffix of ["generation-prompt/preview", "generate"]) {
          const response = await oldHostApp.inject({
            method: "POST",
            url: `/api/chats/${chat.id}/spatial-context/${suffix}`,
            payload: { ...body, operation: "replace" },
          });
          assert.equal(response.statusCode, 501, response.body);
          assert.equal(response.json().code, "host_feature_unavailable");
          assert.match(response.json().error, /newer Marinara Engine/);
        }
        assert.equal(prompts.length, completedCalls, "missing-host failures never call the model");
        release();
        for (const suffix of ["generation-prompt/preview", "generate"]) {
          const response = await oldHostApp.inject({
            method: "POST",
            url: `/api/chats/${chat.id}/spatial-context/${suffix}`,
            payload: { ...body, operation: "replace" },
          });
          assert.equal(response.statusCode, 503, response.body);
          assert.equal(response.json().code, "spatial_runtime_unavailable");
          assert.match(response.json().error, /runtime is not configured/);
        }
        assert.equal(prompts.length, completedCalls, "torn-down runtimes never call the model");
      } finally {
        await oldHostApp.close();
      }
    } finally {
      release();
    }
    await assert.rejects(() => adapter.resolvePackageAgentLorebookEntries(chat.id), {
      code: "spatial_runtime_unavailable",
      statusCode: 503,
    });
  } finally {
    OpenAIProvider.prototype.chatComplete = originalComplete;
    await capabilityModuleRuntime.stop();
    await app.close();
    await closeDB();
    rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
