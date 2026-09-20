import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";

import { SLURP2_SOURCE_MODULES, slurp2Source } from "./slurp2-source";

// Executable half of packages/slurp2/docs/architecture/README.md. Rules apply to the three `slp`
// roots; package-specific implementation outside them is an ownership violation.

const repoRoot = join(import.meta.dirname, "..");
const engineRoot = join(repoRoot, "packages/slurp2/src/engine");
const ROOTS = ["packages/client/src/slp", "packages/server/src/slp", "packages/shared/src/slp"];
const EXCEPTIONS = [
  "packages/client/src/lib/api-client.ts",
  "packages/server/src/services/garnish-ads",
  "packages/server/src/db/schema/slurp.ts",
];
const EXPECTED_OWNERSHIP = [
  "packages/client/src/slp",
  "packages/server/src/slp",
  "packages/shared/src/slp",
  "packages/client/src/lib/api-client.ts",
  "packages/server/src/services/garnish-ads",
  "packages/server/src/db/schema/slurp.ts",
];
const UNOWNED_ENGINE_FILES = new Set(["packages/client/src/hooks/use-creator-personas.ts"]);
const MAX_LINES = 800;
// Server modules hold pure domain rules: they may not reach the database, host storage, or Fastify.
const SERVER_MODULE_IO = /(^fastify$|\/db\/(connection|file-query)(\.js)?$|\/services\/storage\/)/u;
// Lower rank may not import higher rank. `app`/entries compose; locales are data.
const RANKS: Record<string, Record<string, number>> = {
  client: { base: 0, locales: 0, modules: 1, features: 2, app: 3, entry: 4 },
  server: { base: 0, modules: 1, data: 2, features: 3, workflows: 4, entry: 5 },
  shared: { shared: 0 },
};

type Place = { side: string; layer: string; feature?: string };

function place(path: string): Place | null {
  const match = /^packages\/(client|server|shared)\/src\/slp\/(.+)$/u.exec(path);
  if (!match) return null;
  const [, side, rest] = match;
  const parts = rest.split("/");
  if (side === "shared") return { side, layer: "shared" };
  if (parts.length === 1) return { side, layer: "entry" };
  return { side, layer: parts[0], feature: parts[0] === "features" ? parts[1] : undefined };
}

function walk(root: string, dir = ""): string[] {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const path = dir ? `${dir}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(root, path) : [path];
  });
}

function imports(source: string): string[] {
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/gu;
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

const isOwned = (path: string, owned: readonly string[]) =>
  owned.some((entry) => path === entry || path.startsWith(`${entry}/`));

function architectureViolations(root: string, owned: readonly string[]): string[] {
  const violations: string[] = [];
  for (const exception of EXCEPTIONS) {
    if (!owned.includes(exception)) violations.push(`ownership: exception ${exception} must be owned`);
  }
  for (const path of walk(root, "packages")) {
    const name = posix.basename(path);
    const at = place(path);
    if (!at) {
      if (/\.(?:[cm]?[jt]sx?|vue|svelte)$/u.test(name) && !isOwned(path, owned) && !UNOWNED_ENGINE_FILES.has(path)) {
        violations.push(`ownership: ${path} is outside the slp roots or named exceptions`);
      }
      continue;
    }
    if (!isOwned(path, owned)) violations.push(`ownership: ${path} is not in slurp2OwnedSourcePaths`);
    if (!/\.tsx?$/u.test(name) || name.includes(".generated.")) continue;
    if (/^index\.tsx?$/u.test(name)) violations.push(`barrel: ${path} is a generic index barrel`);
    else if (!/^(slp-[a-z0-9][a-z0-9.-]*\.tsx?|Slp[A-Z][A-Za-z0-9]*\.tsx)$/u.test(name)) {
      violations.push(`naming: ${path} must be slp-name.ts(x) or SlpName.tsx`);
    }
    if (!(at.layer in RANKS[at.side])) violations.push(`layer: ${path} is not under an approved layer`);
    const source = readFileSync(join(root, path), "utf8");
    const lines = source.split("\n").length - (source.endsWith("\n") ? 1 : 0);
    if (lines > MAX_LINES) violations.push(`size: ${path} exceeds ${MAX_LINES} lines`);
    for (const specifier of imports(source)) {
      if (at.side === "server" && at.layer === "modules" && SERVER_MODULE_IO.test(specifier)) {
        violations.push(`purity: ${path} -> ${specifier} gives a pure module I/O`);
      }
      if (!specifier.startsWith(".")) continue;
      const targetPath = posix.join(posix.dirname(path), specifier);
      const target = place(targetPath);
      const edge = `${path} -> ${specifier}`;
      if (at.side === "shared" && /^packages\/(client|server)\//u.test(targetPath)) {
        violations.push(`shared: ${edge} imports client or server code`);
      } else if (target && target.side !== at.side && target.side !== "shared") {
        violations.push(`direction: ${edge} crosses between client and server`);
      } else if (target && target.side === at.side) {
        const from = RANKS[at.side][at.layer];
        const to = RANKS[target.side][target.layer];
        const contract = /^slp-[a-z0-9-]+-contract(\.[jt]s)?$/u.test(posix.basename(targetPath));
        if (to > from) violations.push(`direction: ${edge} imports a higher layer`);
        else if (target.layer === "features" && at.layer === "features" && target.feature !== at.feature && !contract) {
          violations.push(`contract: ${edge} reaches into another feature's internals`);
        } else if (target.layer === "features" && at.layer === "workflows" && !contract) {
          violations.push(`contract: ${edge} lets a workflow import feature internals`);
        }
      }
    }
  }
  return violations;
}

