/**
 * Issue #1378: Chrome on Android answers an image-only `accept` with the system photo picker, which
 * lists only a few albums. Post picture inputs leave `accept` out on Android so the full file
 * browser is offered; the handlers still reject a file that is not an image.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { slpImageFileAccept } from "../packages/slurp2/src/engine/packages/client/src/slp/base/media/slp-media-accept.ts";

const root = new URL("../packages/slurp2/src/engine/packages/client/src/slp/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const android =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const iphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const desktop =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
assert.equal(slpImageFileAccept(android), undefined, "Android gets the full file browser");
assert.equal(slpImageFileAccept(iphone), "image/*");
assert.equal(slpImageFileAccept(desktop), "image/*");

for (const [file, handler] of [
  ["app/screens/SlpScreenComposer.tsx", "app/screens/SlpScreenComposer.tsx"],
  ["modules/post/SlpPostImageEditControls.tsx", "modules/post/SlpPostHooks.tsx"],
] as const) {
  const source = read(file);
  assert.ok(source.includes("accept={slpImageFileAccept()}"), `${file} uses the Android-safe accept`);
  assert.ok(!source.includes('accept="image/*"'), `${file} has no hard-coded image accept`);
  assert.match(read(handler), /if \(!file\.type\.startsWith\("image\/"\)\) \{/u, `${handler} still rejects non-images`);
}

console.log("slurp2 android image picker regression passed");
