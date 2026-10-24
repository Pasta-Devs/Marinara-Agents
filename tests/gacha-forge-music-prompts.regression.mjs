// The soundtrack model and package storage are isolated; this never contacts a provider.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createForgeMusicPromptService,
  forgeMusicBriefMessages,
  normalizeForgeMusicPrompt,
} from "../packages/gacha-forge/src/audio-prompts.mjs";
import { loadGachaBundlePatches, swapGachaBundleText } from "../scripts/gacha-forge-bundle-patches.mjs";

const brief = "Original instrumental fantasy music: warm woodwinds, harp and celesta over soft orchestral strings.";
const makeFixture = () => {
  let world = { scenario: "Genshin Impact, a journey between regions.", narrationConnectionId: "narration" };
  let session = { progress: { chapter: 4 }, achievements: { claimed: { first: true } } };
  let result = { ok: true, value: { prompt: brief } };
  let writes = true;
  const calls = [];
  const options = {
    readWorld: async () => structuredClone(world),
    readSession: async () => structuredClone(session),
    updateSession: async (_id, update) => {
      if (!writes) return null;
      update(session);
      return structuredClone(session);
    },
    generate: async (request) => {
      calls.push(request);
      if (result instanceof Error) throw result;
      return typeof result === "function" ? result(request) : result;
    },
  };
  return {
    options,
    calls,
    world: (value) => (world = value),
    result: (value) => (result = value),
    writes: (value) => (writes = value),
    session: () => structuredClone(session),
    service: createForgeMusicPromptService(options),
  };
};
const request = { runId: "world", cue: "home" };
assert.equal(normalizeForgeMusicPrompt({ prompt: " " }), null);
assert.equal(normalizeForgeMusicPrompt({ prompt: "x".repeat(1001) }), null);
assert.deepEqual(normalizeForgeMusicPrompt({ prompt: ` ${brief} `, secret: "discarded" }), { prompt: brief });

const cached = makeFixture();
const traces = [];
cached.options.log = (messages, debugMode) => traces.push({ messages, debugMode });
const shared = createForgeMusicPromptService(cached.options);
await Promise.all([shared(request), shared({ ...request, debugMode: true })]);
assert.equal(cached.calls.length, 1, "concurrent playback deduplicates the model request");
assert.deepEqual(
  traces.map(({ debugMode }) => debugMode),
  [false, true],
);
assert.equal(cached.calls[0].debugMode, false, "a joining trace does not restart an already-billable request");
assert.equal(cached.calls[0].run.narrationConnectionId, "narration");
assert.equal(JSON.parse(cached.calls[0].messages[1].content).world, "Genshin Impact, a journey between regions.");
assert.match(cached.calls[0].messages[0].content, /Do not name franchises/);
assert.deepEqual(cached.session().progress, { chapter: 4 });
assert.deepEqual(cached.session().achievements, { claimed: { first: true } });
assert.equal((await createForgeMusicPromptService(cached.options)(request)).cached, true, "cache survives reload");
assert.equal(cached.calls.length, 1);
await cached.service({ ...request, cue: "boss" });
assert.equal(cached.calls.length, 2, "each soundtrack context receives its own brief");
cached.world({ scenario: "A changed world" });
await cached.service(request);
assert.equal(cached.calls.length, 3, "changing the setting invalidates the saved brief");
assert.equal(JSON.stringify(cached.session()).includes("narrationConnectionId"), false);

for (const cue of ["home", "combat", "boss", "happy", "tense", "sad", "bond"])
  assert.equal(
    typeof JSON.parse(forgeMusicBriefMessages({ scenario: "world" }, cue)[1].content).soundtrackContext,
    "string",
  );
for (const cue of ["__proto__", "unknown", null]) {
  const fixture = makeFixture();
  assert.equal((await fixture.service({ ...request, cue })).error, "bad-request");
  assert.equal(fixture.calls.length, 0);
}
for (const value of [null, { scenario: " " }]) {
  const fixture = makeFixture();
  fixture.world(value);
  assert.equal((await fixture.service(request)).error, "not-found");
  assert.equal(fixture.calls.length, 0);
}
for (const value of [{ ok: false }, { ok: true, value: { prompt: "x".repeat(1001) } }]) {
  const fixture = makeFixture();
  fixture.result(value);
  assert.equal((await fixture.service(request)).error, "generation-failed");
  assert.equal(fixture.session().audioPrompts, undefined);
  fixture.result({ ok: true, value: { prompt: brief } });
  assert.equal((await fixture.service(request)).ok, true, "failed generation releases the pending slot");
}
const thrown = makeFixture();
thrown.result(new Error("fixture failure"));
await assert.rejects(thrown.service(request), /fixture failure/);
thrown.result({ ok: true, value: { prompt: brief } });
assert.equal((await thrown.service(request)).ok, true);
for (const current of [null, { scenario: "changed during generation" }]) {
  const fixture = makeFixture();
  fixture.result(() => {
    fixture.world(current);
    return { ok: true, value: { prompt: brief } };
  });
  assert.equal((await fixture.service(request)).error, "stale-world");
  assert.equal(fixture.session().audioPrompts, undefined, "deleted or changed worlds cannot receive stale results");
}
const conflict = makeFixture();
conflict.writes(false);
assert.equal((await conflict.service(request)).error, "write-conflict");

