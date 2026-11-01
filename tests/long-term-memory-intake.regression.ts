import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runRegressionToCompletion, runWithSafeCleanup } from "./regression-helpers.ts";

const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";

async function main() {
  const [
    { configurePackageRuntime },
    { LongTermMemoryStorage },
    { updateLtmGlobalSettings },
    intake,
    { notePathForId },
    { listLtmPackageReaders },
  ] = await Promise.all([
    import(`${source}/package-runtime.ts`),
    import(`${source}/persistence/storage.ts`),
    import(`${source}/settings.ts`),
    import(`${source}/services/intake.ts`),
    import(`${source}/persistence/paths.ts`),
    import(`${source}/services/storage-read.ts`),
  ]);
  const { createLtmIntakeService, ltmPackageSourceNoteId } = intake;

  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-intake-"));
  const root = join(dataDir, "long-term-memory");
  let releaseRuntime: (() => void) | undefined;
  let storage: any;

  await runWithSafeCleanup(
    "LTM intake",
    async () => {
      releaseRuntime = configurePackageRuntime({
        dataDir,
        logger: { debug() {}, info() {}, warn() {}, error() {} },
        resources: {
          async listCharacters(ids?: string[]) {
            return (ids ?? [])
              .filter((id) => id !== "char-gone")
              .map((id) => ({ id, data: { name: id === "char-b" ? "Bea" : "Ada" }, comment: "" }));
          },
          async listPersonas() {
            return [];
          },
          async listLorebooks() {
            return [];
          },
        },
      } as any);
      storage = new LongTermMemoryStorage(root);
      const service = createLtmIntakeService(storage, root);
      const timestamp = "2026-10-31T00:00:00.000Z";
      await storage.createNote({
        id: "char_ada",
        title: "Ada",
        type: "character",
        status: "active",
        modes: ["roleplay", "conversation"],
        scope: { characterIds: ["char-a"] },
        tags: [],
        keywords: [],
        links: [],
        subjects: [{ key: "character:char-a", ref: { kind: "character", id: "char-a" } }],
        sections: { traits: { text: "Ada keeps a brass compass.", updatedAt: timestamp } },
      });
      const record = { caller: "slurp2", recordId: "fact:f1", characterIds: ["char-a"], text: "Ada posts at dawn." };
      const sourceId = ltmPackageSourceNoteId("slurp2", "fact:f1");
      const noteCount = async () => (await storage.listNotes()).length;
      const ada = async () => (await storage.getNote("char_ada"))!;

      // 1. The switch is off by default: nothing is written.
      assert.equal(await service.submit(record), null, "intake answers null while adding is off");
      assert.equal(await service.retract({ caller: "slurp2", recordId: "fact:f1" }), null);
      assert.equal(await noteCount(), 1, "nothing is written while adding is off");
      await updateLtmGlobalSettings({ longTermMemoryAcceptFromPackages: true }, root);

      // 2. Only a known caller, valid input and a live signal are accepted.
      assert.equal(await service.submit({ ...record, caller: "other-pkg" }), null, "an unknown caller gets null");
      assert.equal(await service.submit({ ...record, characterIds: [] }), null, "a record needs a character");
      assert.equal(await service.submit({ ...record, text: "x".repeat(1_001) }), null, "a line stays under 1,000");
      const aborted = new AbortController();
      aborted.abort();
      assert.equal(await service.submit({ ...record, signal: aborted.signal }), null, "an aborted call gets null");
      assert.equal(await noteCount(), 1);

      // 3. A record becomes one source-owned line in the character's own memory.
      assert.deepEqual(await service.submit(record), { version: 1, status: "applied" });
      const addedBy = async () =>
        (await listLtmPackageReaders(root)).find((reader: any) => reader.caller === "slurp2")?.added;
      assert.deepEqual(
        (await listLtmPackageReaders(root)).find((reader: any) => reader.caller === "slurp2"),
        { caller: "slurp2", lastReadAt: null, reads: 0, memories: 0, added: 1 },
        "an applied record must show as one added memory for its caller, with no reads",
      );
      const sourceNote = await storage.getNote(sourceId);
      assert.deepEqual(sourceNote?.provenance, { kind: "package_record", sourceId: "slurp2:fact:f1" });
      assert.deepEqual(sourceNote?.scope, { characterIds: ["char-a"] });
      const section = (await ada()).sections.from_slurp2;
      assert.equal(section?.text, "Ada posts at dawn.");
      assert.deepEqual(
        section?.contributions?.map((item: any) => [item.owner, item.sourceNoteId]),
        [["source", sourceId]],
        "the line is owned by the record's source note",
      );
      assert.equal((await ada()).sections.traits.text, "Ada keeps a brass compass.", "other sections stay");

      // 4. The same record again changes nothing; new text replaces the line.
      const count = await noteCount();
      assert.deepEqual(await service.submit(record), { version: 1, status: "unchanged" });
      assert.equal(await noteCount(), count);
      assert.equal(await addedBy(), 1, "an unchanged record must not count as added");
      assert.deepEqual(await service.submit({ ...record, text: "Ada posts at dusk." }), {
        version: 1,
        status: "applied",
      });
      assert.equal(await addedBy(), 2, "a replaced line counts as added again");
      assert.equal((await ada()).sections.from_slurp2?.text, "Ada posts at dusk.", "new text replaces the line");
      assert.equal((await ada()).sections.from_slurp2?.contributions?.length, 1, "still one line from the record");
      assert.equal(await noteCount(), count);

      // 5. Retract removes the line and keeps the memory's other sections.
      assert.deepEqual(await service.retract({ caller: "slurp2", recordId: "fact:f1" }), {
        version: 1,
        status: "retracted",
      });
      assert.equal((await ada()).sections.from_slurp2, undefined, "the line is gone");
      assert.equal((await ada()).sections.traits.text, "Ada keeps a brass compass.");
      assert.equal(
        (await ada()).links.some((link: any) => link.target === sourceId),
        false,
        "and so is the link to its source",
      );
      assert.equal(await storage.getNote(sourceId), null, "the source note is deleted");
      assert.deepEqual(await service.retract({ caller: "slurp2", recordId: "fact:f1" }), {
        version: 1,
        status: "missing",
      });

      // 6. Two characters: the line goes on both, a new memory for the one without its own.
      const pair = {
        caller: "slurp2",
        recordId: "bond:b1",
        characterIds: ["char-a", "char-b"],
        text: "Ada and Bea share a flat.",
      };
      assert.deepEqual(await service.submit(pair), { version: 1, status: "applied" });
      assert.equal(await addedBy(), 4, "a record for two characters adds two memories; a retract adds none");
      assert.equal((await ada()).sections.from_slurp2?.text, "Ada and Bea share a flat.");
      const bea = (await storage.listNotes({ type: "character" })).find((note: any) =>
        note.subjects?.some((subject: any) => subject.ref?.id === "char-b"),
      );
      assert.ok(bea?.id.startsWith("char_slurp2_"), "a character without a memory gets one");
      assert.equal(bea.title, "Bea", "named from the host's character");
      assert.deepEqual(bea.scope, { characterIds: ["char-b"] }, "and it belongs to that character alone");
      assert.equal(bea.sections.from_slurp2?.text, "Ada and Bea share a flat.");
      await service.retract({ caller: "slurp2", recordId: "bond:b1" });
      assert.equal(await storage.getNote(bea.id), null, "a memory left empty is deleted with its source");
      assert.deepEqual(Object.keys((await ada()).sections), ["traits"]);

      // 7. A character the host does not have is refused; line breaks become spaces.
      assert.equal(await service.submit({ ...record, characterIds: ["char-a", "char-gone"] }), null);
      assert.equal(await storage.getNote(sourceId), null, "a refused record writes nothing");
      await service.submit({ ...record, text: "Ada posts\n  at dawn." });
      assert.equal((await ada()).sections.from_slurp2?.text, "Ada posts at dawn.", "a record is one line");

      // 8. A retract that cannot finish changes nothing.
      const broken = notePathForId("char_broken", "character", root);
      await mkdir(dirname(broken), { recursive: true });
      await writeFile(broken, "{", "utf8");
      await assert.rejects(service.retract({ caller: "slurp2", recordId: "fact:f1" }));
      assert.equal((await ada()).sections.from_slurp2?.text, "Ada posts at dawn.", "the line stays when retract fails");
      assert.ok(await storage.getNote(sourceId), "and so does its source");
      await rm(broken);
      assert.equal((await service.retract({ caller: "slurp2", recordId: "fact:f1" }))?.status, "retracted");

      // 9. A memory intake made and the user archived is left alone.
      await service.submit({ caller: "slurp2", recordId: "fact:b1", characterIds: ["char-b"], text: "Bea sings." });
      const madeForBea = (await storage.listNotes({ type: "character" })).find((note: any) =>
        note.id.startsWith("char_slurp2_"),
      );
      await storage.updateNote(madeForBea.id, { status: "archived" });
      const later = { caller: "slurp2", recordId: "fact:b2", characterIds: ["char-b"], text: "Bea hums." };
      assert.equal(await service.submit(later), null, "nothing goes into the archived memory");
      assert.equal(await storage.getNote(ltmPackageSourceNoteId("slurp2", "fact:b2")), null);
      assert.equal((await storage.getNote(madeForBea.id)).sections.from_slurp2?.text, "Bea sings.");

      // 10. Replacing a record whose memory the user archived or narrowed changes nothing; that memory is not
      // deleted and recreated active.
      const replaced = { caller: "slurp2", recordId: "fact:b1", characterIds: ["char-b"], text: "Bea whistles." };
      assert.equal(await service.submit(replaced), null, "a replacement into an archived memory is refused");
      assert.equal((await storage.getNote(madeForBea.id)).status, "archived", "and the memory stays archived");
      assert.equal((await storage.getNote(madeForBea.id)).sections.from_slurp2?.text, "Bea sings.");
      assert.equal(
        (await storage.getNote(ltmPackageSourceNoteId("slurp2", "fact:b1")))?.sections.source?.text,
        "Bea sings.",
      );
      await storage.updateNote(madeForBea.id, { status: "active", modes: ["roleplay"] });
      assert.equal(await service.submit(replaced), null, "a replacement into a narrowed memory is refused");
      assert.deepEqual((await storage.getNote(madeForBea.id)).modes, ["roleplay"], "and the memory is not widened");
      assert.equal((await storage.getNote(madeForBea.id)).sections.from_slurp2?.text, "Bea sings.");

      // 11. A line goes only on a memory recall serves in both modes; a game-only memory is left alone.
      await storage.createNote({
        id: "char_cy_game",
        title: "Cy",
        type: "character",
        status: "active",
        modes: ["game"],
        scope: { characterIds: ["char-c"] },
        tags: [],
        keywords: [],
        links: [],
        subjects: [{ key: "character:char-c", ref: { kind: "character", id: "char-c" } }],
        sections: { traits: { text: "Cy plays alone.", updatedAt: timestamp } },
      });
      assert.deepEqual(
        await service.submit({ caller: "slurp2", recordId: "fact:c1", characterIds: ["char-c"], text: "Cy waves." }),
        { version: 1, status: "applied" },
      );
      assert.equal(
        (await storage.getNote("char_cy_game")).sections.from_slurp2,
        undefined,
        "the game-only memory stays",
      );
      const madeForCy = (await storage.listNotes({ type: "character" })).find(
        (note: any) => note.id.startsWith("char_slurp2_") && note.scope.characterIds?.[0] === "char-c",
      );
      assert.equal(madeForCy?.sections.from_slurp2?.text, "Cy waves.", "the line gets a memory of its own");
      assert.deepEqual(madeForCy.modes, ["roleplay", "conversation"]);

      // 12. A source left behind by a failed apply is rewritten, not reported unchanged.
      const orphanId = ltmPackageSourceNoteId("slurp2", "fact:o1");
      await storage.createNote({
        id: orphanId,
        type: "source",
        status: "active",
        modes: ["roleplay", "conversation"],
        scope: { characterIds: ["char-a"] },
        tags: ["package_record"],
        keywords: [],
        links: [],
        provenance: { kind: "package_record", sourceId: "slurp2:fact:o1" },
        sections: { source: { text: "Ada waves.", updatedAt: timestamp } },
      });
      const orphan = { caller: "slurp2", recordId: "fact:o1", characterIds: ["char-a"], text: "Ada waves." };
      assert.deepEqual(await service.submit(orphan), { version: 1, status: "applied" });
      assert.equal((await ada()).sections.from_slurp2?.text, "Ada waves.", "the orphan's line is written");
      assert.deepEqual(await service.submit(orphan), { version: 1, status: "unchanged" }, "and then it is unchanged");

      // 13. Replacing a two-character record keeps the archived character's memory exactly as it is, old line included.
      const duo = { caller: "slurp2", recordId: "bond:d1", characterIds: ["char-a", "char-d"], text: "Ada knows Dee." };
      const duoSourceId = ltmPackageSourceNoteId("slurp2", "bond:d1");
      assert.deepEqual(await service.submit(duo), { version: 1, status: "applied" });
      const madeForDee = (await storage.listNotes({ type: "character" })).find(
        (note: any) => note.id.startsWith("char_slurp2_") && note.scope.characterIds?.[0] === "char-d",
      );
      assert.equal(madeForDee?.sections.from_slurp2?.text, "Ada knows Dee.");
      await storage.updateNote(madeForDee.id, { status: "archived" });
      assert.deepEqual(await service.submit({ ...duo, text: "Ada meets Dee." }), { version: 1, status: "applied" });
      const keptDee = await storage.getNote(madeForDee.id);
      assert.equal(keptDee?.status, "archived", "the archived memory still exists and stays archived");
      assert.equal(keptDee.sections.from_slurp2?.text, "Ada knows Dee.", "and keeps its old line");
      assert.equal(
        keptDee.links.some((link: any) => link.target === duoSourceId),
        false,
        "only its link to the replaced source is gone",
      );
      const adaLines = (await ada()).sections.from_slurp2?.text ?? "";
      assert.ok(
        adaLines.includes("Ada meets Dee.") && !adaLines.includes("Ada knows Dee."),
        "the other gets the new line",
      );
      assert.equal(
        await service.submit({ caller: "slurp2", recordId: "fact:d2", characterIds: ["char-d"], text: "Dee naps." }),
        null,
        "a new record naming the archived character is skipped",
      );
      assert.equal((await storage.getNote(madeForDee.id)).sections.from_slurp2?.text, "Ada knows Dee.");
    },
    [() => storage?.cleanup(), () => releaseRuntime?.(), () => rm(dataDir, { recursive: true, force: true })],
  );
  process.stdout.write(
    "Long-Term Memory intake regression: off by default, caller and input checks, apply, unchanged and replace, retract, two characters, unknown characters, failed retract, archived memories, replaced archived memories, game-only memories and orphaned sources ok\n",
  );
}

void runRegressionToCompletion("long-term-memory-intake", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
