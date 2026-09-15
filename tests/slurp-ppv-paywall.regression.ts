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
  "full thread responses must retain the masking helper",
);
// The picture is masked with the text: a locked message is usually sold on its image.
assert.match(
  routes,
  /message\.kind === "ppv" && !message\.unlockedAt\s*\? \{ \.\.\.message, content: "", imageUrl: null \}/u,
);

// Paginated responses apply the same policy to their page instead of reading the whole thread.
// Execute those actual mapping expressions so accepting the paged route syntax cannot hide a leak.
const pagedMappings = [...routes.matchAll(/messages: (page\.messages\.map\(\(message\) =>[\s\S]*?\n\s*\)),/gu)];
assert.equal(pagedMappings.length, 2, "both paginated message responses must be covered");
const page = {
  messages: [
    { kind: "ppv", content: secret, imageUrl: "/locked.png", unlockedAt: null, metadata: {} },
    { kind: "ppv", content: secret, imageUrl: "/unlocked.png", unlockedAt: "paid", metadata: {} },
    { kind: "text", content: "hello there", imageUrl: null, metadata: {} },
    {
      kind: "post_preview",
      content: secret,
      imageUrl: "/preview.png",
      metadata: { previewLocked: true, content: secret, imageUrl: "/preview.png" },
    },
  ],
};
for (const [index, match] of pagedMappings.entries()) {
  const mapPage = new Function("page", "side", `return ${match[1]}`) as (
    inputPage: typeof page,
    side: "viewer" | "creator",
  ) => typeof page.messages;
  const visible = mapPage(page, "viewer");
  assert.equal(visible[0]!.content, "");
  assert.equal(visible[0]!.imageUrl, null);
  assert.deepEqual(visible.slice(1, 3), page.messages.slice(1, 3));
  assert.equal(visible[3]!.content, "");
  assert.equal(visible[3]!.imageUrl, null);
  assert.equal(visible[3]!.metadata.content, "");
  assert.equal(visible[3]!.metadata.imageUrl, null);
  if (index === 0) assert.deepEqual(mapPage(page, "creator"), page.messages);
}

// Every other response must use the full-thread helper or the empty no-thread fallback.
const raw = [
  ...routes.matchAll(
    /messages: (?!await visibleMessages|thread \? await visibleMessages|page\.messages\.map\(|\[\])[^\n]*/gu,
  ),
];
assert.equal(raw.length, 0, `a route returns messages without masking: ${raw.map((m) => m[0]).join(", ")}`);

console.log("slurp ppv paywall regression passed");
