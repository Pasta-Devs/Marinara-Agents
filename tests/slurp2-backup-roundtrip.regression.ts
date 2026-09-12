/**
 * The remaster's backup is the only path off Slurp Legacy, so the archive reader and the restore
 * contract are checked directly rather than only through the UI.
 *
 * Three things must hold, and each one has broken a migration tool somewhere before:
 *   1. what the writer produces, the reader reads back byte for byte;
 *   2. a legacy export is accepted, because the archive names entities, not tables;
 *   3. a restore never reaches outside this package's own namespaces.
 */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import {
  createStoredZip,
  readStoredZip,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-backup.ts";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// ── 1. Round trip ─────────────────────────────────────────────────────────────
const manifest = { format: "marinara-slurp-backup", formatVersion: 1, sourcePackage: "slurp2" };
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const big = Buffer.alloc(70_000, 7);
const archive = createStoredZip([
  { name: "manifest.json", data: Buffer.from(`${JSON.stringify(manifest)}\n`) },
  { name: "data/accounts.json", data: Buffer.from('[{"id":"a1"}]\n') },
  { name: "media/a1/image.png", data: png },
  { name: "media/a1/large.png", data: big },
]);

const entries = readStoredZip(archive);
const byName = new Map(entries.map((entry) => [entry.name, entry.data]));
assert.equal(entries.length, 4, "every entry must survive the round trip");
assert.deepEqual(JSON.parse(byName.get("manifest.json")!.toString("utf8")), manifest);
assert.deepEqual(JSON.parse(byName.get("data/accounts.json")!.toString("utf8")), [{ id: "a1" }]);
assert.ok(byName.get("media/a1/image.png")!.equals(png), "media bytes must be unchanged");
assert.ok(byName.get("media/a1/large.png")!.equals(big), "an entry past one buffer page must survive");

// A user who unzips and re-zips a backup produces deflated entries, so both methods must read.
const deflated = deflateRawSync(png);
const handMade = Buffer.concat([
  (() => {
    const name = Buffer.from("media/a1/image.png");
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(deflated.length, 18);
    header.writeUInt32LE(png.length, 22);
    header.writeUInt16LE(name.length, 26);
    return Buffer.concat([header, name, deflated]);
  })(),
]);
const centralName = Buffer.from("media/a1/image.png");
const central = Buffer.alloc(46);
central.writeUInt32LE(0x02014b50, 0);
central.writeUInt16LE(8, 10);
central.writeUInt32LE(deflated.length, 20);
central.writeUInt32LE(png.length, 24);
central.writeUInt16LE(centralName.length, 28);
central.writeUInt32LE(0, 42);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(1, 8);
end.writeUInt16LE(1, 10);
end.writeUInt32LE(46 + centralName.length, 12);
end.writeUInt32LE(handMade.length, 16);
const deflatedArchive = Buffer.concat([handMade, central, centralName, end]);
assert.ok(readStoredZip(deflatedArchive)[0].data.equals(png), "a re-zipped backup uses deflate and must still restore");

// A file that is not a ZIP must be reported, not parsed into nonsense.
assert.throws(() => readStoredZip(Buffer.from("not a zip at all")), /not a ZIP archive/u);

// ── 2. Legacy imports are accepted ────────────────────────────────────────────
const routes = read("packages/slurp2/src/engine/packages/server/src/routes/slurp.routes.ts");
assert.match(
  routes,
  /manifest\.sourcePackage !== "slurp" && manifest\.sourcePackage !== "slurp2"/u,
  "a Slurp Legacy export is the migration path onto this package and must be accepted",
);
assert.match(routes, /sourcePackage: "slurp2"/u, "exports must record which package wrote them");
assert.match(routes, /formatVersion !== 1/u, "an unreadable format version must be refused, not guessed");

// ── 3. A restore stays inside this package ────────────────────────────────────
const storage = read("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");
assert.match(
  storage,
  /if \(!key\.startsWith\(SLURP_SETTINGS_NAMESPACE\)\)/u,
  "an archive must not be able to write settings outside the slurp2. namespace",
);
assert.match(storage, /const SLURP_SETTINGS_NAMESPACE = "slurp2\.";/u);

// Every owned table must be in the backup registry, or a restore silently drops it.
const schema = read("packages/slurp2/src/engine/packages/server/src/db/schema/slurp.ts");
const declared = [...schema.matchAll(/fileTable\(\s*"(slurp2_[a-z0-9_]+)"/gu)].map(([, name]) => name);
const registry = storage.slice(storage.indexOf("const SLURP_BACKUP_TABLES = {"), storage.indexOf("} as const;"));
const exported = [...registry.matchAll(/^\s+\w+: (\w+),$/gmu)].map(([, symbol]) => symbol);
for (const table of declared) {
  const symbol = schema.match(new RegExp(`export const (\\w+)\\s*=\\s*fileTable\\(\\s*"${table}"`, "u"))?.[1];
  assert.ok(symbol, `could not resolve the symbol for ${table}`);
  assert.ok(exported.includes(symbol), `${table} (${symbol}) is missing from SLURP_BACKUP_TABLES`);
}
assert.equal(exported.length, declared.length, "the backup registry and the schema must hold the same tables");

// ── 4. The legacy migration actually lands ────────────────────────────────────
// A Slurp Legacy export names these entities. Each one must resolve to a table here, or a user
// migrating off legacy silently loses that part of their data with no error to tell them.
const legacyStorage = read("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts");
const legacyExport = legacyStorage.slice(
  legacyStorage.indexOf("async exportSlurpBackup()"),
  legacyStorage.indexOf("async updateSlurpSettings("),
);
const legacyTableBlock = legacyExport.slice(legacyExport.indexOf("tables: {"), legacyExport.lastIndexOf("},"));
const legacyNames = [...legacyTableBlock.matchAll(/^\s+(\w+),$/gmu)].map(([, name]) => name);
assert.ok(legacyNames.length >= 12, `expected the legacy table set, saw ${legacyNames.length}`);
for (const name of legacyNames) {
  assert.match(
    registry,
    new RegExp(`^\\s+${name}: `, "mu"),
    `a Slurp Legacy backup carries "${name}", which this package must be able to restore`,
  );
}

// Media restore is the other half of the trust boundary.
const media = read("packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-media.ts");
assert.match(media, /if \(!archivePath\.startsWith\("media\/"\)\) return false;/u);
assert.match(media, /if \(!isAllowedImageBuffer\(data\)\) return false;/u, "an archive must not write non-images");

console.log("slurp2 backup round-trip regression passed");
