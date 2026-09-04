import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const source = "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory";
const timestamp = "2026-09-04T00:00:00.000Z";

function unit(input: {
  bucket: "character_fact" | "relationship_state";
  subjectId: string;
  subjectNames: string[];
  text: string;
}) {
  return {
    id: randomUUID(),
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
  const { buildTrustedLtmSubjectCatalog, prepareLtmSubjectIdentityContext } = await import(
    `${source}/subject-identity.ts`
  );

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
  assert.equal(
    compiled.mutations.every((mutation) => mutation.risk === "medium"),
    true,
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

  const ambiguous = buildTrustedLtmSubjectCatalog({
    roster: [],
    notes: [
      {
        ...sourceNote,
        id: "char_mara_one",
        type: "character",
        title: "Mara",
        subjects: [{ key: "local_character:chat_a:mara-one" }],
      } as any,
      {
        ...sourceNote,
        id: "char_mara_two",
        type: "character",
        title: "Mara",
        subjects: [{ key: "local_character:chat_a:mara-two" }],
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

  process.stdout.write(
    "Long-Term Memory local-character regression: scoped identity, review risk, safeguards, and isolation passed\n",
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
