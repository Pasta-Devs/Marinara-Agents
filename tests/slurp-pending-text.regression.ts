import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "packages/slurp/src/engine/packages/server/src");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const service = read("services/slurp/slurp-pending-text.service.ts");
const world = read("services/slurp/slurp-world.operation.ts");
const routes = read("routes/slurp.routes.ts");

// ── Tier 2 pays back what Tier 1 borrowed ───────────────────────────────────
// Unattended work never calls the model, so the world writes from a template bank. That vagueness
// is the cost of the rule, and this is where it is paid back — with the player present, against
// text they are about to read.
for (const kind of ["commission", "question", "opener"]) {
  assert.match(world, new RegExp(`kind: "${kind}"`, "u"), `${kind} must queue a rewrite`);
}
assert.match(
  routes,
  /await drainSlurpPendingText\(app\.db\)\.catch\(/u,
  "the drain must not cost the player their feed",
);

// ── Nothing is generated for text nobody will read ──────────────────────────
// The drain only runs on a read, and only for the newest few. Opening after a week away must not
// stall behind a queue.
assert.match(service, /const DRAIN_LIMIT = 2;/u);
assert.match(service, /\.orderBy\(desc\(slurpPendingText\.createdAt\)\)\.limit\(limit\)/u);

// ── Failure is always survivable ────────────────────────────────────────────
// A placeholder was written to stand on its own, so every failure path leaves it in place.
assert.match(service, /if \(!connection\) return 0;/u, "no connection must not be an error");
assert.match(service, /A placeholder that never gets rewritten is still a usable placeholder\./u);
assert.match(service, /if \(content\) \{/u, "an empty rewrite must leave the placeholder alone");
// A row that keeps failing would block the queue behind it on every read, so it is dropped.
assert.match(service, /Drop the row rather than retrying forever/u);

// ── The fan is speaking, not the Creator ────────────────────────────────────
// These are a fan's words. A rewrite that answered on the Creator's behalf would put words in the
// player's mouth on their own page.
assert.match(service, /Never write as the creator, and never answer on their behalf\./u);
assert.match(service, /NOODLER_UNTRUSTED_CONTENT_INSTRUCTION/u);

// ── The inbox preview must not drift from the message ───────────────────────
// A thread caches its last message, so rewriting one without updating the cache leaves the list
// showing a placeholder next to a conversation that no longer contains it.
const messageStorage = read("services/storage/slurp-messages.storage.ts");
assert.match(messageStorage, /async rewriteMessageContent\(/u);
assert.match(messageStorage, /lastMessagePreview: content\.slice\(0, 160\)/u);
assert.match(messageStorage, /latest\?\.id === id/u, "only the newest message owns the preview");

// Rewrites are text only. Nothing about price, state, or authorship moves.
assert.match(messageStorage, /Text only; nothing else moves\./u);

const schema = read("db/schema/slurp.ts");
assert.match(schema, /fileTable\("slurp_pending_text"/u);

console.log("slurp pending text regression passed");
