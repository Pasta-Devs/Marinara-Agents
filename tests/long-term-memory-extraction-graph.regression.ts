import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const source =
    "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const {
    compileEvidenceUnitExtraction,
    evidenceUnitMessages,
    evidenceUnitResponseFormat,
    parseEvidenceUnitPayload,
  } =
    await import(`${source}/evidence-unit-extraction.ts`);
  const { compileLtmEvidenceUnits } = await import(
    `${source}/evidence-unit-compiler.ts`
  );
  const { deduplicateUnits } = await import(`${source}/dedup.ts`);
  const {
    analyzeTrustedLtmNoteSubjects,
    buildTrustedLtmSubjectCatalog,
    subjectsEqual,
    trustedLtmIdentityNotesForSource,
  } = await import(`${source}/subject-identity.ts`);
  const { projectLtmDraftMutationGroup } = await import(
    `${source}/draft-projector.ts`
  );
  const { sourceHashForLtmSourceNote } = await import(
    `${source}/source-hash.ts`
  );
  const { normalizeStructuredSummaryEvidenceUnits } = await import(
    `${source}/structured-summary-normalizer.ts`
  );
  const { resolveScopedEvidenceUnitTargets } = await import(
    `${source}/scoped-targets.ts`
  );
  const { ltmNoteIdSchema } = await import(
    "../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts"
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
        | "world_fact"
        | "thread"
        | "tone";
      subjectId: string;
      sectionKey: string;
      title?: string;
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
    existingNotes: any[] = [],
  ) =>
    compileEvidenceUnitExtraction({
      unitResponse: { summary: "Extraction graph regression", units },
      providerCandidates: units.length,
      sourceText: note.sections.source.text,
      sourceNote: note,
      existingNotes,
      scope: {},
      modes: ["roleplay"],
      mode: "roleplay",
      sourceHash: sourceHashForLtmSourceNote(note),
      skipStructuredBackfill,
    });

  const chat = sourceNote(
    "source_chat_graph_regression",
    { kind: "chat_summary", sourceId: "chat-a", entryId: "summary-a" },
    "Mara learned the observatory script and is guarded. Alice and Rowan trusted each other less after the argument.",
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

  const structuredCharacterSource = sourceNote(
    "source_structured_character_text",
    { kind: "chat_summary", sourceId: "chat-b", entryId: "summary-b" },
    [
      "## character_fact",
      "- Denise: Damo's reentry case officer at the Marlowe Street reentry office and identifies his case as an exoneree case rather than parole. | text: Damo's reentry case officer at the Marlowe Street reentry office; distinguishes his case as an \"exoneree\" rather than parolee, entitling him to state compensation.",
      "- Denise | text: Began processing Damo's state compensation claim using his college records as evidence of disrupted earning potential, and referred him to civil rights attorney Mara Castellano for a possible civil suit.",
    ].join("\n"),
  );
  const structuredCharacterUnits = normalizeStructuredSummaryEvidenceUnits({
    units: [],
    sourceText: structuredCharacterSource.sections.source.text,
    sourceNote: structuredCharacterSource,
    sourceHash: sourceHashForLtmSourceNote(structuredCharacterSource),
    mode: "roleplay",
    modes: ["roleplay"],
  }).units.filter((candidate) => candidate.bucket === "character_fact");
  assert.equal(structuredCharacterUnits.length, 2);
  assert.equal(
    structuredCharacterUnits.some((candidate) => /(^|\s)text:/i.test(candidate.text)),
    false,
  );
  assert.equal(
    structuredCharacterUnits.some((candidate) => /(^|\s)summary:/i.test(candidate.text)),
    false,
  );
  assert.equal(
    structuredCharacterUnits[0]?.text.includes("distinguishes his case as an \"exoneree\" rather than parolee"),
    true,
  );
  assert.equal(
    structuredCharacterUnits[1]?.text.startsWith("Began processing Damo's state compensation claim"),
    true,
  );

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
  const extractionMessages = evidenceUnitMessages({
    sourceNote: chat,
    sourceText: chat.sections.source.text,
    existingNotes: [],
    scope: {},
    modes: ["roleplay"],
    sourceHash,
    mode: "roleplay",
  } as any);
  const unitFields = JSON.parse(String(extractionMessages[1]?.content)).unitFields;
  assert.match(unitFields.title, /short memory label/i);
  assert.equal(
    evidenceUnitResponseFormat({
      allowedBuckets: ["timeline_event"],
      sourceHash,
    }).json_schema.schema.properties.units.items.properties.title.maxLength,
    80,
  );

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
  const oversizedPayload = parseEvidenceUnitPayload(
    {
      summary: "x".repeat(2_001),
      units: Array.from({ length: 81 }, (_, index) =>
        unit(chat, {
          bucket: "world_fact",
          subjectId: `bounded_${index}`,
          sectionKey: "facts",
          text: `Bounded candidate ${index}.`,
        }),
      ),
    },
    sourceHash,
  );
  assert.equal(oversizedPayload.response.summary.length, 2_000);
  assert.equal(oversizedPayload.response.units.length, 81);
  assert.equal(oversizedPayload.totalCandidates, 81);

  const oversizedDerivedNoteId = compile(chat, [
    unit(chat, {
      bucket: "timeline_event",
      subjectId: `a${"a".repeat(119)}`,
      sectionKey: "event",
      text: "A long generated note id should be dropped before draft finalization.",
      links: [{ target: chat.id, relation: "extracted_from" }],
    }),
  ]);
  assert.equal(oversizedDerivedNoteId.accounting.keptUnits, 0);
  assert.equal(oversizedDerivedNoteId.compiledResponse.mutations.length, 0);
  assert.equal(
    oversizedDerivedNoteId.outcome.droppedCandidates.some((candidate) =>
      candidate.message.includes("too long to keep safely"),
    ),
    true,
  );
  assert.equal(
    oversizedDerivedNoteId.diagnostics.some(
      (diagnostic) =>
        diagnostic.details?.validatorCode === "overlong_target_note_id",
    ),
    true,
  );
  assert.equal(
    oversizedDerivedNoteId.diagnostics.find(
      (diagnostic) =>
        diagnostic.details?.validatorCode === "overlong_target_note_id",
    )?.noteId,
    undefined,
  );
  assert.equal(
    oversizedDerivedNoteId.outcome.droppedCandidates[0]?.recovery?.noteId,
    undefined,
  );

  const strictStorageIds: string[][] = [];
  const targetResolution = await resolveScopedEvidenceUnitTargets({
    units: [
      unit(chat, {
        bucket: "timeline_event",
        subjectId: `a${"a".repeat(119)}`,
        sectionKey: "event",
        text: "A long generated note id must not reach strict storage lookup.",
        links: [{ target: chat.id, relation: "extracted_from" }],
      }),
    ],
    existingNotes: [],
    storage: {
      getNotesByIds: async (ids) => {
        strictStorageIds.push(ids);
        for (const id of ids) ltmNoteIdSchema.parse(id);
        return new Map();
      },
    },
    scope: {},
  });
  assert.deepEqual(strictStorageIds, [[]]);
  const extractedCompilation = compile(chat, targetResolution.units);
  assert.equal(extractedCompilation.accounting.keptUnits, 0);
  assert.equal(extractedCompilation.compiledResponse.mutations.length, 0);
  assert.equal(
    extractedCompilation.diagnostics.some(
      (diagnostic) => diagnostic.details?.validatorCode === "overlong_target_note_id",
    ),
    true,
  );

  const malformedPayload = parseEvidenceUnitPayload(
    { units: Array.from({ length: 100 }, () => null) },
    sourceHash,
  );
  assert.equal(malformedPayload.parserRejections, 100);
  assert.equal(malformedPayload.droppedCandidates.length, 80);
  const countedMalformedCompilation = compileEvidenceUnitExtraction({
    unitResponse: malformedPayload.response,
    providerCandidates: malformedPayload.totalCandidates,
    parserRejectionCount: malformedPayload.parserRejections,
    parserDroppedCandidates: malformedPayload.droppedCandidates,
    sourceText: chat.sections.source.text,
    sourceNote: chat,
    existingNotes: [],
    scope: {},
    modes: ["roleplay"],
    mode: "roleplay",
    sourceHash,
    skipStructuredBackfill: true,
  });
  assert.equal(countedMalformedCompilation.accounting.parserRejections, 100);
  assert.equal(countedMalformedCompilation.outcome.droppedUnits, 100);
  assert.equal(countedMalformedCompilation.outcome.droppedCandidates.length, 80);
  assert.equal(countedMalformedCompilation.outcome.droppedCandidateDetailsTruncated, true);
  assert.throws(
    () => parseEvidenceUnitPayload({ units: Array.from({ length: 1_000 }, () => null) }, sourceHash),
    /maximum is 999/,
  );

  const existingTone = {
    ...chat,
    id: "tone_mara",
    type: "tone" as const,
    tags: ["typed_memory"],
    sections: {
      observations: { text: "- Mara is reserved.", updatedAt: timestamp },
      profile: { text: "Tone profile: reserved.", updatedAt: timestamp },
    },
  };
  const toneCompilation = compileLtmEvidenceUnits({
    units: [
      unit(chat, {
        bucket: "tone",
        subjectId: "mara",
        sectionKey: "observations",
        text: "Mara is guarded.",
      }),
    ],
    existingNotes: [existingTone],
    scope: {},
    modes: ["roleplay"],
    createdAt: timestamp,
  });
  const profileMutation = toneCompilation.mutations.find(
    (mutation) =>
      mutation.kind === "update_section" && mutation.sectionKey === "profile",
  );
  assert.ok(profileMutation, "tone extraction must update the derived profile");
  assert.deepEqual(profileMutation?.evidence, [`source_note:${chat.id}`]);

  const titleCases: Array<Parameters<typeof unit>[1]> = [
    {
      bucket: "timeline_event",
      subjectId: "argument_strained_trust",
      sectionKey: "event",
      title: "Trust-Straining Argument",
      text: "Alice and Rowan argued, straining their trust.",
    },
    {
      bucket: "thread",
      subjectId: "repair_their_trust",
      sectionKey: "summary",
      title: "Repair Their Trust",
      text: "Alice and Rowan need to repair their trust after the argument.",
      claimKind: "static",
    },
    {
      bucket: "world_fact",
      subjectId: "observatory_script",
      sectionKey: "facts",
      title: "Observatory Script",
      text: "The observatory script can be read by Mara.",
      claimKind: "static",
    },
    {
      bucket: "tone",
      subjectId: "guarded_register",
      sectionKey: "observations",
      title: "Guarded Register",
      text: "The conversation keeps a guarded register.",
      claimKind: "static",
    },
    {
      bucket: "character_fact",
      subjectId: "mara",
      sectionKey: "abilities",
      title: "Should Be Ignored For Character",
      text: "Mara can read the observatory script.",
      claimKind: "static",
      subjectNames: ["Mara"],
    },
    {
      bucket: "relationship_state",
      subjectId: "alice_rowan",
      sectionKey: "state",
      title: "Should Be Ignored For Relationship",
      text: "Alice and Rowan trust each other less after the argument.",
      claimKind: "change",
      subjectNames: ["Alice", "Rowan"],
      links: [{ target: "timeline_argument_strained_trust", relation: "caused_by" }],
    },
  ];
  const compileTitleCases = (cases: Array<Parameters<typeof unit>[1]>) =>
    compileLtmEvidenceUnits({
      units: cases.map((input) => unit(chat, input)),
      existingNotes: [],
      scope: {},
      modes: ["roleplay"],
      createdAt: timestamp,
    });
  const titledCreateCompilation = compileTitleCases(titleCases);
  const createdTitles = new Map(
    titledCreateCompilation.mutations
      .filter((mutation): mutation is Extract<(typeof titledCreateCompilation.mutations)[number], { kind: "create_note" }> => mutation.kind === "create_note")
      .map((mutation) => [mutation.note.type, mutation.note.title]),
  );
  assert.equal(createdTitles.get("timeline_event"), "Trust-Straining Argument");
  assert.equal(createdTitles.get("thread"), "Repair Their Trust");
  assert.equal(createdTitles.get("world"), "Observatory Script");
  assert.equal(createdTitles.get("tone"), "Guarded Register");
  assert.equal(createdTitles.get("character"), "Mara");
  assert.equal(createdTitles.get("relationship"), "Alice and Rowan");

  const untitledCreateCompilation = compileTitleCases(
    titleCases.map(({ title: _title, ...input }) => input),
  );
  const fallbackTitles = new Map(
    untitledCreateCompilation.mutations
      .filter((mutation): mutation is Extract<(typeof untitledCreateCompilation.mutations)[number], { kind: "create_note" }> => mutation.kind === "create_note")
      .map((mutation) => [mutation.note.type, mutation.note.title]),
  );
  assert.equal(fallbackTitles.get("timeline_event"), "Argument Strained Trust");
  assert.equal(fallbackTitles.get("thread"), "Repair Their Trust");
  assert.equal(fallbackTitles.get("world"), "Observatory Script");
  assert.equal(fallbackTitles.get("tone"), "Tone: Guarded Register");
  assert.equal(fallbackTitles.get("character"), "Mara");
  assert.equal(fallbackTitles.get("relationship"), "Alice and Rowan");

  const existingWorld = {
    id: "world_observatory_script",
    title: "Manual Observatory Title",
    type: "world" as const,
    status: "active" as const,
    modes: ["roleplay" as const],
    scope: {},
    tags: ["typed_memory"],
    keywords: [],
    links: [],
    sections: {
      facts: { text: "Existing observatory fact.", updatedAt: timestamp },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  const preservedTitleProjection = projectLtmDraftMutationGroup({
    existing: existingWorld,
    mutations: titledCreateCompilation.mutations.filter(
      (mutation): mutation is Extract<(typeof titledCreateCompilation.mutations)[number], { kind: "create_note" }> =>
        mutation.kind === "create_note" && mutation.note.id === existingWorld.id,
    ),
    context: {
      source: {
        sourceNoteId: chat.id,
        sourceHash: sourceHashForLtmSourceNote(chat),
      },
      scope: {},
      modes: ["roleplay"],
    },
    timestamp,
  });
  assert.equal(
    preservedTitleProjection.after.title,
    "Manual Observatory Title",
    "existing note titles must be preserved on merge",
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
  assert.equal(dedupResult.deduplicated.length, 6);
  assert.equal(
    dedupResult.diagnostics.filter(
      (diagnostic) => diagnostic.code === "deduplicated_evidence_unit",
    ).length,
    4,
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
  const identityNote = (id: string, title: string, subjects?: any[]) => ({
    id,
    title,
    type: "character" as const,
    status: "active" as const,
    modes: ["roleplay" as const],
    scope: {},
    tags: [],
    keywords: [],
    links: [],
    ...(subjects ? { subjects } : {}),
    sections: { facts: { text: `${title} is trusted.`, updatedAt: timestamp } },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  });
  const identityCatalog = buildTrustedLtmSubjectCatalog({
    roster: [
      {
        kind: "character",
        id: "seraphina",
        name: "Seraphina Duvall",
      },
      { kind: "character", id: "other", name: "Sabrina Duvall" },
    ],
    notes: [],
  });
  const canonicalIdentityNote = identityNote(
    "char_seraphina",
    "Seraphina Duvall",
    [identityCatalog.entries.find((entry: any) => entry.name === "Seraphina Duvall")!.subject],
  );
  identityCatalog.notes.push(canonicalIdentityNote);
  assert.deepEqual(
    trustedLtmIdentityNotesForSource({
      sourceText: "Serafina Duvall entered the observatory.",
      catalog: identityCatalog,
    }).map((note: any) => note.id),
    ["char_seraphina"],
    "a unique spelling variation should select the trusted canonical identity note",
  );
  assert.deepEqual(
    trustedLtmIdentityNotesForSource({
      sourceText: "Duvall entered the observatory.",
      catalog: identityCatalog,
    }),
    [],
    "a surname-only mention must not select a trusted identity",
  );
  const legacySpellingNote = identityNote(
    "char_serafina_legacy",
    "Serafina Duvall",
  );
  identityCatalog.notes.push(legacySpellingNote);
  assert.equal(
    analyzeTrustedLtmNoteSubjects(identityCatalog).matches.find(
      (match: any) => match.note.id === legacySpellingNote.id,
    )?.basis,
    "spelling_variation",
    "identity repair should expose the conservative fuzzy match basis",
  );
  const ambiguousCatalog = buildTrustedLtmSubjectCatalog({
    roster: [
      { kind: "character", id: "one", name: "Seraphina Duvall" },
      { kind: "character", id: "two", name: "Serafira Duvall" },
    ],
    notes: [],
  });
  ambiguousCatalog.notes.push(
    identityNote("char_one", "Seraphina Duvall", [ambiguousCatalog.entries[0]!.subject]),
  );
  assert.deepEqual(
    trustedLtmIdentityNotesForSource({
      sourceText: "Serafina Duvall entered the observatory.",
      catalog: ambiguousCatalog,
    }),
    [],
    "ambiguous spelling variations must not select an identity",
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