// Slurp2 ownership is read from the builder, which runs on import and cannot be loaded as a module.
const builder = readFileSync(join(repoRoot, "scripts/build-feature-packages.mjs"), "utf8");
const ownershipBlock = /const slurp2OwnedSourcePaths = \[([\s\S]*?)\n\];/u.exec(builder)?.[1] ?? "";
const slurp2Owned = [...ownershipBlock.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
assert.ok(slurp2Owned.length > 0, "slurp2OwnedSourcePaths must be readable from the builder");
assert.doesNotMatch(ownershipBlock, /\.\.\./u, "Slurp2 ownership must not spread legacy Slurp's list");
assert.deepEqual(slurp2Owned, EXPECTED_OWNERSHIP, "Slurp2 ownership must be exactly the six approved entries");
const legacyBlock = /const slurpOwnedSourcePaths = \[([\s\S]*?)\n\];/u.exec(builder)?.[1] ?? "";
for (const root of ROOTS) assert.ok(!legacyBlock.includes(root), `legacy Slurp must not own ${root}`);

// Agents must meet the guide before editing, and the guide must name this regression.
const packageRoot = join(repoRoot, "packages/slurp2");
assert.match(readFileSync(join(packageRoot, "AGENTS.md"), "utf8"), /docs\/architecture\/README\.md/u);
assert.match(
  readFileSync(join(packageRoot, "docs/architecture/README.md"), "utf8"),
  /slurp2-architecture\.regression\.ts/u,
);

// The real tree. New roots may still be absent; the fixtures below keep this from being vacuous.
assert.deepEqual(architectureViolations(engineRoot, slurp2Owned), []);

// Garnish stays a separate module: inside Slurp2's server tree only the ads feature may import it.
const serverSlp = join(engineRoot, "packages/server/src/slp");
const garnishImporters = walk(serverSlp).filter((path) =>
  imports(readFileSync(join(serverSlp, path), "utf8")).some((specifier) =>
    /\/services\/garnish-ads\//u.test(specifier),
  ),
);
assert.ok(garnishImporters.length > 0, "the Slurp ads adapters must be found");
assert.deepEqual(
  garnishImporters.filter((path) => !path.startsWith("features/ads/")),
  [],
  "only features/ads may import the Garnish module",
);

// Logical source keys must keep reading exactly the files they name until a split remaps them.
for (const [key, files] of Object.entries(SLURP2_SOURCE_MODULES)) {
  const direct = files.map((file) => readFileSync(join(engineRoot, file), "utf8")).join("\n");
  assert.equal(slurp2Source(`packages/slurp2/src/engine/${key}`), direct, key);
}

// Fixtures: one valid tree, then one violation per rule.
const scratch = mkdtempSync(join(tmpdir(), "slurp2-architecture-"));
const fixtureOwned = [...ROOTS, ...EXCEPTIONS];
const valid: Record<string, string> = {
  "packages/client/src/slp/slp-client-entry.tsx": 'import { SlpApp } from "./app/SlpApp";\n',
  "packages/client/src/slp/app/SlpApp.tsx": 'import { SlpFeed } from "../features/feed/SlpFeed";\n',
  "packages/client/src/slp/features/feed/SlpFeed.tsx":
    'import { SlpPostCard } from "../../modules/post/SlpPostCard";\nimport { x } from "../economy/slp-economy-contract";\n',
  "packages/client/src/slp/features/economy/slp-economy-contract.ts": "export const x = 1;\n",
  "packages/client/src/slp/modules/post/SlpPostCard.tsx":
    'import { slpApi } from "../../base/api/slp-api";\nimport { slpPurgeAt } from "../../../../../shared/src/slp/slp-autopurge-time";\n',
  "packages/client/src/slp/base/api/slp-api.ts": "export const slpApi = 1;\n",
  "packages/client/src/slp/locales/en.json": "{}\n",
  "packages/shared/src/slp/slp-autopurge-time.ts": "export const slpPurgeAt = 1;\n",
  "packages/server/src/slp/slp-server-entry.ts":
    'import "./workflows/slp-subscription-workflow";\nimport "./data/slp-storage";\n',
  "packages/server/src/slp/workflows/slp-subscription-workflow.ts":
    'import { e } from "../features/economy/slp-economy-contract.js";\nimport { m } from "../base/modifiers/slp-modifier.types";\n',
  "packages/server/src/slp/features/economy/slp-economy-contract.ts": 'import "./slp-economy-storage";\n',
  "packages/server/src/slp/features/economy/slp-economy-storage.ts":
    'import "../../base/host/slp-db";\nimport "../../data/slp-storage";\nimport "../../modules/economy/slp-prices";\n',
  "packages/server/src/slp/data/slp-storage.ts": 'import "./economy/slp-economy-facet";\n',
  "packages/server/src/slp/data/economy/slp-economy-facet.ts":
    'import "../../base/host/slp-db";\nimport "../../modules/economy/slp-prices";\nimport "../../modules/audience/slp-scale";\n',
  "packages/server/src/slp/modules/economy/slp-prices.ts":
    'import "../../base/host/slp-db";\nimport "../audience/slp-scale";\nimport type { Row } from "../../../../db/schema/slurp.js";\n',
  "packages/server/src/slp/modules/audience/slp-scale.ts": "export const scale = 1;\n",
  "packages/server/src/slp/features/messages/commissions/slp-commission-storage.ts":
    'import "../../economy/slp-economy-contract";\n',
  "packages/server/src/slp/base/host/slp-db.ts": 'import { db } from "../../../db/connection.js";\n',
  "packages/server/src/slp/base/modifiers/slp-modifier.types.ts": "// line\n".repeat(MAX_LINES),
  "packages/client/src/lib/api-client.ts": "export {};\n",
};
const cases: Array<[string, Record<string, string>, readonly string[], RegExp]> = [
  [
    "base imports a feature",
    { "packages/server/src/slp/base/host/slp-bad.ts": 'import "../../features/economy/slp-economy-storage";\n' },
    fixtureOwned,
    /direction: .*slp-bad\.ts/u,
  ],
  [
    "base imports a pure module",
    { "packages/server/src/slp/base/host/slp-bad.ts": 'import "../../modules/economy/slp-prices";\n' },
    fixtureOwned,
    /direction: .*base\/host\/slp-bad\.ts/u,
  ],
  [
    "pure module imports data",
    { "packages/server/src/slp/modules/economy/slp-bad.ts": 'import "../../data/slp-storage";\n' },
    fixtureOwned,
    /direction: .*modules\/economy\/slp-bad\.ts/u,
  ],
  [
    "data imports a feature",
    { "packages/server/src/slp/data/economy/slp-bad.ts": 'import "../../features/economy/slp-economy-storage";\n' },
    fixtureOwned,
    /direction: .*data\/economy\/slp-bad\.ts/u,
  ],
  [
    "pure module performs I/O",
    { "packages/server/src/slp/modules/economy/slp-bad.ts": 'import { db } from "../../../../db/connection.js";\n' },
    fixtureOwned,
    /purity: .*modules\/economy\/slp-bad\.ts/u,
  ],
  [
    "client module imports a feature",
    { "packages/client/src/slp/modules/post/slp-bad.ts": 'import "../../features/feed/SlpFeed";\n' },
    fixtureOwned,
    /direction: .*modules\/post\/slp-bad\.ts/u,
  ],
  [
    "feature imports a workflow",
    { "packages/server/src/slp/features/economy/slp-bad.ts": 'import "../../workflows/slp-subscription-workflow";\n' },
    fixtureOwned,
    /direction: .*features\/economy\/slp-bad\.ts/u,
  ],
  [
    "feature reaches into another feature",
    { "packages/server/src/slp/features/messages/slp-bad.ts": 'import "../economy/slp-economy-storage";\n' },
    fixtureOwned,
    /contract: .*messages\/slp-bad\.ts/u,
  ],
  [
    "workflow imports feature internals",
    { "packages/server/src/slp/workflows/slp-bad-workflow.ts": 'import "../features/economy/slp-economy-storage";\n' },
    fixtureOwned,
    /contract: .*slp-bad-workflow/u,
  ],
  [
    "client imports server slp",
    { "packages/client/src/slp/base/api/slp-bad.ts": 'import "../../../../../server/src/slp/base/host/slp-db";\n' },
    fixtureOwned,
    /direction: .*crosses/u,
  ],
  [
    "shared imports client",
    { "packages/shared/src/slp/slp-bad.ts": 'import "../../../client/src/lib/api-client";\n' },
    fixtureOwned,
    /shared: .*slp-bad\.ts/u,
  ],
  [
    "unapproved layer",
    { "packages/server/src/slp/utils/slp-helpers.ts": "export {};\n" },
    fixtureOwned,
    /layer: .*utils/u,
  ],
  [
    "kebab file without slp prefix",
    { "packages/server/src/slp/base/host/db-helpers.ts": "export {};\n" },
    fixtureOwned,
    /naming: .*db-helpers\.ts/u,
  ],
  [
    "component without Slp prefix",
    { "packages/client/src/slp/modules/post/PostCard.tsx": "export {};\n" },
    fixtureOwned,
    /naming: .*PostCard\.tsx/u,
  ],
  [
    "generic index barrel",
    { "packages/client/src/slp/modules/post/index.ts": "export {};\n" },
    fixtureOwned,
    /barrel: .*index\.ts/u,
  ],
  [
    "file above the line ceiling",
    { "packages/server/src/slp/base/host/slp-huge.ts": "// line\n".repeat(MAX_LINES + 1) },
    fixtureOwned,
    /size: .*slp-huge\.ts/u,
  ],
  [
    "slp file outside the roots",
    { "packages/client/src/components/slurp/SlpStray.tsx": "export {};\n" },
    fixtureOwned,
    /ownership: .*SlpStray\.tsx/u,
  ],
  [
    "non-slp implementation outside the roots",
    { "packages/client/src/components/slurp/Stray.tsx": "export {}\n" },
    fixtureOwned,
    /ownership: .*Stray\.tsx/u,
  ],
  [
    "unowned slp root",
    {},
    fixtureOwned.filter((path) => path !== "packages/server/src/slp"),
    /ownership: .*server\/src\/slp.* not in/u,
  ],
  [
    "unowned Garnish exception",
    {},
    fixtureOwned.filter((path) => !path.endsWith("garnish-ads")),
    /ownership: exception .*garnish-ads/u,
  ],
];
try {
  const build = (name: string, files: Record<string, string>) => {
    const root = join(scratch, name.replaceAll(" ", "-"));
    for (const [path, text] of Object.entries({ ...valid, ...files })) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
    return root;
  };
  assert.deepEqual(architectureViolations(build("valid", {}), fixtureOwned), [], "the valid fixture must pass");
  for (const [name, files, owned, expected] of cases) {
    const found = architectureViolations(build(name, files), owned);
    assert.ok(
      found.some((line) => expected.test(line)),
      `${name} must be rejected; got ${JSON.stringify(found)}`,
    );
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

const manifest = JSON.parse(readFileSync(join(repoRoot, "packages/slurp2/manifest.json"), "utf8"));
assert.equal(manifest.schemaVersion, 2, "Host integration requirements must be enforced before activation");
assert.ok(manifest.capabilityApi.major === 1 && manifest.capabilityApi.minor >= 31);
for (const name of [
  "package-host.ts",
  "image/image-generation.ts",
  "video/video-generation.ts",
  "llm/provider-registry.ts",
  "llm/connection-fallback-provider.ts",
  "llm/local-sidecar.ts",
]) {
  assert.equal(
    existsSync(join(repoRoot, "sources/engine/packages/server/src/services", name)),
    false,
    `${name} must be host-owned`,
  );
}
