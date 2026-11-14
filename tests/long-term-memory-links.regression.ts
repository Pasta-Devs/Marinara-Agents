import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion, runWithSafeCleanup } from "./regression-helpers.ts";

const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";

async function main() {
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/persistence/storage.ts`);
  const { applyLtmRelationshipLinks, previewLtmRelationshipLinks, scopeLtmRelationshipLinks } = await import(
    `${source}/maintenance/link-relationships.ts`
  );
  const { readLtmDebugLog } = await import(`${source}/maintenance/debug-log.ts`);
  const { LTM_LINKS_APPLY_MAX, ltmRelationshipLinksApplyRequestSchema } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts");

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-links-"));
  const root = join(dataDir, "long-term-memory");
  const logger = { debug() {}, info() {}, warn() {}, error() {} };
  const releaseHost = configurePackageRuntime({ dataDir, logger });
  const timestamp = "2026-10-20T00:00:00.000Z";
  const chatA = { chatId: "chat-a", chatIds: ["chat-a"] };
  const chatB = { chatId: "chat-b", chatIds: ["chat-b"] };
  const chatC = { chatId: "chat-c", chatIds: ["chat-c"] };
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
    "LTM links",
    async () => {
      await storage.initializeLtmStore();
      const mira = await storage.createNote(note("character", "Mira", "A lighthouse keeper."));
      const tomas = await storage.createNote(
        note("character", "Tomas", "A ferryman.", chatA, { subjects: [{ key: "subject-tomas" }] }),
      );
      const ilse = await storage.createNote(note("character", "Ilse", "A cartographer."));
      const archivedPerson = await storage.createNote(
        note("character", "Oda", "Left town.", chatA, { status: "archived" }),
      );
      const dov = await storage.createNote(note("character", "Dov", "A harbor clerk.", chatB));
      const mixed = await storage.createNote(note("relationship", "Mira & Tomas", "They share the night watch."));
      const partial = await storage.createNote(note("relationship", "Ilse and Brindle", "Ilse maps for Brindle."));
      const bySubject = await storage.createNote(
        note("relationship", "Old rivals", "A long quarrel.", chatA, {
          subjects: [{ key: "subject-nobody" }, { key: "subject-tomas" }],
        }),
      );
      const model1 = await storage.createNote(
        note("relationship", "The keeper and the mapmaker", "Mira trusts the charts Ilse draws."),
      );
      const model2 = await storage.createNote(note("relationship", "Rival ferrymen", "They race at dawn."));
      const alreadyLinked = await storage.createNote(
        note("relationship", "Mira and Ilse", "Friends.", chatA, {
          links: [{ relation: "involves", target: mira.id }],
        }),
      );
      const archivedRelationship = await storage.createNote(
        note("relationship", "Old debts", "Settled.", chatA, { status: "archived" }),
      );
      const otherChat = await storage.createNote(
        note("relationship", "Clerk and captain", "Dov owes a favour.", chatB),
      );
      const noPeople = await storage.createNote(note("relationship", "Mira and Tomas", "Another chat.", chatC));
      const world = await storage.createNote(note("world", "Harbor bell", "The harbor bell rings."));

      const prompts: string[] = [];
      const shortId = (prompt: string, title: string) =>
        prompt
          .split("\n")
          .find((line) => line.includes(` | ${title} |`))
          ?.split(" | ")[0];
      const before = JSON.stringify(await storage.listNotes());
      const hostile = (prompt: string) => {
        prompts.push(prompt);
        if (!prompt.includes("The keeper and the mapmaker")) {
          return JSON.stringify({
            links: [{ relationship: shortId(prompt, "Clerk and captain"), people: [shortId(prompt, "Dov")] }],
          });
        }
        const rival = shortId(prompt, "Rival ferrymen")!;
        return `\`\`\`json\n${JSON.stringify({
          links: [
            {
              relationship: shortId(prompt, "The keeper and the mapmaker"),
              people: [shortId(prompt, "Ilse"), shortId(prompt, "Mira")],
            },
            { relationship: "r1", people: ["p99"] },
            { relationship: rival, people: [rival] },
            { relationship: rival, people: [shortId(prompt, "Tomas")], archive: ["p1"], action: "archive" },
            { relationship: "r99", people: ["p1"] },
            "junk",
          ],
          archive: ["p1", "r1"],
        })}\n\`\`\``;
      };
      const preview = await previewLtmRelationshipLinks({
        root,
        storage,
        languageModel: model as never,
        complete: async (messages) => hostile(messages[1]!.content),
      });
      assert.equal(JSON.stringify(await storage.listNotes()), before, "preview changes nothing");
      assert.equal(prompts.length, 2, "one call per place that has people and unlinked relationships");
      for (const prompt of prompts) {
        for (const text of [
          mixed.title,
          bySubject.title,
          alreadyLinked.title,
          archivedRelationship.title,
          noPeople.title,
          "Oda",
          "Harbor bell",
        ])
          assert.ok(!prompt.includes(text), `not sent to the model: ${text}`);
        for (const id of [mira.id, model1.id, dov.id]) assert.ok(!prompt.includes(id), "real ids are never sent");
        assert.ok(!(prompt.includes("Dov") && prompt.includes("Mira")), "places are not mixed");
      }
      assert.equal(preview.total, 6, "unlinked, active relationships in places that have people");
      assert.equal(preview.checked, 6);
      assert.equal(preview.truncated, false);
      assert.equal(preview.failedChunks, 0);

      // The scope shown before Start is the count the preview reads, and asking for it calls no model and writes nothing.
      const logBeforeScope = JSON.stringify(await readLtmDebugLog(root));
      assert.deepEqual(await scopeLtmRelationshipLinks({ storage }), { count: preview.checked });
      assert.equal(JSON.stringify(await storage.listNotes()), before, "scope changes no notes");
      assert.equal(JSON.stringify(await readLtmDebugLog(root)), logBeforeScope, "scope records no debug event");
      const pairs = preview.suggestions.map((s) => `${s.origin}:${s.relationship.id}>${s.person.id}`).sort();
      assert.deepEqual(
        pairs,
        [
          `name:${mixed.id}>${mira.id}`,
          `name:${mixed.id}>${tomas.id}`,
          `name:${partial.id}>${ilse.id}`,
          `name:${bySubject.id}>${tomas.id}`,
          `model:${model1.id}>${ilse.id}`,
          `model:${model1.id}>${mira.id}`,
          `model:${otherChat.id}>${dov.id}`,
        ].sort(),
      );
      const everything = JSON.stringify(preview);
      for (const id of [model2.id, alreadyLinked.id, archivedRelationship.id, noPeople.id, archivedPerson.id, world.id])
        assert.ok(!everything.includes(id), `hostile or ineligible id is not suggested: ${id}`);

      // Failures: a thrown call and bad JSON are counted; names still answer; all failing without names is an error.
      const flaky = await previewLtmRelationshipLinks({
        root,
        storage,
        languageModel: model as never,
        complete: async (messages) => {
          if (messages[1]!.content.includes("Dov")) throw new Error("provider down");
          return "I think these are fine.";
        },
      });
      assert.equal(flaky.failedChunks, 2);
      assert.ok(flaky.suggestions.length === 4 && flaky.suggestions.every((s) => s.origin === "name"));
      assert.equal(flaky.checked, 3, "relationships the model could not read are not counted as checked");
      const root2 = join(dataDir, "second");
      const storage2 = new LongTermMemoryStorage(root2);
      await storage2.initializeLtmStore();
      await storage2.createNote(note("character", "Wren", "A fisher."));
      await storage2.createNote(note("relationship", "Quiet pair", "They rarely speak."));
      await assert.rejects(
        previewLtmRelationshipLinks({
          root: root2,
          storage: storage2,
          languageModel: model as never,
          complete: async () => {
            throw new Error("provider down");
          },
        }),
        (error: { code?: string; statusCode?: number }) =>
          error.code === "ltm_model_output_unusable" && error.statusCode === 400,
      );
      const controller = new AbortController();
      let calls = 0;
      await assert.rejects(
        previewLtmRelationshipLinks({
          root,
          storage,
          languageModel: model as never,
          signal: controller.signal,
          complete: async () => {
            calls += 1;
            controller.abort();
            return JSON.stringify({ links: [] });
          },
        }),
      );
      assert.equal(calls, 1);

      const log = JSON.stringify(await readLtmDebugLog(root));
      assert.ok(log.includes("links_chunk") && log.includes("fictional-model-1"));
      for (const text of ["lighthouse keeper", "mapmaker", "Dov owes", "race at dawn"])
        assert.ok(!log.toLowerCase().includes(text.toLowerCase()), `debug log must not hold memory text: ${text}`);

      // Apply adds links only: it re-checks every pair and leaves everything else about the memories alone.
      const strip = ({ links: _links, version: _v, updatedAt: _u, ...rest }: Record<string, unknown>) => rest;
      const mixedBefore = await storage.getNote(mixed.id);
      let rebuilds = 0;
      const result = await applyLtmRelationshipLinks({
        root,
        storage,
        links: [
          { relationshipId: mixed.id, personId: mira.id },
          { relationshipId: mixed.id, personId: tomas.id },
          { relationshipId: mixed.id, personId: mira.id },
          { relationshipId: model1.id, personId: archivedPerson.id },
          { relationshipId: model1.id, personId: world.id },
          { relationshipId: model1.id, personId: dov.id },
          { relationshipId: model1.id, personId: model2.id },
          { relationshipId: alreadyLinked.id, personId: mira.id },
          { relationshipId: archivedRelationship.id, personId: mira.id },
          { relationshipId: world.id, personId: mira.id },
          { relationshipId: "rel_00ffffff", personId: mira.id },
          { relationshipId: partial.id, personId: ilse.id },
        ],
        rebuild: async () => {
          rebuilds += 1;
          return complete as never;
        },
      });
      assert.deepEqual(result.linked, [
        { relationshipId: mixed.id, personId: mira.id },
        { relationshipId: mixed.id, personId: tomas.id },
        { relationshipId: partial.id, personId: ilse.id },
      ]);
      assert.deepEqual(
        result.skipped.map((pair) => `${pair.relationshipId}>${pair.personId}`),
        [
          `${model1.id}>${archivedPerson.id}`,
          `${model1.id}>${world.id}`,
          `${model1.id}>${dov.id}`,
          `${model1.id}>${model2.id}`,
          `${alreadyLinked.id}>${mira.id}`,
          `${archivedRelationship.id}>${mira.id}`,
          `${world.id}>${mira.id}`,
          `rel_00ffffff>${mira.id}`,
        ],
      );
      assert.equal(rebuilds, 1, "one rebuild for the whole batch");
      assert.equal(result.rebuild?.status, "complete");
      const mixedAfter = await storage.getNote(mixed.id);
      assert.deepEqual(mixedAfter?.links, [
        { target: mira.id, relation: "involves" },
        { target: tomas.id, relation: "involves" },
      ]);
      assert.deepEqual(strip(mixedAfter as never), strip(mixedBefore as never), "only the links changed");
      assert.deepEqual((await storage.getNote(model1.id))?.links, []);
      assert.equal((await storage.getNote(mira.id))?.status, "active");
      assert.equal((await storage.getNote(alreadyLinked.id))?.links.length, 1);
      // Running the same request again changes nothing.
      const again = await applyLtmRelationshipLinks({
        root,
        storage,
        links: [{ relationshipId: mixed.id, personId: mira.id }],
        rebuild: async () => assert.fail("no rebuild"),
      });
      assert.deepEqual(again, {
        linked: [],
        skipped: [{ relationshipId: mixed.id, personId: mira.id }],
        rebuild: null,
      });
      assert.ok(JSON.stringify(await readLtmDebugLog(root)).includes("links_apply"));
      // The linked relationship is not offered again.
      const second = await previewLtmRelationshipLinks({
        root,
        storage,
        languageModel: model as never,
        complete: async (messages) => hostile(messages[1]!.content),
      });
      assert.ok(!JSON.stringify(second).includes(mixed.id));

      // The request schema caps one apply at 500 links and rejects repeats.
      const pair = { relationshipId: mixed.id, personId: mira.id };
      assert.ok(ltmRelationshipLinksApplyRequestSchema.safeParse({ links: [pair] }).success);
      assert.ok(!ltmRelationshipLinksApplyRequestSchema.safeParse({ links: [] }).success);
      assert.ok(!ltmRelationshipLinksApplyRequestSchema.safeParse({ links: [pair, pair] }).success);
      assert.ok(!ltmRelationshipLinksApplyRequestSchema.safeParse({ links: [{ ...pair, extra: 1 }] }).success);
      const many = Array.from({ length: LTM_LINKS_APPLY_MAX + 1 }, (_, index) => ({
        relationshipId: `rel_${index.toString(16).padStart(8, "0")}`,
        personId: mira.id,
      }));
      assert.ok(!ltmRelationshipLinksApplyRequestSchema.safeParse({ links: many }).success);

      // More places than one run reads: `after: next` reads the rest, and the name matches stay with the first batch.
      const wide = new LongTermMemoryStorage(join(dataDir, "wide"));
      await wide.initializeLtmStore();
      for (let chat = 0; chat < 14; chat += 1) {
        const scope = { chatId: `wide-${chat}`, chatIds: [`wide-${chat}`] };
        await wide.createNote(note("character", `Person ${chat}`, `Lives in ${chat}.`, scope));
        await wide.createNote(note("relationship", `Bond ${chat}`, `A bond in ${chat}.`, scope));
      }
      await wide.createNote(note("character", "Wren", "A weaver.", { chatId: "wide-0", chatIds: ["wide-0"] }));
      await wide.createNote(note("relationship", "Wren & Bond", "Close.", { chatId: "wide-0", chatIds: ["wide-0"] }));
      let seen: string[] = [];
      const readWide = (after?: string) =>
        previewLtmRelationshipLinks({
          root,
          storage: wide,
          languageModel: model as never,
          after,
          complete: async (messages) => {
            const block = messages[1]!.content.split("Relationships:\n")[1]!;
            seen.push(...block.split("\n").map((line) => line.split(" | ")[1]!));
            return '{"links":[]}';
          },
        });
      const firstBatch = await readWide();
      assert.deepEqual([typeof firstBatch.next, firstBatch.truncated], ["string", true]);
      const firstSeen = [...seen];
      assert.equal(firstBatch.suggestions.filter((suggestion) => suggestion.origin === "name").length, 1);
      const secondBatch = await readWide(firstBatch.next!);
      assert.deepEqual([secondBatch.next, secondBatch.truncated], [null, false]);
      assert.equal(secondBatch.suggestions.length, 0, "name matches are not repeated in a later batch");
      assert.equal(new Set(seen).size, 14, "each relationship the model reads is read exactly once");
      assert.equal(seen.length, 14);
      assert.equal(firstBatch.checked + secondBatch.checked, 15, "the name match plus every relationship read");
      assert.equal((await readWide("not a cursor from this check")).total, 15, "an unknown cursor does not throw");

      // Apply links relationships the first batch read: the next call still reads exactly what the first did not.
      seen = [];
      const wideNotes = await wide.listNotes({ skipInvalid: true });
      const links = firstSeen.map((title) => ({
        relationshipId: wideNotes.find((entry) => entry.title === title)!.id,
        personId: wideNotes.find((entry) => entry.title === `Person ${title.slice(5)}`)!.id,
      }));
      assert.equal(links.length, 12);
      const linked = await applyLtmRelationshipLinks({
        root,
        storage: wide,
        links,
        rebuild: async () => ({ status: "deferred" as const, error: "test" }) as never,
      });
      assert.equal(linked.linked.length, 12);
      const afterApply = await readWide(firstBatch.next!);
      assert.equal(afterApply.next, null);
      const unread = wideNotes
        .filter(
          (entry) =>
            entry.type === "relationship" && entry.title?.startsWith("Bond ") && !firstSeen.includes(entry.title),
        )
        .map((entry) => entry.title ?? "");
      assert.deepEqual(
        [...seen].sort(),
        unread.sort(),
        "after an apply, the next batch reads exactly what the first did not",
      );
      assert.equal(seen.length, 2);
    },
    [() => releaseHost(), () => rm(dataDir, { recursive: true, force: true })],
  );

  process.stdout.write(
    "Long-Term Memory links regression: names, parsing, hostile replies, failures, abort, log, apply ok\n",
  );
}

void runRegressionToCompletion("long-term-memory-links", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
