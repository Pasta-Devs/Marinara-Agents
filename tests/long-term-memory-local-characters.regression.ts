import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { runRegressionToCompletion } from "./regression-helpers.ts";

const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
const timestamp = "2026-09-04T00:00:00.000Z";

function unit(input: {
  bucket: "character_fact" | "relationship_state";
  subjectId: string;
  subjectNames?: string[];
  subjectKeys?: string[];
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
  const { normalizeStructuredSummaryEvidenceUnits } = await import(`${source}/structured-summary-normalizer.ts`);
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
  const shortNameContext = prepareLtmSubjectIdentityContext({
    units: [
      unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara arrives." }),
      unit({
        bucket: "character_fact",
        subjectId: "mara_ellison",
        subjectNames: ["Mara Ellison"],
        text: "Mara Ellison arrives.",
      }),
    ],
    catalog: { entries: [], notes: [] },
    scope,
    sourceBackedNpcSourceText: "Mara and Mara Ellison arrive.",
  }).resolve({
    units: [
      unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara arrives." }),
      unit({
        bucket: "character_fact",
        subjectId: "mara_ellison",
        subjectNames: ["Mara Ellison"],
        text: "Mara Ellison arrives.",
      }),
    ],
    existingNotes: [],
  });
  assert.equal(shortNameContext.units[0]!.subjects?.[0]?.key, shortNameContext.units[1]!.subjects?.[0]?.key);

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
  const onDemandFullName = prepareLtmSubjectIdentityContext({
    units: [],
    catalog: {
      entries: [
        {
          subject: validSubject,
          name: "Mara",
          aliases: [],
          canonicalSlug: "mara",
          familyId: ltmScopeFamilyId(scope),
        },
      ],
      notes: [],
    },
    scope,
    sourceBackedNpcSourceText: "Mara Ellison arrives.",
    sourceBackedNpcSourceTitle: "Mara Ellison",
  }).resolve({
    units: [
      unit({
        bucket: "character_fact",
        subjectId: "mara_ellison",
        subjectNames: ["Mara Ellison"],
        text: "Mara Ellison arrives.",
      }),
    ],
    existingNotes: [],
  });
  assert.equal(onDemandFullName.units[0]!.subjects?.[0]?.key, validSubject.key);
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
      { kind: "character", id: "rowan", name: "Rowan" },
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

  // Explicit catalog keys disambiguate names in both resolution and backfill identity lookup.
  const alexKey = "character:char_direct_alex";
  const rowanKey = "character:rowan";
  for (const bucket of ["character_fact", "relationship_state"] as const) {
    const subjectKeys = bucket === "character_fact" ? [alexKey] : [rowanKey, alexKey];
    const subjectNames = bucket === "character_fact" ? ["Alex"] : ["Alex", "Rowan"];
    const candidate = unit({
      bucket,
      subjectId: "provider_subject",
      subjectNames,
      subjectKeys,
      text: "Alex trusts Rowan.",
    });
    const keyedContext = prepareLtmSubjectIdentityContext({
      units: [candidate],
      catalog: duplicateDisplayNameCatalog,
      scope,
      sourceBackedNpcSourceText: "Alex trusts Rowan.",
    });
    const keyOnlyTarget = keyedContext.identityKeyForUnit({ ...candidate, subjectNames: undefined });
    for (const names of [subjectNames, ["Unknown name"], [], undefined]) {
      const input = { ...candidate, subjectNames: names };
      const result = keyedContext.resolve({ units: [input], existingNotes: [] });
      assert.equal(result.units.length, 1, "trusted keys must take precedence over name matching");
      assert.deepEqual(result.units[0]!.subjectKeys, [...subjectKeys].sort());
      assert.deepEqual(
        result.units[0]!.subjects?.map((subject) => subject.key),
        [...subjectKeys].sort(),
      );
      assert.deepEqual(result.units[0]!.subjectNames, subjectNames);
      assert.equal(keyedContext.identityKeyForUnit(input), keyOnlyTarget);
      assert.equal(`${bucket === "character_fact" ? "char" : "rel"}_${result.units[0]!.subjectId}`, keyOnlyTarget);
      assert.equal(result.droppedCandidates.length, 0);
    }
    for (const keys of [undefined, []]) {
      const result = keyedContext.resolve({ units: [{ ...candidate, subjectKeys: keys }], existingNotes: [] });
      assert.equal(result.units.length, 0);
      assert.equal(result.droppedCandidates[0]!.reason, "ambiguous_subject");
    }
    const invalidKeys =
      bucket === "character_fact"
        ? [["character:unknown"], [alexKey, rowanKey]]
        : [[alexKey, "character:unknown"], [alexKey], [alexKey, alexKey], [alexKey, rowanKey, "character:unknown"]];
    for (const keys of invalidKeys) {
      for (const names of [subjectNames, undefined]) {
        for (const enforceTrustedSubjects of [true, false]) {
          const result = keyedContext.resolve({
            units: [{ ...candidate, subjectNames: names, subjectKeys: keys }],
            existingNotes: [],
            enforceTrustedSubjects,
          });
          assert.equal(result.units.length, 0, "invalid explicit keys must not fall back to names or legacy subjects");
          assert.equal(result.droppedCandidates.length, 1);
          assert.equal(result.diagnostics[0]!.details?.matchBasis, "trusted_key");
        }
      }
    }
  }

  const aliasCollisionResolution = prepareLtmSubjectIdentityContext({
    units: [unit({ bucket: "character_fact", subjectId: "sam", subjectNames: ["Sam"], text: "Sam waits." })],
    catalog: buildTrustedLtmSubjectCatalog({
      roster: [
        { kind: "character", id: "char_sam_one", name: "Samuel One", aliases: ["Sam"] },
        { kind: "character", id: "char_sam_two", name: "Samuel Two", aliases: ["Sam"] },
      ],
      notes: [],
    }),
    scope,
  }).resolve({
    units: [unit({ bucket: "character_fact", subjectId: "sam", subjectNames: ["Sam"], text: "Sam waits." })],
    existingNotes: [],
  });
  assert.equal((aliasCollisionResolution.diagnostics[0]!.details as any).collisionSource, "alias_collision");

  // --- I02: Preserve explicit participant names through structured backfill ---
  const structuredSummaryText = `## Relationships
- Mara and Rowan | characters: Mara | participants: Rowan | name: Mara | state: Mara trusts Rowan completely.

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

  // --- I04: cross-family isolation and batch-established keys for structured backfill ---
  // Synthetic equivalents of the reported failure: identical display names across groups must
  // not collide in the active scope, and keyless backfilled units adopt keys another unit in
  // the same batch already established instead of guessing names or forking a second target.
  const activeFamily = ltmScopeFamilyId(scope)!;
  const otherScope = { chatId: "chat-z", chatIds: ["chat-z"] };
  const foreignFamily = ltmScopeFamilyId(otherScope)!;
  const activeMara = localCharacterSubjectForName(scope, "Mara")!;
  const otherMara = localCharacterSubjectForName(otherScope, "Mara")!;
  assert.notEqual(activeMara.key, otherMara.key);

  const activeMaraEntry = {
    subject: activeMara,
    name: "Mara",
    aliases: [],
    canonicalSlug: "mara",
    familyId: activeFamily,
  };
  const otherMaraEntry = {
    subject: otherMara,
    name: "Mara",
    aliases: [],
    canonicalSlug: "mara",
    familyId: foreignFamily,
  };
  const ashleighEntry = {
    subject: {
      key: "character:char_ashleigh_kestrel",
      ref: { kind: "character" as const, id: "char_ashleigh_kestrel" },
    },
    name: "Ashleigh Kestrel",
    aliases: [],
    canonicalSlug: "ashleigh_kestrel",
    provenance: "roster:character:char_ashleigh_kestrel",
  };

  // 1. A same-name local character in another family must not create ambiguity in this scope,
  //    whether the unit arrives keyless with a bare subjectId or named.
  const crossFamilyCatalog = { entries: [activeMaraEntry, otherMaraEntry, ashleighEntry], notes: [] };
  const crossFamilyContext = prepareLtmSubjectIdentityContext({
    units: [
      unit({ bucket: "character_fact", subjectId: "mara", text: "Mara guards the gate." }),
      unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara keeps watch." }),
    ],
    catalog: crossFamilyCatalog,
    scope,
    sourceBackedNpcSourceText: "Mara guards the gate. Mara keeps watch.",
    sourceBackedNpcSourceTitle: "Mara",
  });
  const crossFamilyResolution = crossFamilyContext.resolve({
    units: [
      unit({ bucket: "character_fact", subjectId: "mara", text: "Mara guards the gate." }),
      unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara keeps watch." }),
    ],
    existingNotes: [],
  });
  assert.equal(crossFamilyResolution.droppedCandidates.length, 0, "foreign-family names must not collide");
  assert.deepEqual(
    crossFamilyResolution.units.map((resolvedUnit) => resolvedUnit.subjects?.[0]?.key),
    [activeMara.key, activeMara.key],
  );

  // 2. A short form of a longer roster name resolves to that roster identity instead of
  //    inventing a provisional local character. The short name arrives after batch
  //    pre-resolution (structured backfill), so it resolves on demand.
  const shortFormContext = prepareLtmSubjectIdentityContext({
    units: [],
    catalog: { entries: [ashleighEntry], notes: [] },
    scope,
    sourceBackedNpcSourceText: "Ash holds the line.",
    sourceBackedNpcSourceTitle: "Ash",
  });
  const shortFormResolution = shortFormContext.resolve({
    units: [unit({ bucket: "character_fact", subjectId: "ash", subjectNames: ["Ash"], text: "Ash holds the line." })],
    existingNotes: [],
  });
  assert.equal(shortFormResolution.droppedCandidates.length, 0);
  assert.equal(
    shortFormResolution.units[0]!.subjects?.[0]?.key,
    "character:char_ashleigh_kestrel",
    "short names must reuse the established longer identity rather than fork a new one",
  );

  // 2b. A backfilled relationship naming short forms of the same participants must resolve to
  //     the same canonical relationship target as the keyed batch unit, not a parallel note.
  const rowanSubject = localCharacterSubjectForName(scope, "Rowan")!;
  const pairModelUnit = unit({
    bucket: "relationship_state",
    subjectId: "ash_kestrel_rowan",
    subjectKeys: ["character:char_ashleigh_kestrel", rowanSubject.key],
    text: "Ash and Rowan watch the gate.",
  });
  const pairBackfillUnit = unit({
    bucket: "relationship_state",
    subjectId: "ash_rowan",
    subjectNames: ["Ash", "Rowan"],
    text: "Ash and Rowan watch the gate.",
  });
  const shortPairContext = prepareLtmSubjectIdentityContext({
    units: [pairModelUnit],
    catalog: {
      entries: [
        ashleighEntry,
        {
          subject: rowanSubject,
          name: "Rowan",
          aliases: [],
          canonicalSlug: "rowan",
          familyId: activeFamily,
        },
      ],
      notes: [],
    },
    scope,
    sourceBackedNpcSourceText: "Ash and Rowan watch the gate.",
    sourceBackedNpcSourceTitle: "Watch",
  });
  const shortPairResolution = shortPairContext.resolve({ units: [pairModelUnit, pairBackfillUnit], existingNotes: [] });
  assert.equal(shortPairResolution.droppedCandidates.length, 0);
  assert.equal(shortPairResolution.units.length, 2);
  assert.equal(
    shortPairResolution.units[0]!.subjectId,
    shortPairResolution.units[1]!.subjectId,
    "short and full participant names must not fork parallel relationship targets",
  );

  // 3. A keyless, nameless backfilled unit adopts the keys already established for the same
  //    subject in the batch, so identity keys and resolved targets stay identical.
  const modelMara = unit({
    bucket: "character_fact",
    subjectId: "mara_ellison",
    subjectKeys: [activeMara.key],
    text: "Mara Ellison arrives.",
  });
  const backfilledMara = unit({
    bucket: "character_fact",
    subjectId: "mara_ellison",
    text: "Mara Ellison departs.",
  });
  const establishedContext = prepareLtmSubjectIdentityContext({
    units: [modelMara],
    catalog: { entries: [activeMaraEntry], notes: [] },
    scope,
  });
  const modelIdentity = establishedContext.identityKeyForUnit(modelMara);
  assert.equal(
    establishedContext.identityKeyForUnit(backfilledMara),
    modelIdentity,
    "backfill coverage must match the identity of the unit that established the keys",
  );
  const establishedResolution = establishedContext.resolve({
    units: [modelMara, backfilledMara],
    existingNotes: [],
  });
  assert.equal(establishedResolution.droppedCandidates.length, 0);
  assert.equal(establishedResolution.units.length, 2);
  assert.equal(establishedResolution.units[0]!.subjectId, establishedResolution.units[1]!.subjectId);
  assert.deepEqual(
    establishedResolution.units[1]!.subjects?.map((subject) => subject.key),
    [activeMara.key],
  );

  // 4. Batch-extracted name variants must canonicalize to one trusted identity
  //    instead of forking provisional local characters from the surface form.
  const batchVariantUnits = [
    unit({ bucket: "character_fact", subjectId: "ash", subjectNames: ["Ash"], text: "Ash holds the line." }),
    unit({
      bucket: "character_fact",
      subjectId: "ashleigh",
      subjectNames: ["Ashleigh"],
      text: "Ashleigh arrives later.",
    }),
    unit({
      bucket: "character_fact",
      subjectId: "ashleigh_kestrel",
      subjectNames: ["Ashleigh Kestrel"],
      text: "Ashleigh Kestrel departs.",
    }),
  ];
  const batchVariantResolution = prepareLtmSubjectIdentityContext({
    units: batchVariantUnits,
    catalog: { entries: [ashleighEntry], notes: [] },
    scope,
    sourceBackedNpcSourceText: "Ash holds the line. Ashleigh arrives later. Ashleigh Kestrel departs.",
    sourceBackedNpcSourceTitle: "Watch",
  }).resolve({ units: batchVariantUnits, existingNotes: [] });
  assert.equal(batchVariantResolution.droppedCandidates.length, 0);
  assert.deepEqual(
    batchVariantResolution.units.map((resolvedUnit) => resolvedUnit.subjects?.[0]?.key),
    ["character:char_ashleigh_kestrel", "character:char_ashleigh_kestrel", "character:char_ashleigh_kestrel"],
    "short, first-name, and full-name variants must share one trusted identity",
  );

  // 4b. A minor spelling variation of the trusted full name resolves to that
  //     identity instead of forking a provisional local character.
  const spellingVariantUnit = unit({
    bucket: "character_fact",
    subjectId: "ashleigh_kestral",
    subjectNames: ["Ashleigh Kestral"],
    text: "Ashleigh Kestral holds the line.",
  });
  const spellingVariantResolution = prepareLtmSubjectIdentityContext({
    units: [spellingVariantUnit],
    catalog: { entries: [ashleighEntry], notes: [] },
    scope,
    sourceBackedNpcSourceText: "Ashleigh Kestral holds the line.",
    sourceBackedNpcSourceTitle: "Watch",
  }).resolve({ units: [spellingVariantUnit], existingNotes: [] });
  assert.equal(spellingVariantResolution.droppedCandidates.length, 0);
  assert.equal(spellingVariantResolution.units[0]!.subjects?.[0]?.key, "character:char_ashleigh_kestrel");

  // 4c. A first name shared by two trusted characters fails closed with
  //     actionable competing identities instead of picking one.
  const sharedFirstNameCatalog = {
    entries: [
      {
        subject: {
          key: "character:char_ashley_cooper",
          ref: { kind: "character" as const, id: "char_ashley_cooper" },
        },
        name: "Ashley Cooper",
        aliases: [],
        canonicalSlug: "ashley_cooper",
        provenance: "roster:character:char_ashley_cooper",
      },
      {
        subject: {
          key: "character:char_ashley_dalton",
          ref: { kind: "character" as const, id: "char_ashley_dalton" },
        },
        name: "Ashley Dalton",
        aliases: [],
        canonicalSlug: "ashley_dalton",
        provenance: "roster:character:char_ashley_dalton",
      },
    ],
    notes: [],
  };
  const sharedFirstNameUnit = unit({
    bucket: "character_fact",
    subjectId: "ashley",
    subjectNames: ["Ashley"],
    text: "Ashley waits.",
  });
  const sharedFirstNameResolution = prepareLtmSubjectIdentityContext({
    units: [sharedFirstNameUnit],
    catalog: sharedFirstNameCatalog,
    scope,
    sourceBackedNpcSourceText: "Ashley waits.",
    sourceBackedNpcSourceTitle: "Watch",
  }).resolve({ units: [sharedFirstNameUnit], existingNotes: [] });
  assert.equal(sharedFirstNameResolution.units.length, 0);
  assert.equal(sharedFirstNameResolution.droppedCandidates[0]!.reason, "ambiguous_subject");
  assert.equal(sharedFirstNameResolution.diagnostics[0]!.code, "ambiguous_subject_identity");
  const sharedFirstNameDetails = sharedFirstNameResolution.diagnostics[0]!.details as any;
  assert.equal(sharedFirstNameDetails.competingSubjectKeys?.length, 2);
  assert.ok(sharedFirstNameDetails.competingRecords?.length >= 2);

  // 4d. A keyless, nameless unit whose subjectId matches a short form of a
  //     trusted name adopts that trusted identity instead of forking a
  //     provisional local character from the source-backed surface name.
  const keylessShortFormUnit = unit({
    bucket: "character_fact",
    subjectId: "ash",
    text: "Ash holds the line.",
  });
  const keylessShortFormResolution = prepareLtmSubjectIdentityContext({
    units: [keylessShortFormUnit],
    catalog: { entries: [ashleighEntry], notes: [] },
    scope,
    sourceBackedNpcSourceText: "Ash holds the line.",
    sourceBackedNpcSourceTitle: "Watch",
  }).resolve({ units: [keylessShortFormUnit], existingNotes: [] });
  assert.equal(keylessShortFormResolution.droppedCandidates.length, 0);
  assert.equal(
    keylessShortFormResolution.units[0]!.subjects?.[0]?.key,
    "character:char_ashleigh_kestrel",
    "keyless short-form subject IDs must reuse the trusted longer identity",
  );

  // 4e. A keyless short-form unit must adopt the vault's existing note target for the
  //     resolved identity (even a non-canonical legacy one) instead of forking a
  //     parallel canonical note.
  const ashleighLegacyNote = {
    ...sourceNote,
    id: "char_ashleigh_legacy",
    title: "Ashleigh",
    type: "character" as const,
    subjects: [ashleighEntry.subject],
  };
  const keylessLegacyUnit = unit({
    bucket: "character_fact",
    subjectId: "ash",
    text: "Ash holds the line.",
  });
  const keylessLegacyResolution = prepareLtmSubjectIdentityContext({
    units: [keylessLegacyUnit],
    catalog: { entries: [ashleighEntry], notes: [ashleighLegacyNote] },
    scope,
    sourceBackedNpcSourceText: "Ash holds the line.",
    sourceBackedNpcSourceTitle: "Watch",
  }).resolve({ units: [keylessLegacyUnit], existingNotes: [] });
  assert.equal(keylessLegacyResolution.droppedCandidates.length, 0);
  assert.equal(
    keylessLegacyResolution.units[0]!.subjects?.[0]?.key,
    "character:char_ashleigh_kestrel",
    "keyless short-form units must still resolve to the trusted identity",
  );
  assert.equal(
    keylessLegacyResolution.units[0]!.subjectId,
    "ashleigh_legacy",
    "keyless source-backed units must target the existing legacy note, not a parallel canonical one",
  );
  assert.deepEqual(
    keylessLegacyResolution.existingNotes.map((note) => note.id),
    ["char_ashleigh_legacy"],
    "the existing legacy note must be the sole target, with no forked canonical note",
  );

  for (const character of ["char-Mara", "char Mara"]) {
    const normalized = normalizeStructuredSummaryEvidenceUnits({
      units: [],
      sourceText: `## Character Facts\n- character: ${character} | Mara guards the gate.`,
      sourceNote: sourceNote as any,
      sourceHash: "c".repeat(64),
      existingNotes: [],
      allowedBuckets: ["character_fact"],
      mode: "roleplay",
      modes: ["roleplay"],
    });
    assert.equal(normalized.units.length, 1);
    assert.equal(normalized.units[0]!.subjectNames, undefined, "normalized note IDs must not become names");
  }

  const activeNote = {
    ...sourceNote,
    id: "char_mara",
    title: "Mara",
    type: "character" as const,
    subjects: [activeMara],
  };
  const unscopedNote = { ...activeNote, id: "char_unscoped", scope: {} };
  const invalidNote = { ...activeNote, id: "char_invalid", subjects: [otherMara] };
  const filteredCatalog = buildTrustedLtmSubjectCatalog({
    roster: [],
    notes: [activeNote, unscopedNote, invalidNote],
  });
  assert.deepEqual(
    filteredCatalog.notes.map((note) => note.id),
    [activeNote.id],
    "invalid local notes must leave the catalog",
  );

  const maraUnit = unit({ bucket: "character_fact", subjectId: "mara", text: "Mara guards the gate." });
  const missingMetadataContext = prepareLtmSubjectIdentityContext({
    units: [maraUnit],
    catalog: {
      entries: [
        { ...activeMaraEntry, familyId: undefined },
        { ...otherMaraEntry, familyId: undefined },
      ],
      notes: [activeNote, { ...activeNote, id: "char_foreign", scope: {}, subjects: [otherMara] }],
    },
    scope,
  });
  assert.equal(missingMetadataContext.identityKeyForUnit(maraUnit), activeNote.id);
  const missingMetadataResult = missingMetadataContext.resolve({ units: [maraUnit], existingNotes: [] });
  assert.equal(missingMetadataResult.droppedCandidates.length, 0);
  assert.equal(missingMetadataResult.units[0]!.subjects?.[0]?.key, activeMara.key);

  for (const legacyScope of [{}, otherScope]) {
    const legacyContext = prepareLtmSubjectIdentityContext({
      units: [maraUnit],
      catalog: {
        entries: [activeMaraEntry],
        notes: [{ ...activeNote, id: "char_legacy", scope: legacyScope, subjects: undefined }],
      },
      scope,
    });
    assert.notEqual(
      legacyContext.identityKeyForUnit(maraUnit),
      "char_legacy",
      "unscoped or foreign legacy notes must not bind local subjects",
    );
  }

  process.stdout.write(
    "Long-Term Memory local-character regression: scoped identity, review risk, safeguards, and isolation passed\n",
  );
}

void runRegressionToCompletion("long-term-memory-local-characters", main).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
