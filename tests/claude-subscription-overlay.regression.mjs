// Noodle, Slurp and Calls bundle sources/claude-subscription-overlay in place of the frozen
// vendored Claude (Subscription) provider (#1313). This loads the overlay the way the package
// build stacks it (vendored server sources, then the overlay) with the plugin beside it, drives
// chat() through a fake Agent SDK, and checks that every package ships the plugin.
// Run: node --experimental-transform-types tests/claude-subscription-overlay.regression.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const overlay = join(root, "sources/claude-subscription-overlay");
const pluginSource = join(overlay, "packages/server/src/assets/claude-code-plugin");
const pluginFiles = [".claude-plugin/plugin.json", "hooks/hooks.json", "hooks/register.mjs"];

// Real path: module URLs are resolved through symlinks such as macOS /var -> /private/var.
const buildRoot = await realpath(await mkdtemp(join(tmpdir(), "claude-subscription-overlay-")));
const server = join(buildRoot, "packages/server/src");
const providers = join(server, "services/llm/providers");
// Bundled into server.mjs, the provider finds claude-code-plugin/ beside itself; so does this copy.
const pluginDir = join(providers, "claude-code-plugin");
await cp(join(root, "sources/engine/packages/server/src"), server, { recursive: true });
await cp(overlay, buildRoot, { recursive: true, force: true });
await cp(pluginSource, pluginDir, { recursive: true });

const mocks = new Map([
  [
    join(server, "lib/logger.js"),
    "export const logger = {debug(){},info(){},warn(...args){(globalThis.overlayWarnings ??= []).push(args)},error(){},isLevelEnabled(){return false}}; export function logDebugOverride(){}",
  ],
  [
    join(server, "config/runtime-config.js"),
    `export const isClaudeSubscriptionResumeEnabled = () => false;
     export const getDataDir = () => ${JSON.stringify(buildRoot)};
     export const getEmbeddingRequestTimeoutMs = () => 1000;
     export const isProviderLocalUrlsEnabled = () => false;`,
  ],
  [
    join(server, "utils/security.js"),
    "export const requestHeadersWithIdentityEncoding = (h) => h; export async function safeFetch(){ throw Error('no network'); }",
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

const init = (extra = {}) => ({
  type: "system",
  subtype: "init",
  tools: [],
  mcp_servers: [],
  skills: [],
  plugins: [{ name: "marinara-chat-context", path: pluginDir }],
  slash_commands: [],
  claude_code_version: "2.1.293",
  apiKeySource: "none",
  ...extra,
});
const success = {
  type: "result",
  subtype: "success",
  result: "Hi there.",
  usage: { input_tokens: 3, output_tokens: 2 },
};

try {
  const provider = await import(pathToFileURL(join(providers, "claude-subscription.provider.ts")).href);
  let calls = [];
  let script = [];
  provider.__setSdkForTesting({
    query({ options }) {
      calls.push(options);
      return (async function* () {
        for (const message of script) yield message;
      })();
    },
  });
  const claude = new provider.ClaudeSubscriptionProvider("", "", 200_000);
  const run = async (options = {}) => {
    let text = "";
    for await (const chunk of claude.chat(
      [
        { role: "system", content: "You are Mari." },
        { role: "user", content: "Hello" },
      ],
      { model: "claude-sonnet-4-5", stream: false, ...options },
    ))
      text += chunk;
    return text;
  };

  // One request with a preset title (no hidden generate_session_title call) and the plugin loaded,
  // and Custom Parameters can tune generation but never undo either of them.
  script = [init(), success];
  assert.equal(
    await run({
      customParameters: { title: "", plugins: [], env: { ENABLE_CLAUDEAI_MCP_SERVERS: "true" }, effort: "low" },
    }),
    "Hi there.",
  );
  assert.equal(calls.length, 1);
  const [options] = calls;
  assert.equal(options.title, "Title");
  assert.deepEqual(options.plugins, [{ type: "local", path: pluginDir }]);
  assert.equal(options.env.ENABLE_CLAUDEAI_MCP_SERVERS, "false");
  assert.equal(options.effort, "low");
  assert.deepEqual(options.tools, []);
  assert.deepEqual(options.settingSources, []);
  assert.equal(options.systemPrompt, "You are Mari.");
  assert.equal(globalThis.overlayWarnings, undefined, "a Claude Code that applies the plugin needs no warning");

  // Engine 2.5.0's Claude Code (2.1.282) loads the plugin but ignores it: warn once per process.
  for (let request = 0; request < 2; request += 1) {
    script = [init({ claude_code_version: "2.1.282" }), success];
    assert.equal(await run(), "Hi there.");
  }
  assert.equal(globalThis.overlayWarnings?.length, 1);
  assert.match(globalThis.overlayWarnings[0][0], /ignores the chat-context mod/u);
  assert.equal(globalThis.overlayWarnings[0][1], "2.1.282");

  // Claude Code reporting claude.ai connectors or mcp__ tools stops the request.
  for (const exposed of [
    { mcp_servers: [{ name: "claude.ai Gmail", status: "connected" }] },
    { tools: ["mcp__claude_ai_Gmail__search"] },
  ]) {
    calls = [];
    script = [init(exposed), success];
    await assert.rejects(run(), /turned on claude\.ai connectors/u);
    assert.equal(calls[0].abortController.signal.aborted, true);
  }

  // Without the plugin, nothing reaches Claude Code: the CLI would send the request before init.
  for (const file of pluginFiles) {
    await rm(join(pluginDir, file));
    calls = [];
    script = [init(), success];
    await assert.rejects(
      run(),
      (error) => /chat-context plugin/u.test(error.message) && error.message.includes(`: ${file}.`),
    );
    assert.equal(calls.length, 0, `${file} missing must stop before the SDK`);
    await cp(join(pluginSource, file), join(pluginDir, file));
  }
} finally {
  hooks.deregister();
  await rm(buildRoot, { recursive: true, force: true });
}

// Every package that bundles the provider ships the plugin beside server.mjs, byte for byte.
for (const id of ["noodle", "slurp2", "conversation-calls"]) {
  const packageDir = join(root, "packages", id);
  const manifest = JSON.parse(await readFile(join(packageDir, "manifest.json"), "utf8"));
  const bundle = await readFile(join(packageDir, "server.mjs"), "utf8");
  // Plain checks, not assert.match: a failure would print the whole bundle.
  assert.ok(
    bundle.includes('new URL("./claude-code-plugin",import.meta.url)'),
    `${id} resolves the plugin from server.mjs`,
  );
  assert.ok(bundle.includes('title:"Title"'), `${id} presets the session title`);
  assert.ok(!bundle.includes("despite zero-tool config"), `${id} still bundles the frozen provider`);
  for (const file of pluginFiles) {
    const path = `claude-code-plugin/${file}`;
    assert.ok(
      manifest.files.some((entry) => entry.path === path),
      `${id} manifest declares ${path}`,
    );
    assert.deepEqual(await readFile(join(packageDir, path)), await readFile(join(pluginSource, file)), `${id} ${path}`);
  }
}

console.log(
  "Claude (Subscription) overlay: title preset, plugin wired and required, old Claude Code warned, MCP exposure stops the request",
);
