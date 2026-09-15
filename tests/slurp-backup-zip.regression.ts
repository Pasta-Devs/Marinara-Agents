import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createStoredZip } from "../packages/slurp/src/engine/packages/server/src/services/slurp/slurp-backup.ts";

const archive = createStoredZip([
  { name: "manifest.json", data: Buffer.from('{"formatVersion":1}\n') },
  { name: "media/account/image.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
]);
assert.equal(archive.readUInt32LE(0), 0x04034b50);
assert.equal(archive.readUInt32LE(archive.length - 22), 0x06054b50);
assert.equal(archive.readUInt16LE(archive.length - 12), 2);
assert.deepEqual(
  ["manifest.json", "media/account/image.png"].map((name) => archive.includes(Buffer.from(name, "utf8"))),
  [true, true],
);
