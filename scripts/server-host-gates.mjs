// Server bundle gates (Pasta-Devs/Marinara-Agents#1487). They read the esbuild metafile every package server build
// already writes, so a copy of a stateful Engine service cannot come back unnoticed:
//
// - Tier A (fail): a vendored copy of a stateful Engine service or of a library that holds Engine state. Calls,
//   Noodle and Slurp reach those through api.runtime (sources/host-runtime-overlay); an overlay file at the same
//   path is allowed only while it is byte-identical to the overlay.
// - Tier B (ratchet): Engine-owned storage, db and data-dir modules in Calls, Noodle and Slurp. They stay bundled
//   for reads (the host has no read API for those tables), each with a written reason in
//   scripts/server-engine-modules-baseline.json. A new one fails, and so does an entry that no longer occurs.
// - Host libraries (fail): libraries every package server takes from the Engine's install (bundleServer's
//   externals) must not be bundled, and neither may the stateful ones no package may import at all.
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SERVER_ENGINE_MODULES_BASELINE = join(repoRoot, "scripts/server-engine-modules-baseline.json");
export const HOST_RUNTIME_PACKAGES = new Set(["conversation-calls", "noodle", "slurp2"]);

const SERVER = "packages/server/src/";
export const TIER_A_PATHS = [
  new RegExp(`^${SERVER}services/sidecar/`),
  new RegExp(
    `^${SERVER}services/llm/(local-sidecar|provider-registry|connection-fallback-provider|openai-chatgpt-auth)\\.ts$`,
  ),
  new RegExp(`^${SERVER}services/llm/providers/`),
  new RegExp(`^${SERVER}services/generation/connection-admission\\.ts$`),
  new RegExp(`^${SERVER}services/capability-packages/[^/]*registry[^/]*$`),
  new RegExp(
    `^${SERVER}services/image/(image-generation|image-generation-queue|gallery-file-lifecycle|generated-image-entity-gallery)\\.ts$`,
  ),
  new RegExp(`^${SERVER}services/video/video-generation\\.ts$`),
  new RegExp(`^${SERVER}services/(spotify|haptic)/`),
  new RegExp(`^${SERVER}lib/logger\\.ts$`),
];
/** Libraries that keep Engine state (an Intiface client, the Claude Agent SDK, a logger worker). */
export const TIER_A_LIBRARIES = ["buttplug", "@anthropic-ai/claude-agent-sdk", "pino", "pino-pretty"];
export const TIER_B_PATHS = [
  new RegExp(`^${SERVER}services/storage/[^/]+\\.ts$`),
  new RegExp(`^${SERVER}db/`),
  new RegExp(`^${SERVER}utils/data-dir\\.ts$`),
];
/** No package server may bundle these: the Engine provides the first five, and the rest must not be imported. */
export const SERVER_HOST_LIBRARIES = [
  "zod",
  "adm-zip",
  "dotenv",
  "nanoid",
  "jsonrepair",
  "buttplug",
  "ws",
  "eventemitter3",
  "@anthropic-ai/claude-agent-sdk",
];

