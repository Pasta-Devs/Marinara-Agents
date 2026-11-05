import assert from "node:assert/strict";
import filesystem, { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createForgeCombatVoices } from "../packages/gacha-forge/src/combat-voices-server.mjs";

const root = await realpath(await mkdtemp(join(tmpdir(), "forge-voice-file-")));
const world = "a".repeat(64);
const filename = `${"b".repeat(64)}.wav`;
const folder = join(root, "capability-package-data", "gacha-forge", "combat-voices", world);
const path = join(folder, filename);
const bytes = Buffer.from("RIFF0000WAVEfixture");
const originalOpen = filesystem.open;
const opened = [];
let failStat = true;
let closes = 0;
const reply = () => ({
  status: 200,
  headers: {},
  code(value) {
    this.status = value;
    return this;
  },
  header(key, value) {
    this.headers[key] = value;
    return this;
  },
  send(value) {
    this.payload = value;
    return this;
  },
});

try {
  await mkdir(folder, { recursive: true });
  await writeFile(path, bytes);
  filesystem.open = async (...args) => {
    const file = await originalOpen(...args);
    if (args[0] !== path) return file;
    opened.push(file);
    return {
      stat: () => (failStat ? Promise.reject(new Error("Injected filesystem stat failure")) : file.stat()),
      close: () => {
        closes++;
        return file.close();
      },
      createReadStream: (options) => file.createReadStream(options),
    };
  };
  syncBuiltinESMExports();
  const manager = createForgeCombatVoices({ dataDir: root });
  const request = { params: { world, filename }, method: "GET" };
  const failed = await manager.serve(request, reply());
  assert.equal(failed.status, 404);
  assert.equal(closes, 1);
  await assert.rejects(opened.at(-1).stat(), { code: "EBADF" });
  process.stdout.write("ok 1 - a failed file stat closes the actual opened handle and returns 404\n");

  failStat = false;
  const head = await manager.serve({ ...request, method: "HEAD" }, reply());
  assert.equal(head.status, 200);
  assert.equal(head.headers["Content-Length"], bytes.length);
  assert.equal(head.payload, undefined);
  assert.equal(closes, 2);
  await assert.rejects(opened.at(-1).stat(), { code: "EBADF" });
  process.stdout.write("ok 2 - a valid HEAD closes the handle without streaming\n");

  const get = await manager.serve(request, reply());
  const chunks = [];
  for await (const chunk of get.payload) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), bytes);
  assert.equal(get.headers["Content-Type"], "audio/wav");
  await assert.rejects(opened.at(-1).stat(), { code: "EBADF" });
  process.stdout.write("ok 3 - a valid GET streams the cached clip and closes automatically\n");
  manager.dispose();
} finally {
  filesystem.open = originalOpen;
  syncBuiltinESMExports();
  await Promise.all(opened.map((file) => file.close().catch(() => {})));
  await rm(root, { recursive: true, force: true });
}
