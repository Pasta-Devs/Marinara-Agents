import { createHash } from "node:crypto";
import {
  isLtmSourceLikeNote,
  type LtmNote,
  type LtmNoteType,
  type LtmScope,
  type LtmStatus,
  type LtmImportance,
  type LtmMode,
  type LtmRelationshipDimensionChanges,
  type LtmRelationshipDimensions,
  type LtmMemoryChunk,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { extractNoteKeywords } from "./keyword-extract.js";

export const CURRENT_LTM_CHUNK_FORMAT_VERSION = 4;

export interface ChunkLtmNotesOptions {
  includeSourceNotes?: boolean;
  sourceNotesOnly?: boolean;
}

const LEGACY_LABEL_SUFFIX_PATTERN = /\n{2,}\[note:[^\n]*\]\s*$/;
const INLINE_EVIDENCE_LABEL_PATTERN = /\s*\[evidence:[^\]\n]*\]/g;

export function cleanLongTermMemoryChunkText(text: string) {
  return text.trim().replace(LEGACY_LABEL_SUFFIX_PATTERN, "").replace(INLINE_EVIDENCE_LABEL_PATTERN, "").trim();
}

export function stableJsonHash(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

export function isLtmSourceSummaryNote(note: Pick<LtmNote, "type" | "tags">) {
  return isLtmSourceLikeNote(note);
}

export function chunkNoteSections(note: LtmNote): LtmMemoryChunk[] {
  const keywords = extractNoteKeywords(note);
  if (note.type === "tone") {
    const profileText = note.sections.profile?.text ? cleanLongTermMemoryChunkText(note.sections.profile.text) : "";
    const obsText = note.sections.observations?.text
      ? cleanLongTermMemoryChunkText(note.sections.observations.text)
      : "";
    const combined = [profileText, obsText].filter(Boolean).join("\n\n");
    const section = note.sections.profile ?? note.sections.observations;
    if (!section || !combined) return [];
    return [
      {
        id: `${note.id}::profile`,
        noteId: note.id,
        title: note.title?.trim() || undefined,
        sectionKey: "profile",
        text: combined,
        noteType: note.type,
        status: note.status,
        modes: [...note.modes].sort((a, b) => a.localeCompare(b)),
        scope: note.scope,
        tags: [...note.tags].sort((a, b) => a.localeCompare(b)),
        keywords,
        salience: Math.max(note.sections.profile?.salience ?? 0, note.sections.observations?.salience ?? 0),
        confidence: Math.max(note.sections.profile?.confidence ?? 0, note.sections.observations?.confidence ?? 0),
        importance: note.sections.profile?.importance ?? note.sections.observations?.importance,
        dimensions: section.dimensions,
        dimensionChanges: section.dimensionChanges,
        updatedAt: note.sections.profile?.updatedAt ?? note.sections.observations?.updatedAt ?? "",
        sourceHash: stableJsonHash({
          noteId: note.id,
          title: note.title?.trim() || undefined,
          noteType: note.type,
          status: note.status,
          modes: note.modes,
          scope: note.scope,
          tags: note.tags,
          keywords,
          sectionKey: "profile",
          section,
        }),
      },
    ];
  }

  return Object.entries(note.sections)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sectionKey, section]) => {
      const text = cleanLongTermMemoryChunkText(section.text);
      return {
        id: `${note.id}::${sectionKey}`,
        noteId: note.id,
        title: note.title?.trim() || undefined,
        sectionKey,
        text,
        noteType: note.type,
        status: note.status,
        modes: [...note.modes].sort((a, b) => a.localeCompare(b)),
        scope: note.scope,
        tags: [...note.tags].sort((a, b) => a.localeCompare(b)),
        keywords,
        salience: section.salience,
        confidence: section.confidence,
        importance: section.importance,
        dimensions: section.dimensions,
        dimensionChanges: section.dimensionChanges,
        updatedAt: section.updatedAt,
        sourceHash: stableJsonHash({
          noteId: note.id,
          title: note.title?.trim() || undefined,
          noteType: note.type,
          status: note.status,
          modes: note.modes,
          scope: note.scope,
          tags: note.tags,
          keywords,
          sectionKey,
          section,
        }),
      };
    });
}

export function chunkNotes(notes: LtmNote[], options: ChunkLtmNotesOptions = {}) {
  return notes
    .slice()
    .filter((note) => {
      const isSource = isLtmSourceSummaryNote(note);
      if (options.sourceNotesOnly) return isSource;
      return options.includeSourceNotes === true || !isSource;
    })
    .sort((a, b) => a.id.localeCompare(b.id))
    .flatMap((note) => chunkNoteSections(note));
}