function realpathOr(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

/** The npm package a node_modules path belongs to (the innermost one), or null. */
export function nodeModulesPackage(path) {
  const normalized = path.split(sep).join("/");
  const index = normalized.lastIndexOf("/node_modules/");
  const rest = index >= 0 ? normalized.slice(index + "/node_modules/".length) : null;
  if (!rest) return null;
  const parts = rest.split("/");
  return parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1]}` : (parts[0] ?? null);
}

/** The bare package name of an import specifier ("pino-pretty", "@scope/name/sub" -> "@scope/name"). */
function bareName(specifier) {
  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.includes(":")) return null;
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
}

/**
 * Sort a server metafile's inputs into the gate categories.
 *
 * `metafile` is esbuild's metafile (input keys relative to `cwd`). `buildRoot` is the stacked source tree the
 * build read. A build-root file counts as the overlay's only while it is byte-identical to `overlayRoot`'s copy,
 * and as package-owned when `packageSourceRoot` has a file at the same path.
 */
export function classifyServerMetafile({ metafile, cwd, buildRoot, overlayRoot = null, packageSourceRoot = null }) {
  const root = realpathOr(buildRoot);
  const result = { tierA: [], tierB: [], overlay: [], libraries: [], bareImports: [] };
  for (const [input, details] of Object.entries(metafile.inputs ?? {})) {
    for (const imported of details.imports ?? []) {
      if (!imported.external) continue;
      const name = bareName(imported.path);
      if (name && !result.bareImports.includes(name)) result.bareImports.push(name);
    }
    const absolute = realpathOr(resolve(cwd, input));
    const library = nodeModulesPackage(absolute);
    if (library) {
      if (!result.libraries.includes(library)) result.libraries.push(library);
      continue;
    }
    if (!absolute.startsWith(`${root}${sep}`)) continue;
    const path = relative(root, absolute).split(sep).join("/");
    const overlayFile = overlayRoot ? join(overlayRoot, path) : null;
    if (overlayFile && existsSync(overlayFile) && readFileSync(overlayFile).equals(readFileSync(absolute))) {
      result.overlay.push(path);
      continue;
    }
    // Before the package-owned exemption: a package's own copy of a Tier A service is still a copy.
    if (TIER_A_PATHS.some((pattern) => pattern.test(path))) result.tierA.push(path);
    else if (packageSourceRoot && existsSync(join(packageSourceRoot, path))) continue;
    else if (TIER_B_PATHS.some((pattern) => pattern.test(path))) result.tierB.push(path);
  }
  for (const list of Object.values(result)) list.sort();
  return result;
}

/**
 * `{ reasons: { <path>: <why it may stay bundled> }, packages: { <package id>: [<path>, ...] } }`. A path is listed
 * once under `reasons`, because the same module is bundled by more than one package for the same reason.
 */
export function readServerEngineModulesBaseline(path = SERVER_ENGINE_MODULES_BASELINE) {
  const baseline = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  return { ...baseline, reasons: baseline.reasons ?? {}, packages: baseline.packages ?? {} };
}

/** Every gate failure for one package's server metafile; an empty list passes. */
export function serverHostGateFailures(packageId, classified, baseline, { requireReasons = true } = {}) {
  const failures = [];
  for (const path of classified.tierA) {
    failures.push(
      `${packageId}: bundles the Engine's ${path}; reach it through api.runtime (sources/host-runtime-overlay)`,
    );
  }
  for (const library of classified.libraries) {
    if (TIER_A_LIBRARIES.includes(library) || SERVER_HOST_LIBRARIES.includes(library)) {
      failures.push(`${packageId}: bundles ${library}; it must come from the Engine (or not be imported at all)`);
    }
  }
  if (HOST_RUNTIME_PACKAGES.has(packageId)) {
    for (const name of classified.bareImports) {
      if (TIER_A_LIBRARIES.includes(name)) {
        failures.push(`${packageId}: imports ${name}; use the Engine's own through api.runtime instead`);
      }
    }
    const listed = baseline.packages[packageId] ?? [];
    for (const path of classified.tierB) {
      if (!listed.includes(path)) {
        failures.push(
          `${packageId}: bundles the Engine's ${path}, which is not in scripts/server-engine-modules-baseline.json. ` +
            "Read through api.runtime, or add it with a written reason after checking that it holds no module state",
        );
      } else if (requireReasons && !String(baseline.reasons[path] ?? "").trim()) {
        failures.push(`${packageId}: ${path} in scripts/server-engine-modules-baseline.json needs a written reason`);
      }
    }
    for (const path of listed) {
      if (!classified.tierB.includes(path)) {
        failures.push(
          `${packageId}: ${path} is no longer bundled; remove it from scripts/server-engine-modules-baseline.json`,
        );
      }
    }
  }
  return failures;
}

/**
 * Run the gates on a build's metafile and throw on any failure. With MARINARA_UPDATE_SERVER_BASELINE=1 the
 * package's Tier B list is rewritten to what the build bundles first, and a new path gets an empty reason: the
 * build still passes then, but every other run fails until someone writes the reason.
 */
export function assertServerHostGates({ packageId, metafilePath, cwd, buildRoot, overlayRoot, packageSourceRoot }) {
  const metafile = JSON.parse(readFileSync(metafilePath, "utf8"));
  const classified = classifyServerMetafile({ metafile, cwd, buildRoot, overlayRoot, packageSourceRoot });
  const baseline = readServerEngineModulesBaseline();
  const update = process.env.MARINARA_UPDATE_SERVER_BASELINE === "1" && HOST_RUNTIME_PACKAGES.has(packageId);
  if (update) {
    baseline.packages = { ...baseline.packages, [packageId]: classified.tierB };
    const used = new Set(Object.values(baseline.packages).flat());
    baseline.reasons = Object.fromEntries([...used].sort().map((path) => [path, baseline.reasons[path] ?? ""]));
    writeFileSync(SERVER_ENGINE_MODULES_BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
  }
  const failures = serverHostGateFailures(packageId, classified, baseline, { requireReasons: !update });
  if (failures.length) throw new Error(`Server host gates failed:\n- ${failures.join("\n- ")}`);
  return classified;
}
