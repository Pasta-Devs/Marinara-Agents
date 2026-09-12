import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { slurpMessagePreview } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-messaging.js";

const root = join(import.meta.dirname, "..");
const src = join(root, "packages/slurp2/src/engine/packages/server/src");

// The inbox row is shown before anyone pays, so it must never quote the locked message.
const secret = "The whole point of the paid message, in the first sentence.";
const preview = slurpMessagePreview("ppv", secret, 8);
assert.ok(!preview.includes(secret.slice(0, 12)), `preview leaked locked content: ${preview}`);
assert.ok(preview.length > 0, "a locked message still needs a row in the inbox");
// Everything unpaid still reads normally, or the inbox becomes useless.
assert.match(slurpMessagePreview("text", "hello there", 0), /hello there/u);
assert.match(slurpMessagePreview("tip", "", 12), /12/u);

// Hiding locked content in the client is not enough: the response itself must not carry it.
const routes = readFileSync(join(src, "routes/slurp-messages.routes.ts"), "utf8");
assert.match(
  routes,
  /const visibleMessages = async \(threadId: string, side: "viewer" \| "creator"\)/u,
  "masking must live in one helper, not be repeated per route",
);
// The picture is masked with the text: a locked message is usually sold on its image.
assert.match(
  routes,
  /message\.kind === "ppv" && !message\.unlockedAt\s*\? \{ \.\.\.message, content: "", imageUrl: null \}/u,
);

// Every route that returns a thread's messages has to go through it.
const raw = [...routes.matchAll(/messages: (?!await visibleMessages|thread \? await visibleMessages)[^\n]*/gu)];
assert.equal(raw.length, 0, `a route returns messages without masking: ${raw.map((m) => m[0]).join(", ")}`);

console.log("slurp ppv paywall regression passed");
