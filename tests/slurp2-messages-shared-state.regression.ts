import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Storage modules import Engine host code that this repository does not carry, so these checks
// read the source instead of loading it.
const server = join(import.meta.dirname, "../packages/slurp2/src/engine/packages/server/src/slp");
const contextSource = readFileSync(join(server, "data/messages/slp-messages-storage-context.ts"), "utf8");

// Value names a module exports at the top level, following `export { … } from` chains. esbuild
// drops an unresolved TypeScript re-export without an error, so a missing name reaches runtime as
// `undefined` instead of failing the build.
function valueExports(file: string, seen = new Set<string>()): Set<string> {
  const names = new Set<string>();
  if (seen.has(file) || !existsSync(file)) return names;
  seen.add(file);
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/^export (?:async )?(?:function\*?|const|let|class) ([A-Za-z0-9_$]+)/gmu)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/^export \{([^}]*)\}(?: from "([^"]+)")?;/gmu)) {
    const target = match[2] ? join(dirname(file), match[2].replace(/\.js$/u, ".ts")) : null;
    const available = target ? valueExports(target, seen) : null;
    for (const part of match[1].split(",").map((name) => name.trim())) {
      if (!part || part.startsWith("type ")) continue;
      const [original, alias = original] = part.split(/\s+as\s+/u);
      if (!available || available.has(original)) names.add(alias);
    }
  }
  return names;
}

// The profile tip settles its payment through five helpers. The storage split nested them inside
// the messages context while a contract still re-exported them, so the route called `undefined`.
const contextExports = valueExports(join(server, "data/messages/slp-messages-storage-context.ts"));
for (const name of [
  "compensateSlurpPaymentForDatabase",
  "claimSlurpPaymentIntentForDatabase",
  "resetSlurpPaymentIntentForDatabase",
  "settleSlurpPaymentIntentForDatabase",
  "applySlurpTipEffectsForDatabase",
]) {
  assert.ok(contextExports.has(name), `${name} must be a real top-level export`);
}

// In-flight unlocks, tips, commissions, and payment claims de-duplicate concurrent requests only if
// every messages storage instance sees the same pending work, and there are many construction
// sites. Each owner is declared once, at module scope, before the context factory.
const factoryAt = contextSource.indexOf("export function createSlurpMessagesContext(");
assert.ok(factoryAt > 0, "the messages context factory must exist");
for (const owner of [
  "messageUnlocks",
  "directMessageTips",
  "commissionOperations",
  "paymentIntentClaims",
  "slurpDatabases",
]) {
  const declarations = [...contextSource.matchAll(new RegExp(`^([ \\t]*)const ${owner} = new `, "gmu"))];
  assert.equal(declarations.length, 1, `${owner} must have one construction site`);
  assert.equal(declarations[0][1], "", `${owner} must be declared at module scope`);
  assert.ok((declarations[0].index ?? 0) < factoryAt, `${owner} must not be created per context`);
}

// Every value a server feature contract re-exports must resolve to a real export.
const features = join(server, "features");
const contracts = readdirSync(features, { recursive: true, encoding: "utf8" }).filter((file) =>
  /(^|\/)slp-[a-z0-9-]+-contract\.ts$/u.test(file),
);
assert.ok(contracts.length > 0, "the feature contracts must be found");
for (const file of contracts) {
  const source = readFileSync(join(features, file), "utf8");
  for (const match of source.matchAll(/^export \{([^}]*)\} from "([^"]+)";/gmu)) {
    const target = join(features, dirname(file), match[2].replace(/\.js$/u, ".ts"));
    const available = valueExports(target);
    for (const name of match[1].split(",").map((part) => part.trim())) {
      if (name && !name.startsWith("type ")) assert.ok(available.has(name), `${file} re-exports a missing ${name}`);
    }
  }
}

console.log("slurp2 messages shared-state regression passed");
