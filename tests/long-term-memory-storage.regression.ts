import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

async function main() {
  const source =
    "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { configurePackageRuntime } = await import(
    `${source}/package-runtime.ts`
  );
  const { getLongTermMemoryDirectories, getLongTermMemoryRoot, notePathForId } =
    await import(`${source}/paths.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/storage.ts`);
  const { activateLongTermMemoryStorage } = await import(
    `${source}/runtime.ts`
  );
  const { ltmSettingsPath } = await import(`${source}/settings.ts`);
  const { ltmMutationTransactionSchema, recoverLtmMutations } = await import(
    `${source}/mutation-transaction.ts`
  );
  const { runLongTermMemoryRetention } = await import(`${source}/retention.ts`);

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-storage-"));
  const logger = { debug() {}, info() {}, warn() {}, error() {} };
  const releaseHost = configurePackageRuntime({ dataDir, logger });
  const root = join(dataDir, "long-term-memory");
  const timestamp = "2026-07-17T00:00:00.000Z";
  const noteInput = {
    id: "world_restart_proof",
    title: "Restart proof",
    type: "world",
    modes: ["roleplay"],
    scope: {},
    tags: [],
    keywords: ["restart"],
    links: [],
    sections: {
      facts: {
        text: "This note survives runtime restart.",
        updatedAt: timestamp,
      },
    },
  };

  try {
    assert.equal(
      getLongTermMemoryRoot(),
      root,
      "default root must remain join(dataDir, 'long-term-memory')",
    );
    const first = await activateLongTermMemoryStorage(root);
    await first.storage.createNote(noteInput);
    await first.cleanup();
    const restarted = await activateLongTermMemoryStorage(root);
    assert.equal(
      (await restarted.storage.getNote(noteInput.id))?.sections.facts?.text,
      "This note survives runtime restart.",
    );

    const interruptedId = randomUUID();
    const interruptedPath = notePathForId("world_interrupted", "world", root);
    const interruptedNote = {
      ...noteInput,
      id: "world_interrupted",
      title: "Interrupted",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    };
    const transaction = ltmMutationTransactionSchema.parse({
      version: 1,
      id: interruptedId,
      createdAt: timestamp,
      status: "committed",
      files: [
        {
          path: "vault/world/world_interrupted.json",
          before: null,
          after: interruptedNote,
        },
      ],
      events: [],
    });
    await writeFile(
      join(
        getLongTermMemoryDirectories(root).transactions,
        `${interruptedId}.json`,
      ),
      `${JSON.stringify(transaction)}\n`,
    );
    await recoverLtmMutations(root);
    assert.equal(
      JSON.parse(await readFile(interruptedPath, "utf8")).id,
      "world_interrupted",
    );
    await assert.rejects(
      stat(
        join(
          getLongTermMemoryDirectories(root).transactions,
          `${interruptedId}.json`,
        ),
      ),
    );

    await writeFile(ltmSettingsPath(root), '{"version":1,"unknown":true}\n');
    await restarted.cleanup();
    await assert.rejects(
      activateLongTermMemoryStorage(root),
      /unrecognized|unknown/i,
      "self-check must reject malformed settings",
    );
    await writeFile(ltmSettingsPath(root), '{"version":1}\n');

    const quarantine = join(root, "quarantine", "expired");
    await mkdir(quarantine, { recursive: true });
    await writeFile(join(quarantine, "artifact.json"), "{}\n");
    await utimes(quarantine, new Date(0), new Date(0));
    const cleanup = await runLongTermMemoryRetention({
      root,
      now: new Date("2026-07-17T00:00:00Z"),
      force: true,
    });
    assert.equal(cleanup.quarantineArtifacts, 1);
    await assert.rejects(stat(quarantine));
    assert.equal(
      (await new LongTermMemoryStorage(root).getNote(noteInput.id))?.id,
      noteInput.id,
      "cleanup must preserve canonical notes",
    );

    process.stdout.write(
      "Long-Term Memory storage regression: restart, recovery, self-check, cleanup, stable root ok\n",
    );
  } finally {
    releaseHost();
    await rm(dataDir, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
