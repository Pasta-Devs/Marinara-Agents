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
  const { projectLtmDraftMutationGroup } = await import(`${source}/draft-projector.ts`);
  const { ltmDraftMutationSchema, ltmDraftReviewChangeSchema } =
    await import("../packages/long-term-memory/src/engine/packages/shared/src/features/agents/long-term-memory/schema.ts");
  const { compileEvidenceUnitExtraction, parseEvidenceUnitPayload } = await import(
    `${source}/evidence-unit-extraction.ts`
  );
  const { sourceHashForLtmSourceNote } = await import(`${source}/source-hash.ts`);
  const { normalizeStructuredSummaryEvidenceUnits } = await import(`${source}/structured-summary-normalizer.ts`);
  const { isLocalCharacterSubject, localCharacterScopeError, localCharacterSubjectForName, ltmScopeFamilyId } =
    await import(`${source}/chat-scope.ts`);
  const {
    analyzeTrustedLtmNoteSubjects,
    buildTrustedLtmSubjectCatalog,
    prepareLtmSubjectIdentityContext,
    trustedLtmIdentityNotesForSource,
  } = await import(`${source}/subject-identity.ts`);

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
  const mara = {
    subject: { key: "character:mara", ref: { kind: "character", id: "mara" } },
    name: "Mara",
    aliases: [],
    canonicalSlug: "mara",
  };
  const rowan = {
    subject: { key: "character:rowan", ref: { kind: "character", id: "rowan" } },
    name: "Rowan",
    aliases: [],
    canonicalSlug: "rowan",
  };
  const conflicted = {
    ...sourceNote,
    id: "char_mara",
    title: "Rowan",
    type: "character" as const,
    subjects: undefined,
  };
  const collisionCatalog = { entries: [mara, rowan], notes: [conflicted] as any[] };
  assert.deepEqual(
    analyzeTrustedLtmNoteSubjects(collisionCatalog).unresolved.map((issue) => issue.basis),
    ["conflicting_identifiers"],
  );
  const collision = prepareLtmSubjectIdentityContext({
    units: [unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara travels." })],
    catalog: collisionCatalog,
    scope,
  }).resolve({
    units: [unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara travels." })],
    existingNotes: [],
  });
  assert.equal(collision.units.length, 0, "a conflicting legacy ID/title must not be an extraction target");
  assert.equal(collision.diagnostics[0]?.code, "ambiguous_subject_identity");
  const duplicates = {
    entries: [mara],
    notes: [
      { ...conflicted, title: "Mara", id: "char_mara_old" },
      { ...conflicted, title: "Mara", id: "char_mara_new" },
    ] as any[],
  };
  const duplicateResolution = prepareLtmSubjectIdentityContext({
    units: [unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara travels." })],
    catalog: duplicates,
    scope,
  }).resolve({
    units: [unit({ bucket: "character_fact", subjectId: "mara", subjectNames: ["Mara"], text: "Mara travels." })],
    existingNotes: [],
  });
  assert.equal(duplicateResolution.units.length, 0, "duplicate legacy notes require an explicit merge");
  assert.deepEqual(
    trustedLtmIdentityNotesForSource({ sourceText: "Mara travels.", catalog: duplicates }),
    [],
    "source lookup must not silently pick one duplicate",
  );
  const duplicateLocal = buildTrustedLtmSubjectCatalog({
    roster: [],
    notes: ["one", "two"].map((id) => ({
      ...conflicted,
      id: `char_mara_${id}`,
      title: "Mara Ellison",
      subjects: [
        {
          key: `local_character:chat_chat_a:mara-${id}`,
          ref: { kind: "local_character" as const, id: `chat_chat_a:mara-${id}` },
        },
      ],
    })) as any,
  });
  for (const name of ["Mara", "Mara Ellison"]) {
    const value = prepareLtmSubjectIdentityContext({
      units: [
        unit({
          bucket: "character_fact",
          subjectId: name.replaceAll(" ", "_"),
          subjectNames: [name],
          text: "Mara travels.",
        }),
      ],
      catalog: duplicateLocal,
      scope,
    }).resolve({
      units: [
        unit({
          bucket: "character_fact",
          subjectId: name.replaceAll(" ", "_"),
          subjectNames: [name],
          text: "Mara travels.",
        }),
      ],
      existingNotes: [],
    });
    assert.equal(value.units.length, 0, `${name} must expose the duplicate local identity`);
  }
  const duplicateLinkCatalog = {
    entries: [mara, rowan],
    notes: [
      { ...conflicted, id: "char_mara_old", title: "Mara" },
      { ...conflicted, id: "char_mara_new", title: "Mara" },
    ] as any[],
  };
  const duplicateLinkResolution = prepareLtmSubjectIdentityContext({
    units: [],
    catalog: duplicateLinkCatalog,
    scope,
  }).resolve({
    units: [
      {
        ...unit({ bucket: "character_fact", subjectId: "rowan", subjectNames: ["Rowan"], text: "Rowan notices Mara." }),
        links: [{ target: "mara", relation: "affects_character" as const }],
      },
    ],
    existingNotes: [],
  });
  assert.equal(duplicateLinkResolution.units[0]?.links[0]?.target, "mara");
  assert.equal(
    duplicateLinkResolution.diagnostics.some((item) => item.code === "ambiguous_subject_link_target"),
    true,
    "duplicate named identity notes must leave a link unresolved",
  );
  const conflictedLink = prepareLtmSubjectIdentityContext({
    units: [],
    catalog: {
      ...collisionCatalog,
      entries: [
        ...collisionCatalog.entries,
        {
          ...mara,
          subject: { key: "character:jules", ref: { kind: "character" as const, id: "jules" } },
          name: "Jules",
          canonicalSlug: "jules",
        },
      ],
    },
    scope,
  }).resolve({
    units: [
      {
        ...unit({
          bucket: "character_fact",
          subjectId: "jules",
          subjectKeys: ["character:jules"],
          text: "Jules notices Mara.",
        }),
        links: [{ target: "mara", relation: "affects_character" as const }],
      },
    ],
    existingNotes: [],
  });
  assert.equal(conflictedLink.units[0]?.links[0]?.target, "mara");
  assert.deepEqual(
    (conflictedLink.diagnostics.find((item) => item.code === "ambiguous_subject_link_target")?.details as any)
      ?.candidateTargetNoteIds,
    ["char_mara"],
    "an unresolved legacy identity must block canonical link fallback",
  );
  const pairEntries = [
    { ...mara, subject: { key: "character:z" }, name: "A", canonicalSlug: "a" },
    { ...mara, subject: { key: "character:é" }, name: "B C", canonicalSlug: "b_c" },
    { ...mara, subject: { key: "character:x" }, name: "A B", canonicalSlug: "a_b" },
    { ...mara, subject: { key: "character:y" }, name: "C", canonicalSlug: "c" },
  ];
  const pairCatalog = {
    entries: pairEntries,
    notes: [{ ...conflicted, id: "rel_a_b_c", type: "relationship" as const, title: "A B C" }] as any[],
  };
  assert.ok(
    analyzeTrustedLtmNoteSubjects(pairCatalog).unresolved[0]?.candidateSubjectPairs?.some(
      (pair) => pair.includes("character:z") && pair.includes("character:é"),
    ),
  );
  const pairConflict = prepareLtmSubjectIdentityContext({ units: [], catalog: pairCatalog, scope }).resolve({
    units: [
      unit({
        bucket: "relationship_state",
        subjectId: "a_b_c",
        subjectKeys: ["character:z", "character:é"],
        text: "Their relationship changed.",
      }),
    ],
    existingNotes: [],
  });
  assert.equal(pairConflict.units.length, 0, "locale-ordered unresolved pairs must block matching targets");
  const conflictingPairs = {
    entries: [
      { ...mara, subject: { key: "character:a" }, name: "A", canonicalSlug: "a" },
      { ...mara, subject: { key: "character:b" }, name: "B", canonicalSlug: "b" },
      { ...mara, subject: { key: "character:c" }, name: "C", canonicalSlug: "c" },
      { ...mara, subject: { key: "character:d" }, name: "D", canonicalSlug: "d" },
    ],
    notes: [{ ...conflicted, id: "rel_a_b", type: "relationship" as const, title: "C D" }] as any[],
  };
  const conflictingIssue = analyzeTrustedLtmNoteSubjects(conflictingPairs).unresolved[0];
  assert.equal(conflictingIssue?.basis, "conflicting_identifiers");
  assert.deepEqual(conflictingIssue.candidateSubjectPairs, [
    ["character:c", "character:d"],
    ["character:a", "character:b"],
  ]);
  const conflictingPairResolution = prepareLtmSubjectIdentityContext({
    units: [],
    catalog: conflictingPairs,
    scope,
  }).resolve({
    units: [
      unit({
        bucket: "relationship_state",
        subjectId: "a_b",
        subjectKeys: ["character:a", "character:b"],
        text: "A and B changed.",
      }),
    ],
    existingNotes: [],
  });
  assert.equal(
    conflictingPairResolution.units.length,
    0,
    "both matched relationship identities must remain unresolved",
  );
  const linked = prepareLtmSubjectIdentityContext({
    units: [],
    catalog: {
      entries: [
        mara,
        {
          ...mara,
          subject: { key: "character:mara-other", ref: { kind: "character" as const, id: "mara-other" } },
          canonicalSlug: "mara_other",
        },
        rowan,
      ],
      notes: [],
    },
    scope,
  }).resolve({
    units: [
      unit({ bucket: "character_fact", subjectId: "mara", subjectKeys: ["character:mara"], text: "First Mara." }),
      unit({ bucket: "character_fact", subjectId: "mara", subjectKeys: ["character:mara-other"], text: "Other Mara." }),
      {
        ...unit({
          bucket: "character_fact",
          subjectId: "rowan",
          subjectKeys: ["character:rowan"],
          text: "Rowan visits.",
        }),
        links: [{ target: "char_mara", relation: "affects_character" as const }],
      },
    ],
    existingNotes: [],
  });
  const ambiguousLink = linked.diagnostics.find((item) => item.code === "ambiguous_subject_link_target");
  assert.ok(
    ambiguousLink,
    `ambiguous link choices must remain visible on the draft: ${JSON.stringify(linked.diagnostics)}`,
  );
  assert.equal((ambiguousLink.details as any).candidateTargetNoteIds.length, 2);
  const namedCollision = prepareLtmSubjectIdentityContext({
    units: [],
    catalog: { entries: [mara, { ...rowan, name: "Nara", canonicalSlug: "nara" }], notes: [] },
    scope,
  }).resolve({
    units: [
      unit({ bucket: "character_fact", subjectId: "mara", subjectKeys: ["character:mara"], text: "Mara travels." }),
      unit({ bucket: "character_fact", subjectId: "mara", subjectKeys: ["character:rowan"], text: "Nara travels." }),
      {
        ...unit({
          bucket: "character_fact",
          subjectId: "rowan",
          subjectKeys: ["character:rowan"],
          text: "Rowan visits.",
        }),
        links: [{ target: "char_mara", relation: "affects_character" as const }],
      },
    ],
    existingNotes: [],
  });
  assert.ok(
    namedCollision.diagnostics.some((item) => item.code === "ambiguous_subject_link_target"),
    "an exact name must not override conflicting batch link targets",
  );
  const { ambiguousLtmDraftLinkChoiceError } = await import(`${source}/reconciliation.ts`);
  const originalLinkMutation = {
    id: "link-choice",
    kind: "add_link" as const,
    noteId: ambiguousLink.noteId!,
    link: { target: "char_mara", relation: "affects_character" as const },
  } as any;
  const linkDraft = { diagnostics: linked.diagnostics };
  assert.equal(
    ambiguousLtmDraftLinkChoiceError(linkDraft, originalLinkMutation, originalLinkMutation)?.code,
    "ltm_draft_ambiguous_link",
  );
  assert.equal(
    ambiguousLtmDraftLinkChoiceError(
      linkDraft,
      originalLinkMutation,
      {
        ...originalLinkMutation,
        link: { ...originalLinkMutation.link, target: "char_unrelated" },
      },
      new Map([
        [
          "link-choice\u0000affects_character\u0000char_mara",
          {
            mutationId: "link-choice",
            linkTarget: "char_mara",
            linkRelation: "affects_character",
            selectedTarget: "char_unrelated",
          },
        ],
      ]),
    )?.code,
    "ltm_draft_ambiguous_link",
  );
  assert.equal(
    ambiguousLtmDraftLinkChoiceError(
      linkDraft,
      originalLinkMutation,
      {
        ...originalLinkMutation,
        link: { ...originalLinkMutation.link, target: (ambiguousLink.details as any).candidateTargetNoteIds[1] },
      },
      new Map([
        [
          "link-choice\u0000affects_character\u0000char_mara",
          {
            mutationId: "link-choice",
            linkTarget: "char_mara",
            linkRelation: "affects_character",
            selectedTarget: (ambiguousLink.details as any).candidateTargetNoteIds[1],
          },
        ],
      ]),
    ),
    null,
  );
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
  assert.notEqual(shortNameContext.units[0]!.subjects?.[0]?.key, shortNameContext.units[1]!.subjects?.[0]?.key);

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
  assert.notEqual(
    onDemandFullName.units[0]!.subjects?.[0]?.key,
    validSubject.key,
    "a longer name is not evidence of the same identity",
  );
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
      assert.equal(
        result.droppedCandidates[0]!.reason,
        keys === undefined ? "ambiguous_subject" : "invalid_subject_cardinality",
      );
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

  const identityRoster = [
    { kind: "character", id: "char_maria", name: "Maria", aliases: ["Marie"] },
    { kind: "character", id: "char_marie", name: "Marie", aliases: ["Mimi"] },
    { kind: "character", id: "char_one", name: "Samuel One", aliases: ["Sam"] },
    { kind: "character", id: "char_two", name: "Samuel Two", aliases: ["Sam"] },
    { kind: "character", id: "char_eloise", name: "Éloïse O'Neil", aliases: [] },
    { kind: "character", id: "char_li", name: "李娜", aliases: [] },
    { kind: "character", id: "char_ming", name: "李明", aliases: [] },
    { kind: "character", id: "char_jose", name: "Jose", aliases: [] },
    { kind: "character", id: "char_josé", name: "José", aliases: [] },
  ];
  const identityCatalog = buildTrustedLtmSubjectCatalog({
    roster: identityRoster,
    notes: [],
  });
  const resolveIdentity = (name: string, subjectId = "provider_subject", subjectKeys?: string[]) => {
    const candidate = unit({
      bucket: "character_fact",
      subjectId,
      subjectNames: [name],
      subjectKeys,
      text: `${name} waits.`,
    });
    return prepareLtmSubjectIdentityContext({ units: [candidate], catalog: identityCatalog, scope }).resolve({
      units: [candidate],
      existingNotes: [],
    });
  };
  assert.deepEqual(resolveIdentity("Marie").units[0]?.subjectKeys, ["character:char_marie"]);
  assert.deepEqual(resolveIdentity("Mimi").units[0]?.subjectKeys, ["character:char_marie"]);
  assert.deepEqual(resolveIdentity("éloïse o'neil").units[0]?.subjectKeys, ["character:char_eloise"]);
  assert.deepEqual(resolveIdentity("李娜").units[0]?.subjectKeys, ["character:char_li"]);
  assert.deepEqual(resolveIdentity("李明").units[0]?.subjectKeys, ["character:char_ming"]);
  const unicodeUnits = ["李娜", "李明"].map((name) =>
    unit({ bucket: "character_fact", subjectId: "provider_subject", subjectNames: [name], text: `${name} waits.` }),
  );
  const unicodeResolution = prepareLtmSubjectIdentityContext({
    units: unicodeUnits,
    catalog: identityCatalog,
    scope,
  }).resolve({
    units: unicodeUnits,
    existingNotes: [],
  });
  const unicodeNotes = compileLtmEvidenceUnits({
    units: unicodeResolution.units,
    existingNotes: [],
    scope,
    modes: ["roleplay"],
  }).mutations.filter((mutation) => mutation.kind === "create_note");
  assert.equal(unicodeNotes.length, 2, "distinct Unicode names must not share a memory target");
  assert.deepEqual(
    new Set(unicodeNotes.map((mutation) => mutation.note.subjects?.[0]?.key)),
    new Set(["character:char_li", "character:char_ming"]),
  );
  const accentedUnits = [
    unit({
      bucket: "character_fact",
      subjectId: "jose",
      subjectNames: ["Jose"],
      subjectKeys: ["character:char_jose"],
      text: "Jose waits.",
    }),
    unit({
      bucket: "character_fact",
      subjectId: "jose",
      subjectNames: ["José"],
      subjectKeys: ["character:char_josé"],
      text: "José waits.",
    }),
  ];
  const accentedResolution = prepareLtmSubjectIdentityContext({
    units: accentedUnits,
    catalog: identityCatalog,
    scope,
  }).resolve({ units: accentedUnits, existingNotes: [] });
  const accentedNotes = compileLtmEvidenceUnits({
    units: accentedResolution.units,
    existingNotes: [],
    scope,
    modes: ["roleplay"],
  }).mutations.filter((mutation) => mutation.kind === "create_note");
  assert.deepEqual(
    new Set(accentedNotes.map((mutation) => mutation.note.subjects?.[0]?.key)),
    new Set(["character:char_jose", "character:char_josé"]),
    "different trusted keys must not merge when their names fold to the same slug",
  );
  assert.deepEqual(resolveIdentity("Marie", "BAD incidental ID!").units[0]?.subjectKeys, ["character:char_marie"]);
  const malformedInput = unit({
    bucket: "character_fact",
    subjectId: "BAD incidental ID!",
    subjectNames: ["Marie"],
    text: "Marie waits.",
  });
  const recoveredInput = parseEvidenceUnitPayload({ units: [malformedInput] }, "a".repeat(64));
  assert.equal(recoveredInput.parserRejections, 0);
  assert.deepEqual(
    resolveIdentity(recoveredInput.response.units[0]!.subjectNames![0]!, recoveredInput.response.units[0]!.subjectId)
      .units[0]?.subjectKeys,
    ["character:char_marie"],
  );
  const malformedWorld = parseEvidenceUnitPayload(
    { units: [{ ...malformedInput, bucket: "world_fact" }] },
    "a".repeat(64),
  );
  assert.equal(malformedWorld.parserRejections, 1, "malformed IDs in other buckets remain invalid");
  const malformedRelationship = parseEvidenceUnitPayload(
    {
      units: [
        unit({
          bucket: "relationship_state",
          subjectId: "BAD relationship ID!",
          subjectNames: ["Marie", "Maria"],
          text: "Marie trusts Maria.",
        }),
      ],
    },
    "a".repeat(64),
  );
  assert.equal(malformedRelationship.parserRejections, 0);
  assert.deepEqual(
    prepareLtmSubjectIdentityContext({
      units: malformedRelationship.response.units,
      catalog: identityCatalog,
      scope,
    }).resolve({ units: malformedRelationship.response.units, existingNotes: [] }).units[0]?.subjectKeys,
    ["character:char_maria", "character:char_marie"],
  );
  assert.equal(resolveIdentity("Mariya").units.length, 0, "fuzzy neighbors must not assign a subject");
  const ambiguousAlias = resolveIdentity("Sam");
  assert.equal(ambiguousAlias.units.length, 0);
  assert.deepEqual((ambiguousAlias.diagnostics[0]?.details as any)?.competingSubjectKeys?.sort(), [
    "character:char_one",
    "character:char_two",
  ]);
  assert.deepEqual(ambiguousAlias.droppedCandidates[0]?.recoveryCandidate?.subjectNames, ["Sam"]);
  assert.deepEqual(resolveIdentity("Sam", "bad!", ["character:char_two"]).units[0]?.subjectKeys, [
    "character:char_two",
  ]);
  const selectedSam = unit({
    bucket: "character_fact",
    subjectId: "chosen_sam",
    subjectNames: ["Sam"],
    subjectKeys: ["character:char_two"],
    text: "Sam waits.",
  });
  const repeatedSam = unit({
    bucket: "character_fact",
    subjectId: "another_sam",
    subjectNames: ["Sam"],
    text: "Sam speaks.",
  });
  const chosenContext = prepareLtmSubjectIdentityContext({
    units: [selectedSam, repeatedSam],
    catalog: identityCatalog,
    scope,
  });
  const chosenResult = chosenContext.resolve({ units: [selectedSam, repeatedSam], existingNotes: [] });
  assert.deepEqual(
    chosenResult.units.map((candidate) => candidate.subjectKeys),
    [["character:char_two"], ["character:char_two"]],
  );
  assert.equal(chosenContext.identityKeyForUnit(repeatedSam), chosenContext.identityKeyForUnit(selectedSam));
  assert.equal(resolveIdentity("Sam").units.length, 0, "an alias choice cannot leak into a new context");
  const chosenNotes = compileLtmEvidenceUnits({
    units: chosenResult.units,
    existingNotes: [],
    scope,
    modes: ["roleplay"],
  }).mutations.filter((mutation) => mutation.kind === "create_note");
  assert.equal(chosenNotes.length, 1);
  const persistedChoice = { ...chosenNotes[0]!.note, createdAt: timestamp, updatedAt: timestamp, version: 1 };
  assert.equal(persistedChoice.title, "Sam", "the chosen alias must survive the normal create-note path");
  const savedChoiceCatalog = buildTrustedLtmSubjectCatalog({ roster: identityRoster, notes: [persistedChoice] as any });
  const repeatContext = prepareLtmSubjectIdentityContext({ units: [repeatedSam], catalog: savedChoiceCatalog, scope });
  assert.deepEqual(repeatContext.resolve({ units: [repeatedSam], existingNotes: [] }).units[0]?.subjectKeys, [
    "character:char_two",
  ]);
  const existingSam = { ...persistedChoice, title: "Samuel Two" };
  const existingCatalog = buildTrustedLtmSubjectCatalog({ roster: identityRoster, notes: [existingSam] as any });
  const existingResolution = prepareLtmSubjectIdentityContext({
    units: [selectedSam],
    catalog: existingCatalog,
    scope,
  }).resolve({ units: [selectedSam], existingNotes: [existingSam] as any });
  const updateExisting = compileLtmEvidenceUnits({
    units: existingResolution.units,
    existingNotes: [existingSam] as any,
    scope,
    modes: ["roleplay"],
    aliasChoices: existingResolution.aliasChoices,
  });
  const titleMutation = updateExisting.mutations.find((mutation) => mutation.kind === "set_title");
  assert.equal(ltmDraftMutationSchema.parse(titleMutation).kind, "set_title");
  const existingProjection = projectLtmDraftMutationGroup({
    existing: existingSam as any,
    mutations: updateExisting.mutations,
    context: { source: { sourceNoteId: "roleplay_source", sourceHash: "a".repeat(64) }, scope, modes: ["roleplay"] },
    timestamp,
  });
  assert.equal(
    ltmDraftReviewChangeSchema.parse(
      existingProjection.mutations.find((mutation) => mutation.mutationId === titleMutation?.id)?.changes[0],
    ).kind,
    "title",
  );
  assert.equal(existingProjection.after.title, "Sam", "an explicit choice must persist on an existing canonical note");
  const duplicateSource = {
    ...sourceNote,
    sections: { source: { text: "Sam knows the ancient language.", updatedAt: timestamp } },
  };
  const duplicateExisting = {
    ...existingSam,
    sections: { ...existingSam.sections, facts: { text: duplicateSource.sections.source.text, updatedAt: timestamp } },
  };
  const duplicateResult = compileEvidenceUnitExtraction({
    unitResponse: {
      summary: "Repeated fact with an explicit identity choice",
      units: [
        {
          ...existingResolution.units[0]!,
          text: duplicateSource.sections.source.text,
          claimKind: "static" as const,
          sourceHash: sourceHashForLtmSourceNote(duplicateSource),
        },
      ],
    },
    sourceText: duplicateSource.sections.source.text,
    sourceNote: duplicateSource,
    existingNotes: [duplicateExisting] as any,
    aliasChoices: existingResolution.aliasChoices,
    scope,
    modes: ["roleplay"],
    sourceHash: sourceHashForLtmSourceNote(duplicateSource),
    skipStructuredBackfill: true,
  });
  assert.equal(duplicateResult.accounting.deduplications, 1);
  assert.deepEqual(
    duplicateResult.compiledResponse.mutations.map((mutation) => mutation.kind),
    ["set_title"],
    "deduplicated facts must retain the identity choice without rewriting the fact",
  );
  assert.equal(duplicateResult.outcome.state, "success", "alias-only mutations are suggestions");
  const unsupportedAlias = compileEvidenceUnitExtraction({
    unitResponse: {
      summary: "Repeated change without a source event",
      units: [{ ...duplicateResult.unitResponse.units[0]!, claimKind: "change" as const }],
    },
    sourceText: duplicateSource.sections.source.text,
    sourceNote: duplicateSource,
    existingNotes: [duplicateExisting] as any,
    aliasChoices: existingResolution.aliasChoices,
    scope,
    modes: ["roleplay"],
    sourceHash: sourceHashForLtmSourceNote(duplicateSource),
    skipStructuredBackfill: true,
  });
  assert.deepEqual(unsupportedAlias.compiledResponse.mutations, [], "unsupported aliases cannot rename notes");
  assert.equal(unsupportedAlias.accounting.validationRejections, 1);
  assert.equal(unsupportedAlias.accounting.deduplications, 0, "rejected aliases count only once");
  assert.equal(unsupportedAlias.outcome.droppedUnits, 1, "rejected aliases keep the source retryable");
  assert.equal(unsupportedAlias.outcome.droppedCandidates[0]?.validatorCode, "source_event_graph_open");
  assert.equal(
    unsupportedAlias.diagnostics.some((item) => item.code === "source_event_graph_open"),
    true,
  );
  const rejectedAlongsideAlias = {
    ...duplicateResult.unitResponse.units[0]!,
    id: randomUUID(),
    claimKind: "change" as const,
  };
  const mixedAliasResult = compileEvidenceUnitExtraction({
    unitResponse: {
      summary: "Valid alias and unsupported duplicate change",
      units: [duplicateResult.unitResponse.units[0]!, rejectedAlongsideAlias],
    },
    sourceText: duplicateSource.sections.source.text,
    sourceNote: duplicateSource,
    existingNotes: [duplicateExisting] as any,
    aliasChoices: new Map([
      ...existingResolution.aliasChoices,
      [rejectedAlongsideAlias.id, existingResolution.aliasChoices.get(duplicateResult.unitResponse.units[0]!.id)!],
    ]),
    scope,
    modes: ["roleplay"],
    sourceHash: sourceHashForLtmSourceNote(duplicateSource),
    skipStructuredBackfill: true,
  });
  assert.equal(mixedAliasResult.accounting.keptUnits, 0);
  assert.equal(mixedAliasResult.outcome.droppedUnits, 1);
  assert.deepEqual(
    mixedAliasResult.compiledResponse.mutations.map((mutation) => mutation.kind),
    ["set_title"],
  );
  assert.equal(mixedAliasResult.outcome.state, "partial_success", "alias mutation with a rejection is partial");
  const eventSource = {
    ...duplicateSource,
    sections: {
      source: { text: "Sam knows the ancient language. Sam learned it at the academy.", updatedAt: timestamp },
    },
  };
  const eventHash = sourceHashForLtmSourceNote(eventSource);
  const linkedAliasResult = compileEvidenceUnitExtraction({
    unitResponse: {
      summary: "Repeated change supported by a new event",
      units: [
        {
          ...duplicateResult.unitResponse.units[0]!,
          claimKind: "change" as const,
          links: [{ target: "timeline_sam_learned", relation: "caused_by" as const }],
          sourceHash: eventHash,
        },
        {
          ...unit({ bucket: "character_fact", subjectId: "sam_learned", text: "Sam learned it at the academy." }),
          bucket: "timeline_event" as const,
          sectionKey: "event",
          claimKind: "change" as const,
          links: [{ target: eventSource.id, relation: "extracted_from" as const }],
          sourceHash: eventHash,
        },
      ],
    },
    sourceText: eventSource.sections.source.text,
    sourceNote: eventSource,
    existingNotes: [duplicateExisting] as any,
    aliasChoices: existingResolution.aliasChoices,
    scope,
    modes: ["roleplay"],
    sourceHash: eventHash,
    skipStructuredBackfill: true,
  });
  assert.equal(linkedAliasResult.accounting.deduplications, 1);
  assert.equal(linkedAliasResult.accounting.validationRejections, 0);
  assert.deepEqual(
    linkedAliasResult.compiledResponse.mutations.map((mutation) => mutation.kind).sort(),
    ["create_note", "set_title"],
    "same-batch timeline events support deduplicated alias changes without duplicating the event",
  );
  assert.equal(
    compileEvidenceUnitExtraction({
      unitResponse: { summary: "Invalid source hash", units: [existingResolution.units[0]!] },
      sourceText: duplicateSource.sections.source.text,
      sourceNote: duplicateSource,
      existingNotes: [duplicateExisting] as any,
      aliasChoices: existingResolution.aliasChoices,
      scope,
      modes: ["roleplay"],
      sourceHash: sourceHashForLtmSourceNote(duplicateSource),
      skipStructuredBackfill: true,
    }).compiledResponse.mutations.length,
    0,
    "a rejected fact must not persist its identity choice",
  );
  const updatedCatalog = buildTrustedLtmSubjectCatalog({ roster: identityRoster, notes: [existingProjection.after] });
  assert.deepEqual(
    prepareLtmSubjectIdentityContext({ units: [repeatedSam], catalog: updatedCatalog, scope }).resolve({
      units: [repeatedSam],
      existingNotes: [],
    }).units[0]?.subjectKeys,
    ["character:char_two"],
  );
  assert.equal(
    prepareLtmSubjectIdentityContext({
      units: [repeatedSam],
      catalog: updatedCatalog,
      scope: { chatId: "chat-b" },
    }).resolve({ units: [repeatedSam], existingNotes: [] }).units.length,
    0,
  );
  const manualSam = { ...existingSam, title: "My protagonist" };
  const manualUpdate = compileLtmEvidenceUnits({
    units: existingResolution.units,
    existingNotes: [manualSam] as any,
    scope,
    modes: ["roleplay"],
    aliasChoices: existingResolution.aliasChoices,
  });
  assert.equal(
    manualUpdate.mutations.some((mutation) => mutation.kind === "set_title"),
    false,
  );
  assert.equal(
    prepareLtmSubjectIdentityContext({
      units: [repeatedSam],
      catalog: savedChoiceCatalog,
      scope: { chatId: "chat-b" },
    }).resolve({ units: [repeatedSam], existingNotes: [] }).units.length,
    0,
    "persisted alias choice must not leak into another chat family",
  );
  const conflictingSam = { ...selectedSam, subjectId: "conflicting_sam", subjectKeys: ["character:char_one"] };
  const contestedContext = prepareLtmSubjectIdentityContext({
    units: [selectedSam, conflictingSam, repeatedSam],
    catalog: identityCatalog,
    scope,
  });
  assert.equal(contestedContext.resolve({ units: [repeatedSam], existingNotes: [] }).units.length, 0);
  assert.equal(resolveIdentity("Marie", "provider_subject", ["character:unknown"]).units.length, 0);
  assert.equal(
    resolveIdentity("Marie", "provider_subject", []).units.length,
    0,
    "empty explicit keys must fail closed",
  );
  const emptyKeyCandidate = unit({
    bucket: "character_fact",
    subjectId: "Marie",
    subjectKeys: [],
    text: "Marie waits.",
  });
  assert.equal(
    prepareLtmSubjectIdentityContext({ units: [emptyKeyCandidate], catalog: identityCatalog, scope }).resolve({
      units: [emptyKeyCandidate],
      existingNotes: [],
      enforceTrustedSubjects: false,
    }).units.length,
    0,
    "empty explicit keys cannot enter legacy fallback",
  );
  const lowercase = unit({
    bucket: "character_fact",
    subjectId: "elara",
    subjectNames: ["elara"],
    text: "elara waits.",
  });
  const lowercaseResolution = prepareLtmSubjectIdentityContext({
    units: [lowercase],
    catalog: { entries: [], notes: [] },
    scope,
    sourceBackedNpcSourceText: "elara waits.",
  }).resolve({ units: [lowercase], existingNotes: [] });
  assert.equal(
    lowercaseResolution.units.length,
    1,
    "source-visible lowercase names can create scoped local identities",
  );
  const mixedCase = unit({
    bucket: "character_fact",
    subjectId: "elara",
    subjectNames: ["Elara"],
    text: "Elara waits.",
  });
  assert.equal(
    prepareLtmSubjectIdentityContext({
      units: [mixedCase],
      catalog: { entries: [], notes: [] },
      scope,
      sourceBackedNpcSourceText: "ELARA waits.",
    }).resolve({ units: [mixedCase], existingNotes: [] }).units.length,
    1,
    "case-insensitive name matches use consistent boundary offsets",
  );
  const unicodeLocal = unit({
    bucket: "character_fact",
    subjectId: "li_na",
    subjectNames: ["李娜"],
    text: "李娜 waits.",
  });
  const unicodeLocalResolution = prepareLtmSubjectIdentityContext({
    units: [unicodeLocal],
    catalog: { entries: [], notes: [] },
    scope,
    sourceBackedNpcSourceText: "李娜 waits.",
  }).resolve({ units: [unicodeLocal], existingNotes: [] });
  assert.equal(unicodeLocalResolution.units.length, 1);
  assert.ok(unicodeLocalResolution.units[0]!.subjects?.[0]?.key.startsWith("local_character:"));

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
    aliases: ["Ash", "Ashleigh"],
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

  // 2. An explicit roster alias resolves to that roster identity instead of
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

  // 4. Batch-extracted explicitly aliased names must canonicalize to one trusted identity
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

  // 4b. A minor spelling variation is a suggestion, not identity evidence.
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
  assert.equal(spellingVariantResolution.units.length, 0);
  assert.deepEqual((spellingVariantResolution.diagnostics[0]?.details as any)?.competingSubjectKeys, [
    "character:char_ashleigh_kestrel",
  ]);
  assert.deepEqual(spellingVariantResolution.droppedCandidates[0]?.recoveryCandidate?.subjectNames, [
    "Ashleigh Kestral",
  ]);

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
        aliases: ["Ashley"],
        canonicalSlug: "ashley_cooper",
        provenance: "roster:character:char_ashley_cooper",
      },
      {
        subject: {
          key: "character:char_ashley_dalton",
          ref: { kind: "character" as const, id: "char_ashley_dalton" },
        },
        name: "Ashley Dalton",
        aliases: ["Ashley"],
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
  const keylessShortFormKeyContext = prepareLtmSubjectIdentityContext({
    units: [keylessShortFormUnit],
    catalog: { entries: [ashleighEntry], notes: [] },
    scope,
    sourceBackedNpcSourceText: "Ash holds the line.",
    sourceBackedNpcSourceTitle: "Watch",
  });
  assert.equal(
    keylessShortFormKeyContext.identityKeyForUnit(keylessShortFormUnit),
    "char_ashleigh_kestrel",
    "identityKeyForUnit must predict the trusted target for keyless short forms",
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
  const keylessLegacyKeyContext = prepareLtmSubjectIdentityContext({
    units: [keylessLegacyUnit],
    catalog: { entries: [ashleighEntry], notes: [ashleighLegacyNote] },
    scope,
    sourceBackedNpcSourceText: "Ash holds the line.",
    sourceBackedNpcSourceTitle: "Watch",
  });
  assert.equal(
    keylessLegacyKeyContext.identityKeyForUnit(keylessLegacyUnit),
    "char_ashleigh_legacy",
    "identityKeyForUnit must predict the existing legacy target for keyless source-backed units",
  );

  // 4f. Production catalog shape: an imported roleplay source note must not fork variants of a
  //     roster character or collide with its identity. This uses only the `notes` and
  //     `localSourceNotes` inputs that loadTrustedLtmSubjectCatalog supplies in production.
  const importedSourceText = "Ash holds the line. Ashleigh arrives later. Ashleigh Kestrel departs.";
  const importedSourceNote = {
    ...sourceNote,
    id: "imported-source",
    title: "Watch",
    sections: { source: { text: importedSourceText, updatedAt: timestamp } },
  };
  const variantNames = ["Ash", "Ashleigh", "Ashleigh Kestrel"];
  const variantUnits = variantNames.map((name) =>
    unit({
      bucket: "character_fact",
      subjectId: name.toLowerCase().replaceAll(" ", "_"),
      subjectNames: [name],
      text: `${name} knows navigation.`,
    }),
  );
  const productionCatalog = buildTrustedLtmSubjectCatalog({
    roster: [
      { kind: "character", id: "char_ashleigh_kestrel", name: "Ashleigh Kestrel", aliases: ["Ash", "Ashleigh"] },
    ],
    notes: [importedSourceNote],
    localSourceNotes: [importedSourceNote],
  });
  const productionLocalNames = productionCatalog.entries
    .filter((entry) => isLocalCharacterSubject(entry.subject))
    .map((entry) => entry.name);
  for (const name of variantNames) {
    assert.equal(
      productionLocalNames.includes(name),
      false,
      "source variants of a roster character must not create competing local identities",
    );
  }
  const productionResolution = prepareLtmSubjectIdentityContext({
    units: variantUnits,
    catalog: productionCatalog,
    scope,
    sourceBackedNpcSourceText: importedSourceText,
    sourceBackedNpcSourceTitle: importedSourceNote.title,
  }).resolve({ units: variantUnits, existingNotes: [] });
  assert.equal(productionResolution.droppedCandidates.length, 0);
  assert.deepEqual(
    productionResolution.units.map((resolvedUnit) => resolvedUnit.subjects?.[0]?.key),
    ["character:char_ashleigh_kestrel", "character:char_ashleigh_kestrel", "character:char_ashleigh_kestrel"],
    "short, first-name, and full-name variants must reuse the roster identity",
  );
  assert.equal(new Set(productionResolution.units.map((resolvedUnit) => resolvedUnit.subjectId)).size, 1);

  // 4g. Without a roster alias, source-visible names remain separate identities.
  const unrosteredCatalog = buildTrustedLtmSubjectCatalog({
    roster: [],
    notes: [importedSourceNote],
    localSourceNotes: [importedSourceNote],
  });
  const unrosteredNames = unrosteredCatalog.entries
    .filter((entry) => isLocalCharacterSubject(entry.subject))
    .map((entry) => entry.name);
  assert.equal(unrosteredNames.includes("Ash"), true);
  assert.equal(unrosteredNames.includes("Ashleigh"), true);
  assert.equal(unrosteredNames.includes("Ashleigh Kestrel"), true, "the full form stays the canonical identity");
  const unrosteredResolution = prepareLtmSubjectIdentityContext({
    units: variantUnits,
    catalog: unrosteredCatalog,
    scope,
    sourceBackedNpcSourceText: importedSourceText,
    sourceBackedNpcSourceTitle: importedSourceNote.title,
  }).resolve({ units: variantUnits, existingNotes: [] });
  assert.equal(unrosteredResolution.droppedCandidates.length, 0);
  assert.equal(
    new Set(unrosteredResolution.units.map((resolvedUnit) => resolvedUnit.subjects?.[0]?.key)).size,
    3,
    "source co-occurrence cannot prove short/full-name identity",
  );
  assert.equal(new Set(unrosteredResolution.units.map((resolvedUnit) => resolvedUnit.subjectId)).size, 3);
  assert.ok(unrosteredResolution.units[0]!.subjects?.[0]?.key.startsWith("local_character:"));

  // 4h. Separate source names stay distinct, regardless of note order.
  const variantNoteA = {
    ...sourceNote,
    id: "variant-note-a",
    title: "variant-note-a",
    sections: { source: { text: "Ash holds the line.", updatedAt: timestamp } },
  };
  const variantNoteB = {
    ...sourceNote,
    id: "variant-note-b",
    title: "variant-note-b",
    sections: { source: { text: "Ashleigh Kestrel departs.", updatedAt: timestamp } },
  };
  const orderIdentities: Array<Array<{ name: string; key: string }>> = [];
  for (const orderedNotes of [
    [variantNoteA, variantNoteB],
    [variantNoteB, variantNoteA],
  ]) {
    const orderedCatalog = buildTrustedLtmSubjectCatalog({
      roster: [],
      notes: orderedNotes,
      localSourceNotes: orderedNotes,
    });
    const localEntries = orderedCatalog.entries.filter((entry) => isLocalCharacterSubject(entry.subject));
    assert.ok(localEntries.some((entry) => entry.name === "Ash"));
    assert.ok(localEntries.some((entry) => entry.name === "Ashleigh Kestrel"));
    orderIdentities.push(
      localEntries
        .map((entry) => ({ name: entry.name, key: entry.subject.key }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
  assert.deepEqual(orderIdentities[0], orderIdentities[1], "source identities must not depend on note order");

  // 4i. A roster alias that is itself a variant of the source name must block a competing local
  //     identity, not only an exact-slug alias match.
  const aliasSourceNote = {
    ...sourceNote,
    id: "alias-source",
    title: "alias-source",
    sections: { source: { text: "Ashleigh swings.", updatedAt: timestamp } },
  };
  const aliasCatalog = buildTrustedLtmSubjectCatalog({
    roster: [
      { kind: "character", id: "char_ash_kestrel", name: "Ash Kestrel", aliases: ["Ashleigh Kestrel", "Ashleigh"] },
    ],
    notes: [aliasSourceNote],
    localSourceNotes: [aliasSourceNote],
  });
  assert.equal(
    aliasCatalog.entries.filter((entry) => isLocalCharacterSubject(entry.subject)).length,
    0,
    "a roster alias variant must not fork a competing local identity",
  );
  const aliasUnits = [
    unit({ bucket: "character_fact", subjectId: "ashleigh", subjectNames: ["Ashleigh"], text: "Ashleigh swings." }),
  ];
  const aliasResolution = prepareLtmSubjectIdentityContext({
    units: aliasUnits,
    catalog: aliasCatalog,
    scope,
    sourceBackedNpcSourceText: aliasSourceNote.sections.source.text,
    sourceBackedNpcSourceTitle: aliasSourceNote.title,
  }).resolve({ units: aliasUnits, existingNotes: [] });
  assert.equal(aliasResolution.droppedCandidates.length, 0);
  assert.equal(
    aliasResolution.units[0]!.subjects?.[0]?.key,
    "character:char_ash_kestrel",
    "an alias variant must resolve to the trusted roster identity instead of a provisional local target",
  );
  const ambiguousAliasCatalog = buildTrustedLtmSubjectCatalog({
    roster: [
      { kind: "character", id: "char_ash_kestrel", name: "Ash Kestrel", aliases: ["Ashleigh Kestrel", "Ashleigh"] },
      {
        kind: "character",
        id: "char_ashford_kestrel",
        name: "Ashford Kestrel",
        aliases: ["Ashleigh Kestrel", "Ashleigh"],
      },
    ],
    notes: [aliasSourceNote],
    localSourceNotes: [aliasSourceNote],
  });
  const ambiguousAliasResolution = prepareLtmSubjectIdentityContext({
    units: aliasUnits,
    catalog: ambiguousAliasCatalog,
    scope,
    sourceBackedNpcSourceText: aliasSourceNote.sections.source.text,
    sourceBackedNpcSourceTitle: aliasSourceNote.title,
  }).resolve({ units: aliasUnits, existingNotes: [] });
  assert.equal(ambiguousAliasResolution.droppedCandidates.length, 1);
  assert.equal(ambiguousAliasResolution.droppedCandidates[0]!.reason, "ambiguous_subject");

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
