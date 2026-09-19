import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Slice 12: Slurp2 owns its social vocabulary. It declares the shapes of its own `slurp2_*` rows
// and its own `/api/slurp2` payloads in `packages/shared/src/slp/`, and no longer borrows the
// Engine Noodle names. The Engine is unchanged, so legacy Slurp and Noodle keep building.
const repoRoot = join(import.meta.dirname, "..");
const packageRoot = join(repoRoot, "packages/slurp2");
const engineRoot = join(packageRoot, "src/engine");
const slpShared = join(engineRoot, "packages/shared/src/slp");

// The only names Slurp2 may still take from the Engine. `AvatarCrop` and `avatarCropSchema` stay
// because Engine avatar rendering consumes them; the rest are plain Engine host contracts.
const ALLOWED_ENGINE_IMPORTS = new Set([
  "APIProvider",
  "AvatarCrop",
  "CSRF_HEADER",
  "CSRF_HEADER_VALUE",
  "LIMITS",
  "PROFESSOR_MARI_ID",
  "Persona",
  "avatarCropSchema",
  "isOpenAIGpt56Model",
  "normalizeAvatarCrop",
]);

// Every Engine name Slice 12 reclassified as Slurp2-owned, mapped to the name that replaced it.
// Nothing may be removed from this map: it is the record of what the copy took over.
const RECLASSIFIED: Record<string, string> = JSON.parse(
  readFileSync(join(packageRoot, "docs/architecture/slurp2-owned-vocabulary.json"), "utf8"),
);

function sources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

const ENGINE_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"@marinara-engine\/shared";/gu;

function engineImports(root: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of sources(root)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(ENGINE_IMPORT)) {
      for (const raw of match[1].split(",")) {
        const name = raw
          .trim()
          .replace(/^type\s+/u, "")
          .split(/\s+as\s+/u)[0];
        if (!name) continue;
        found.set(name, [...(found.get(name) ?? []), file]);
      }
    }
  }
  return found;
}

// 1. Slurp2 imports nothing Noodle-named from the Engine any more.
const imported = engineImports(engineRoot);
const reclassifiedLeaks = [...imported.keys()].filter((name) => name in RECLASSIFIED);
assert.deepEqual(
  reclassifiedLeaks,
  [],
  `slurp2 still imports reclassified Noodle names from the Engine: ${reclassifiedLeaks
    .map((name) => `${name} (${imported.get(name)?.join(", ")})`)
    .join("; ")}`,
);
const unexpected = [...imported.keys()].filter((name) => !ALLOWED_ENGINE_IMPORTS.has(name));
assert.deepEqual(unexpected, [], `unreviewed Engine imports in slurp2: ${unexpected.join(", ")}`);

// 2. Negative fixture: the scanner must actually catch a reintroduced Engine Noodle import.
const fixtureDir = join(engineRoot, `packages/shared/src/zz-vocabulary-fixture-${process.pid}`);
try {
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(
    join(fixtureDir, "leak.ts"),
    ['import type { NoodleAccount } from "@marinara-engine/shared";', "export type Leak = NoodleAccount;", ""].join(
      "\n",
    ),
  );
  const leaked = [...engineImports(engineRoot).keys()].filter((name) => name in RECLASSIFIED);
  assert.deepEqual(leaked, ["NoodleAccount"], "the scanner must flag a reintroduced Engine Noodle import");
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
}

// 3. Every replacement name is really exported by the owned `slp` shared root.
const ownedExports = new Set<string>();
for (const file of sources(slpShared)) {
  for (const match of readFileSync(file, "utf8").matchAll(
    /^\s*export\s+(?:declare\s+)?(?:const|let|var|function|type|interface|class|enum)\s+([A-Za-z0-9_$]+)/gmu,
  )) {
    ownedExports.add(match[1]);
  }
}
const missing = Object.values(RECLASSIFIED).filter((name) => !ownedExports.has(name));
assert.deepEqual(missing, [], `slurp2 does not export its own replacement for: ${missing.join(", ")}`);

console.log(`slurp2 owned-vocabulary regression passed (${Object.keys(RECLASSIFIED).length} reclassified names)`);
