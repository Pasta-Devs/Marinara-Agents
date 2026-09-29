import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRegressionToCompletion } from "./regression-helpers.ts";

async function main() {
  const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
  const { compileEvidenceUnitExtraction, evidenceUnitMessages, evidenceUnitResponseFormat, parseEvidenceUnitPayload } =
    await import(`${source}/evidence-unit-extraction.ts`);
  const { compileLtmEvidenceUnits } = await import(`${source}/evidence-unit-compiler.ts`);
  const { deduplicateUnits } = await import(`${source}/dedup.ts`);
  const {
    analyzeTrustedLtmNoteSubjects,
    buildTrustedLtmSubjectCatalog,
    resolveLtmSubjectIdentities,
    subjectsEqual,
    trustedLtmIdentityNotesForSource,
  } = await import(`${source}/subject-identity.ts`);
  const { projectLtmDraftMutationGroup } = await import(`${source}/draft-projector.ts`);
  const { sourceHashForLtmSourceNote } = await import(`${source}/source-hash.ts`);
  const { normalizeStructuredSummaryEvidenceUnits } = await import(`${source}/structured-summary-normalizer.ts`);
  const { validateLtmEvidenceUnits } = await import(`${source}/evidence-unit-validation.ts`);
  const { resolveScopedEvidenceUnitTargets, scopedVariantNoteId } = await import(`${source}/scoped-targets.ts`);
  const { configurePackageRuntime } = await import(`${source}/package-runtime.ts`);
  const { processLongTermMemorySource } = await import(`${source}/source-processing.ts`);
  const { LongTermMemoryStorage } = await import(`${source}/storage.ts`);
  const { ltmNoteIdSchema } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts");

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
      bucket: "timeline_event" | "character_fact" | "relationship_state" | "world_fact" | "thread" | "tone";
      subjectId: string;
      sectionKey: string;
      title?: string;
      text: string;
      claimKind?: "static" | "change";
      status?: "active" | "resolved";
      links?: Array<{
        target: string;
        relation: "extracted_from" | "evidenced_by" | "caused_by" | "resolved_in" | "affects_character" | "involves";
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
    status: input.status ?? ("active" as const),
    links: input.links ?? [],
    sourceHash: sourceHashForLtmSourceNote(note),
  });
  const compile = (
    note: ReturnType<typeof sourceNote>,
    units: ReturnType<typeof unit>[],
    skipStructuredBackfill = true,
    existingNotes: any[] = [],
    scope: Record<string, unknown> = {},
  ) =>
    compileEvidenceUnitExtraction({
      unitResponse: { summary: "Extraction graph regression", units },
      providerCandidates: units.length,
      sourceText: note.sections.source.text,
      sourceNote: note,
      existingNotes,
      scope: scope as any,
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
  const scopedChat = { ...chat, scope: { chatId: "chat-a", chatIds: ["chat-a"] } };

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
  assert.equal(linklessCharacter.compiledResponse.mutations[0]?.claimKind, "static");

  const unresolvedThread = compile(chat, [
    unit(chat, {
      bucket: "thread",
      subjectId: "archive_open",
      sectionKey: "summary",
      text: "The archive thread remains open.",
      claimKind: "static",
      status: "active",
    }),
  ]);
  assert.equal(unresolvedThread.accounting.keptUnits, 1);
  assert.equal(unresolvedThread.outcome.droppedCandidates.length, 0);

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
  assert.equal(
    relationshipWithoutCause.outcome.droppedCandidates[0]?.validatorCode,
    "relationship_state_missing_caused_by",
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
    relationshipWithMissingCause.outcome.droppedCandidates.some(
      (candidate) =>
        candidate.message.includes("missing a caused_by link") &&
        !candidate.message.includes("timeline_missing_argument"),
    ),
    true,
  );
  assert.equal(
    relationshipWithMissingCause.outcome.droppedCandidates[0]?.validatorCode,
    "relationship_state_missing_caused_by",
  );
  const unknownLinkTarget = compile(chat, [
    unit(chat, {
      bucket: "world_fact",
      subjectId: "missing_link_fact",
      sectionKey: "facts",
      text: "A fact linked to a missing memory.",
      links: [{ target: "missing_memory", relation: "evidenced_by" }],
    }),
  ]);
  assert.equal(unknownLinkTarget.outcome.droppedCandidates[0]?.validatorCode, "unknown_link_target");
  assert.doesNotMatch(unknownLinkTarget.outcome.droppedCandidates[0]?.message ?? "", /missing_memory/u);
  const closureAfterInitialDrop = compile(chat, [
    unit(chat, {
      bucket: "relationship_state",
      subjectId: "removed_relationship",
      sectionKey: "state",
      text: "Alice and Rowan's trust changed after the argument.",
      claimKind: "change",
      subjectNames: ["Alice", "Rowan"],
      dimensionChanges: { trust: -12 },
    }),
    unit(chat, {
      bucket: "world_fact",
      subjectId: "dependent_fact",
      sectionKey: "facts",
      text: "The observatory kept a record of Alice and Rowan's trust.",
      links: [{ target: "rel_removed_relationship", relation: "evidenced_by" }],
    }),
  ]);
  const closureDrop = closureAfterInitialDrop.outcome.droppedCandidates.find(
    (candidate) => candidate.validatorCode === "unknown_link_target",
  );
  assert.ok(closureDrop);
  assert.doesNotMatch(closureDrop.message, /rel_removed_relationship/u);
  assert.equal(
    closureAfterInitialDrop.diagnostics.find(
      (diagnostic) => diagnostic.details?.validatorCode === "unknown_link_target",
    )?.details?.validationStage,
    "closure",
  );
  const sourceHashMismatch = compile(chat, [
    {
      ...unit(chat, {
        bucket: "world_fact",
        subjectId: "stale_source_fact",
        sectionKey: "facts",
        text: "A fact extracted from a stale source version.",
      }),
      sourceHash: "stale-source-hash",
    },
  ]);
  assert.equal(sourceHashMismatch.outcome.droppedCandidates[0]?.validatorCode, "source_hash_mismatch");

  // Issue #1137: a flat summary (no recognized headings) must normalize a
  // timeline_event to the event section instead of dropping it as invalid.
  const flatSummaryTimeline = unit(chat, {
    bucket: "timeline_event",
    subjectId: "argument_strained_trust",
    sectionKey: "facts",
    text: "Alice and Rowan argued, straining their trust.",
    links: [{ target: chat.id, relation: "extracted_from" }],
  });
  const flatTimelineResult = compile(chat, [flatSummaryTimeline]);
  assert.equal(flatTimelineResult.accounting.keptUnits, 1);
  assert.equal(flatTimelineResult.outcome.droppedCandidates.length, 0);
  assert.equal(flatTimelineResult.unitResponse.units[0]?.sectionKey, "event");
  // The validator guard and its recovery candidate stay intact for direct callers.
  const rawInvalidTimeline = validateLtmEvidenceUnits({
    units: [flatSummaryTimeline],
    sourceText: chat.sections.source.text,
    sourceNote: chat,
    existingNotes: [],
    expectedSourceHash: sourceHashForLtmSourceNote(chat),
  });
  const rawInvalidTimelineDrop = rawInvalidTimeline.droppedCandidates[0];
  assert.equal(rawInvalidTimelineDrop?.validatorCode, "invalid_timeline_section");
  assert.equal(rawInvalidTimelineDrop?.recoveryCandidate?.text, flatSummaryTimeline.text);
  assert.equal(rawInvalidTimelineDrop?.recoveryCandidate?.sourceHash, flatSummaryTimeline.sourceHash);
  assert.deepEqual(rawInvalidTimelineDrop?.recoveryCandidate?.evidence, flatSummaryTimeline.evidence);

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
      links: [{ target: "timeline_argument_strained_trust", relation: "caused_by" }],
    }),
  ]);
  assert.equal(relationshipWithEvent.accounting.keptUnits, 2);
  assert.equal(relationshipWithEvent.compiledResponse.mutations.length, 2);

  const resolvedThread = unit(chat, {
    bucket: "thread",
    subjectId: "thread_archive_open",
    sectionKey: "summary",
    text: "The archive thread is resolved after Mara returned.",
    claimKind: "change",
    status: "resolved",
    links: [{ target: "timeline_archive_reopened", relation: "resolved_in" }],
  });
  const resolutionEvent = unit(chat, {
    bucket: "timeline_event",
    subjectId: "archive_reopened",
    sectionKey: "event",
    text: "Mara returned and reopened the archive.",
    claimKind: "change",
    links: [{ target: chat.id, relation: "extracted_from" }],
  });
  const existingThread = {
    ...chat,
    id: "thread_archive_open",
    type: "thread" as const,
    status: "active" as const,
    tags: ["typed_memory"],
    sections: { summary: { text: "The archive thread remains open.", updatedAt: timestamp } },
  };
  const parsedResolution = parseEvidenceUnitPayload(
    { summary: "Resolved thread parser regression", units: [resolvedThread, resolutionEvent] },
    sourceHashForLtmSourceNote(chat),
  );
  assert.equal(parsedResolution.parserRejections, 0);
  assert.equal(parsedResolution.response.units.length, 2);
  assert.deepEqual(parsedResolution.response.units[0]?.links, [
    { target: "timeline_archive_reopened", relation: "resolved_in" },
  ]);
  const resolvedThreadValidation = compile(chat, [resolvedThread, resolutionEvent], true, [existingThread]);
  assert.equal(resolvedThreadValidation.accounting.keptUnits, 2);
  assert.equal(
    resolvedThreadValidation.compiledResponse.mutations.some(
      (mutation) => mutation.kind === "create_note" && mutation.note.type === "thread",
    ),
    false,
  );
  assert.equal(
    resolvedThreadValidation.compiledResponse.mutations.some(
      (mutation) =>
        mutation.kind === "set_status" && mutation.noteId === existingThread.id && mutation.status === "resolved",
    ),
    true,
  );
  assert.equal(
    resolvedThreadValidation.diagnostics.some((diagnostic) => diagnostic.code === "resolved_thread_missing_fanout"),
    false,
  );
  const missingThreadTarget = compile(chat, [resolvedThread]);
  assert.equal(missingThreadTarget.accounting.keptUnits, 0);
  assert.equal(missingThreadTarget.outcome.droppedCandidates[0]?.validatorCode, "unknown_link_target");
  // Issue #1137: a resolution event from a flat summary is normalized to the
  // event section, so it still satisfies the resolved thread's fan-out.
  const repairedResolutionEvent = compile(chat, [resolvedThread, { ...resolutionEvent, sectionKey: "facts" }]);
  assert.equal(repairedResolutionEvent.accounting.keptUnits, 2);
  assert.equal(
    repairedResolutionEvent.outcome.droppedCandidates.some(
      (candidate) => candidate.validatorCode === "unknown_link_target",
    ),
    false,
  );
  const missingResolutionEvent = compile(chat, [
    unit(chat, {
      bucket: "thread",
      subjectId: "archive_missing",
      sectionKey: "summary",
      text: "The archive thread is resolved.",
      claimKind: "change",
      status: "resolved",
    }),
  ]);
  assert.equal(
    missingResolutionEvent.diagnostics.some((diagnostic) => diagnostic.code === "resolved_thread_missing_fanout"),
    true,
  );

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
  assert.deepEqual(currentEvidence.mutations[0]?.evidence, [`source_note:${chat.id}`]);

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
    structuredCharacterUnits[0]?.text.includes('distinguishes his case as an "exoneree" rather than parolee'),
    true,
  );
  assert.equal(structuredCharacterUnits[1]?.text.startsWith("Began processing Damo's state compensation claim"), true);

  // Issue #1137: an unrecognized `##` heading must close the previous section so
  // its following fields are not misattributed to the last known bucket.
  const unknownHeadingSource = sourceNote(
    "source_unknown_heading",
    { kind: "chat_summary", sourceId: "chat-unknown", entryId: "summary-unknown" },
    [
      "## character_fact",
      "- Mara | section: facts | text: Mara reads old scripts.",
      "## misc_notes",
      "- Rowan | section: facts | text: Rowan guards the gate.",
    ].join("\n"),
  );
  const unknownHeadingUnits = normalizeStructuredSummaryEvidenceUnits({
    units: [],
    sourceText: unknownHeadingSource.sections.source.text,
    sourceNote: unknownHeadingSource,
    sourceHash: sourceHashForLtmSourceNote(unknownHeadingSource),
    mode: "roleplay",
    modes: ["roleplay"],
  }).units.filter((candidate) => candidate.bucket === "character_fact");
  assert.deepEqual(
    unknownHeadingUnits.map((candidate) => candidate.subjectId),
    ["mara"],
    "fields under an unrecognized heading must not be attributed to the previous section",
  );

  // Issue #1137: structured backfill must not append a unit that duplicates a
  // provider candidate already returned for the same source. The shorthand line
  // folds its leading description into the parsed text, so a provider unit with
  // only the canonical `text:` value must still count as covered.
  const structuredCharacterProviderResult = normalizeStructuredSummaryEvidenceUnits({
    units: [
      unit(structuredCharacterSource, {
        bucket: "character_fact",
        subjectId: "denise",
        sectionKey: "facts",
        text: 'Damo\'s reentry case officer at the Marlowe Street reentry office; distinguishes his case as an "exoneree" rather than parolee, entitling him to state compensation.',
        subjectNames: ["Denise"],
      }),
      unit(structuredCharacterSource, {
        bucket: "character_fact",
        subjectId: "denise",
        sectionKey: "facts",
        text: "Began processing Damo's state compensation claim using his college records as evidence of disrupted earning potential, and referred him to civil rights attorney Mara Castellano for a possible civil suit.",
        subjectNames: ["Denise"],
      }),
    ],
    sourceText: structuredCharacterSource.sections.source.text,
    sourceNote: structuredCharacterSource,
    sourceHash: sourceHashForLtmSourceNote(structuredCharacterSource),
    mode: "roleplay",
    modes: ["roleplay"],
  });
  assert.equal(
    structuredCharacterProviderResult.addedUnits,
    0,
    "structured backfill must not duplicate provider candidates for the same source",
  );
  assert.equal(
    structuredCharacterProviderResult.units.filter((candidate) => candidate.bucket === "character_fact").length,
    2,
  );

  // Issue #1137: the provider-coverage check must not compare two backfill lines
  // against each other, or a richer structured fact whose text contains a shorter
  // sibling fact for the same subject and section is dropped.
  const nestedBackfillSource = sourceNote(
    "source_nested_backfill",
    { kind: "chat_summary", sourceId: "chat-nested", entryId: "summary-nested" },
    [
      "## character_fact",
      "- Alice | section: facts | text: Alice has a scar on her left cheek.",
      "- Alice | section: facts | text: Alice has a scar on her left cheek and speaks French.",
    ].join("\n"),
  );
  const nestedBackfillResult = normalizeStructuredSummaryEvidenceUnits({
    units: [],
    sourceText: nestedBackfillSource.sections.source.text,
    sourceNote: nestedBackfillSource,
    sourceHash: sourceHashForLtmSourceNote(nestedBackfillSource),
    mode: "roleplay",
    modes: ["roleplay"],
  });
  const nestedBackfillTexts = nestedBackfillResult.units
    .filter((candidate) => candidate.bucket === "character_fact")
    .map((candidate) => candidate.text);
  assert.equal(nestedBackfillTexts.length, 2, "a richer sibling backfill fact must not be suppressed");
  assert.equal(
    nestedBackfillTexts.some((text) => text.includes("speaks French")),
    true,
    "the distinct detail from the richer backfill fact must be retained",
  );

  const idiomaticStaticSource = sourceNote(
    "source_static_fact_heuristic",
    { kind: "chat_summary", sourceId: "chat-static", entryId: "summary-static" },
    [
      "## character_fact",
      "- Rowan | section: facts | text: Rowan decided the old observatory was not worth visiting again.",
    ].join("\n"),
  );
  const idiomaticStaticUnit = normalizeStructuredSummaryEvidenceUnits({
    units: [],
    sourceText: idiomaticStaticSource.sections.source.text,
    sourceNote: idiomaticStaticSource,
    sourceHash: sourceHashForLtmSourceNote(idiomaticStaticSource),
    mode: "roleplay",
    modes: ["roleplay"],
  }).units.find((candidate) => candidate.bucket === "character_fact");
  assert.equal(idiomaticStaticUnit?.sectionKey, "facts");
  assert.equal(idiomaticStaticUnit?.claimKind, "static");

  const explicitStaticTransition = normalizeStructuredSummaryEvidenceUnits({
    units: [],
    sourceText: [
      "## character_fact",
      "- Rowan | section: facts | text: Rowan decided to become a case officer.",
      "- Mara | section: facts | text: Mara lost her assigned officer role.",
    ].join("\n"),
    sourceNote: idiomaticStaticSource,
    sourceHash: sourceHashForLtmSourceNote(idiomaticStaticSource),
    mode: "roleplay",
    modes: ["roleplay"],
  }).units.filter((candidate) => candidate.bucket === "character_fact");
  assert.equal(
    explicitStaticTransition.every((candidate) => candidate.sectionKey === "developments"),
    true,
  );
  assert.equal(
    explicitStaticTransition.every((candidate) => candidate.claimKind === "change"),
    true,
  );

  const durableNarrativeCharacter = compile(chat, [
    unit(chat, {
      bucket: "character_fact",
      subjectId: "rowan",
      sectionKey: "facts",
      text: "Rowan met Mara and is her assigned case officer.",
      claimKind: "static",
      subjectNames: ["Rowan"],
    }),
  ]);
  assert.equal(durableNarrativeCharacter.accounting.keptUnits, 1);

  const durablePastNarrativeCharacter = compile(chat, [
    unit(chat, {
      bucket: "character_fact",
      subjectId: "rowan",
      sectionKey: "facts",
      text: "Rowan told Mara he was her assigned case officer.",
      claimKind: "static",
      subjectNames: ["Rowan"],
    }),
  ]);
  assert.equal(durablePastNarrativeCharacter.accounting.keptUnits, 1);

  for (const text of ["Rowan met Mara and works as a doctor.", "Rowan told Mara he serves as her case officer."]) {
    const result = compile(chat, [
      unit(chat, {
        bucket: "character_fact",
        subjectId: "rowan",
        sectionKey: "facts",
        text,
        claimKind: "static",
        subjectNames: ["Rowan"],
      }),
    ]);
    assert.equal(result.accounting.keptUnits, 1, text);
  }

  const assertEventShapedWarningKept = (
    text: string,
    subject: { subjectId: string; subjectNames: string[] } = {
      subjectId: "rowan",
      subjectNames: ["Rowan"],
    },
  ) => {
    const result = compile(chat, [
      unit(chat, {
        bucket: "character_fact",
        subjectId: subject.subjectId,
        sectionKey: "facts",
        text,
        claimKind: "static",
        subjectNames: subject.subjectNames,
      }),
    ]);
    assert.equal(result.accounting.keptUnits, 1, text);
    assert.equal(result.outcome.droppedCandidates.length, 0, text);
    assert.ok(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === "event_shaped_character_fact" && diagnostic.severity === "warning",
      ),
      text,
    );
    return result;
  };

  assertEventShapedWarningKept("Rowan met Mara at the observatory.");
  assertEventShapedWarningKept("Rowan met Mara and is walking away.");
  assertEventShapedWarningKept("Rowan met Mara and uses a lantern.");
  assertEventShapedWarningKept("Rowan met Mara and is walking away, but is her assigned case officer.");
  const mara = { subjectId: "mara", subjectNames: ["Mara"] };
  assertEventShapedWarningKept("Mara learned to read the observatory script.", mara);
  assertEventShapedWarningKept("Mara discovered she could read the observatory script.", mara);
  assertEventShapedWarningKept("Mara carries the observatory key.", mara);
  assertEventShapedWarningKept("Mara returned to the observatory.", mara);

  {
    const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-event-shaped-review-"));
    const releaseHost = configurePackageRuntime({
      isDebugAgentsEnabled: () => false,
      logger: { debug() {}, info() {}, warn() {}, error() {} },
      dataDir,
      resources: {
        listCharacters: async () => [{ id: "mara", data: { name: "Mara" }, comment: "" }],
        listPersonas: async () => [],
        listLorebooks: async () => [],
      },
      persistence: {
        getChat: async () => null,
        listChats: async () => [],
        updateChatMetadata: async () => {},
      },
    });
    const root = join(dataDir, "long-term-memory");
    const reviewScope = { characterIds: ["mara"] };
    try {
      const storage = new LongTermMemoryStorage(root);
      const reviewSourceText = "Mara learned to read the observatory script.";
      await storage.createNote({
        ...chat,
        id: "source_event_shaped_review",
        title: "Event-shaped review source",
        scope: reviewScope,
        sections: { source: { text: reviewSourceText, updatedAt: timestamp } },
      } as never);
      const reviewSource = (await storage.getNote("source_event_shaped_review"))!;
      const sourceHash = sourceHashForLtmSourceNote(reviewSource);
      const committed = await processLongTermMemorySource({
        sourceNote: reviewSource as never,
        languageModel: {
          name: "FixtureModel",
          model: "fixture-model",
          maxContext: null,
          maxOutputTokens: null,
          fitContext(messages: unknown[], fitOptions: { maxTokens: number }) {
            return {
              messages,
              maxTokens: fitOptions.maxTokens,
              estimatedTokensBefore: 20,
              estimatedTokensAfter: 20,
              trimmed: false,
            };
          },
          async chatComplete() {
            return {
              content: JSON.stringify({
                summary: "One durable outcome.",
                units: [
                  {
                    bucket: "character_fact",
                    subjectId: "mara",
                    sectionKey: "facts",
                    text: reviewSourceText,
                    claimKind: "static",
                    importance: "major",
                    evidence: [`source_note:${reviewSource.id}`],
                    confidence: 0.9,
                    salience: 0.8,
                    status: "active",
                    links: [],
                    subjectNames: ["Mara"],
                    sourceHash,
                  },
                ],
              }),
              finishReason: "stop",
            };
          },
        } as never,
        scope: reviewScope,
        modes: ["roleplay"],
        mode: "roleplay",
        extractionMode: "roleplay",
        operationId: randomUUID(),
        root,
        applyLowRisk: true,
      });
      assert.equal(committed.draft.reviewRequired, true, "event-shaped character facts must require review");
      assert.ok(
        committed.diagnostics.some(
          (diagnostic) => diagnostic.code === "event_shaped_character_fact" && diagnostic.severity === "warning",
        ),
        "event-shaped character facts must warn without hard-dropping",
      );
      assert.ok(committed.draft.mutations.length > 0, "event-shaped durable outcomes must remain available for review");
      assert.equal(
        committed.appliedMutationIds.length,
        0,
        "event-shaped character facts must block low-risk auto-apply",
      );
    } finally {
      releaseHost();
      await rm(dataDir, { recursive: true, force: true });
    }
  }

  {
    // Pad diagnostics past the retained-list bound so the event-shaped warning is truncated
    // out of the bounded array but still forces requiresReview / blocks auto-apply.
    const padUnits = Array.from({ length: 520 }, (_, index) =>
      unit(chat, {
        bucket: "world_fact",
        subjectId: `pad_diag_${index}`,
        sectionKey: "facts",
        text: `Unrelated token salad ${index} xyzzy quux plugh.`,
        claimKind: "static",
      }),
    );
    const truncatedEventShaped = unit(chat, {
      bucket: "character_fact",
      subjectId: "mara",
      sectionKey: "facts",
      text: "Mara learned to read the observatory script.",
      claimKind: "static",
      subjectNames: ["Mara"],
    });
    const trailingPad = unit(chat, {
      bucket: "world_fact",
      subjectId: "trailing_diag",
      sectionKey: "facts",
      text: "Trailing unrelated token salad xyzzy quux plugh.",
      claimKind: "static",
    });
    const truncatedCompile = compileEvidenceUnitExtraction({
      unitResponse: {
        summary: "Truncated event-shaped review signal",
        units: [...padUnits, truncatedEventShaped, trailingPad],
      },
      providerCandidates: padUnits.length + 2,
      sourceText: chat.sections.source.text,
      sourceNote: chat,
      existingNotes: [],
      scope: {},
      modes: ["roleplay"],
      mode: "roleplay",
      sourceHash: sourceHashForLtmSourceNote(chat),
      skipStructuredBackfill: true,
    });
    assert.ok(truncatedCompile.diagnostics.length <= 500);
    assert.equal(
      truncatedCompile.diagnostics.some((diagnostic) => diagnostic.code === "event_shaped_character_fact"),
      false,
      "event-shaped warning must sit outside the retained diagnostic window for this proof",
    );
    assert.equal(
      truncatedCompile.requiresReview,
      true,
      "requiresReview must be computed from full diagnostics before truncation",
    );

    const dataDir = await mkdtemp(join(tmpdir(), "marinara-ltm-event-shaped-truncated-review-"));
    const releaseHost = configurePackageRuntime({
      isDebugAgentsEnabled: () => false,
      logger: { debug() {}, info() {}, warn() {}, error() {} },
      dataDir,
      resources: {
        listCharacters: async () => [{ id: "mara", data: { name: "Mara" }, comment: "" }],
        listPersonas: async () => [],
        listLorebooks: async () => [],
      },
      persistence: {
        getChat: async () => null,
        listChats: async () => [],
        updateChatMetadata: async () => {},
      },
    });
    const root = join(dataDir, "long-term-memory");
    const reviewScope = { characterIds: ["mara"] };
    try {
      const storage = new LongTermMemoryStorage(root);
      const durableFact = "The observatory archive keeps a cobalt ledger.";
      const eventShapedText = "Mara learned to read the observatory script.";
      const sourceText = `${durableFact} ${eventShapedText}`;
      await storage.createNote({
        ...chat,
        id: "source_event_shaped_truncated_review",
        title: "Truncated event-shaped review source",
        scope: reviewScope,
        sections: { source: { text: sourceText, updatedAt: timestamp } },
      } as never);
      const reviewSource = (await storage.getNote("source_event_shaped_truncated_review"))!;
      const sourceHash = sourceHashForLtmSourceNote(reviewSource);
      const fixtureUnits = [
        ...Array.from({ length: 520 }, (_, index) => ({
          bucket: "world_fact" as const,
          subjectId: `pad_diag_${index}`,
          sectionKey: "facts",
          text: `Unrelated token salad ${index} xyzzy quux plugh.`,
          claimKind: "static" as const,
          importance: "minor" as const,
          evidence: [`source_note:${reviewSource.id}`],
          confidence: 0.9,
          salience: 0.5,
          status: "active" as const,
          links: [] as [],
          sourceHash,
        })),
        {
          bucket: "character_fact" as const,
          subjectId: "mara",
          sectionKey: "facts",
          text: eventShapedText,
          claimKind: "static" as const,
          importance: "major" as const,
          evidence: [`source_note:${reviewSource.id}`],
          confidence: 0.9,
          salience: 0.8,
          status: "active" as const,
          links: [] as [],
          subjectNames: ["Mara"],
          sourceHash,
        },
        {
          bucket: "world_fact" as const,
          subjectId: "cobalt_ledger",
          sectionKey: "facts",
          text: durableFact,
          claimKind: "static" as const,
          importance: "major" as const,
          evidence: [`source_note:${reviewSource.id}`],
          confidence: 0.95,
          salience: 0.8,
          status: "active" as const,
          links: [] as [],
          sourceHash,
        },
      ];
      const committed = await processLongTermMemorySource({
        sourceNote: reviewSource as never,
        languageModel: {
          name: "FixtureModel",
          model: "fixture-model",
          maxContext: null,
          maxOutputTokens: null,
          fitContext(messages: unknown[], fitOptions: { maxTokens: number }) {
            return {
              messages,
              maxTokens: fitOptions.maxTokens,
              estimatedTokensBefore: 20,
              estimatedTokensAfter: 20,
              trimmed: false,
            };
          },
          async chatComplete() {
            return {
              content: JSON.stringify({
                summary: "Durable world fact with a truncated event-shaped warning.",
                units: fixtureUnits,
              }),
              finishReason: "stop",
            };
          },
        } as never,
        scope: reviewScope,
        modes: ["roleplay"],
        mode: "roleplay",
        extractionMode: "roleplay",
        operationId: randomUUID(),
        root,
        applyLowRisk: true,
      });
      assert.equal(committed.draft.reviewRequired, true, "truncated event-shaped warnings must still require review");
      assert.equal(
        committed.diagnostics.some((diagnostic) => diagnostic.code === "event_shaped_character_fact"),
        false,
        "bounded diagnostics must omit the truncated event-shaped warning",
      );
      assert.ok(
        committed.draft.mutations.some((mutation) => mutation.risk === "low"),
        "fixture must still produce an otherwise low-risk mutation",
      );
      assert.equal(
        committed.appliedMutationIds.length,
        0,
        "truncated event-shaped warnings must block low-risk auto-apply",
      );
    } finally {
      releaseHost();
      await rm(dataDir, { recursive: true, force: true });
    }
  }

  const invalidEventWithDependent = compile(chat, [
    {
      ...unit(chat, {
        bucket: "timeline_event",
        subjectId: "invalid_argument",
        sectionKey: "event",
        text: "Alice and Rowan argued.",
      }),
      // A stale source hash is the invalidation trigger now that the normalizer
      // repairs a non-event section instead of dropping the unit.
      sourceHash: "stale-source-hash",
    },
    unit(chat, {
      bucket: "world_fact",
      subjectId: "argument_aftermath",
      sectionKey: "facts",
      text: "The argument remained consequential.",
      claimKind: "change",
      links: [{ target: "timeline_invalid_argument", relation: "evidenced_by" }],
    }),
  ]);
  assert.equal(invalidEventWithDependent.accounting.keptUnits, 0);
  assert.equal(
    invalidEventWithDependent.outcome.droppedCandidates.length,
    2,
    "removing an invalid event must also orphan its dependent memory",
  );

  const invalidEventWithStaticFact = compile(chat, [
    {
      ...unit(chat, {
        bucket: "timeline_event",
        subjectId: "invalid_static_argument",
        sectionKey: "event",
        text: "Alice and Rowan argued.",
      }),
      sourceHash: "stale-source-hash",
    },
    unit(chat, {
      bucket: "world_fact",
      subjectId: "observatory",
      sectionKey: "facts",
      text: "The observatory has a brass gate.",
      claimKind: "static",
    }),
  ]);
  assert.equal(invalidEventWithStaticFact.accounting.keptUnits, 1);
  assert.equal(invalidEventWithStaticFact.compiledResponse.mutations[0]?.claimKind, "static");
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
      (mutation) => mutation.kind === "create_note" && mutation.note.type === "timeline_event",
    ),
    false,
    "static lore must not synthesize a timeline event",
  );
  assert.equal(
    repairedLoreCharacter.compiledResponse.mutations.some(
      (mutation) => mutation.kind === "create_note" && mutation.note.type === "character",
    ),
    true,
    "direct source evidence must keep the linkless static character fact",
  );

  const sourceHash = sourceHashForLtmSourceNote(chat);
  const extractionMessages = evidenceUnitMessages({
    sourceNote: chat,
    sourceText: chat.sections.source.text,
    scope: {},
    modes: ["roleplay"],
    sourceHash,
    mode: "roleplay",
  } as any);
  const extractionPrompt = JSON.parse(String(extractionMessages[1]?.content));
  assert.equal(
    extractionPrompt.existingTypedNotes,
    undefined,
    "issue #1086: the prompt must not serialize existingTypedNotes",
  );
  const unitFields = extractionPrompt.unitFields;
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
          links: [{ target: `source_note:${chat.id}`, relation: "extracted_from" }],
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
  const nearLimitEvent = parseEvidenceUnitPayload(
    {
      summary: "Near-limit provider event",
      units: [
        unit(chat, {
          bucket: "timeline_event",
          subjectId: `event_${"a".repeat(105)}`,
          sectionKey: "event",
          text: "Mara learned the observatory script.",
          links: [{ target: chat.id, relation: "extracted_from" }],
        }),
        unit(chat, {
          bucket: "character_fact",
          subjectId: "mara",
          sectionKey: "facts",
          text: "Mara learned the observatory script.",
          links: [{ target: `event_${"a".repeat(105)}`, relation: "caused_by" }],
        }),
      ],
    },
    sourceHash,
  );
  const boundedEvent = normalizeStructuredSummaryEvidenceUnits({
    units: nearLimitEvent.response.units,
    sourceText: chat.sections.source.text,
    sourceNote: chat,
    sourceHash,
  }).units[0]!;
  assert.equal(
    ltmNoteIdSchema.safeParse(`timeline_${boundedEvent.subjectId}`).success,
    true,
    "provider event IDs must leave room for server-added prefix and source suffix",
  );
  assert.deepEqual(
    nearLimitEvent.response.units[1]?.links,
    [{ target: `timeline_${nearLimitEvent.response.units[0]?.subjectId}`, relation: "caused_by" }],
    "same-response links must follow a bounded provider target",
  );
  const sharedLongSubject = `shared_${"a".repeat(115)}`;
  const sharedLongSubjectResponse = parseEvidenceUnitPayload(
    {
      summary: "Shared near-limit provider targets",
      units: [
        {
          ...unit(chat, {
            bucket: "timeline_event",
            subjectId: sharedLongSubject,
            sectionKey: "event",
            text: "Mara opened the observatory gate.",
          }),
          links: [
            { target: sharedLongSubject, relation: "affects_character" },
            { target: sharedLongSubject, relation: "involves" },
          ],
        },
        {
          ...unit(chat, {
            bucket: "character_fact",
            subjectId: sharedLongSubject,
            sectionKey: "facts",
            text: "Mara opened the observatory gate.",
          }),
          links: [{ target: sharedLongSubject, relation: "caused_by" }],
        },
      ],
    },
    sourceHash,
  );
  const sharedTimeline = sharedLongSubjectResponse.response.units.find(
    (candidate) => candidate.bucket === "timeline_event",
  )!;
  const sharedCharacter = sharedLongSubjectResponse.response.units.find(
    (candidate) => candidate.bucket === "character_fact",
  )!;
  assert.deepEqual(
    sharedTimeline.links,
    [{ target: `char_${sharedCharacter.subjectId}`, relation: "affects_character" }],
    "relation-aware remapping must route a shared bare subject to the character target",
  );
  assert.deepEqual(
    sharedCharacter.links,
    [{ target: `timeline_${sharedTimeline.subjectId}`, relation: "caused_by" }],
    "relation-aware remapping must route a shared bare subject to the timeline target",
  );
  const ambiguousGenericResponse = parseEvidenceUnitPayload(
    {
      summary: "Ambiguous generic target",
      units: [
        unit(chat, {
          bucket: "timeline_event",
          subjectId: "shared_identity",
          sectionKey: "event",
          text: "Mara opened the observatory gate.",
          links: [{ target: "shared_identity", relation: "involves" }],
        }),
        unit(chat, {
          bucket: "character_fact",
          subjectId: "shared_identity",
          sectionKey: "facts",
          text: "Mara opened the observatory gate.",
        }),
      ],
    },
    sourceHash,
  );
  assert.deepEqual(
    ambiguousGenericResponse.response.units[0]?.links,
    [],
    "generic links must fail closed when matching timeline and character targets conflict",
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
  assert.doesNotMatch(oversizedDerivedNoteId.outcome.droppedCandidates[0]?.message ?? "", /a{120}/u);
  assert.equal(
    oversizedDerivedNoteId.diagnostics.some(
      (diagnostic) => diagnostic.details?.validatorCode === "overlong_target_note_id",
    ),
    true,
  );
  assert.equal(
    oversizedDerivedNoteId.diagnostics.find(
      (diagnostic) => diagnostic.details?.validatorCode === "overlong_target_note_id",
    )?.noteId,
    undefined,
  );
  assert.equal(oversizedDerivedNoteId.outcome.droppedCandidates[0]?.recovery?.noteId, undefined);
  assert.equal(oversizedDerivedNoteId.outcome.droppedCandidates[0]?.validatorCode, "overlong_target_note_id");

  const strictStorageIds: string[][] = [];
  const legacyScope = {
    chatId: "chat-a",
    chatIds: ["chat-a"],
    characterIds: ["character-a"],
    personaIds: ["persona-a"],
  };
  const legacyHash = createHash("sha256").update("ltm_scope_v1:chat:chat-a").digest("hex").slice(0, 10);
  const legacyNoteId = `world_legacy_scope_fact_${legacyHash}`;
  const conflictingNote = {
    ...chat,
    id: "world_legacy_scope_fact",
    type: "world" as const,
    scope: { groupId: "group-b" },
    tags: [],
    sections: { facts: { text: "Other scoped memory.", updatedAt: timestamp } },
  };
  const legacyNote = {
    ...chat,
    id: legacyNoteId,
    type: "world" as const,
    scope: legacyScope,
    tags: [],
    sections: { facts: { text: "Legacy scoped memory.", updatedAt: timestamp } },
  };
  const legacyResolution = await resolveScopedEvidenceUnitTargets({
    units: [
      unit(chat, {
        bucket: "world_fact",
        subjectId: `legacy_scope_fact_${legacyHash}`,
        sectionKey: "facts",
        text: "Legacy scoped memory.",
        links: [{ target: chat.id, relation: "extracted_from" }],
      }),
    ],
    existingNotes: [legacyNote, conflictingNote],
    storage: {
      getNotesByIds: async () =>
        new Map([
          [conflictingNote.id, conflictingNote],
          [legacyNote.id, legacyNote],
        ]),
    },
    scope: legacyScope,
  });
  assert.equal(legacyResolution.remaps.size, 0);
  assert.equal(
    legacyResolution.existingNotes.some((note) => note.id === legacyNote.id),
    true,
  );
  assert.notEqual(scopedVariantNoteId("world_legacy_scope", legacyScope), legacyNoteId);
  const chatOnlyDestination = { chatId: "chat-a", chatIds: ["chat-a"] };
  const narrowerResolution = await resolveScopedEvidenceUnitTargets({
    units: [
      unit(chat, {
        bucket: "world_fact",
        subjectId: "legacy_scope_fact",
        sectionKey: "facts",
        text: "Only chat A may see this new evidence.",
        links: [{ target: chat.id, relation: "extracted_from" }],
      }),
    ],
    existingNotes: [{ ...legacyNote, id: "world_legacy_scope_fact" }],
    storage: {
      getNotesByIds: async () =>
        new Map([["world_legacy_scope_fact", { ...legacyNote, id: "world_legacy_scope_fact" }]]),
    },
    scope: chatOnlyDestination,
  });
  assert.equal(
    narrowerResolution.remaps.has("world_legacy_scope_fact"),
    true,
    "chat-only evidence forks instead of updating a persona-visible memory",
  );
  assert.equal(
    narrowerResolution.existingNotes.some((note) => note.id === "world_legacy_scope_fact"),
    false,
  );
  assert.notEqual(narrowerResolution.units[0]?.subjectId, "legacy_scope_fact");
  const destinationScopeVariants = [
    { groupIds: ["group-a"], chatIds: ["chat-a"] },
    { groupIds: ["group-a"], chatIds: ["chat-b"] },
    { groupIds: ["group-a"], characterIds: ["character-a"] },
    { groupIds: ["group-a"], personaIds: ["persona-a"] },
  ];
  assert.equal(
    new Set(destinationScopeVariants.map((scope) => scopedVariantNoteId("world_destination_union", scope))).size,
    destinationScopeVariants.length,
    "destination scope unions receive distinct scoped identities",
  );

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

  const malformedPayload = parseEvidenceUnitPayload({ units: Array.from({ length: 100 }, () => null) }, sourceHash);
  assert.equal(malformedPayload.parserRejections, 100);
  assert.equal(malformedPayload.droppedCandidates.length, 80);
  assert.equal(malformedPayload.droppedCandidates[0]?.validatorCode, "invalid_evidence_unit_format");
  assert.ok(malformedPayload.droppedCandidates[0]?.issues?.length);
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
  const overflowPayload = parseEvidenceUnitPayload({ units: Array.from({ length: 1_000 }, () => null) }, sourceHash);
  assert.equal(overflowPayload.totalCandidates, 1_000);
  assert.equal(overflowPayload.parserRejections, 1_000);
  assert.equal(overflowPayload.response.units.length, 0);
  assert.equal(overflowPayload.droppedCandidates.length, 80);
  assert.equal(overflowPayload.droppedCandidates.at(-1)?.reason, "candidate_overflow");

  const overflowWithValid = parseEvidenceUnitPayload(
    {
      units: Array.from({ length: 1_000 }, (_, index) =>
        unit(chat, {
          bucket: "world_fact",
          subjectId: `fact_${index}`,
          sectionKey: "facts",
          text: `Fact ${index}.`,
        }),
      ),
    },
    sourceHash,
  );
  assert.equal(overflowWithValid.totalCandidates, 1_000);
  assert.equal(overflowWithValid.response.units.length, 999);
  assert.equal(overflowWithValid.parserRejections, 1);
  assert.equal(overflowWithValid.droppedCandidates[0]?.reason, "candidate_overflow");

  const providerSchema = evidenceUnitResponseFormat({ allowedBuckets: ["timeline_event"], sourceHash }).json_schema
    .schema;
  const schemaText = JSON.stringify(providerSchema);
  assert.equal(/"(?:allOf|if|then|else|not|uniqueItems)"/u.test(schemaText), false);
  for (const resolveSubjectNames of [true, false]) {
    const schema = evidenceUnitResponseFormat({
      allowedBuckets: ["character_fact", "relationship_state"],
      sourceHash,
      resolveSubjectNames,
    }).json_schema.schema as any;
    const item = schema.properties.units.items;
    assert.equal(item.required.includes("id"), false);
    assert.equal(item.required.includes("sourceHash"), false);
    assert.equal(item.required.includes("evidence"), false);
    assert.equal(item.required.includes("subjectNames"), resolveSubjectNames);
    assert.equal(item.properties.dimensions.properties.trust.minimum, 0);
    assert.equal(item.properties.dimensionChanges.properties.trust.minimum, -100);
    assert.equal(item.properties.links.items.properties.aspect.maxLength, 50);
  }
  const diagnosticHeavy = compileEvidenceUnitExtraction({
    unitResponse: {
      summary: "Diagnostic bound",
      units: Array.from({ length: 600 }, (_, index) =>
        unit(chat, {
          bucket: "timeline_event",
          subjectId: `invalid_event_${index}`,
          sectionKey: "event",
          text: "Not present in source.",
          links: [{ target: "missing_event", relation: "evidenced_by" }],
        }),
      ),
    },
    providerCandidates: 600,
    sourceText: chat.sections.source.text,
    sourceNote: chat,
    existingNotes: [],
    scope: {},
    modes: ["roleplay"],
    mode: "roleplay",
    sourceHash,
    skipStructuredBackfill: true,
  });
  assert.ok(diagnosticHeavy.diagnostics.length <= 500);

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
    (mutation) => mutation.kind === "update_section" && mutation.sectionKey === "profile",
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
      .filter(
        (mutation): mutation is Extract<(typeof titledCreateCompilation.mutations)[number], { kind: "create_note" }> =>
          mutation.kind === "create_note",
      )
      .map((mutation) => [mutation.note.type, mutation.note.title]),
  );
  assert.equal(createdTitles.get("timeline_event"), "Trust-Straining Argument");
  assert.equal(createdTitles.get("thread"), "Repair Their Trust");
  assert.equal(createdTitles.get("world"), "Observatory Script");
  assert.equal(createdTitles.get("tone"), "Guarded Register");
  assert.equal(createdTitles.get("character"), "Mara");
  assert.equal(createdTitles.get("relationship"), "Alice and Rowan");

  const untitledCreateCompilation = compileTitleCases(titleCases.map(({ title: _title, ...input }) => input));
  const fallbackTitles = new Map(
    untitledCreateCompilation.mutations
      .filter(
        (
          mutation,
        ): mutation is Extract<(typeof untitledCreateCompilation.mutations)[number], { kind: "create_note" }> =>
          mutation.kind === "create_note",
      )
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
      (diagnostic) => diagnostic.details?.validatorCode === "static_relationship_dimension_change",
    ),
    true,
  );

  const dedupUnit = (text: string, subjectId = "dedup_subject", sectionKey = "facts") =>
    unit(chat, {
      bucket: "world_fact",
      subjectId,
      sectionKey,
      text,
    });
  const shared = Array.from({ length: 17 }, (_, index) => `shared${index}`).join(" ");
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
    dedupResult.diagnostics.filter((diagnostic) => diagnostic.code === "deduplicated_evidence_unit").length,
    4,
    "dedup must characterize same-batch, existing-note, threshold, and exact matches",
  );

  const longTailText = Array.from({ length: 700 }, (_, index) => `filler${index}`).join(" ");
  const longTailUnit = dedupUnit("The observatory gate remains sealed.", "long_tail_subject");
  const longTailResult = deduplicateUnits(
    [longTailUnit],
    [
      {
        ...chat,
        id: "world_long_tail_subject",
        type: "world" as const,
        sections: { facts: { text: `${longTailText} The observatory gate remains sealed.` } },
      } as any,
    ],
  );
  assert.equal(
    longTailResult.deduplicated.length,
    0,
    "same-section duplicates must still match at a long-section tail",
  );

  const interiorUnitText = [
    "observatory",
    "gate",
    "remains",
    "sealed",
    "during",
    "nightly",
    "watch",
    "despite",
    "storm",
    "damage",
    "around",
    "hinges",
    "after",
    "winter",
    "repairs",
  ].join(" ");
  const interiorCandidateText = interiorUnitText.replace("nightly", "nighttime");
  const interiorResult = deduplicateUnits(
    [dedupUnit(interiorUnitText, "interior_subject")],
    [
      {
        ...chat,
        id: "world_interior_subject",
        type: "world" as const,
        sections: {
          facts: {
            text: [
              ...Array.from({ length: 731 }, (_, index) => `interiorfiller${index}`),
              interiorCandidateText,
              ...Array.from({ length: 258 }, (_, index) => `interiortail${index}`),
            ].join(" "),
          },
        },
      } as any,
    ],
  );
  assert.equal(interiorResult.deduplicated.length, 0, "same-section near-duplicates must match at interior offsets");

  const crossSectionResult = deduplicateUnits(
    [dedupUnit("The observatory gate remains sealed.", "cross_scope_subject", "history")],
    [
      {
        ...chat,
        id: "world_cross_scope_subject",
        type: "world" as const,
        sections: { facts: { text: "The observatory gate remains sealed." } },
      } as any,
    ],
  );
  assert.equal(crossSectionResult.deduplicated.length, 1, "duplicates must remain section-scoped");

  const crossNoteResult = deduplicateUnits(
    [dedupUnit("The observatory gate remains sealed.", "cross_note_subject")],
    [
      {
        ...chat,
        id: "world_other_subject",
        type: "world" as const,
        sections: { facts: { text: "The observatory gate remains sealed." } },
      } as any,
    ],
  );
  assert.equal(crossNoteResult.deduplicated.length, 1, "duplicates must remain target-note scoped");

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
  const aliasEvent = validateLtmEvidenceUnits({
    units: [
      unit(chat, {
        bucket: "timeline_event",
        subjectId: "Sera",
        sectionKey: "event",
        text: "Sera arrived at the observatory.",
      }),
    ],
    sourceText: chat.sections.source.text,
    sourceNote: chat,
    existingNotes: [],
    expectedSourceHash: sourceHashForLtmSourceNote(chat),
    eventSubjectIdentityKeys: new Set(["sera"]),
  });
  assert.equal(aliasEvent.droppedCandidates[0]?.validatorCode, "event_subject_matches_character_alias");
  assert.equal(aliasEvent.droppedCandidates[0]?.reason, "unsupported_bucket");
  const subjectIdentityRejection = resolveLtmSubjectIdentities({
    units: [
      unit(chat, {
        bucket: "character_fact",
        subjectId: "unknown_person",
        sectionKey: "facts",
        text: "An unknown person has a durable fact.",
        subjectNames: ["Unknown Person"],
      }),
    ],
    catalog: identityCatalog,
    existingNotes: [],
    scope: {},
    mode: "roleplay",
  });
  assert.equal(subjectIdentityRejection.droppedCandidates[0]?.validatorCode, "untrusted_subject_identity");
  const collisionCatalog = buildTrustedLtmSubjectCatalog({
    roster: [
      { kind: "character", id: "alex-a", name: "Alex" },
      { kind: "character", id: "alex-b", name: "Alex" },
      { kind: "character", id: "rowan-a", name: "Rowan" },
      { kind: "character", id: "rowan-b", name: "Rowan" },
    ],
    notes: [],
  });
  const collisionChat = sourceNote(
    "source_identity_collisions",
    { kind: "chat_summary", sourceId: "chat-c", entryId: "summary-c" },
    "alex-a remembers the gate. alex-b remembers the gate. Pair a trusts the other. Pair b trusts the other.",
  );
  const collisionUnits = [
    ...["alex-a", "alex-b"].map((id) => ({
      ...unit(collisionChat, {
        bucket: "character_fact" as const,
        subjectId: "alex",
        sectionKey: "facts",
        claimKind: "static",
        text: `${id} remembers the gate.`,
      }),
      subjectKeys: [`character:${id}`],
    })),
    ...["a", "b"].map((suffix) => ({
      ...unit(collisionChat, {
        bucket: "relationship_state" as const,
        subjectId: "alex_rowan",
        sectionKey: "state",
        claimKind: "static",
        text: `Pair ${suffix} trusts the other.`,
      }),
      subjectKeys: [`character:alex-${suffix}`, `character:rowan-${suffix}`],
    })),
  ];
  const collisionResolution = resolveLtmSubjectIdentities({
    units: collisionUnits,
    catalog: collisionCatalog,
    existingNotes: [],
    scope: {},
    mode: "roleplay",
  });
  assert.equal(collisionResolution.units.length, 4);
  const collisionIds = collisionResolution.units.map((resolved: any) =>
    resolved.bucket === "character_fact" ? `char_${resolved.subjectId}` : `rel_${resolved.subjectId}`,
  );
  assert.equal(new Set(collisionIds).size, 4, "distinct trusted identities must have distinct targets");
  const collisionCompilation = compile(collisionChat, collisionResolution.units, true);
  assert.deepEqual(
    new Set(
      collisionCompilation.compiledResponse.mutations.map((mutation: any) =>
        mutation.kind === "create_note" ? mutation.note.id : mutation.noteId,
      ),
    ),
    new Set(collisionIds),
    "normalization and compilation must not mix facts from different identities",
  );
  for (const [index, id] of collisionIds.entries()) {
    const created = collisionCompilation.compiledResponse.mutations.find(
      (mutation: any) => mutation.kind === "create_note" && mutation.note.id === id,
    );
    assert.equal(
      Object.values((created as any)?.note.sections ?? {}).some((section: any) =>
        section.text.includes(collisionUnits[index]!.text),
      ),
      true,
      "each distinct target must receive only its own fact",
    );
  }
  const resolvedVoice = { ...collisionResolution.units[0]!, subjectId: "alex_voice", sectionKey: "voice" };
  assert.equal(
    normalizeStructuredSummaryEvidenceUnits({ units: [resolvedVoice], sourceText: "", sourceHash }).units[0]?.subjectId,
    "alex_voice",
    "a subject-bound target ending in a section name must not be stripped again",
  );
  const canonicalIdentityNote = identityNote("char_seraphina", "Seraphina Duvall", [
    identityCatalog.entries.find((entry: any) => entry.name === "Seraphina Duvall")!.subject,
  ]);
  identityCatalog.notes.push(canonicalIdentityNote);
  const canonicalSubject = canonicalIdentityNote.subjects[0];
  const legacyIdentityNote = {
    ...identityNote("char_seraphina_legacy", "Legacy Seraphina", [canonicalSubject]),
    sections: { facts: { text: "Seraphina Duvall is trusted.", updatedAt: timestamp } },
  };
  const canonicalizedUnit = {
    ...unit(chat, {
      bucket: "character_fact",
      subjectId: "seraphina_duvall",
      sectionKey: "facts",
      text: "Seraphina Duvall is trusted.",
      subjectNames: ["Seraphina Duvall"],
    }),
    subjects: [canonicalSubject],
  };
  const subjectIdentityDedup = deduplicateUnits([canonicalizedUnit], [legacyIdentityNote]);
  assert.equal(
    subjectIdentityDedup.deduplicated.length,
    0,
    "canonical subject identity must deduplicate an equivalent legacy target id",
  );
  const distinctSubjectDedup = deduplicateUnits(
    [
      {
        ...canonicalizedUnit,
        subjectId: "rowan_hale",
        subjects: [subject("character:rowan", { kind: "character", id: "rowan" })],
      },
    ],
    [legacyIdentityNote],
  );
  assert.equal(distinctSubjectDedup.deduplicated.length, 1, "distinct canonical subjects must remain separate");
  const scopeA = { chatId: "chat-a", chatIds: ["chat-a"] };
  const scopeB = { chatId: "chat-b", chatIds: ["chat-b"] };
  const overlappingScope = { chatIds: ["chat-a", "chat-b"] };
  const targetScopeNote = {
    ...legacyIdentityNote,
    id: "char_seraphina_scope_a",
    scope: scopeA,
    sections: { facts: { text: "Seraphina Duvall is cautious.", updatedAt: timestamp } },
  };
  const otherScopeDuplicate = {
    ...legacyIdentityNote,
    id: "char_seraphina_scope_b",
    scope: scopeB,
    sections: { facts: { text: "Seraphina Duvall is trusted.", updatedAt: timestamp } },
  };
  const scopedUnit = {
    ...unit(scopedChat, {
      bucket: "character_fact",
      subjectId: "seraphina_scope_a",
      sectionKey: "facts",
      text: "Seraphina Duvall is trusted.",
      claimKind: "static",
      subjectNames: ["Seraphina Duvall"],
    }),
    subjects: [canonicalSubject],
  };
  const crossScopeDedup = deduplicateUnits([scopedUnit], [targetScopeNote, otherScopeDuplicate], overlappingScope);
  assert.equal(
    crossScopeDedup.deduplicated.length,
    1,
    "an identical memory in a merely overlapping scope must not suppress the target-scope write",
  );
  const crossScopeCompilation = compile(scopedChat, [scopedUnit], true, [targetScopeNote, otherScopeDuplicate], scopeA);
  assert.equal(
    crossScopeCompilation.accounting.keptUnits,
    1,
    "an overlapping-scope duplicate must not be dropped before the target-scope write",
  );
  assert.equal(
    crossScopeCompilation.outcome.droppedCandidates.filter(
      (candidate: any) => candidate.noteId === "char_seraphina_scope_a",
    ).length,
    0,
    "the target-scope note must not be dropped as out of scope",
  );
  assert.equal(
    crossScopeDedup.diagnostics.some((diagnostic) => diagnostic.code === "deduplicated_evidence_unit"),
    false,
  );
  const sameScopeDedup = deduplicateUnits(
    [scopedUnit],
    [targetScopeNote, { ...otherScopeDuplicate, scope: scopeA }],
    overlappingScope,
  );
  assert.equal(sameScopeDedup.deduplicated.length, 0, "same-scope subject duplicates must still deduplicate");
  const omittedScopeDedup = deduplicateUnits([scopedUnit], [otherScopeDuplicate]);
  assert.equal(
    omittedScopeDedup.deduplicated.length,
    1,
    "an omitted scope must not fall back to matching a subject-equivalent note in another scope",
  );
  const directTargetNote = {
    ...canonicalIdentityNote,
    id: "char_seraphina_duvall",
  };
  const directTargetCatalog = buildTrustedLtmSubjectCatalog({
    roster: [{ kind: "character", id: "seraphina", name: "Seraphina Duvall" }],
    notes: [],
  });
  const directTargetIdentity = resolveLtmSubjectIdentities({
    units: [
      unit(chat, {
        bucket: "character_fact",
        subjectId: "seraphina_duvall",
        sectionKey: "facts",
        text: "Seraphina Duvall is trusted.",
        subjectNames: ["Seraphina Duvall"],
      }),
    ],
    catalog: directTargetCatalog,
    existingNotes: [],
    scope: {},
    mode: "roleplay",
  });
  const directTargetResolution = await resolveScopedEvidenceUnitTargets({
    units: directTargetIdentity.units,
    existingNotes: directTargetIdentity.existingNotes,
    storage: {
      getNotesByIds: async () => new Map([[directTargetNote.id, directTargetNote]]),
    },
    scope: {},
  });
  assert.deepEqual(
    directTargetResolution.existingNotes.map((note: any) => note.id),
    ["char_seraphina_duvall"],
    "direct target lookup must join a retrieval-missed canonical note to deduplication",
  );
  const directTargetCompilation = compile(
    chat,
    directTargetResolution.units,
    true,
    directTargetResolution.existingNotes,
  );
  assert.equal(directTargetCompilation.accounting.deduplications, 1);
  assert.equal(directTargetCompilation.compiledResponse.mutations.length, 0);
  assert.deepEqual(
    trustedLtmIdentityNotesForSource({
      sourceText: "Serafina Duvall entered the observatory.",
      catalog: identityCatalog,
    }).map((note: any) => note.id),
    [],
    "a spelling variation alone must not select a trusted identity note",
  );
  assert.deepEqual(
    trustedLtmIdentityNotesForSource({
      sourceText: "Duvall entered the observatory.",
      catalog: identityCatalog,
    }),
    [],
    "a surname-only mention must not select a trusted identity",
  );
  const legacySpellingNote = identityNote("char_serafina_legacy", "Serafina Duvall");
  identityCatalog.notes.push(legacySpellingNote);
  const spellingIssue = analyzeTrustedLtmNoteSubjects(identityCatalog).unresolved.find(
    (issue: any) => issue.note.id === legacySpellingNote.id,
  );
  assert.equal(
    spellingIssue?.basis,
    "spelling_variation",
    "identity repair should suggest rather than bind a fuzzy identity",
  );
  assert.deepEqual(spellingIssue?.candidateSubjectKeys, ["character:seraphina"]);
  const ambiguousCatalog = buildTrustedLtmSubjectCatalog({
    roster: [
      { kind: "character", id: "one", name: "Seraphina Duvall" },
      { kind: "character", id: "two", name: "Serafira Duvall" },
    ],
    notes: [],
  });
  ambiguousCatalog.notes.push(identityNote("char_one", "Seraphina Duvall", [ambiguousCatalog.entries[0]!.subject]));
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

void runRegressionToCompletion("long-term-memory-extraction-graph", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
