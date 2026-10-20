// esbuild for package clients that use the Engine's host instead of bundling copies of it
// (Pasta-Devs/Marinara-Agents#1487, Engine "Host client namespace").
//
// Since capability API 1.341 the Engine sets `globalThis.__MARINARA_HOST__ = { version: 1, ... }` before it loads any
// package client. hostModulesPlugin resolves each library the Engine hands packages (React, React Query, zustand,
// sonner, zod, i18next, framer-motion, ...) to a small shim that re-exports the Engine's own module object, so a package
// renders with the Engine's React and shares its query cache, toasts and stores. `marinara:host` is the namespace itself.
//
// A shim exports exactly the names the Engine's copy of the library exports, read from MARINARA_ENGINE_ROOT. A package
// importing a name the host does not have fails the build with esbuild's "No matching export" (guardrail 5) instead of
// reading `undefined` at runtime. react-i18next leaves out initReactI18next, setI18n and setDefaults, so a package can
// never replace the Engine's global i18n instance.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

/** The capability API that first provides the namespace; packages built with these shims need it. */
export const HOST_CAPABILITY_API = "1.341";

/** Bare specifiers a package build takes from the host (the Engine's MARINARA_HOST_MODULE_SPECIFIERS). */
export const HOST_MODULE_SPECIFIERS = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/client",
  "@tanstack/react-query",
  "zustand",
  "zustand/middleware",
  "sonner",
  "zod",
  "i18next",
  "react-i18next",
  "framer-motion",
  "tailwind-merge",
  "clsx",
];

/** Exports a package must not take from the host, by specifier. */
export const WITHHELD_HOST_EXPORTS = {
  // Each replaces the Engine's global i18n instance or its defaults. A package keeps its own instance from
  // i18next.createInstance() inside <I18nextProvider> instead.
  "react-i18next": ["initReactI18next", "setI18n", "setDefaults"],
};

export const HOST_CONTRACT_PATH = "packages/client/src/lib/marinara-host-contract.ts";
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/u;
const HOST_MODULE_NAMESPACE = "marinara-host-module";
const HOST_NAMESPACE = "marinara-host";

function missingMessage(member) {
  return `Marinara Engine does not provide ${member}; this package needs capability API ${HOST_CAPABILITY_API} or newer.`;
}

/** The specifiers the Engine's contract lists. Throws when the Engine predates the namespace. */
export function readHostContractSpecifiers(engineRoot) {
  const contractPath = join(engineRoot, HOST_CONTRACT_PATH);
  if (!existsSync(contractPath)) {
    throw new Error(
      `${contractPath} is missing: package clients use the Engine's host namespace (capability API ${HOST_CAPABILITY_API}). Set MARINARA_ENGINE_ROOT to an Engine that has it.`,
    );
  }
  const list = /MARINARA_HOST_MODULE_SPECIFIERS\s*=\s*\[([^\]]*)\]/u.exec(readFileSync(contractPath, "utf8"))?.[1];
  if (list === undefined) throw new Error(`${contractPath} does not declare MARINARA_HOST_MODULE_SPECIFIERS`);
  return [...list.matchAll(/["']([^"']+)["']/gu)].map((match) => match[1]);
}

const exportCache = new Map();

/**
 * The names `import * as m from "<specifier>"` gives for each host library, evaluated by Node in the Engine's client
 * package with NODE_ENV=production (ESM resolution, so the same entry the Engine's bundler uses).
 */
export function readHostModuleExports(engineRoot, specifiers = HOST_MODULE_SPECIFIERS) {
  const clientRoot = join(resolve(engineRoot), "packages/client");
  const key = `${clientRoot}\0${specifiers.join("\0")}`;
  if (exportCache.has(key)) return exportCache.get(key);
  const script = `const out = {};
for (const specifier of JSON.parse(process.argv[1])) out[specifier] = Object.keys(await import(specifier));
process.stdout.write(JSON.stringify(out));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script, JSON.stringify(specifiers)], {
    cwd: clientRoot,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "production" },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `Could not read the Engine's host library exports in ${clientRoot}:\n${result.stderr || result.error}`,
    );
  }
  const exportsBySpecifier = JSON.parse(result.stdout);
  exportCache.set(key, exportsBySpecifier);
  return exportsBySpecifier;
}

/** The shim's export names: identifiers only, without the withheld ones. */
export function shimExportNames(specifier, names) {
  const withheld = new Set(WITHHELD_HOST_EXPORTS[specifier] ?? []);
  return [...new Set(names)].filter((name) => IDENTIFIER.test(name) && name !== "__esModule" && !withheld.has(name));
}

export function hostModuleShimSource(specifier, names) {
  const exported = shimExportNames(specifier, names);
  const lines = [
    `const host = globalThis.__MARINARA_HOST__;`,
    `const m = host && host.version === 1 && host.modules ? host.modules[${JSON.stringify(specifier)}] : undefined;`,
    `if (!m) throw new Error(${JSON.stringify(missingMessage(specifier))});`,
  ];
  // Local bindings, then one export clause: export names may be reserved words (zod exports `enum`).
  exported.forEach((name, index) => lines.push(`const e${index} = m[${JSON.stringify(name)}];`));
  if (exported.length) lines.push(`export { ${exported.map((name, index) => `e${index} as ${name}`).join(", ")} };`);
  return `${lines.join("\n")}\n`;
}

