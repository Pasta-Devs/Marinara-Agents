import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion } from "./regression-helpers.ts";

// Issue #1085: bounded, deterministic post-extraction reconciliation for the
// non-character streams that currently derive their target from the model-chosen
// subjectId. Character/relationship resolution stays in subject-identity.ts.
async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { reconcileEvidenceUnitCandidates } = await import(`${source}/candidate-reconciliation.ts`);
  const { compileEvidenceUnitExtraction } = await import(`${source}/evidence-unit-extraction.ts`);
  const { sourceHashForLtmSourceNote } = await import(`${source}/source-hash.ts`);
  const { chunkNotes } = await import(`${source}/chunking.ts`);
  const { buildLtmMetadataIndex } = await import(`${source}/metadata-index.ts`);
  const { buildLtmBm25Index } = await import(`${source}/bm25.ts`);
  const { buildLtmKeywordIndex } = await import(`${source}/keyword-index.ts`);
  const { buildLtmGraphIndex } = await import(`${source}/graph.ts`);
  const { configurePackageRuntime, logger } = await import(`${source}/package-runtime.ts`);

  const timestamp = "2026-07-21T00:00:00.000Z";
  const scopeA = { chatId: "chat-a", chatIds: ["chat-a"] };
  const scopeB = { chatId: "chat-b", chatIds: ["chat-b"] };
  const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-reconcile-"));
  const releaseHost = configurePackageRuntime({ dataDir, logger });
  const root = join(dataDir, "long-term-memory");

  const note = (input: {
    id: string;
    type: string;
    title: string;
    text: string;
    scope?: Record<string, unknown>;
    sectionKey?: string;
    keywords?: string[];
    links?: Array<{ target: string; relation: string }>;
    tags?: string[];
  }) => ({
    id: input.id,
    title: input.title,
    type: input.type,
    status: "active",
    modes: ["roleplay"],
    scope: input.scope ?? scopeA,
    tags: input.tags ?? [],
    keywords: input.keywords ?? [],
    links: input.links ?? [],
    sections: { [input.sectionKey ?? "facts"]: { text: input.text, updatedAt: timestamp } },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  });

  const sourceNote = note({
    id: "source_session_1",
    type: "source",
    title: "Session 1",
    text: "The party reached the observatory and spoke of the cobalt archive.",
    tags: ["source_summary"],
  });
  const notes = [
    sourceNote,
    note({
      id: "world_cobalt_archive",
      type: "world",
      title: "Cobalt Archive",
      keywords: ["cobalt archive"],
      text: "The cobalt archive vault key is buried below the observatory floorboards.",
    }),
    note({
      id: "world_obsidian_gate",
      type: "world",
      title: "Obsidian Gate",
      text: "The obsidian gate opens only to the moonlit oath.",
    }),
    note({
      id: "thread_lost_caravan",
      type: "thread",
      title: "Lost Caravan",
      text: "The lost caravan still has not reached the northern pass.",
    }),
    note({
      id: "timeline_damo_arrival",
      type: "timeline_event",
      title: "Damo Arrival",
      sectionKey: "event",
      text: "Damo arrived at the northern gate before dusk.",
      links: [{ target: sourceNote.id, relation: "extracted_from" }],
    }),
    note({
      id: "world_hidden_ledger",
      type: "world",
      title: "Hidden Ledger",
      scope: scopeB,
      keywords: ["hidden ledger"],
      text: "The hidden ledger belongs to the eastern guild.",
    }),
    note({
      id: "world_twin_moons_a",
      type: "world",
      title: "Twin Moons Prophecy",
      keywords: ["twin moons prophecy"],
      text: "The first twin moons prophecy names a silver crown.",
    }),
    note({
      id: "world_twin_moons_b",
      type: "world",
      title: "Twin Moons Prophecy",
      keywords: ["twin moons prophecy"],
      text: "The second twin moons prophecy names a broken throne.",
    }),
    note({
      id: "scene_mirror_hall",
      type: "scene",
      title: "Mirror Hall",
      text: "The mirror hall reflects every spoken promise.",
    }),
    note({
      id: "location_deep_archive",
      type: "world",
      title: "Deep Archive",
      text: "The deep archive holds the drowned map.",
    }),
    note({
      id: "world_echo_pair_a",
      type: "world",
      title: "Echo Pair",
      text: "The echo pair repeats the same vow.",
    }),
    note({
      id: "world_echo_pair_b",
      type: "world",
      title: "Echo Pair",
      text: "The echo pair repeats the same vow.",
    }),
  ];
  const notesById = new Map(notes.map((item) => [item.id, item]));

  const buildIndex = (corpus: typeof notes) => {
    const chunks = chunkNotes(corpus as never, { includeSourceNotes: false, stopWords: [] });
    return {
      version: 1 as const,
      generatedAt: timestamp,
      sourceHash: "0".repeat(64),
      metadata: buildLtmMetadataIndex(chunks),
      bm25: buildLtmBm25Index(chunks),
      graph: buildLtmGraphIndex(corpus as never, chunks),
      keywords: buildLtmKeywordIndex(chunks),
      embeddings: { version: 1 as const, model: "unavailable", dimension: null, embeddedChunkCount: 0, chunks: [] },
    };
  };
  const index = buildIndex(notes);
  const storage = {
    getNotesByIds: async (ids: string[]) =>
      new Map(ids.filter((id) => notesById.has(id)).map((id) => [id, notesById.get(id)!])),
  };

  const unit = (input: {
    bucket: string;
    subjectId: string;
    sectionKey: string;
    text: string;
    title?: string;
    claimKind?: string;
    links?: Array<{ target: string; relation: string }>;
    keywords?: string[];
    subjectNames?: string[];
  }) => ({
    id: randomUUID(),
    bucket: input.bucket,
    subjectId: input.subjectId,
    sectionKey: input.sectionKey,
    ...(input.title ? { title: input.title } : {}),
    text: input.text,
    claimKind: input.claimKind ?? "static",
    importance: "major",
    keywords: input.keywords ?? [],
    evidence: [`source_note:${sourceNote.id}`],
    confidence: 0.95,
    salience: 0.8,
    status: "active",
    links: input.links ?? [],
    sourceHash: sourceHashForLtmSourceNote(sourceNote as never),
    ...(input.subjectNames ? { subjectNames: input.subjectNames } : {}),
  });

  const reconcile = (units: unknown[], overrides: Record<string, unknown> = {}) =>
    reconcileEvidenceUnitCandidates({
      units: units as never,
      root,
      scope: scopeA,
      mode: "roleplay",
      storage,
      index,
      ...overrides,
    });

  try {
    // The exact derived id is owned downstream by scoped-targets; this pass must not claim it.
    {
      const result = await reconcile([
        unit({
          bucket: "world_fact",
          subjectId: "cobalt_archive",
          sectionKey: "facts",
          text: "The cobalt archive vault key is buried below the observatory floorboards.",
        }),
      ]);
      assert.equal(result.remaps.size, 0, "an exact derived id must be left to scoped-targets");
    }

    // Identity match: the model invents a different subjectId but names the same subject.
    {
      const result = await reconcile([
        unit({
          bucket: "world_fact",
          subjectId: "cobalt_vault",
          sectionKey: "facts",
          title: "Cobalt Archive",
          text: "An unrelated sentence about the observatory floorboards.",
        }),
      ]);
      assert.equal(
        result.remaps.get("world_cobalt_vault"),
        "world_cobalt_archive",
        "an identity match must reuse the existing note id",
      );
      assert.deepEqual(result.matches, [{ derivedNoteId: "world_cobalt_vault", noteId: "world_cobalt_archive" }]);
    }

    // Content match: no usable identity, but the indexed section text is the same claim.
    {
      const result = await reconcile([
        unit({
          bucket: "world_fact",
          subjectId: "obsidian_gate_rule",
          sectionKey: "facts",
          text: "The obsidian gate opens only to the moonlit oath.",
        }),
      ]);
      assert.equal(
        result.remaps.get("world_obsidian_gate_rule"),
        "world_obsidian_gate",
        "a content match must reuse the existing note id",
      );
    }

    // No compatible target is a likely create with no diagnostic.
    {
      const result = await reconcile([
        unit({
          bucket: "world_fact",
          subjectId: "silver_moon_ritual",
          sectionKey: "facts",
          title: "Silver Moon Ritual",
          text: "The silver moon ritual requires three uncut garnets.",
        }),
      ]);
      assert.equal(result.remaps.size, 0, "a genuinely new candidate must create");
      assert.equal(result.diagnostics.length, 0, "a single create is not ambiguous");
    }

    // Same subject reaching two existing notes stays unattached and warns.
    {
      const result = await reconcile([
        unit({
          bucket: "world_fact",
          subjectId: "twin_moons",
          sectionKey: "facts",
          title: "Twin Moons Prophecy",
          text: "Twin moons prophecy is being studied.",
        }),
      ]);
      assert.equal(result.remaps.size, 0, "an ambiguous candidate must not attach silently");
      const diagnostic = result.diagnostics.find(
        (candidate) => candidate.code === "candidate_reconciliation_ambiguous",
      );
      assert.ok(diagnostic, "an ambiguous candidate must warn");
      assert.deepEqual(diagnostic!.details?.candidateTargetNoteIds, ["world_twin_moons_a", "world_twin_moons_b"]);
    }

    // Scope-incompatible notes are never selected.
    {
      const result = await reconcile([
        unit({
          bucket: "world_fact",
          subjectId: "hidden_ledger",
          sectionKey: "facts",
          title: "Hidden Ledger",
          text: "The hidden ledger belongs to the eastern guild.",
        }),
      ]);
      assert.equal(result.remaps.size, 0, "a note from another scope must not be reused");
      assert.equal(result.diagnostics.length, 0, "a scope-excluded note is not an ambiguity");
    }

    // Scene/source notes are excluded even when their text matches.
    {
      const result = await reconcile([
        unit({
          bucket: "world_fact",
          subjectId: "mirror_hall",
          sectionKey: "facts",
          title: "Mirror Hall",
          text: "The mirror hall reflects every spoken promise.",
        }),
      ]);
      assert.equal(result.remaps.size, 0, "scene/source notes must never be reconciliation targets");
    }

    // Target and same-response links are remapped together, keeping event closure intact.
    {
      const result = await reconcile([
        unit({
          bucket: "timeline_event",
          subjectId: "damo_gate_arrival",
          sectionKey: "event",
          title: "Damo Arrival",
          text: "Damo arrived at the northern gate before dusk.",
          links: [{ target: sourceNote.id, relation: "extracted_from" }],
        }),
        unit({
          bucket: "world_fact",
          subjectId: "gate_witness",
          sectionKey: "facts",
          text: "The northern gate was opened for Damo.",
          links: [{ target: "timeline_damo_gate_arrival", relation: "evidenced_by" }],
        }),
      ]);
      assert.equal(result.remaps.get("timeline_damo_gate_arrival"), "timeline_damo_arrival");
      const dependent = result.units.find((candidate) => candidate.subjectId === "gate_witness");
      assert.deepEqual(
        dependent!.links.map((link) => link.target),
        ["timeline_damo_arrival"],
        "links to a remapped candidate must follow the resolved note id",
      );
    }

    // Character/relationship candidates stay with their existing resolver.
    {
      const result = await reconcile([
        unit({
          bucket: "character_fact",
          subjectId: "cobalt_vault",
          sectionKey: "facts",
          title: "Cobalt Archive",
          text: "An unrelated sentence about the observatory floorboards.",
        }),
      ]);
      assert.equal(result.remaps.size, 0, "character candidates are owned by subject-identity.ts");
    }

    // Mutation compilation keeps the reconciled note and creates only the new one.
    {
      const result = await reconcile([
        unit({
          bucket: "world_fact",
          subjectId: "cobalt_vault",
          sectionKey: "facts",
          title: "Cobalt Archive",
          text: "An unrelated sentence about the observatory floorboards.",
        }),
        unit({
          bucket: "world_fact",
          subjectId: "silver_moon_ritual",
          sectionKey: "facts",
          title: "Silver Moon Ritual",
          text: "The silver moon ritual requires three uncut garnets.",
        }),
      ]);
      const compiled = compileEvidenceUnitExtraction({
        unitResponse: { summary: "", units: result.units },
        sourceText: sourceNote.sections.facts.text,
        sourceNote: sourceNote as never,
        existingNotes: notes as never,
        scope: scopeA,
        modes: ["roleplay"],
        mode: "roleplay",
        sourceHash: sourceHashForLtmSourceNote(sourceNote as never),
        allowedBuckets: ["world_fact"],
        skipStructuredBackfill: true,
      });
      const mutations = compiled.compiledResponse.mutations;
      assert.equal(
        mutations.some((mutation) => mutation.kind === "create_note" && mutation.note.id === "world_cobalt_archive"),
        false,
        "a reconciled candidate must not create a duplicate note",
      );
      assert.ok(
        mutations.some(
          (mutation) =>
            (mutation.kind === "append_section" || mutation.kind === "update_section") &&
            mutation.noteId === "world_cobalt_archive",
        ),
        "a reconciled candidate must update the existing note",
      );
      assert.ok(
        mutations.some(
          (mutation) => mutation.kind === "create_note" && mutation.note.id === "world_silver_moon_ritual",
        ),
        "a genuinely new candidate must still create",
      );
    }

    // Boundedness: a crowded identity yields a bounded, sorted candidate list.
    {
      const crowded = [
        note({
          id: "world_echo_chamber",
          type: "world",
          title: "Echo Chamber",
          keywords: ["echo chamber"],
          text: "The echo chamber repeats the first spoken word.",
        }),
        ...Array.from({ length: 11 }, (_, index) =>
          note({
            id: `world_echo_chamber_${index + 2}`,
            type: "world",
            title: "Echo Chamber",
            keywords: ["echo chamber"],
            text: `The echo chamber variant ${index + 2} repeats a different word.`,
          }),
        ),
      ];
      const crowdedById = new Map(crowded.map((item) => [item.id, item]));
      const result = await reconcile(
        [
          unit({
            bucket: "world_fact",
            subjectId: "echo_chamber",
            sectionKey: "facts",
            title: "Echo Chamber",
            text: "The echo chamber is being studied again.",
          }),
        ],
        {
          index: buildIndex(crowded),
          storage: {
            getNotesByIds: async (ids: string[]) =>
              new Map(ids.filter((id) => crowdedById.has(id)).map((id) => [id, crowdedById.get(id)!])),
          },
        },
      );
      assert.equal(result.remaps.size, 0, "a crowded identity must not attach silently");
      const diagnostic = result.diagnostics.find(
        (candidate) => candidate.code === "candidate_reconciliation_ambiguous",
      );
      const candidateIds = diagnostic?.details?.candidateTargetNoteIds as string[] | undefined;
      assert.ok(
        candidateIds && candidateIds.length > 1 && candidateIds.length <= 8,
        "the candidate list must stay bounded",
      );
      assert.deepEqual(
        candidateIds,
        [...candidateIds].sort((left, right) => left.localeCompare(right)),
      );
    }

    // Determinism: identical inputs produce identical decisions.
    {
      const makeUnits = () => [
        unit({
          bucket: "world_fact",
          subjectId: "cobalt_vault",
          sectionKey: "facts",
          title: "Cobalt Archive",
          text: "An unrelated sentence about the observatory floorboards.",
        }),
      ];
      const first = await reconcile(makeUnits());
      const second = await reconcile(makeUnits());
      assert.deepEqual(Object.fromEntries(first.remaps), Object.fromEntries(second.remaps));
      assert.deepEqual(first.diagnostics, second.diagnostics);
    }

    // A legacy world id this unit cannot derive must not be remapped, or the match compiles
    // against a different new note.
    {
      const result = await reconcile([
        unit({
          bucket: "world_fact",
          subjectId: "deep_archive",
          sectionKey: "facts",
          title: "Deep Archive",
          text: "The deep archive holds the drowned map.",
        }),
      ]);
      assert.equal(result.remaps.size, 0, "a legacy-prefixed world note is not a reachable target");
      assert.equal(result.matches.length, 0, "an unreachable match must not be recorded");
    }

    // Two notes with identical text are a genuine ambiguity, not a silent reuse.
    {
      const result = await reconcile([
        unit({
          bucket: "world_fact",
          subjectId: "echo_pair",
          sectionKey: "facts",
          title: "Echo Pair",
          text: "The echo pair repeats the same vow.",
        }),
      ]);
      assert.equal(result.remaps.size, 0, "exact-text duplicates must not attach silently");
      const diagnostic = result.diagnostics.find(
        (candidate) => candidate.code === "candidate_reconciliation_ambiguous",
      );
      assert.ok(diagnostic, "exact-text duplicates must warn");
      assert.deepEqual(diagnostic!.details?.candidateTargetNoteIds, ["world_echo_pair_a", "world_echo_pair_b"]);
    }

    // Unrelated note types must not crowd the bounded window and hide the compatible target.
    {
      const distractors = Array.from({ length: 11 }, (_, index) =>
        note({
          id: `char_distractor_${index + 1}`,
          type: "character",
          title: `Distractor ${index + 1}`,
          text: "The cobalt archive vault key is buried below the observatory floorboards.",
        }),
      );
      const target = note({
        id: "world_cobalt_archive_twin",
        type: "world",
        title: "Cobalt Archive Duplicate",
        text: "The cobalt archive vault key is buried below the observatory floorboards.",
      });
      const corpus = [target, ...distractors];
      const corpusById = new Map(corpus.map((item) => [item.id, item]));
      const result = await reconcile(
        [
          unit({
            bucket: "world_fact",
            subjectId: "cobalt_vault",
            sectionKey: "facts",
            title: "Cobalt Archive",
            text: "The cobalt archive vault key is buried below the observatory floorboards.",
          }),
        ],
        {
          index: buildIndex(corpus),
          storage: {
            getNotesByIds: async (ids: string[]) =>
              new Map(ids.filter((id) => corpusById.has(id)).map((id) => [id, corpusById.get(id)!])),
          },
        },
      );
      assert.equal(
        result.remaps.get("world_cobalt_vault"),
        "world_cobalt_archive_twin",
        "unrelated types must not crowd out the compatible target",
      );
    }

    process.stdout.write(
      "Long-Term Memory candidate reconciliation regression: bounded reuse, create, ambiguity, scope, link closure, mutation kinds ok\n",
    );
  } finally {
    releaseHost();
    await rm(dataDir, { recursive: true, force: true });
  }
}

void runRegressionToCompletion("long-term-memory-candidate-reconciliation", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
