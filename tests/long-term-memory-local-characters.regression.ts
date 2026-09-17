import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runRegressionToCompletion } from "./regression-helpers.ts";

const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
const timestamp = "2026-09-04T00:00:00.000Z";

function unit(input: {
  bucket: "character_fact" | "relationship_state";
  subjectId: string;
  subjectNames: string[];
  text: string;
  sectionKey?: string;
}) {
  return {
    id: randomUUID(),
    sectionKey: input.sectionKey ?? (input.bucket === "relationship_state" ? "relationship" : "facts"),
    ...input,
    importance: "major" as const,
    keywords: [],
    evidence: ["source_note:roleplay-source"],
    confidence: 0.95,
    salience: 0.8,
    status: "active" as const,
    links: [],
    sourceHash: "source-hash",
  };
}

async function main() {
  const { compileLtmEvidenceUnits } = await import(`${source}/evidence-unit-compiler.ts`);
  const { localCharacterScopeError, localCharacterSubjectForName, ltmScopeFamilyId } = await import(
    `${source}/chat-scope.ts`
  );
  const { buildTrustedLtmSubjectCatalog, prepareLtmSubjectIdentityContext, trustedLtmIdentityNotesForSource } =
    await import(`${source}/subject-identity.ts`);

  const sourceNote = {
    id: "roleplay-source",
    title: "Mara and Rowan",
    type: "source" as const,
    status: "active" as const,
    modes: ["roleplay" as const],
    scope: { chatId: "chat-a", chatIds: ["chat-a"] },
    tags: ["source_summary"],
    keywords: [],
    links: [],
    sections: { source: { text: "Mara trusts Rowan. Rowan keeps Mara's secret.", updatedAt: timestamp } },
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
  const scope = { chatId: "chat-a", chatIds: ["chat-a"] };
  const context = prepareLtmSubjectIdentityContext({
    units: [
      unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara trusts Rowan." }),
      unit({
        bucket: "relationship_state",
        subjectId: "mara_rowan",
        subjectNames: ["Mara", "Rowan"],
        text: "Mara trusts Rowan.",
      }),
    ],
    catalog: { entries: [], notes: [] },
    scope,
    sourceBackedNpcSourceText: sourceNote.sections.source.text,
    sourceBackedNpcSourceTitle: sourceNote.title,
  });
  const resolved = context.resolve({
    units: [
      unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara trusts Rowan." }),
      unit({
        bucket: "relationship_state",
        subjectId: "mara_rowan",
        subjectNames: ["Mara", "Rowan"],
        text: "Mara trusts Rowan.",
      }),
    ],
    existingNotes: [],
  });
  assert.equal(resolved.units.length, 2);
  assert.equal(resolved.units[0]!.subjects?.[0]?.key.startsWith("local_character:"), true);
  assert.equal(resolved.units[1]!.subjects?.length, 2);
  assert.equal(new Set(resolved.units[1]!.subjects?.map((subject) => subject.key)).size, 2);

  const compiled = compileLtmEvidenceUnits({
    units: resolved.units,
    existingNotes: [],
    scope,
    modes: ["roleplay"],
    mode: "roleplay",
    createdAt: timestamp,
  });
  assert.ok(compiled.mutations.length > 0);
  assert.equal(
    compiled.mutations.every((mutation) => mutation.risk === "medium"),
    true,
  );

  const validSubject = localCharacterSubjectForName(scope, "Mara")!;
  assert.equal(localCharacterScopeError([validSubject], scope), null);
  assert.notEqual(
    localCharacterScopeError([localCharacterSubjectForName({ chatId: "chat-b", chatIds: ["chat-b"] }, "Mara")!], scope),
    null,
  );
  assert.notEqual(
    localCharacterSubjectForName({ groupId: "shared-family", groupIds: ["shared-family"] }, "Mara")!.key,
    localCharacterSubjectForName({ chatId: "shared-family", chatIds: ["shared-family"] }, "Mara")!.key,
  );
  const longGroupA = "g".repeat(120);
  const longGroupB = `${"g".repeat(119)}h`;
  assert.notEqual(
    localCharacterSubjectForName({ groupId: longGroupA, groupIds: [longGroupA] }, "Mara")!.key,
    localCharacterSubjectForName({ groupId: longGroupB, groupIds: [longGroupB] }, "Mara")!.key,
  );
  const longNameA = `${"m".repeat(60)}a`;
  const longNameB = `${"m".repeat(60)}b`;
  assert.notEqual(
    localCharacterSubjectForName(scope, longNameA)!.key,
    localCharacterSubjectForName(scope, longNameB)!.key,
  );
  assert.notEqual(localCharacterSubjectForName(scope, "Mara!")!.key, localCharacterSubjectForName(scope, "Mara?")!.key);
  assert.notEqual(
    localCharacterSubjectForName({ groupId: "family-a", groupIds: ["family-a"] }, "Mara")!.key,
    localCharacterSubjectForName({ groupId: "family_a", groupIds: ["family_a"] }, "Mara")!.key,
  );

  const generic = prepareLtmSubjectIdentityContext({
    units: [
      unit({ bucket: "character_fact", subjectId: "guard", subjectNames: ["the guard"], text: "The guard waits." }),
    ],
    catalog: { entries: [], notes: [] },
    scope,
    sourceBackedNpcSourceText: "The guard waits.",
  }).resolve({
    units: [
      unit({ bucket: "character_fact", subjectId: "guard", subjectNames: ["the guard"], text: "The guard waits." }),
    ],
    existingNotes: [],
  });
  assert.equal(generic.units.length, 0);

  const otherFamily = prepareLtmSubjectIdentityContext({
    units: [unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara arrives." })],
    catalog: { entries: [], notes: [] },
    scope: { chatId: "chat-b", chatIds: ["chat-b"] },
    sourceBackedNpcSourceText: "Mara arrives.",
  }).resolve({
    units: [unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara arrives." })],
    existingNotes: [],
  });
  assert.notEqual(resolved.units[0]!.subjects?.[0]?.key, otherFamily.units[0]!.subjects?.[0]?.key);

  const familyId = ltmScopeFamilyId(scope);
  const ambiguous = buildTrustedLtmSubjectCatalog({
    roster: [],
    notes: [
      {
        ...sourceNote,
        id: "char_mara_one",
        type: "character",
        title: "Mara",
        subjects: [
          {
            key: `local_character:${familyId}:mara-one`,
            ref: { kind: "local_character", id: `${familyId}:mara-one` },
          },
        ],
      } as any,
      {
        ...sourceNote,
        id: "char_mara_two",
        type: "character",
        title: "Mara",
        subjects: [
          {
            key: `local_character:${familyId}:mara-two`,
            ref: { kind: "local_character", id: `${familyId}:mara-two` },
          },
        ],
      } as any,
    ],
  });
  assert.equal(ambiguous.entries.filter((entry) => entry.name === "Mara").length, 0);
  assert.equal(
    prepareLtmSubjectIdentityContext({
      units: [unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara arrives." })],
      catalog: ambiguous,
      scope,
      sourceBackedNpcSourceText: "Mara arrives.",
    }).resolve({
      units: [unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara arrives." })],
      existingNotes: [],
    }).units.length,
    0,
  );
  const gameResolution = prepareLtmSubjectIdentityContext({
    units: [unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara arrives." })],
    catalog: {
      entries: [{ subject: validSubject, name: "Mara", aliases: [], canonicalSlug: "mara", familyId: "chat_chat_a" }],
      notes: [],
    },
    scope,
    mode: "game",
    sourceBackedNpcSourceText: "Mara arrives.",
  }).resolve({
    units: [unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara arrives." })],
    existingNotes: [],
  });
  assert.equal(
    gameResolution.units.some((item) => item.subjects?.some((subject) => subject.ref?.kind === "local_character")),
    false,
  );
  assert.deepEqual(
    trustedLtmIdentityNotesForSource({
      sourceText: "Mara arrives.",
      mode: "game",
      catalog: {
        entries: [{ subject: validSubject, name: "Mara", aliases: [], canonicalSlug: "mara", familyId: "chat_chat_a" }],
        notes: [
          {
            ...sourceNote,
            id: "char_local_mara",
            type: "character",
            title: "Mara",
            subjects: [validSubject],
          } as any,
        ],
      },
    }),
    [],
  );
  const gameCatalog = buildTrustedLtmSubjectCatalog({
    roster: [],
    notes: [],
    localSourceNotes: [
      {
        ...sourceNote,
        modes: ["game"],
        title: "Cobalt and Vela",
        sections: { source: { text: "Vela enters the Cobalt campaign.", updatedAt: timestamp } },
      } as any,
    ],
  });
  assert.equal(
    gameCatalog.entries.some((entry) => entry.name === "Vela"),
    false,
  );
  const { evidenceUnitMessages } = await import(`${source}/evidence-unit-extraction.ts`);
  const messages = evidenceUnitMessages({
    sourceNote: { ...sourceNote, modes: ["game"] } as any,
    sourceText: "Mara visits the party.",
    sourceHash: "a".repeat(64),
    modes: ["game"],
    mode: "game",
    trustedSubjectCatalog: {
      entries: [{ subject: validSubject, name: "Mara", aliases: [], canonicalSlug: "mara", familyId: "chat_chat_a" }],
      notes: [],
    },
    languageModel: {} as any,
  });
  const promptBody = JSON.stringify(messages);
  assert.equal(promptBody.includes("local_character:"), false);

  const { normalizeStructuredSummaryEvidenceUnits } = await import(`${source}/structured-summary-normalizer.ts`);

  // --- I01: Ambiguity diagnostics & competing records with provenance ---
  const duplicateDisplayNameCatalog = buildTrustedLtmSubjectCatalog({
    roster: [
      {
        kind: "character",
        id: "char_direct_alex",
        name: "Alex",
        provenance: "roster:character:char_direct_alex",
        sourceScope: "direct",
      },
      {
        kind: "character",
        id: "char_group_alex",
        name: "Alex",
        provenance: "group_roster:character:char_group_alex",
        sourceScope: "group",
      },
    ],
    notes: [],
  });
  const ambiguityResolution = prepareLtmSubjectIdentityContext({
    units: [unit({ bucket: "character_fact", subjectId: "alex", subjectNames: ["Alex"], text: "Alex is an archer." })],
    catalog: duplicateDisplayNameCatalog,
    scope,
  }).resolve({
    units: [unit({ bucket: "character_fact", subjectId: "alex", subjectNames: ["Alex"], text: "Alex is an archer." })],
    existingNotes: [],
  });
  assert.equal(ambiguityResolution.units.length, 0);
  assert.equal(ambiguityResolution.droppedCandidates.length, 1);
  assert.equal(ambiguityResolution.droppedCandidates[0]!.reason, "ambiguous_subject");
  assert.equal(ambiguityResolution.diagnostics.length, 1);
  assert.equal(ambiguityResolution.diagnostics[0]!.code, "ambiguous_subject_identity");
  const diagnosticDetails = ambiguityResolution.diagnostics[0]!.details as any;
  assert.ok(diagnosticDetails);
  assert.equal(diagnosticDetails.competingSubjectKeys?.length, 2);
  assert.ok(diagnosticDetails.competingRecords?.length >= 2);
  assert.equal(diagnosticDetails.collisionSource, "group_catalog");
  assert.ok(diagnosticDetails.competingRecords.some((r: any) => r.provenance?.includes("group_roster")));

  // --- I02: Preserve explicit participant names through structured backfill ---
  const structuredSummaryText = `## Relationships
- Mara and Rowan | characters: Mara, Rowan | state: Mara trusts Rowan completely.

## Character Facts
- character: Mara | Mara knows astronomy.
`;
  const backfillNormalizerResult = normalizeStructuredSummaryEvidenceUnits({
    units: [],
    sourceText: structuredSummaryText,
    sourceNote: sourceNote as any,
    sourceHash: "b".repeat(64),
    existingNotes: [],
    allowedBuckets: ["relationship_state", "character_fact"],
    mode: "roleplay",
    modes: ["roleplay"],
    relationshipIdentityKey: context.identityKeyForUnit,
    characterIdentityKey: context.identityKeyForUnit,
  });
  const backfilledRel = backfillNormalizerResult.units.find((u) => u.bucket === "relationship_state");
  assert.ok(backfilledRel);
  assert.deepEqual(backfilledRel.subjectNames, ["Mara", "Rowan"]);
  assert.equal(backfilledRel.text.includes("characters:"), false);
  assert.equal(backfilledRel.text.includes("Mara, Rowan |"), false);

  const backfilledChar = backfillNormalizerResult.units.find((u) => u.bucket === "character_fact");
  assert.ok(backfilledChar);
  assert.deepEqual(backfilledChar.subjectNames, ["Mara"]);

  const backfilledResolution = context.resolve({
    units: backfillNormalizerResult.units,
    existingNotes: [],
  });
  assert.ok(backfilledResolution.units.length >= 2);
  const resolvedBackfillRel = backfilledResolution.units.find((u) => u.bucket === "relationship_state");
  assert.ok(resolvedBackfillRel);
  assert.equal(resolvedBackfillRel.subjects?.length, 2);

  // --- I03: Unify named/backfilled identity and coverage matching ---
  // 1. Shared surnames do not trigger false cardinality drops
  const vanceCatalog = buildTrustedLtmSubjectCatalog({
    roster: [
      { kind: "character", id: "char_alice_vance", name: "Alice Vance", aliases: ["Alice"] },
      { kind: "character", id: "char_bob_vance", name: "Bob Vance", aliases: ["Bob"] },
    ],
    notes: [],
  });
  const vanceContext = prepareLtmSubjectIdentityContext({
    units: [
      unit({
        bucket: "character_fact",
        subjectId: "alice_vance",
        subjectNames: [],
        text: "Alice Vance is an engineer.",
      }),
    ],
    catalog: vanceCatalog,
    scope,
  });
  const vanceResolution = vanceContext.resolve({
    units: [
      unit({
        bucket: "character_fact",
        subjectId: "alice_vance",
        subjectNames: [],
        text: "Alice Vance is an engineer.",
      }),
    ],
    existingNotes: [],
  });
  assert.equal(vanceResolution.units.length, 1);
  assert.equal(vanceResolution.droppedCandidates.length, 0);
  assert.equal(vanceResolution.units[0]!.subjects?.[0]?.key, "character:char_alice_vance");

  // 2. Short/full-name pairs resolve to identical notes
  const pairContext = prepareLtmSubjectIdentityContext({
    units: [
      unit({ bucket: "character_fact", subjectId: "alice", subjectNames: ["Alice"], text: "Alice arrives." }),
      unit({
        bucket: "character_fact",
        subjectId: "alice_vance",
        subjectNames: ["Alice Vance"],
        text: "Alice Vance departs.",
      }),
    ],
    catalog: vanceCatalog,
    scope,
  });
  const pairResolution = pairContext.resolve({
    units: [
      unit({ bucket: "character_fact", subjectId: "alice", subjectNames: ["Alice"], text: "Alice arrives." }),
      unit({
        bucket: "character_fact",
        subjectId: "alice_vance",
        subjectNames: ["Alice Vance"],
        text: "Alice Vance departs.",
      }),
    ],
    existingNotes: [],
  });
  assert.equal(pairResolution.units.length, 2);
  assert.equal(pairResolution.units[0]!.subjectId, pairResolution.units[1]!.subjectId);
  assert.equal(pairResolution.units[0]!.subjects?.[0]?.key, pairResolution.units[1]!.subjects?.[0]?.key);

  // 3. Redundant backfill candidates for covered facts are suppressed
  const coveredModelUnit = unit({
    bucket: "character_fact",
    subjectId: "alice",
    subjectNames: ["Alice"],
    text: "Alice knows navigation.",
  });
  const backfillCoveredSummary = `## Character Facts
- character: Alice Vance | Alice knows navigation.
`;
  const coveredBackfillResult = normalizeStructuredSummaryEvidenceUnits({
    units: [coveredModelUnit],
    sourceText: backfillCoveredSummary,
    sourceNote: sourceNote as any,
    sourceHash: "c".repeat(64),
    existingNotes: [],
    allowedBuckets: ["character_fact"],
    mode: "roleplay",
    modes: ["roleplay"],
    characterIdentityKey: vanceContext.identityKeyForUnit,
  });
  assert.equal(coveredBackfillResult.units.length, 1);
  assert.equal(coveredBackfillResult.addedUnits, 0);

  process.stdout.write(
    "Long-Term Memory local-character regression: scoped identity, review risk, safeguards, and isolation passed\n",
  );
}

void runRegressionToCompletion("long-term-memory-local-characters", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
