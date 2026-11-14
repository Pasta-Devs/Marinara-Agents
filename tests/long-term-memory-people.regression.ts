import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { runRegressionToCompletion, runWithSafeCleanup } from "./regression-helpers.ts";

const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";

async function main() {
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/persistence/storage.ts`);
  const { applyLtmDuplicatePeople, previewLtmDuplicatePeople, scopeLtmDuplicatePeople } = await import(
    `${source}/maintenance/duplicate-people.ts`
  );
  const { getLtmIdentityRepairBackupsRoot } = await import(`${source}/identity/identity-repair.ts`);
  const { readLtmDebugLog } = await import(`${source}/maintenance/debug-log.ts`);
  const { LTM_PEOPLE_APPLY_MAX, ltmDuplicatePeopleApplyRequestSchema } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts");

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-people-"));
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
    id: `${{ character: "char", relationship: "rel" }[type as string] ?? type}_${(counter++).toString(16).padStart(8, "0")}`,
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
  const complete = {
    status: "complete" as const,
    generatedAt: timestamp,
    noteCount: 1,
    chunkCount: 1,
    embeddedChunkCount: 0,
    embeddingsAvailable: false,
  };

  await runWithSafeCleanup(
    "LTM people",
    async () => {
      await storage.initializeLtmStore();
      const longTail = "TAIL-NOT-SENT";
      const liz = await storage.createNote(
        note(
          "character",
          "Elizabeth Marlow",
          `A glassblower who runs the shop on Kettle Lane. ${"She keeps the furnace lit all night. ".repeat(6)}${longTail}`,
        ),
      );
      const lizzie = await storage.createNote(
        note("character", "Lizzie", "Glassblower on Kettle Lane.", chatA, { subjects: [{ key: "subject-lizzie" }] }),
      );
      const bram = await storage.createNote(note("character", "Bram Hollis", "A baker."));
      const oldHollis = await storage.createNote(note("character", "Old Hollis", "Bram's father, also a baker."));
      const tobin = await storage.createNote(note("character", "Tobin", "A ferryman."));
      const toby = await storage.createNote(note("character", "Toby", "Ferryman, likes rum."));
      const beth = await storage.createNote(note("character", "Beth", "Moved away.", chatA, { status: "archived" }));
      const pair = await storage.createNote(
        note("relationship", "Lizzie and Bram", "Lizzie buys bread from Bram.", chatA, {
          links: [{ relation: "involves", target: lizzie.id }],
        }),
      );
      const world = await storage.createNote(note("world", "Kettle Lane", "A crooked street of workshops."));
      const elspeth = await storage.createNote(note("character", "Elspeth", "A glassblower far away.", chatB));
      const pell = await storage.createNote(note("character", "Pell", "A fisher.", chatB));

      const prompts: string[] = [];
      const systems: string[] = [];
      const shortId = (prompt: string, title: string) =>
        prompt
          .split("\n")
          .find((line) => line.includes(` | ${title} |`))
          ?.split(" | ")[0];
      const before = JSON.stringify(await storage.listNotes());
      const fake = (system: string, prompt: string) => {
        systems.push(system);
        prompts.push(prompt);
        if (!prompt.includes("Lizzie")) return JSON.stringify({ groups: [] });
        const id = (title: string) => shortId(prompt, title)!;
        return `\`\`\`json\n${JSON.stringify({
          groups: [
            [id("Elizabeth Marlow"), id("Lizzie")],
            [id("Tobin"), id("Toby")],
            ["m99", id("Bram Hollis")],
            [id("Elizabeth Marlow"), id("Bram Hollis")],
            [id("Old Hollis")],
            "junk",
          ],
          merge: [id("Bram Hollis")],
        })}\n\`\`\``;
      };
      const preview = await previewLtmDuplicatePeople({
        root,
        storage,
        languageModel: model as never,
        complete: async (messages) => fake(messages[0]!.content, messages[1]!.content),
      });
      assert.equal(JSON.stringify(await storage.listNotes()), before, "preview changes nothing");
      assert.equal(prompts.length, 2, "one call per place with two or more people");
      for (const system of systems) {
        assert.ok(system.includes("The same name is not required."));
        assert.ok(system.includes("Never group people who merely share a role, a job or a family name."));
        assert.ok(system.includes("When unsure, leave them out."));
      }
      for (const prompt of prompts) {
        for (const text of ["Beth", "Kettle Lane |", "Lizzie and Bram", longTail])
          assert.ok(!prompt.includes(text), `not sent to the model: ${text}`);
        for (const id of [liz.id, lizzie.id, elspeth.id]) assert.ok(!prompt.includes(id), "real ids are never sent");
        assert.ok(!(prompt.includes("Elspeth") && prompt.includes("Lizzie")), "places are not mixed");
      }
      const lizLine = prompts
        .find((prompt) => prompt.includes("Lizzie"))!
        .split("\n")
        .find((line) => line.includes("| Elizabeth Marlow |"))!;
      assert.match(lizLine, /^m\d+ \| Elizabeth Marlow \| A glassblower/);
      assert.ok(lizLine.split(" | ")[2]!.length <= 200, "text is cut to 200 characters");
      assert.equal(preview.total, 8, "active people in places that hold at least two");
      assert.equal(preview.checked, 8);
      assert.equal(preview.truncated, false);
      assert.equal(preview.failedChunks, 0);

      // The scope shown before Start is the count the preview reads, and asking for it calls no model and writes nothing.
      const logBeforeScope = JSON.stringify(await readLtmDebugLog(root));
      assert.deepEqual(await scopeLtmDuplicatePeople({ storage }), { count: preview.checked });
      assert.equal(JSON.stringify(await storage.listNotes()), before, "scope changes no notes");
      assert.equal(JSON.stringify(await readLtmDebugLog(root)), logBeforeScope, "scope records no debug event");
      assert.deepEqual(
        preview.suggestions.map((s) => [s.keep.id, ...s.merge.map((m) => m.id)]),
        [
          [liz.id, lizzie.id],
          [toby.id, tobin.id],
        ],
        "the most complete memory keeps; unknown ids, reused ids and one-person groups are dropped",
      );
      assert.equal(preview.suggestions[0]!.keep.title, "Elizabeth Marlow");
      assert.equal(preview.suggestions[0]!.merge[0]!.title, "Lizzie");
      const everything = JSON.stringify(preview);
      for (const id of [bram.id, oldHollis.id, beth.id, world.id, elspeth.id, pell.id])
        assert.ok(!everything.includes(id), `not suggested: ${id}`);

      // A malformed reply gives no suggestions; every reply failing is an error.
      const malformed = await previewLtmDuplicatePeople({
        root,
        storage,
        languageModel: model as never,
        complete: async (messages) =>
          messages[1]!.content.includes("Lizzie") ? "These look like the same person to me." : '{"groups":[]}',
      });
      assert.deepEqual(malformed.suggestions, []);
      assert.equal(malformed.failedChunks, 1);
      assert.equal(malformed.checked, 2, "people the model could not read are not counted as checked");
      await assert.rejects(
        previewLtmDuplicatePeople({
          root,
          storage,
          languageModel: model as never,
          complete: async (messages) => {
            if (messages[1]!.content.includes("Pell")) throw new Error("provider down");
            return '{"groups":"m1,m2"}';
          },
        }),
        (error: { code?: string; statusCode?: number }) =>
          error.code === "ltm_model_output_unusable" && error.statusCode === 400,
      );
      const controller = new AbortController();
      let calls = 0;
      await assert.rejects(
        previewLtmDuplicatePeople({
          root,
          storage,
          languageModel: model as never,
          signal: controller.signal,
          complete: async () => {
            calls += 1;
            controller.abort();
            return JSON.stringify({ groups: [] });
          },
        }),
      );
      assert.equal(calls, 1);

      const log = JSON.stringify(await readLtmDebugLog(root));
      assert.ok(log.includes("people_chunk") && log.includes("fictional-model-1"));
      for (const text of ["glassblower", "ferryman", "Kettle", "baker"])
        assert.ok(!log.toLowerCase().includes(text.toLowerCase()), `debug log must not hold memory text: ${text}`);

      // Apply merges only the ticked group, re-checks every id, archives (never deletes) and keeps a backup.
      const untouched = JSON.stringify(
        await Promise.all([tobin, toby, bram, oldHollis, elspeth, world].map((n) => storage.getNote(n.id))),
      );
      const idsBefore = (await storage.listNotes()).map((n) => n.id).sort();
      let rebuilds = 0;
      const result = await applyLtmDuplicatePeople({
        root,
        storage,
        groups: [
          { keepId: liz.id, mergeIds: [lizzie.id, elspeth.id, beth.id, world.id, "char_00ffffff"] },
          { keepId: pair.id, mergeIds: [bram.id] },
          { keepId: "char_00fffffe", mergeIds: [oldHollis.id] },
        ],
        rebuild: async () => {
          rebuilds += 1;
          return complete as never;
        },
      });
      assert.deepEqual(result.merged, [{ keepId: liz.id, mergeIds: [lizzie.id] }]);
      assert.deepEqual(result.skipped, [
        elspeth.id,
        beth.id,
        world.id,
        "char_00ffffff",
        pair.id,
        bram.id,
        "char_00fffffe",
        oldHollis.id,
      ]);
      assert.equal(rebuilds, 1, "one rebuild for the whole batch");
      assert.equal(result.rebuild?.status, "complete");
      assert.deepEqual((await storage.listNotes()).map((n) => n.id).sort(), idsBefore, "nothing is deleted");
      const lizAfter = (await storage.getNote(liz.id))!;
      const lizzieAfter = (await storage.getNote(lizzie.id))!;
      assert.equal(lizAfter.status, "active");
      assert.ok(lizAfter.sections.facts!.text.includes("Glassblower on Kettle Lane."), "the keep gains the text");
      assert.ok(lizAfter.sections.facts!.text.includes(longTail), "the keep loses nothing");
      assert.equal(lizAfter.subjects, undefined, "subjects are not changed");
      assert.equal(lizzieAfter.status, "archived", "the merged memory is archived");
      assert.deepEqual(lizzieAfter.subjects, [{ key: "subject-lizzie" }]);
      assert.deepEqual((await storage.getNote(pair.id))?.links, [{ relation: "involves", target: liz.id }]);
      assert.equal(
        JSON.stringify(
          await Promise.all([tobin, toby, bram, oldHollis, elspeth, world].map((n) => storage.getNote(n.id))),
        ),
        untouched,
        "the unticked group and every skipped memory are untouched",
      );
      assert.ok(result.backup, "a backup is reported");
      const backupDir = join(getLtmIdentityRepairBackupsRoot(root), result.backup.id);
      const manifest = JSON.parse(await readFile(join(backupDir, "manifest.json"), "utf8"));
      assert.equal(manifest.purpose, "long-term-memory-identity-repair", "the identity-repair backup");
      const snapshot = new LongTermMemoryStorage(join(backupDir, basename(root)));
      assert.equal((await snapshot.getNote(lizzie.id))?.status, "active", "the backup holds the vault before merging");
      assert.ok(JSON.stringify(await readLtmDebugLog(root)).includes("people_apply"));

      // Running the same request again merges nothing and takes no backup.
      const again = await applyLtmDuplicatePeople({
        root,
        storage,
        groups: [{ keepId: liz.id, mergeIds: [lizzie.id] }],
        rebuild: async () => assert.fail("no rebuild"),
      });
      assert.deepEqual(again, { merged: [], skipped: [lizzie.id, liz.id], backup: null, rebuild: null });
      // The archived memory is not offered again.
      prompts.length = 0;
      await previewLtmDuplicatePeople({
        root,
        storage,
        languageModel: model as never,
        complete: async (messages) => fake(messages[0]!.content, messages[1]!.content),
      });
      assert.ok(prompts.every((prompt) => !prompt.includes("| Lizzie |")));

      // The request schema caps one apply and rejects a memory in two groups.
      const group = { keepId: liz.id, mergeIds: [lizzie.id] };
      assert.ok(ltmDuplicatePeopleApplyRequestSchema.safeParse({ groups: [group] }).success);
      assert.ok(!ltmDuplicatePeopleApplyRequestSchema.safeParse({ groups: [] }).success);
      assert.ok(
        !ltmDuplicatePeopleApplyRequestSchema.safeParse({ groups: [{ keepId: liz.id, mergeIds: [] }] }).success,
      );
      assert.ok(
        !ltmDuplicatePeopleApplyRequestSchema.safeParse({ groups: [group, { keepId: bram.id, mergeIds: [liz.id] }] })
          .success,
      );
      assert.ok(!ltmDuplicatePeopleApplyRequestSchema.safeParse({ groups: [{ ...group, extra: 1 }] }).success);
      const many = Array.from({ length: LTM_PEOPLE_APPLY_MAX + 1 }, (_, index) => ({
        keepId: `char_${(index * 2).toString(16).padStart(8, "0")}`,
        mergeIds: [`char_${(index * 2 + 1).toString(16).padStart(8, "0")}`],
      }));
      assert.ok(!ltmDuplicatePeopleApplyRequestSchema.safeParse({ groups: many }).success);

      // More places than one run reads: `after: next` reads the rest, so every person can be reviewed.
      const wide = new LongTermMemoryStorage(join(dataDir, "wide"));
      await wide.initializeLtmStore();
      for (let chat = 0; chat < 14; chat += 1)
        for (const side of ["a", "b"])
          await wide.createNote(
            note("character", `Person ${chat}${side}`, `Lives in ${chat}${side}.`, {
              chatId: `wide-${chat}`,
              chatIds: [`wide-${chat}`],
            }),
          );
      let seen: string[] = [];
      const readWide = (after?: string) =>
        previewLtmDuplicatePeople({
          root,
          storage: wide,
          languageModel: model as never,
          after,
          complete: async (messages) => {
            seen.push(
              ...messages[1]!.content
                .split("\n")
                .slice(1)
                .map((line) => line.split(" | ")[1]!),
            );
            return '{"groups":[]}';
          },
        });
      const firstBatch = await readWide();
      assert.deepEqual([firstBatch.checked, typeof firstBatch.next, firstBatch.truncated], [24, "string", true]);
      const firstSeen = [...seen];
      const secondBatch = await readWide(firstBatch.next!);
      assert.deepEqual([secondBatch.checked, secondBatch.next, secondBatch.truncated], [4, null, false]);
      assert.equal(new Set(seen).size, 28, "each person is read exactly once across the two batches");
      assert.equal(seen.length, 28);
      assert.equal((await readWide("not a cursor from this check")).total, 28, "an unknown cursor does not throw");

      // Apply merges people the first batch read: the next call still reads exactly what the first did not.
      seen = [];
      const people = await wide.listNotes({ skipInvalid: true });
      const groups = people
        .filter((entry) => firstSeen.includes(entry.title ?? "") && entry.title?.endsWith("a"))
        .map((keep) => ({
          keepId: keep.id,
          mergeIds: people
            .filter((other) => other.title === `Person ${keep.title!.slice(7, -1)}b`)
            .map((other) => other.id),
        }));
      assert.equal(groups.length, 12);
      const merged = await applyLtmDuplicatePeople({
        root,
        storage: wide,
        groups,
        rebuild: async () => ({ status: "deferred" as const, error: "test" }) as never,
      });
      assert.equal(merged.merged.length, 12);
      const afterApply = await readWide(firstBatch.next!);
      assert.equal(afterApply.next, null);
      const unread = people.map((entry) => entry.title ?? "").filter((title) => !firstSeen.includes(title));
      assert.deepEqual(
        [...seen].sort(),
        unread.sort(),
        "after an apply, the next batch reads exactly what the first did not",
      );
      assert.equal(seen.length, 4);
    },
    [() => releaseHost(), () => rm(dataDir, { recursive: true, force: true })],
  );

  process.stdout.write(
    "Long-Term Memory people regression: prompt, parsing, hostile replies, failures, abort, log, apply, backup ok\n",
  );
}

void runRegressionToCompletion("long-term-memory-people", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
