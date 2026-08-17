import { createHash } from "node:crypto";
import type { LtmNote, LtmSourceProvenance } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

function hashShort(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function sourceNoteIdForProvenance(provenance: LtmSourceProvenance) {
  const identity = provenance.entryId ? `${provenance.sourceId}\0${provenance.entryId}` : provenance.sourceId;
  return `source_${provenance.kind}_${hashShort(identity)}`;
}

function evidenceValue(evidence: readonly string[], prefix: string) {
  return evidence
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

export function inferSourceProvenance(note: Pick<LtmNote, "tags" | "sections" | "provenance">) {
  if (note.provenance) return note.provenance;
  const evidence = note.sections.source?.evidence ?? note.sections.summary?.evidence ?? [];

  if (note.tags.includes("imported_character")) {
    const sourceId = evidenceValue(evidence, "character:");
    return sourceId ? ({ kind: "character", sourceId } satisfies LtmSourceProvenance) : null;
  }
  if (note.tags.includes("imported_lorebook")) {
    const sourceId = evidenceValue(evidence, "lorebook:");
    return sourceId ? ({ kind: "lorebook", sourceId } satisfies LtmSourceProvenance) : null;
  }

  const sourceId = evidenceValue(evidence, "chat:");
  if (!sourceId) return null;
  if (note.tags.includes("imported_chat")) {
    const entryId = evidenceValue(evidence, "summary_entry:");
    return entryId
      ? ({
          kind: "chat_summary",
          sourceId,
          entryId,
        } satisfies LtmSourceProvenance)
      : null;
  }
  return null;
}
