import assert from "node:assert/strict";
import { join } from "node:path";
import { slurpMessagePreview } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging.js";
import { slurp2Source } from "./slurp2-source";

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
const routes = slurp2Source(join(src, "routes/slurp-messages.routes.ts"));
assert.match(
  routes,
  /const visibleMessages = async \(threadId: string, side: "viewer" \| "creator"\)/u,
  "full thread responses must retain the masking helper",
);
// The picture is masked with the text: a locked message is usually sold on its image.
assert.match(
  routes,
  /message\?\.kind === "ppv" && !message\.unlockedAt\s*\?\s*\{\s*\.\.\.message,\s*content: "",\s*imageUrl: null,/u,
);

// The masking rule itself is now a shared helper (maskForViewer) both the full-thread and the
// paginated responses call, instead of each writing it out inline. Execute the real helper so
// extracting it cannot hide a leak.
const maskForViewerMatch = routes.match(/const maskForViewer = <T[^>]*>\(message: T\): T =>\n([\s\S]*?: message;)/u);
assert.ok(maskForViewerMatch, "the shared masking helper must exist");
const maskForViewer = new Function("message", `return ${maskForViewerMatch![1]}`) as (message: unknown) => any;
// The stored media path is server storage: no fan-facing message may carry it, locked or not.
for (const kind of ["text", "ppv", "post_preview"]) {
  const masked = maskForViewer({
    kind,
    content: "hello",
    imageUrl: "/media/x.png",
    unlockedAt: null,
    metadata: {
      noodlerMediaPath: "/srv/private/secret.png",
      previewLocked: true,
      content: "hello",
      imageUrl: "/media/x.png",
    },
  });
  assert.doesNotMatch(
    JSON.stringify(masked),
    /secret\.png|noodlerMediaPath/u,
    `a ${kind} message leaks the media path`,
  );
}

// Paginated responses apply the same policy to their page instead of reading the whole thread.
// Execute those actual mapping expressions so accepting the paged route syntax cannot hide a leak.
const pagedMappings = [
  ...routes.matchAll(
    /messages: ((?:side === "viewer" \? )?page\.messages\.map\(maskForViewer\)(?: : page\.messages)?),/gu,
  ),
];
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
let sawCreatorBypass = false;
for (const match of pagedMappings) {
  const mapPage = new Function("page", "side", "maskForViewer", `return ${match[1]}`) as (
    inputPage: typeof page,
    side: "viewer" | "creator",
    mask: typeof maskForViewer,
  ) => typeof page.messages;
  const visible = mapPage(page, "viewer", maskForViewer);
  assert.equal(visible[0]!.content, "");
  assert.equal(visible[0]!.imageUrl, null);
  // Compare what goes over the wire: undefined keys (the dropped media path) do not survive JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(visible.slice(1, 3))), page.messages.slice(1, 3));
  assert.equal(visible[3]!.content, "");
  assert.equal(visible[3]!.imageUrl, null);
  assert.equal(visible[3]!.metadata.content, "");
  assert.equal(visible[3]!.metadata.imageUrl, null);
  // Only the viewer-and-creator-shared handler bypasses masking for the creator side; the
  // viewer-only media-viewer route has no "side" to bypass with, so it always masks.
  if (match[1]!.includes('side === "viewer"'))
    sawCreatorBypass = sawCreatorBypass || deepStrictEqualSafe(mapPage(page, "creator", maskForViewer), page.messages);
}
assert.ok(sawCreatorBypass, "the shared thread route must still let the creator side see its own messages");

function deepStrictEqualSafe(a: unknown, b: unknown): boolean {
  try {
    assert.deepEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

// Every other response must use the full-thread helper or the empty no-thread fallback. Type
// annotations, parameter declarations and one comment also contain the literal "messages: " outside
// any response object. They are excluded by their exact text, so a new response line is never hidden.
const NOT_RESPONSES = new Set([
  'messages: SlpMessagesStorageDependencies["messages"],',
  "messages: SlurpMessagesStorage;",
  "messages: Parameters<typeof createSlpMessagesContext>[2],",
  "messages: a long chat forgot the last picture (R1-015).",
]);
const raw = [
  ...routes.matchAll(
    /messages: (?!await visibleMessages|thread \? await visibleMessages|page\.messages\.map\(|side === "viewer" \? page\.messages\.map\(|\[\])[^\n]*/gu,
  ),
].filter((match) => !NOT_RESPONSES.has(match[0]));
assert.equal(raw.length, 0, `a route returns messages without masking: ${raw.map((m) => m[0]).join(", ")}`);

console.log("slurp ppv paywall regression passed");
