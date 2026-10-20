// Package clients take React, React Query, zustand, sonner, zod, i18next, framer-motion, tailwind-merge and clsx from
// the Engine (`__MARINARA_HOST__.modules`) through scripts/esbuild-host-plugins.mjs (Pasta-Devs/Marinara-Agents#1487).
// A shim exports exactly the names the Engine's copy exports, so a package importing a name the host lacks fails the
// build (guardrail 5) instead of reading undefined at runtime; react-i18next never hands out initReactI18next, which
// would replace the Engine's global i18n instance. An Engine without the host contract cannot be built against, and a
// package evaluated without the namespace stops with a clear message. The shared tree-shaking keeps only used modules.
// The export map is injected here; with MARINARA_ENGINE_ROOT set, the real export lists are read from that Engine too.
// Run: node scripts/tests/host-module-shims.regression.mjs
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  HOST_CONTRACT_PATH,
  HOST_MODULE_SPECIFIERS,
  hostModulesPlugin,
  readHostModuleExports,
  runEsbuild,
  sharedTreeShakingPlugin,
} from "../esbuild-host-plugins.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const temporary = await mkdtemp(join(tmpdir(), "host-module-shims-"));

async function fakeEngine(name, specifiers) {
  const root = join(temporary, name);
  await mkdir(join(root, dirname(HOST_CONTRACT_PATH)), { recursive: true });
  await writeFile(
    join(root, HOST_CONTRACT_PATH),
    `export const MARINARA_HOST_MODULE_SPECIFIERS = [\n${specifiers.map((s) => `  "${s}",`).join("\n")}\n] as const;\n`,
  );
  return root;
}

const exportMap = Object.fromEntries(HOST_MODULE_SPECIFIERS.map((specifier) => [specifier, []]));
Object.assign(exportMap, {
  react: ["default", "useState", "createElement", "module.exports"],
  "react/jsx-runtime": ["jsx", "jsxs", "Fragment"],
  "@tanstack/react-query": ["QueryClientProvider", "useQuery"],
  "react-i18next": ["I18nextProvider", "useTranslation", "initReactI18next", "setI18n", "setDefaults", "__esModule"],
});

const engine = await fakeEngine("engine", HOST_MODULE_SPECIFIERS);
const plugin = hostModulesPlugin({ engineRoot: engine, exportMap });

let entries = 0;
async function build(source, plugins = [plugin]) {
  const entry = join(temporary, `entry-${++entries}.jsx`);
  const outfile = join(temporary, `out-${entries}.mjs`);
  await writeFile(entry, source);
  await runEsbuild({
    absWorkingDir: repoRoot,
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    outfile,
    plugins,
  });
  return outfile;
}

// A package build takes every listed library and the namespace from the host.
const built = await build(`
import React, { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { queryClient } from "marinara:host";
export const values = { React, useState, QueryClientProvider, I18nextProvider, queryClient, element: <b /> };
`);
const output = await readFile(built, "utf8");
assert.doesNotMatch(output, /initReactI18next|setI18n|setDefaults/u, "the withheld react-i18next names never ship");

const host = {
  version: 1,
  queryClient: { name: "the Engine's QueryClient" },
  modules: {
    react: { default: { name: "React" }, useState: () => "state", createElement: () => null },
    "react/jsx-runtime": { jsx: (type) => ({ type }), jsxs: () => null, Fragment: "fragment" },
    "@tanstack/react-query": { QueryClientProvider: "Provider" },
    "react-i18next": { I18nextProvider: "I18nextProvider" },
  },
};
globalThis.__MARINARA_HOST__ = host;
const { values } = await import(pathToFileURL(built).href);
assert.equal(values.React, host.modules.react.default);
assert.equal(values.useState, host.modules.react.useState);
assert.equal(values.QueryClientProvider, "Provider");
assert.equal(values.queryClient, host.queryClient, "the package renders with the Engine's QueryClient");
assert.deepEqual(values.element, { type: "b" }, "JSX goes through the Engine's react/jsx-runtime");

// Without the namespace the package stops at once with a message the Engine shows on its load-failure card.
delete globalThis.__MARINARA_HOST__;
await assert.rejects(
  import(`${pathToFileURL(built).href}?without-host`),
  /Marinara Engine does not provide react; this package needs capability API 1\.341 or newer\./u,
);
globalThis.__MARINARA_HOST__ = { version: 2, modules: host.modules };
await assert.rejects(import(`${pathToFileURL(built).href}?newer-shape`), /does not provide react/u);
delete globalThis.__MARINARA_HOST__;

// Guardrail 5: a name the host's library does not export fails the build.
await assert.rejects(build(`import { useFormStatus } from "react"; export { useFormStatus };`), /No matching export/u);
// C9: no package can replace the Engine's i18n instance.
await assert.rejects(
  build(`import { initReactI18next } from "react-i18next"; export { initReactI18next };`),
  /No matching export in "marinara-host-module:react-i18next" for import "initReactI18next"/u,
);

// An Engine that predates the namespace, or does not list a library, cannot be built against.
assert.throws(
  () => hostModulesPlugin({ engineRoot: join(temporary, "no-engine"), exportMap }),
  /marinara-host-contract\.ts is missing/u,
);
const partial = await fakeEngine(
  "partial",
  HOST_MODULE_SPECIFIERS.filter((specifier) => specifier !== "framer-motion"),
);
assert.throws(() => hostModulesPlugin({ engineRoot: partial, exportMap }), /does not provide framer-motion/u);

// The shared build is marked free of side effects, so modules a package does not use are dropped from the bundle.
const shared = join(temporary, "shared-dist");
await mkdir(shared, { recursive: true });
await writeFile(join(shared, "index.js"), `export * from "./used.js";\nexport * from "./unused.js";\n`);
await writeFile(join(shared, "used.js"), `export const used = "kept";\n`);
await writeFile(join(shared, "unused.js"), `export const unused = "dropped";\nglobalThis.unusedSharedModule = true;\n`);
const sharedEntry = `import { used } from ${JSON.stringify(join(shared, "index.js"))}; export { used };`;
const withoutShaking = await readFile(await build(sharedEntry, []), "utf8");
assert.match(withoutShaking, /unusedSharedModule/u, "control: without the plugin the whole barrel is bundled");
const shaken = await readFile(await build(sharedEntry, [sharedTreeShakingPlugin({ roots: [shared] })]), "utf8");
assert.match(shaken, /kept/u);
assert.doesNotMatch(shaken, /unusedSharedModule|dropped/u);

// The real export lists, when an Engine with the namespace is at hand.
if (process.env.MARINARA_ENGINE_ROOT) {
  const real = readHostModuleExports(process.env.MARINARA_ENGINE_ROOT);
  assert.ok(real.react.includes("useState"));
  assert.ok(real["react-dom/client"].includes("createRoot"));
  assert.ok(real["react-i18next"].includes("I18nextProvider"));
  assert.ok(real.i18next.includes("createInstance"), "ESM resolution, as the Engine's bundler resolves it");
  console.log("host module shims: real Engine export lists read");
}

await rm(temporary, { recursive: true, force: true });
console.log("host module shims: ok");
