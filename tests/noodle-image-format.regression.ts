import assert from "node:assert/strict";
import { noodleImageExtension } from "../packages/noodle/src/engine/packages/server/src/services/noodle/noodle-image-format.js";

function encoded(bytes: number[]) {
  return Buffer.from(bytes).toString("base64");
}

assert.equal(noodleImageExtension(encoded([0x89, 0x50, 0x4e, 0x47]), "jpg"), "png");
assert.equal(noodleImageExtension(encoded([0xff, 0xd8, 0xff]), "png"), "jpg");
assert.equal(
  noodleImageExtension(encoded([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), "png"),
  "webp",
);
assert.equal(noodleImageExtension(encoded([0x47, 0x49, 0x46]), "png"), "gif");
assert.equal(noodleImageExtension(encoded([0x42, 0x4d]), "png"), "bmp");
assert.equal(
  noodleImageExtension(encoded([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]), "png"),
  "avif",
);
assert.equal(
  noodleImageExtension(
    encoded([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31, 0, 0, 0, 0, 0x61, 0x76, 0x69, 0x66]),
    "png",
  ),
  "avif",
);
assert.equal(noodleImageExtension(encoded([0]), ".jpeg"), "jpg");
assert.equal(noodleImageExtension(encoded([0]), "unknown"), "png");

console.log("Noodle generated image format regression passed.");
