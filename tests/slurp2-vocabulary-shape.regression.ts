import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Slice 12 copied the Engine Noodle declarations into Slurp2's own `slp` shared root and renamed
// them. This proves the copy changed names only: every copied declaration, renamed back through
// the recorded map and stripped of comments and formatting, is identical to the Engine original.
// Nothing may be removed from the map or from INTENDED_DELTAS.
const repoRoot = join(import.meta.dirname, "..");
const packageRoot = join(repoRoot, "packages/slurp2");
const slpShared = join(packageRoot, "src/engine/packages/shared/src/slp");
const engineRoot = process.env.MARINARA_ENGINE_ROOT;

if (!engineRoot || !existsSync(join(engineRoot, "packages/shared/src/types/noodle.ts"))) {
  console.log("slurp2 vocabulary-shape regression skipped: set MARINARA_ENGINE_ROOT to an Engine checkout to run it");
  process.exit(0);
}

const MAP: Record<string, string> = JSON.parse(
  readFileSync(join(packageRoot, "docs/architecture/slurp2-vocabulary-rename-map.json"), "utf8"),
);
const BACK = new Map(Object.entries(MAP).map(([engine, slp]) => [slp, engine]));

// The one deliberate value change in the copy: a user-visible validation message that said Noodle
// where Slurp is meant. Every other difference is a shape difference and must fail.
const INTENDED_DELTAS: Record<string, [string, string][]> = {
  slpAccountIdentityUpdateShape: [['"Enter a Slurp handle."', '"Enter a Noodle handle."']],
};

const PAIRS: [string, string[]][] = [
  ["packages/shared/src/types/noodle.ts", ["slp-social.types.ts"]],
  ["packages/shared/src/schemas/noodle.schema.ts", ["slp-social.schema.ts", "slp-social-generation.schema.ts"]],
  ["packages/shared/src/utils/noodle-mentions.ts", ["slp-mentions.ts"]],
  ["packages/shared/src/utils/noodle-polls.ts", ["slp-polls.ts"]],
  ["packages/shared/src/utils/noodle-post-images.ts", ["slp-post-images.ts"]],
  ["packages/shared/src/utils/noodler-onboarding.ts", ["slp-creator-onboarding.ts"]],
  ["packages/shared/src/utils/noodle-interactions.ts", ["slp-interactions.ts"]],
];

const DECL =
  /^(?:export\s+)?(?:declare\s+)?(?:const|let|var|function|type|interface|class|enum)\s+([A-Za-z0-9_$]+)[\s\S]*?(?=\n(?:export\s+|declare\s+)?(?:const|let|var|function|type|interface|class|enum)\s+[A-Za-z0-9_$]+|(?![\s\S]))/gmu;
const RENAMED = new RegExp(`\\b(${[...BACK.keys()].sort((a, b) => b.length - a.length).join("|")})\\b`, "gu");

// Comments and formatting are not shape. `export` is not shape either: the split across two files
// widened one declaration's visibility.
function normalize(source: string): string {
  let text = source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|\s)\/\/[^\n]*/gu, "");
  text = text.replace(/\s+/gu, "");
  for (const [from, to] of [
    ["=|", "="],
    [",)", ")"],
    [",}", "}"],
    [",]", "]"],
    ["|}", "}"],
  ]) {
    text = text.split(from).join(to);
  }
  return text.replace(/^export/u, "");
}

function declarations(source: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of source.matchAll(DECL)) found.set(match[1], match[0]);
  return found;
}

let compared = 0;
for (const [enginePath, copies] of PAIRS) {
  const engine = declarations(readFileSync(join(engineRoot, enginePath), "utf8"));
  for (const copy of copies) {
    for (const [name, body] of declarations(readFileSync(join(slpShared, copy), "utf8"))) {
      const original = BACK.get(name);
      if (!original) continue;
      const engineBody = engine.get(original);
      assert.ok(engineBody, `${name} claims to come from ${original}, which ${enginePath} does not declare`);
      let renamedBack = body.replace(RENAMED, (match) => BACK.get(match) ?? match);
      for (const [after, before] of INTENDED_DELTAS[name] ?? []) renamedBack = renamedBack.split(after).join(before);
      assert.equal(
        normalize(renamedBack),
        normalize(engineBody),
        `${name} is not shape-identical to Engine ${original}; the copy changed more than the name`,
      );
      compared += 1;
    }
  }
}

assert.ok(compared >= 200, `expected the whole copied vocabulary to be compared, got ${compared}`);
console.log(`slurp2 vocabulary-shape regression passed (${compared} declarations shape-identical to the Engine)`);