export const HOST_NAMESPACE_SOURCE = `const host = globalThis.__MARINARA_HOST__;
if (!host || host.version !== 1 || !host.queryClient) throw new Error(${JSON.stringify(missingMessage("its query client"))});
export { host };
export const queryClient = host.queryClient;
`;

/**
 * Resolves the host libraries to shims over `__MARINARA_HOST__.modules` and `marinara:host` to the namespace.
 * `exportMap` replaces the Engine's export lists (tests only).
 */
export function hostModulesPlugin({ engineRoot, exportMap } = {}) {
  if (!engineRoot) throw new Error("hostModulesPlugin needs the Engine root");
  const listed = new Set(readHostContractSpecifiers(engineRoot));
  const unlisted = HOST_MODULE_SPECIFIERS.filter((specifier) => !listed.has(specifier));
  if (unlisted.length) {
    throw new Error(
      `The Engine at ${engineRoot} does not provide ${unlisted.join(", ")} in MARINARA_HOST_MODULE_SPECIFIERS (${HOST_CONTRACT_PATH})`,
    );
  }
  const exportsBySpecifier = exportMap ?? readHostModuleExports(engineRoot);
  const escaped = HOST_MODULE_SPECIFIERS.map((specifier) => specifier.replace(/[.*+?^${}()|[\]\\/]/gu, "\\$&"));
  // esbuild filters are Go regular expressions: no flags.
  const filter = new RegExp(`^(?:${escaped.join("|")})$`);
  return {
    name: "marinara-host-modules",
    setup(build) {
      build.onResolve({ filter }, (args) => ({ path: args.path, namespace: HOST_MODULE_NAMESPACE }));
      build.onResolve({ filter: /^marinara:host$/ }, () => ({ path: "marinara:host", namespace: HOST_NAMESPACE }));
      build.onLoad({ filter: /.*/, namespace: HOST_MODULE_NAMESPACE }, (args) => {
        const names = exportsBySpecifier[args.path];
        if (!Array.isArray(names)) {
          return { errors: [{ text: `No export list for host module ${args.path}` }] };
        }
        return { contents: hostModuleShimSource(args.path, names), loader: "js" };
      });
      build.onLoad({ filter: /.*/, namespace: HOST_NAMESPACE }, () => ({
        contents: HOST_NAMESPACE_SOURCE,
        loader: "js",
      }));
    },
  };
}

/**
 * Marks the vendored shared build and the package shared entry as free of side effects, so esbuild keeps only the
 * modules a package uses instead of everything the barrel re-exports (Noodle's schema and the model lists went into
 * every bundle). Nothing in sources/engine/packages/shared/dist runs code at import time. `files` adds single modules
 * whose only effect is creating what they export (a game's store reached through a shared query key).
 */
export function sharedTreeShakingPlugin({ roots = [], files = [] } = {}) {
  // esbuild reports real paths, so compare against both spellings (macOS /var is /private/var).
  const spellings = (path) => [...new Set([resolve(path), ...(existsSync(path) ? [realpathSync(path)] : [])])];
  const prefixes = roots.flatMap(spellings).map((root) => `${root}${sep}`);
  const exact = new Set(files.flatMap(spellings));
  const isShared = (path) => exact.has(path) || prefixes.some((prefix) => path.startsWith(prefix));
  const marker = "marinaraSharedTreeShaking";
  return {
    name: "marinara-shared-tree-shaking",
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.pluginData?.[marker] || args.namespace !== "file") return undefined;
        const fromShared = args.importer && isShared(args.importer);
        const target = args.resolveDir ? resolve(args.resolveDir, args.path) : args.path;
        const named = ["", ".ts", ".tsx", ".js", ".mjs"].some((extension) => isShared(`${target}${extension}`));
        if (!fromShared && args.path !== "@marinara-engine/shared" && !named) return undefined;
        const resolved = await build.resolve(args.path, {
          importer: args.importer,
          kind: args.kind,
          resolveDir: args.resolveDir,
          pluginData: { [marker]: true },
        });
        if (resolved.errors.length) return { errors: resolved.errors };
        if (resolved.external || !isShared(resolved.path)) return undefined;
        return { path: resolved.path, namespace: resolved.namespace, sideEffects: false };
      });
    },
  };
}

/** esbuild's JS build, from the Engine checkout `absWorkingDir` names (the CLI cannot take plugins). */
export async function runEsbuild({ absWorkingDir, ...options }) {
  if (!absWorkingDir) throw new Error("runEsbuild needs absWorkingDir, the Engine checkout that provides esbuild");
  const engineRequire = createRequire(pathToFileURL(join(resolve(absWorkingDir), "package.json")));
  return engineRequire("esbuild").build({ logLevel: "silent", logLimit: 0, absWorkingDir, ...options });
}
