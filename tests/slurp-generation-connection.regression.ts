import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveSlurpTextConnection } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-connection.js";

const root = join(import.meta.dirname, "..");
const serverRoot = join(root, "packages/slurp/src/engine/packages/server/src");
const read = (path: string) => readFileSync(join(serverRoot, path), "utf8");

type Row = { id: string; provider: string; apiKey?: string };

/**
 * Stand in for the Engine's connections storage with just the three lookups the resolver makes.
 */
function stubConnections(rows: { agents?: Row; plain?: Row }) {
  const all = [rows.agents, rows.plain].filter((row): row is Row => Boolean(row));
  return {
    getWithKey: async (id: string) => all.find((row) => row.id === id) ?? null,
    getDefaultForAgents: async () => rows.agents ?? null,
    getDefault: async () => rows.plain ?? null,
  } as any;
}

async function main() {
  const language: Row = { id: "language", provider: "openai" };
  const image: Row = { id: "image", provider: "image_generation" };

  // An explicit choice always wins and never consults the defaults.
  assert.equal((await resolveSlurpTextConnection(stubConnections({ plain: language }), "language"))?.id, "language");
  // The Engine's agent default is preferred when one is flagged.
  assert.equal((await resolveSlurpTextConnection(stubConnections({ agents: language, plain: image })))?.id, "language");
  // Slurp ships `generationConnectionId: null`, and `getDefaultForAgents()` only answers for a
  // connection carrying the agent flag. Without this last step an install with working
  // connections but no agent flag resolved to nothing, and every Slurp generation — posts,
  // comments, creator replies, direct messages, stage-profile drafts, audience activity, ads —
  // quietly reported "connection not found" while the app looked configured.
  assert.equal((await resolveSlurpTextConnection(stubConnections({ plain: language })))?.id, "language");
  // An image or video default is not a chat connection, so it must not reach a completion.
  assert.equal(await resolveSlurpTextConnection(stubConnections({ plain: image })), null);
  assert.equal(await resolveSlurpTextConnection(stubConnections({})), null);

  // Every Slurp text generation routes through the shared resolver, or the next path added here
  // reintroduces the same silent dead end.
  for (const file of [
    "routes/slurp.routes.ts",
    "services/slurp/slurp-post.operation.ts",
    "services/slurp/slurp-creator-reply.operation.ts",
    "services/slurp/slurp-message.operation.ts",
    "services/slurp/slurp-reserve.operation.ts",
    "services/slurp/slurp-fan-activity.service.ts",
    "services/slurp/slurp-garnish-generation.service.ts",
  ]) {
    const source = read(file);
    assert.match(source, /resolveSlurpTextConnection/, `${file} must resolve through the shared helper`);
    assert.doesNotMatch(source, /getDefaultForAgents\(\)/, `${file} must not resolve the agent default on its own`);
  }

  // The stage-profile draft route drives creator and persona creation and editing. It used to skip
  // the Slurp generation setting entirely and go straight to the agent default.
  const routes = read("routes/slurp.routes.ts");
  const draftRoute = routes.slice(routes.indexOf('app.post("/noodler/stage-profile-draft"'), 900 + routes.length);
  assert.match(draftRoute.slice(0, 900), /parsed\.data\.connectionId \?\? settings\.generationConnectionId/);

  console.log("slurp generation connection regression passed");
}

void main();
