import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion, runWithSafeCleanup } from "./regression-helpers.ts";

const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";

async function main() {
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/persistence/storage.ts`);
  const { applyLtmTidy, previewLtmTidy, scopeLtmTidy } = await import(`${source}/maintenance/tidy.ts`);
  const { readLtmDebugLog } = await import(`${source}/maintenance/debug-log.ts`);
  const { LTM_TIDY_APPLY_MAX_NOTES, ltmTidyApplyRequestSchema } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts");

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-tidy-"));
  const root = join(dataDir, "long-term-memory");
  const logger = { debug() {}, info() {}, warn() {}, error() {} };
  const releaseHost = configurePackageRuntime({ dataDir, logger });
  const timestamp = "2026-10-20T00:00:00.000Z";
  const chatA = { chatId: "chat-a", chatIds: ["chat-a"] };
  const chatB = { chatId: "chat-b", chatIds: ["chat-b"] };
  let counter = 0;
  const note = (
    type: string,
    title: string,
    text: string,
    scope: Record<string, unknown> = chatA,
    extra: Record<string, unknown> = {},
  ) => ({
    id: `${type}_${(counter++).toString(16).padStart(8, "0")}`,
    title,
    type,
    modes: ["roleplay"],
    scope,
    tags: [],
    keywords: [],
    links: [],
    sections: { facts: { text, updatedAt: timestamp } },
    ...extra,
  });
  const storage = new LongTermMemoryStorage(root);
  const model = { name: "Fictional Provider", model: "fictional-model-1", maxOutputTokens: 4000 };

  await runWithSafeCleanup(
    "LTM tidy",
    async () => {
      await storage.initializeLtmStore();
      const bell1 = await storage.createNote(note("world", "Harbor bell rings", "The harbor bell rings at dusk."));
      const bell2 = await storage.createNote(note("world", "Dusk bell", "At dusk the harbor bell rings twice."));
      const empty = await storage.createNote(note("world", "Nothing happened", "Nothing happened."));
      const lamp = await storage.createNote(note("world", "Lamp oil", "Lamps burn whale oil in Brindle Cove."));
      const otherChat1 = await storage.createNote(note("world", "Harbor bell", "The harbor bell rings.", chatB));
      const otherChat2 = await storage.createNote(note("world", "Bell at dusk", "A bell rings at dusk.", chatB));
      const tone1 = await storage.createNote(note("tone", "Gentle tone", "The mood is gentle."));
      const archived = await storage.createNote(note("world", "Old bell", "Old bell.", chatA, { status: "archived" }));
      const sourceNote = await storage.createNote(
        note("source", "Harbor log", "Harbor log text.", chatA, {
          tags: ["source_summary"],
          provenance: { kind: "chat_summary", sourceId: "chat-a", entryId: "harbor-1" },
        }),
      );
      const derived = await storage.createNote(
        note("world", "Derived bell", "Derived from the log.", chatA, {
          links: [{ relation: "extracted_from", target: sourceNote.id }],
        }),
      );

      // Which memories reach the model: same type and place only; sources and archived notes never do.
      const prompts: string[] = [];
      const reply = (keep: string, archive: string[], reason = "duplicate") =>
        JSON.stringify({ groups: [{ keep, archive, reason }] });
      const shortIdOf = (prompt: string, title: string) =>
        prompt
          .split("\n")
          .find((line) => line.includes(title))
          ?.split(" | ")[0];
      const before = JSON.stringify(await storage.listNotes());
      const preview = await previewLtmTidy({
        root,
        storage,
        languageModel: model as never,
        complete: async (messages) => {
          const prompt = messages[1]!.content;
          prompts.push(prompt);
          if (prompt.includes("Harbor bell rings")) {
            // Reply with short ids (and one id from nowhere, a repeat of a kept id, and bad JSON-shaped noise).
            return `\`\`\`json\n${JSON.stringify({
              groups: [
                {
                  keep: shortIdOf(prompt, "Harbor bell rings"),
                  archive: [shortIdOf(prompt, "Dusk bell")],
                  reason: "duplicate",
                },
                { keep: null, archive: [shortIdOf(prompt, "Nothing happened")], reason: "placeholder" },
                { keep: "m1", archive: ["m99"], reason: "covered" },
                {
                  keep: shortIdOf(prompt, "Lamp oil"),
                  archive: [shortIdOf(prompt, "Harbor bell rings")],
                  reason: "covered",
                },
                "junk",
              ],
            })}\n\`\`\``;
          }
          return reply(shortIdOf(prompt, "Harbor bell")!, [shortIdOf(prompt, "Bell at dusk")!]);
        },
      });
      assert.equal(JSON.stringify(await storage.listNotes()), before, "preview changes nothing");
      assert.equal(
        prompts.length,
        2,
        "one call per same-place group with two or more memories; the lone tone note is skipped",
      );
      for (const prompt of prompts) {
        assert.ok(!prompt.includes("Old bell"), "archived notes are not sent");
        assert.ok(!prompt.includes("Harbor log"), "source notes are not sent");
        assert.ok(!prompt.includes(bell1.id), "real ids are never sent to the model");
        assert.ok(!(prompt.includes("Harbor bell rings") && prompt.includes("Bell at dusk")), "chats are not mixed");
      }
      assert.equal(preview.total, 8, "every non-source, non-archived memory counts");
      assert.equal(preview.checked, 7);
      assert.equal(preview.truncated, false);
      assert.equal(preview.failedChunks, 0);
      const byReason = (reason: string) => preview.suggestions.filter((suggestion) => suggestion.reason === reason);
      assert.deepEqual(
        byReason("duplicate").map((suggestion) => [suggestion.keep?.id, suggestion.archive.map((item) => item.id)]),
        [
          [bell1.id, [bell2.id]],
          [otherChat1.id, [otherChat2.id]],
        ],
      );
      assert.deepEqual(
        byReason("placeholder").map((suggestion) => suggestion.archive.map((item) => item.id)),
        [[empty.id]],
      );
      assert.equal(byReason("placeholder")[0]!.keep, null);
      assert.equal(
        preview.suggestions.length,
        3,
        "invalid groups, unknown ids and a kept memory archived later are dropped",
      );
      assert.ok(!JSON.stringify(preview).includes(lamp.id), "lamp memory is not suggested");
      assert.ok(!JSON.stringify(preview).includes(tone1.id));

      // The scope shown before Start is the count the preview reads, and asking for it calls no model and writes nothing.
      const logBeforeScope = JSON.stringify(await readLtmDebugLog(root));
      assert.deepEqual(await scopeLtmTidy({ storage }), { count: preview.checked });
      assert.equal(JSON.stringify(await storage.listNotes()), before, "scope changes no notes");
      assert.equal(JSON.stringify(await readLtmDebugLog(root)), logBeforeScope, "scope records no debug event");

      // Failures: bad JSON in one chunk and a thrown call in another are counted; all failing is an error.
      const flaky = await previewLtmTidy({
        root,
        storage,
        languageModel: model as never,
        complete: async (messages) => {
          if (messages[1]!.content.includes("Harbor bell rings")) return "I think these are fine.";
          return reply("m1", ["m2"]);
        },
      });
      assert.equal(flaky.failedChunks, 1);
      assert.equal(flaky.checked, 2, "memories the model could not read are not counted as checked");
      assert.equal(flaky.suggestions.length, 1);
      await assert.rejects(
        previewLtmTidy({
          root,
          storage,
          languageModel: model as never,
          complete: async () => {
            throw new Error("provider down");
          },
        }),
        (error: { code?: string; statusCode?: number }) =>
          error.code === "ltm_model_output_unusable" && error.statusCode === 400,
      );
      // An aborted request stops without calling the model again.
      const controller = new AbortController();
      let calls = 0;
      await assert.rejects(
        previewLtmTidy({
          root,
          storage,
          languageModel: model as never,
          signal: controller.signal,
          complete: async () => {
            calls += 1;
            controller.abort();
            return reply("m1", ["m2"]);
          },
        }),
      );
      assert.equal(calls, 1);

      // The debug log records counts and model names, never memory text.
      const log = JSON.stringify(await readLtmDebugLog(root));
      assert.ok(log.includes("tidy_chunk") && log.includes("fictional-model-1"));
      for (const text of ["harbor bell rings", "Lamps burn", "Nothing happened"])
        assert.ok(!log.toLowerCase().includes(text.toLowerCase()), `debug log must not hold memory text: ${text}`);

      // Apply archives like DELETE /notes/:id (a memory is archived, links kept), skips what it should, rebuilds once.
      let rebuilds = 0;
      const result = await applyLtmTidy({
        root,
        storage,
        noteIds: [bell2.id, empty.id, archived.id, sourceNote.id, "world_00ffffff", bell2.id],
        rebuild: async () => {
          rebuilds += 1;
          return {
            status: "complete" as const,
            generatedAt: timestamp,
            noteCount: 1,
            chunkCount: 1,
            embeddedChunkCount: 0,
            embeddingsAvailable: false,
          } as never;
        },
      });
      assert.deepEqual(result.archived, [bell2.id, empty.id]);
      assert.deepEqual(result.skipped, [archived.id, sourceNote.id, "world_00ffffff"]);
      assert.equal(rebuilds, 1, "one rebuild for the whole batch");
      assert.equal(result.rebuild?.status, "complete");
      assert.equal((await storage.getNote(bell2.id))?.status, "archived");
      assert.equal((await storage.getNote(bell1.id))?.status, "active");
      assert.equal(
        (await storage.getNote(sourceNote.id))?.status,
        "active",
        "a source record is never archived by tidy",
      );
      assert.equal((await storage.getNote(derived.id))?.status, "active");
      const nothing = await applyLtmTidy({
        root,
        storage,
        noteIds: [archived.id],
        rebuild: async () => assert.fail("no rebuild"),
      });
      assert.deepEqual(nothing, { archived: [], skipped: [archived.id], rebuild: null });
      const applyLog = JSON.stringify(await readLtmDebugLog(root));
      assert.ok(applyLog.includes("tidy_apply"));

      // The request schema caps one apply at 500 memories and rejects repeats.
      assert.ok(ltmTidyApplyRequestSchema.safeParse({ noteIds: [bell1.id] }).success);
      assert.ok(!ltmTidyApplyRequestSchema.safeParse({ noteIds: [] }).success);
      assert.ok(!ltmTidyApplyRequestSchema.safeParse({ noteIds: [bell1.id, bell1.id] }).success);
      const many = Array.from(
        { length: LTM_TIDY_APPLY_MAX_NOTES + 1 },
        (_, index) => `world_${index.toString(16).padStart(8, "0")}`,
      );
      assert.ok(!ltmTidyApplyRequestSchema.safeParse({ noteIds: many }).success);

      // More groups than one run reads: `after: next` reads the rest, so every memory can be reviewed.
      const wide = new LongTermMemoryStorage(join(dataDir, "wide"));
      await wide.initializeLtmStore();
      for (let chat = 0; chat < 14; chat += 1)
        for (const side of ["a", "b"])
          await wide.createNote(
            note("world", `Memory ${chat}${side}`, `Fact ${chat}${side}.`, {
              chatId: `wide-${chat}`,
              chatIds: [`wide-${chat}`],
            }),
          );
      let seen: string[] = [];
      const readWide = (after?: string) =>
        previewLtmTidy({
          root,
          storage: wide,
          languageModel: model as never,
          after,
          complete: async (messages) => {
            seen.push(...messages[1]!.content.split("\n").map((line) => line.split(" | ")[1]!));
            return '{"groups":[]}';
          },
        });
      const firstBatch = await readWide();
      assert.deepEqual([firstBatch.checked, typeof firstBatch.next, firstBatch.truncated], [24, "string", true]);
      const firstSeen = [...seen];
      const secondBatch = await readWide(firstBatch.next!);
      assert.deepEqual([secondBatch.checked, secondBatch.next, secondBatch.truncated], [4, null, false]);
      assert.equal(new Set(seen).size, 28, "each memory is read exactly once across the two batches");
      assert.equal(seen.length, 28);
      assert.equal((await readWide("\uffff")).checked, 0, "a cursor past the last memory reads nothing");
      assert.equal((await readWide("not a cursor from this check")).total, 28, "an unknown cursor does not throw");

      // Apply archives memories the first batch read: the next call still reads exactly what the first did not.
      seen = [];
      const readByFirst = (await wide.listNotes({ skipInvalid: true })).filter((entry) =>
        firstSeen.includes(entry.title ?? ""),
      );
      assert.equal(readByFirst.length, 24);
      await applyLtmTidy({
        root,
        storage: wide,
        noteIds: readByFirst.filter((entry) => entry.title?.endsWith("a")).map((entry) => entry.id),
        rebuild: async () => ({ status: "deferred" as const, error: "test" }) as never,
      });
      const afterApply = await readWide(firstBatch.next!);
      assert.equal(afterApply.next, null);
      const unread = (await wide.listNotes({ skipInvalid: true }))
        .map((entry) => entry.title ?? "")
        .filter((title) => !firstSeen.includes(title));
      assert.deepEqual(
        [...seen].sort(),
        unread.sort(),
        "after an apply, the next batch reads exactly what the first did not",
      );
      assert.equal(seen.length, 4);
    },
    [() => releaseHost(), () => rm(dataDir, { recursive: true, force: true })],
  );

  process.stdout.write("Long-Term Memory tidy regression: grouping, parsing, failures, abort, log, apply ok\n");
}

void runRegressionToCompletion("long-term-memory-tidy", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