// Execute the actual registered route and narration resolver from the package bundle.
const packageRoot = new URL("../packages/gacha-forge/", import.meta.url);
const ledger = await loadGachaBundlePatches(packageRoot);
let source = await readFile(new URL("server.mjs", packageRoot), "utf8");
if (!source.includes("/* forge-audio-prompts-source:start */")) {
  const patch = ledger.files["server.mjs"].patches.find((entry) =>
    entry.edits.some((edit) => edit.sourceId === "audio-prompts"),
  );
  assert.ok(patch);
  for (const edit of patch.edits) source = swapGachaBundleText(source, edit.find, edit.replace);
}
assert.ok(
  source.includes("generate:({runId,run,messages,debugMode})"),
  "the rebuilt narration adapter forwards the music debug override",
);
const directory = await mkdtemp(join(tmpdir(), "marinara-forge-music-prompts-"));
const originalFetch = globalThis.fetch;
try {
  const path = join(directory, "server.mjs");
  await writeFile(path, source);
  const docs = new Map();
  const seed = (id, kind, data) => docs.set(id, { id, kind, data, revision: 1 });
  seed("index", "index", {
    activeRunId: "world",
    runs: [
      {
        runId: "world",
        scenario: "A fantasy world",
        language: "Polish",
        connectionId: "main",
        narrationConnectionId: "narration",
      },
    ],
  });
  seed("world:session", "session", { progress: { chapter: 4 } });
  const routes = new Map();
  const generated = [];
  const logged = [];
  globalThis.fetch = async (input) => {
    assert.equal(new URL(input).pathname, "/api/connections");
    return {
      ok: true,
      json: async () => ["main", "narration"].map((id) => ({ id, model: "fixture", maxContext: 128000 })),
    };
  };
  const documents = {
    getById: async (_package, id) => structuredClone(docs.get(id) || null),
    list: async () => structuredClone([...docs.values()]),
    create: async (document) => {
      const saved = { ...structuredClone(document), revision: 1 };
      docs.set(document.id, saved);
      return structuredClone(saved);
    },
    update: async (document) => {
      const old = docs.get(document.id);
      if (old?.revision !== document.expectedRevision) return null;
      const saved = { ...old, ...structuredClone(document), revision: old.revision + 1 };
      docs.set(document.id, saved);
      return structuredClone(saved);
    },
  };
  const { activate } = await import(pathToFileURL(path).href);
  await activate({
    package: { id: "gacha-forge", version: "fixture" },
    api: {
      runtime: {
        persistence: { documents },
        logger: Object.fromEntries(
          ["info", "warn", "error", "debug"].map((level) => [level, (...args) => logged.push({ level, args })]),
        ),
        json: { parseJsonish: JSON.parse },
        languageModels: {
          resolveForRequest: async ({ connectionId }) => ({
            connectionId,
            model: "fixture",
            chatComplete: async (messages, options) => {
              generated.push({ connectionId, messages, options });
              return {
                content: generated.length === 1 ? "not valid JSON" : JSON.stringify({ prompt: brief }),
                finishReason: "stop",
              };
            },
          }),
        },
      },
      registerPrivilegedRoutes: async (register) =>
        register({ get() {}, post: (name, handler) => routes.set(name, handler) }),
    },
  });
  assert.ok(routes.has("/audio/prompt"), "the actual package registers the music brief route");
  const route = routes.get("/audio/prompt");
  const result = await route({ body: { ...request, scenario: "untrusted client override", debugMode: true } });
  assert.deepEqual(result, { ok: true, prompt: brief, cached: false });
  assert.equal(generated.length, 2);
  assert.equal(generated[0].connectionId, "narration");
  assert.equal(
    generated[0].messages[0].content.includes("write every player-facing string in Polish"),
    false,
    "provider briefs remain English in non-English worlds",
  );
  assert.equal(
    generated.every(({ options }) => options.debugMode === true),
    true,
    "debug override reaches the actual provider, including later parser retries",
  );
  assert.equal(
    JSON.parse(generated[0].messages[1].content).world,
    "A fantasy world",
    "the route reads canonical persisted world context",
  );
  assert.ok(
    logged.some(
      ({ level, args }) => level === "info" && args[0].includes("music-prompt") && args[1].includes("A fantasy world"),
    ),
    "debug mode exposes the final model prompt",
  );
  assert.equal((await route({ body: request })).cached, true);
  assert.equal(generated.length, 2);
  assert.equal(docs.get("world:session").data.progress.chapter, 4);
  assert.equal(docs.get("world:session").data.audioPrompts.home.prompt, brief);
} finally {
  globalThis.fetch = originalFetch;
  await rm(directory, { recursive: true, force: true });
}
process.stdout.write(
  "Music brief regression passed: seven cues, cache/reload, invalid/stale/failure paths and actual narration route.\n",
);
