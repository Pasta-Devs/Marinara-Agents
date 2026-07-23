import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const source =
    "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { compileEvidenceUnitExtraction, parseEvidenceUnitPayload } =
    await import(`${source}/evidence-unit-extraction.ts`);
  const { compileLtmEvidenceUnits } = await import(
    `${source}/evidence-unit-compiler.ts`
  );
  const { deduplicateUnits } = await import(`${source}/dedup.ts`);
  const { subjectsEqual } = await import(`${source}/subject-identity.ts`);
  const { projectLtmDraftMutationGroup } = await import(
    `${source}/draft-projector.ts`
  );
  const { sourceHashForLtmSourceNote } = await import(
    `${source}/source-hash.ts`
  );

  const timestamp = "2026-07-21T00:00:00.000Z";
  const sourceNote = (
    id: string,
    provenance: {
      kind: "chat_summary" | "lorebook";
      sourceId: string;
      entryId: string;
    },
    text: string,
  ) => ({
    id,
    title: id,
    type: "source" as const,
    status: "active" as const,
    modes: ["roleplay" as const],
    scope: {},
    tags: ["source_summary"],
    keywords: [],
    links: [],
    provenance,
    sections: { source: { text, updatedAt: timestamp } },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  });
  const unit = (
    note: ReturnType<typeof sourceNote>,
    input: {
      bucket:
        | "timeline_event"
        | "character_fact"
        | "relationship_state"
        | "world_fact";
      subjectId: string;
      sectionKey: string;
      text: string;
      claimKind?: "static" | "change";
      links?: Array<{
        target: string;
        relation: "extracted_from" | "evidenced_by" | "caused_by";
      }>;
      subjectNames?: string[];
      dimensionChanges?: Record<string, number>;
    },
  ) => ({
    id: randomUUID(),
    ...input,
    importance: "major" as const,
    keywords: [],
    evidence: [`source_note:${note.id}`],
    confidence: 0.9,
    salience: 0.8,
    status: "active" as const,
    links: input.links ?? [],
    sourceHash: sourceHashForLtmSourceNote(note),
  });
  const compile = (
    note: ReturnType<typeof sourceNote>,
    units: ReturnType<typeof unit>[],
    skipStructuredBackfill = true,
  ) =>
    compileEvidenceUnitExtraction({
      unitResponse: { summary: "Extraction graph regression", units },
      providerCandidates: units.length,
      sourceText: note.sections.source.text,
      sourceNote: note,
      existingNotes: [],
      scope: {},
      modes: ["roleplay"],
      mode: "roleplay",
      sourceHash: sourceHashForLtmSourceNote(note),
      skipStructuredBackfill,
    });

  const chat = sourceNote(
    "source_chat_graph_regression",
    { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-a" },
    "Mara learned the observatory script. Alice and Rowan trusted each other less after the argument.",
  );

  const linklessCharacter = compile(chat, [
    unit(chat, {
      bucket: "character_fact",
      subjectId: "mara",
      sectionKey: "abilities",
      text: "Mara can read the observatory script.",
      claimKind: "static",
      subjectNames: ["Mara"],
    }),
  ]);
  assert.equal(linklessCharacter.accounting.keptUnits, 1);
  assert.equal(linklessCharacter.compiledResponse.mutations.length, 1);
  assert.equal(
    linklessCharacter.compiledResponse.mutations[0]?.claimKind,
    "static",
  );

  const relationshipWithoutCause = compile(chat, [
    unit(chat, {
      bucket: "relationship_state",
      subjectId: "alice_rowan",
      sectionKey: "state",
      text: "Alice and Rowan's trust became strained after the argument.",
      claimKind: "change",
      subjectNames: ["Alice", "Rowan"],
      dimensionChanges: { trust: -12 },
    }),
  ]);
  assert.equal(relationshipWithoutCause.accounting.keptUnits, 0);
  assert.equal(
    relationshipWithoutCause.outcome.droppedCandidates.some((candidate) =>
      candidate.message.includes("missing a caused_by link"),
    ),
    true,
  );

  const relationshipWithMissingCause = compile(chat, [
    unit(chat, {
      bucket: "relationship_state",
      subjectId: "alice_rowan",
      sectionKey: "state",
      text: "Alice and Rowan's trust became strained after the argument.",
      claimKind: "change",
      subjectNames: ["Alice", "Rowan"],
      dimensionChanges: { trust: -12 },
      links: [{ target: "timeline_missing_argument", relation: "caused_by" }],
    }),
  ]);
  assert.equal(relationshipWithMissingCause.accounting.keptUnits, 0);
  assert.equal(
    relationshipWithMissingCause.outcome.droppedCandidates.some((candidate) =>
      candidate.message.includes("does not exist"),
    ),
    true,
  );

  const relationshipWithEvent = compile(chat, [
    unit(chat, {
      bucket: "timeline_event",
      subjectId: "argument_strained_trust",
      sectionKey: "event",
      text: "Alice and Rowan argued, straining their trust.",
      links: [{ target: chat.id, relation: "extracted_from" }],
    }),
    unit(chat, {
      bucket: "relationship_state",
      subjectId: "alice_rowan",
      sectionKey: "state",
      text: "Alice and Rowan's trust became strained after the argument.",
      claimKind: "change",
      subjectNames: ["Alice", "Rowan"],
      dimensionChanges: { trust: -12 },
      links: [
        { target: "timeline_argument_strained_trust", relation: "caused_by" },
      ],
    }),
  ]);
  assert.equal(relationshipWithEvent.accounting.keptUnits, 2);
  assert.equal(relationshipWithEvent.compiledResponse.mutations.length, 2);

  const evidenceCharacter = {
    id: "char_mara",
    title: "Mara",
    type: "character" as const,
    status: "active" as const,
    modes: ["roleplay" as const],
    scope: {},
    tags: [],
    keywords: [],
    links: [],
    sections: {
      abilities: {
        text: "Mara reads old scripts.",
        updatedAt: timestamp,
        evidence: Array.from({ length: 20 }, (_, index) => `old:${index}`),
      },
    },
  };
  const currentEvidence = compileLtmEvidenceUnits({
    units: [
      unit(chat, {
        bucket: "character_fact",
        subjectId: "mara",
        sectionKey: "abilities",
        text: "Mara learned the observatory script.",
        subjectNames: ["Mara"],
      }),
    ],
    existingNotes: [evidenceCharacter],
    scope: {},
    modes: ["roleplay"],
  });
  assert.equal(currentEvidence.mutations[0]?.kind, "append_section");
  assert.deepEqual(currentEvidence.mutations[0]?.evidence, [
    `source_note:${chat.id}`,
  ]);

  const invalidEventWithDependent = compile(chat, [
    unit(chat, {
      bucket: "timeline_event",
      subjectId: "invalid_argument",
      sectionKey: "history",
      text: "Alice and Rowan argued.",
    }),
    unit(chat, {
      bucket: "world_fact",
      subjectId: "argument_aftermath",
      sectionKey: "facts",
      text: "The argument remained consequential.",
      claimKind: "change",
      links: [
        { target: "timeline_invalid_argument", relation: "evidenced_by" },
      ],
    }),
  ]);
  assert.equal(invalidEventWithDependent.accounting.keptUnits, 0);
  assert.equal(
    invalidEventWithDependent.outcome.droppedCandidates.length,
    2,
    "removing an invalid event must also orphan its dependent memory",
  );

  const invalidEventWithStaticFact = compile(chat, [
    unit(chat, {
      bucket: "timeline_event",
      subjectId: "invalid_static_argument",
      sectionKey: "history",
      text: "Alice and Rowan argued.",
    }),
    unit(chat, {
      bucket: "world_fact",
      subjectId: "observatory",
      sectionKey: "facts",
      text: "The observatory has a brass gate.",
      claimKind: "static",
    }),
  ]);
  assert.equal(invalidEventWithStaticFact.accounting.keptUnits, 1);
  assert.equal(
    invalidEventWithStaticFact.compiledResponse.mutations[0]?.claimKind,
    "static",
  );
  assert.equal(
    invalidEventWithDependent.diagnostics.some(
      (diagnostic) =>
        diagnostic.details?.validatorCode === "unknown_link_target" &&
        diagnostic.details?.validationStage === "closure",
    ),
    true,
  );

  const lore = sourceNote(
    "source_lore_graph_regression",
    { kind: "lorebook", sourceId: "lore-a", entryId: "entry-a" },
    "The observatory script can be read by Mara.",
  );
  const repairedLoreCharacter = compile(
    lore,
    [
      unit(lore, {
        bucket: "character_fact",
        subjectId: "mara",
        sectionKey: "abilities",
        text: "Mara can read the observatory script.",
        claimKind: "static",
        subjectNames: ["Mara"],
      }),
    ],
    false,
  );
  assert.equal(repairedLoreCharacter.accounting.keptUnits, 1);
  assert.equal(
    repairedLoreCharacter.compiledResponse.mutations.some(
      (mutation) =>
        mutation.kind === "create_note" &&
        mutation.note.type === "timeline_event",
    ),
    false,
    "static lore must not synthesize a timeline event",
  );
  assert.equal(
    repairedLoreCharacter.compiledResponse.mutations.some(
      (mutation) =>
        mutation.kind === "create_note" && mutation.note.type === "character",
    ),
    true,
    "direct source evidence must keep the linkless static character fact",
  );

  const sourceHash = sourceHashForLtmSourceNote(chat);
  const parsedSourcePrefixedLink = parseEvidenceUnitPayload(
    {
      summary: "Source-prefixed link normalization",
      units: [
        unit(chat, {
          bucket: "timeline_event",
          subjectId: "source_prefixed_event",
          sectionKey: "event",
          text: "Mara learned the observatory script.",
          links: [
            { target: `source_note:${chat.id}`, relation: "extracted_from" },
          ],
        }),
      ],
    },
    sourceHash,
  );
  assert.deepEqual(
    parsedSourcePrefixedLink.response.units[0]?.links,
    [{ target: chat.id, relation: "extracted_from" }],
    "source_note:<id> extracted_from targets must normalize to the source note id",
  );

  const legacyMissingClaimKind = compile(chat, [
    unit(chat, {
      bucket: "world_fact",
      subjectId: "legacy_strict_default",
      sectionKey: "facts",
      text: "The observatory has a brass gate.",
    }),
  ]);
  assert.equal(legacyMissingClaimKind.accounting.keptUnits, 0);

  const staticRelationshipDelta = compile(chat, [
    unit(chat, {
      bucket: "relationship_state",
      subjectId: "alice_rowan_static_delta",
      sectionKey: "state",
      text: "Alice and Rowan trust each other.",
      claimKind: "static",
      subjectNames: ["Alice", "Rowan"],
      dimensionChanges: { trust: 5 },
    }),
  ]);
  assert.equal(staticRelationshipDelta.accounting.keptUnits, 0);
  assert.equal(
    staticRelationshipDelta.diagnostics.some(
      (diagnostic) =>
        diagnostic.details?.validatorCode ===
        "static_relationship_dimension_change",
    ),
    true,
  );

  const dedupUnit = (
    text: string,
    subjectId = "dedup_subject",
    sectionKey = "facts",
  ) =>
    unit(chat, {
      bucket: "world_fact",
      subjectId,
      sectionKey,
      text,
    });
  const shared = Array.from(
    { length: 17 },
    (_, index) => `shared${index}`,
  ).join(" ");
  const exactlyThreshold = dedupUnit(shared);
  const thresholdMatch = dedupUnit(`${shared} extraA extraB extraC`);
  const belowThreshold = dedupUnit(`${shared} belowA belowB belowC belowD`);
  const dedupResult = deduplicateUnits(
    [
      dedupUnit("A sealed observatory gate."),
      dedupUnit("A sealed observatory gate."),
      dedupUnit("a an the"),
      dedupUnit("a an the"),
      exactlyThreshold,
      thresholdMatch,
      belowThreshold,
      dedupUnit("A sealed observatory gate.", "different_subject"),
      dedupUnit("A sealed observatory gate.", "dedup_subject", "history"),
      dedupUnit("A sealed observatory gate.", "existing_subject"),
    ],
    [
      {
        ...chat,
        id: "world_existing_subject",
        type: "world" as const,
        sections: { facts: { text: "A sealed observatory gate." } },
      } as any,
    ],
  );
  assert.equal(dedupResult.deduplicated.length, 7);
  assert.equal(
    dedupResult.diagnostics.filter(
      (diagnostic) => diagnostic.code === "deduplicated_evidence_unit",
    ).length,
    3,
    "dedup must characterize same-batch, existing-note, threshold, and exact matches",
  );

  const subject = (key: string, ref?: { kind: "character"; id: string }) => ({
    key,
    ...(ref ? { ref } : {}),
  });
  assert.equal(subjectsEqual(undefined, undefined), false);
  assert.equal(subjectsEqual([subject("character:mara")], []), false);
  assert.equal(
    subjectsEqual(
      [subject("character:mara", { kind: "character", id: "mara" })],
      [subject("character:mara", { kind: "character", id: "other" })],
    ),
    true,
  );
  assert.equal(
    subjectsEqual(
      [subject("character:mara"), subject("character:rowan")],
      [subject("character:rowan"), subject("character:mara")],
    ),
    false,
  );
  const existingCharacter = {
    id: "char_mara_subject",
    title: "Mara",
    type: "character" as const,
    status: "active" as const,
    modes: ["roleplay" as const],
    scope: {},
    tags: [],
    keywords: [],
    links: [],
    subjects: [subject("character:mara", { kind: "character", id: "mara" })],
    sections: { facts: { text: "Mara is present.", updatedAt: timestamp } },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  assert.throws(
    () =>
      projectLtmDraftMutationGroup({
        existing: existingCharacter,
        mutations: [
          {
            id: randomUUID(),
            kind: "set_subjects",
            noteId: existingCharacter.id,
            subjects: [subject("character:rowan")],
            risk: "low",
            confidence: 0.9,
            summary: "Mismatch subject",
            evidence: [`source_note:${chat.id}`],
          },
        ],
        context: {
          source: { sourceNoteId: chat.id },
          scope: {},
          modes: ["roleplay"],
        },
        timestamp,
      }),
    (error: any) => error.code === "subject_identity_mismatch",
  );

  process.stdout.write(
    "Long-Term Memory extraction graph regression: static grounding, change linkage, relationship causes, and source-link normalization passed\n",
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
