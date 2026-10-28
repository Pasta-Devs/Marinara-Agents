// Calls, Noodle and Slurp reach the Engine's live services through api.runtime (Pasta-Devs/Marinara-Agents#1487):
// sources/host-runtime-overlay replaces each vendored copy of a stateful Engine service. This loads the overlay
// modules as the package build stacks them and checks the binding, the pre-activation log buffer, delegation to
// the host members, the "needs a newer Marinara Engine" answer (HTTP 501) when a member is missing, and the
// Calls schedule update.
// Run: node --experimental-transform-types tests/host-runtime-overlay.regression.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(root, "sources/host-runtime-overlay/packages/server/src");

// The overlay imports its siblings with .js specifiers, as the bundler resolves them.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL) {
      const path = fileURLToPath(new URL(specifier, context.parentURL));
      if (path.endsWith(".js") && !existsSync(path) && existsSync(path.replace(/\.js$/u, ".ts"))) {
        return { url: pathToFileURL(path.replace(/\.js$/u, ".ts")).href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
});
const load = (path) => import(pathToFileURL(join(server, path)).href);

try {
  const host = await load("lib/host-runtime.ts");
  const { logger, logDebugOverride } = await load("lib/logger.ts");

  // --- Binding ------------------------------------------------------------------------------------------------
  assert.throws(() => host.hostRuntime(), { name: "HostRuntimeNotBoundError" }, "nothing is bound before activate()");

  // Logs before activation are kept (the newest 200) and written on bind, in order.
  for (let index = 0; index < 250; index += 1) logger.info("before activation %d", index);
  logDebugOverride(true, "debug override %s", "early");
  const written = [];
  const runtimeLogger = {
    debug: (...args) => written.push(["debug", ...args]),
    info: (...args) => written.push(["info", ...args]),
    warn: (...args) => written.push(["warn", ...args]),
    error: (...args) => written.push(["error", ...args]),
    debugOverride: (...args) => written.push(["debugOverride", ...args]),
  };
  const runtime = { logger: runtimeLogger, persistence: {} };
  const unbind = host.bindHostRuntime(runtime);
  assert.equal(host.hostRuntime(), runtime);
  assert.equal(written.length, 200, "the buffer keeps at most 200 entries");
  assert.deepEqual(written[0], ["info", "before activation %d", 51], "the oldest entries are dropped");
  assert.deepEqual(written.at(-1), ["debugOverride", true, "debug override %s", "early"]);

  written.length = 0;
  logger.warn(new Error("boom"), "after activation");
  logger.trace("trace lands on debug");
  logger.fatal("fatal lands on error");
  assert.deepEqual(
    written.map((entry) => entry[0]),
    ["warn", "debug", "error"],
  );
  assert.equal(logger.isLevelEnabled("debug"), false, "an Engine without the check is treated as LOG_LEVEL info");
  runtimeLogger.isLevelEnabled = (level) => level === "debug";
  assert.equal(logger.isLevelEnabled("debug"), true, "the Engine's own level check decides");

  // A second activation's binding is not undone by the first one's cleanup.
  const second = { logger: runtimeLogger, persistence: {} };
  const unbindSecond = host.bindHostRuntime(second);
  unbind();
  assert.equal(host.hostRuntime(), second);
  unbindSecond();
  assert.throws(() => host.hostRuntime(), { name: "HostRuntimeNotBoundError" });

  // --- Missing members: "needs a newer Marinara Engine", HTTP 501 ----------------------------------------------
  host.bindHostRuntime({ logger: runtimeLogger, persistence: {} });
  const { createLLMProvider } = await load("services/llm/provider-registry.ts");
  const missing = (() => {
    try {
      createLLMProvider("openai", "https://example.invalid", "key");
    } catch (error) {
      return error;
    }
  })();
  assert.equal(missing?.name, "HostFeatureUnavailableError");
  assert.equal(missing.statusCode, 501);
  assert.match(missing.message, /needs a newer Marinara Engine/u);
  assert.equal(host.isHostFeatureUnavailableError(missing), true);
  assert.deepEqual(host.hostFeatureErrorBody(missing), {
    error: missing.message,
    code: "host_feature_unavailable",
    feature: missing.feature,
  });

  // Privileged routes answer it as HTTP 501; other errors reach the Engine's handler unchanged.
  const routes = [];
  const collector = { get: (path, handler) => routes.push([path, handler]), db: "kept" };
  const wrapped = host.withHostFeatureErrors(collector);
  wrapped.get("/missing", async () => {
    throw new host.HostFeatureUnavailableError("Local Whisper in calls");
  });
  wrapped.get("/broken", async () => {
    throw new Error("broken");
  });
  wrapped.get("/fine", async () => ({ ok: true }));
  assert.equal(wrapped.db, "kept", "the router is otherwise unchanged");
  const reply = () => {
    const sent = {};
    return {
      sent,
      status(code) {
        sent.status = code;
        return { send: (body) => Object.assign(sent, { body }) };
      },
    };
  };
  const missingReply = reply();
  await routes[0][1]({}, missingReply);
  assert.deepEqual(missingReply.sent, {
    status: 501,
    body: {
      error: "Local Whisper in calls needs a newer Marinara Engine.",
      code: "host_feature_unavailable",
      feature: "Local Whisper in calls",
    },
  });
  await assert.rejects(routes[1][1]({}, reply()), /broken/u);
  assert.deepEqual(await routes[2][1]({}, reply()), { ok: true });
  assert.throws(() => host.hostFeatureErrorHandler(new Error("other"), {}, reply()), /other/u);

  // --- Delegation to the Engine's members ----------------------------------------------------------------------
  const calls = [];
  const facade = { chatComplete: async () => ({ content: "ok" }) };
  const integrations = {
    llm: {
      createProvider: (...args) => (calls.push(["createProvider", ...args]), facade),
      withFallback: (options) => (calls.push(["withFallback", options]), facade),
      localSidecar: () => (calls.push(["localSidecar"]), facade),
    },
    images: {
      generate: async (...args) => (calls.push(["images.generate", ...args]), { base64: "", ext: "png" }),
      save: (...args) => (calls.push(["images.save", ...args]), "chat/file.png"),
      remove: () => {},
      stage: () => ({ filePath: "f", promote() {}, compensate() {} }),
      sweepStaged: () => 3,
      resolveNovelAiRequestSize: () => ({ width: 1, height: 2 }),
    },
    videos: {
      generate: async () => ({}),
      save: async () => "chat/clip.mp4",
      remove: async () => {},
      resolveDuration: () => 5,
      resolveReferenceUpload: () => null,
    },
  };
  host.bindHostRuntime({ logger: runtimeLogger, persistence: {}, integrations });
  assert.equal(
    createLLMProvider("custom", "http://127.0.0.1:1/v1", "k", 8192, null, null, false, true, {}, "conn"),
    facade,
  );
  assert.deepEqual(calls.at(-1), [
    "createProvider",
    "custom",
    "http://127.0.0.1:1/v1",
    "k",
    8192,
    null,
    null,
    false,
    true,
    {},
    "conn",
  ]);

  const { withConnectionFallbackProvider } = await load("services/llm/connection-fallback-provider.ts");
  const fallbackArgs = {
    primary: facade,
    primaryConnectionId: "conn",
    fallbackConnection: null,
    fallbackBaseUrl: "",
    category: "main",
    admissionMode: { kind: "background" },
  };
  assert.equal(withConnectionFallbackProvider(fallbackArgs), facade);
  assert.equal(calls.at(-1)[1], fallbackArgs, "the admission mode reaches the Engine (the vendored copy dropped it)");

  const { getLocalSidecarProvider, LOCAL_SIDECAR_MODEL } = await load("services/llm/local-sidecar.ts");
  assert.equal(getLocalSidecarProvider(), facade, "Local Model calls use the Engine's llama-server");
  assert.equal(LOCAL_SIDECAR_MODEL, "local-sidecar");

  const { sidecarModelService } = await load("services/sidecar/sidecar-model.service.ts");
  assert.deepEqual(sidecarModelService.getConfig(), { contextSize: undefined, maxParallelJobs: 1 });

  const images = await load("services/image/image-generation.ts");
  await images.generateImage("source", "url", "key", "hint", { prompt: "p" });
  assert.equal(calls.at(-1)[0], "images.generate");
  assert.equal(images.saveImageToDisk("chat", "AA==", "png"), "chat/file.png");
  assert.deepEqual(calls.at(-1), ["images.save", "chat", "AA==", "png", {}]);
  assert.equal(images.sweepStagedImages(), 3);
  const videos = await load("services/video/video-generation.ts");
  assert.equal(videos.resolveVideoRequestDuration("s", "h", { durationSeconds: 5 }), 5);
  assert.equal(await videos.saveVideoToDisk("chat", "AA=="), "chat/clip.mp4");

  // Admission: one slot table in the Engine. Missing, background work reports itself unavailable.
  const admission = await load("services/generation/connection-admission.ts");
  assert.equal(admission.withConnectionAdmissionProvider(facade, "conn", { kind: "none" }), facade);
  assert.throws(() => admission.tryBackgroundConnection("conn", new Date()), {
    name: "HostFeatureUnavailableError",
  });
  const busy = Object.assign(new Error("busy"), { name: "BackgroundConnectionBusyError" });
  assert.equal(admission.isConnectionAdmissionFailure(busy), true, "recognised by name without the member");
  assert.deepEqual(admission.admissionModeForRequest({ "x-marinara-automatic-generation": "1" }), {
    kind: "background",
  });
  const slots = [];
  integrations.admission = {
    withProvider: (provider, connectionId, mode) => (slots.push(["withProvider", connectionId, mode]), provider),
    run: async (connectionId, mode, operation) => (slots.push(["run", connectionId, mode]), operation()),
    tryBackground: (connectionId) => (slots.push(["tryBackground", connectionId]), { acquired: false }),
    isFailure: (error) => error === busy,
  };
  assert.deepEqual(admission.tryBackgroundConnection("conn", new Date()), { acquired: false });
  assert.equal(admission.withConnectionAdmissionProvider(facade, "conn"), facade);
  assert.equal(await admission.withConnectionAdmission("conn", { kind: "foreground" }, async () => 7), 7);
  assert.deepEqual(
    slots.map((slot) => slot[0]),
    ["tryBackground", "withProvider", "run"],
  );
  assert.deepEqual(slots[1][2], { kind: "foreground" }, "the vendored default mode is kept");

  // Registries: the Engine's commands and services, never an empty copy.
  const commands = await load("services/capability-packages/capability-command-registry.service.ts");
  const services = await load("services/capability-packages/capability-service-registry.service.ts");
  assert.deepEqual(commands.parseCapabilityConversationCommands("[uno]"), [], "no commands on an older Engine");
  assert.equal(commands.stripCapabilityConversationCommands("hi [uno]"), "hi [uno]");
  assert.equal(services.getCapabilityService("long-term-memory:storage"), null);
  const ltm = { storage: {} };
  host.bindHostRuntime({
    logger: runtimeLogger,
    persistence: {},
    integrations,
    commands: {
      parse: (content) =>
        content.includes("[uno]") ? [{ type: "capability", commandType: "uno", payload: null }] : [],
      strip: (content) => content.replace("[uno]", "").trim(),
      instructions: () => [],
    },
    services: { get: (key) => (key === "long-term-memory:storage" ? ltm : null) },
  });
  assert.deepEqual(commands.parseCapabilityConversationCommands("[uno]"), [
    { type: "capability", commandType: "uno", payload: null },
  ]);
  assert.equal(commands.stripCapabilityConversationCommands("hi [uno]"), "hi");
  assert.equal(services.getCapabilityService("long-term-memory:storage"), ltm);

  // --- Package-owned code calls api.runtime directly ------------------------------------------------------------
  const routesSource = await readFile(
    join(root, "packages/conversation-calls/src/engine/packages/server/src/routes/conversation-calls.routes.ts"),
    "utf8",
  );
  // A [schedule_update] goes on the character card through the Engine (#1498). The chat's schedule map is a cache
  // the Engine replaces on its next presence read, so the call never writes it.
  assert.match(routesSource, /requireHostMember\("Schedule updates in calls", persistence\.updateCharacterStatus\)/u);
  assert.doesNotMatch(routesSource, /characterSchedules/u, "no writes to the chat's schedule cache");
  assert.doesNotMatch(routesSource, /\.updateMetadata\(/u, "no whole-metadata writes");
  assert.doesNotMatch(
    routesSource,
    /chats\.(createMessage|createMessagesBatch|createNote|createInfluence|patchMetadata)\(/u,
    "chat writes go through api.runtime.persistence",
  );
  assert.equal(routesSource.match(/hostChatWrite\("appendMessages"\)/gu)?.length, 6);
  const importedPaths = [...routesSource.matchAll(/from "([^"]+)"/gu)].map((match) => match[1]);
  for (const vendored of ["haptic/", "spotify/", "sidecar/", "image/generated-image-entity-gallery"]) {
    assert.ok(
      !importedPaths.some((path) => path.includes(vendored)),
      `Calls routes no longer import the Engine's ${vendored}`,
    );
  }
  assert.doesNotMatch(routesSource, /import\("\.\.\/services\/haptic/u, "no second Intiface client");
  // Slurp's "lately" reads Long-Term Memory's service through the registry overlay (api.runtime.services).
  const memorySource = await readFile(
    join(root, "packages/slurp2/src/engine/packages/server/src/slp/data/creators/slp-agent-memory-source.ts"),
    "utf8",
  );
  assert.match(
    memorySource,
    /from "\.\.\/\.\.\/\.\.\/services\/capability-packages\/capability-service-registry\.service\.js"/u,
  );

  console.log("host runtime overlay regression passed");
} finally {
  hooks.deregister();
}
