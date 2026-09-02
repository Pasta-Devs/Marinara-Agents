/**
 * garnish-ads is written so it can move out of Slurp into its own agent later.
 * That only stays true while the dependency direction stays one-way, so this
 * test enforces the two rules that would silently rot:
 *
 *   1. No file in `garnish-ads/` imports from `../slurp`.
 *   2. No host-app concept appears in an identifier there.
 *
 * Comments and string literals are exempt: the header comment explains the
 * rules, and the storage key is pre-existing stored data, not an identifier.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { garnishTagsFromPersona } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-garnish-context";

const DIR = "packages/slurp/src/engine/packages/server/src/services/garnish-ads";
const FORBIDDEN = /\b(slurp|noodler|noodle|persona)\b/iu;

/** Drop comments and string literals so only real code is checked. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, " ")
    .replace(/\/\/[^\n]*/gu, " ")
    .replace(/"(?:[^"\\]|\\.)*"/gu, '""')
    .replace(/'(?:[^'\\]|\\.)*'/gu, "''")
    .replace(/`(?:[^`\\]|\\.)*`/gu, "``");
}

async function main() {
  const files = await readdir(DIR);
  assert.ok(files.length > 0, "garnish-ads directory is empty");

  for (const file of files) {
    const source = await readFile(`${DIR}/${file}`, "utf8");
    const code = codeOnly(source);

    for (const [, specifier] of source.matchAll(/from\s+"([^"]+)"/gu)) {
      assert.ok(
        !/(^|\/)(\.\.\/)?slurp\//u.test(specifier),
        `${file} imports host-app code (${specifier}). garnish-ads must not depend on Slurp.`,
      );
    }

    const offender = FORBIDDEN.exec(code);
    assert.ok(!offender, `${file} names a host-app concept in code: "${offender?.[0]}". Use subjectId instead.`);
  }

  // The seam is allowed to know both worlds, and must keep doing so.
  const seam = await readFile(
    "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-garnish-context.ts",
    "utf8",
  );
  assert.match(seam, /garnish-ads\/garnish-ads\.types\.js/u);
  assert.match(seam, /export function garnishTagsFromPersona/u);

  // Word boundaries, not substrings: "night" must not match inside "nightlife".
  assert.deepEqual(garnishTagsFromPersona({ description: "she loves nightlife" }), ["nightlife"]);
  assert.deepEqual(garnishTagsFromPersona({ description: "a network engineer" }), []);
  assert.deepEqual(garnishTagsFromPersona({ name: "Mona", personality: "coffee and work" }), ["coffee", "work"]);

  console.log("garnish-ads boundary: ok");
}

void main();
