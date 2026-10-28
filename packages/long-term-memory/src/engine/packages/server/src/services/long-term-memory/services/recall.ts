import { z } from "zod";
import type { LtmNote, LtmNoteType } from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import type { LongTermMemoryStorage } from "../persistence/storage.js";
import { estimateTokens } from "../recall/budget.js";
import { chunkNoteSections } from "../recall/chunking.js";
import { retrieveLongTermMemory } from "../recall/retrieval.js";
import { getLtmGlobalSettings } from "../settings.js";
import { isLtmNoteShareable, ltmPackageCallerSchema, recordLtmPackageRead } from "./storage-read.js";

const LTM_RECALL_SERVICE_VERSION = 1;
/** The most sections a whole-memory recall returns. */
const WHOLE_RECALL_MAX_SECTIONS = 20;

/** The order sections come back in: what is still going on and what happened, then who, then the backdrop. */
const SECTION_TYPES: readonly LtmNoteType[] = [
  "thread",
  "timeline_event",
  "relationship",
  "character",
  "world",
  "scene",
];

const recallInputSchema = z.object({
  caller: ltmPackageCallerSchema,
  queryText: z.string().trim().min(1).max(8_000),
  characterIds: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  personaId: z.string().trim().min(1).max(120).optional(),
  mode: z.enum(["roleplay", "conversation"]).optional(),
  maxTokens: z.number().int().min(50).max(4_000).default(800),
  whole: z.boolean().default(false),
});

type LtmRecallServiceSection = { noteId: string; type: LtmNoteType; title?: string; text: string };
type LtmRecallServiceResult = {
  version: typeof LTM_RECALL_SERVICE_VERSION;
  sections: LtmRecallServiceSection[];
};

/** A character or relationship memory must name a posting account as a subject; other types have no subjects. */
function isAboutAccounts(note: Pick<LtmNote, "type" | "subjects">, accountIds: ReadonlySet<string>) {
  if (note.type !== "character" && note.type !== "relationship") return true;
  return note.subjects?.some((subject) => accountIds.has(subject.ref?.id ?? "")) ?? false;
}

/**
 * The `long-term-memory:recall` service: memories about the posting accounts for another package's prompt, as a
 * new chat with those characters would recall them. Contract in docs/ARCHITECTURE.md ("Services for Other Packages").
 */
export function createLtmRecallService(storage: Pick<LongTermMemoryStorage, "listNotes" | "root">) {
  return {
    version: LTM_RECALL_SERVICE_VERSION,
    async recall(input: unknown): Promise<LtmRecallServiceResult | null> {
      const signal =
        input && typeof input === "object" && "signal" in input && input.signal instanceof AbortSignal
          ? input.signal
          : undefined;
      const parsed = recallInputSchema.safeParse(input);
      if (!parsed.success || signal?.aborted) return null;
      const { caller, queryText, characterIds, personaId, mode, maxTokens, whole } = parsed.data;
      if (!characterIds.length && !personaId) return null;
      try {
        const settings = await getLtmGlobalSettings(storage.root);
        if (!settings.longTermMemoryShareWithPackages) return null;
        // No chat or group in the query, so a memory limited to one never matches.
        const scope = personaId ? { personaId, personaIds: [personaId] } : undefined;
        const accountIds = new Set([...characterIds, ...(personaId ? [personaId] : [])]);
        const notes = new Map(
          (await storage.listNotes({ characterIds, scope, skipInvalid: true }))
            .filter(
              (note) =>
                isLtmNoteShareable(note) &&
                SECTION_TYPES.includes(note.type) &&
                (!mode || note.modes.includes(mode)) &&
                isAboutAccounts(note, accountIds),
            )
            .map((note) => [note.id, note]),
        );
        const sections = new Map<string, LtmRecallServiceSection>();
        if (whole) {
          // Newest first within a type. A memory that does not fit is skipped, never cut, so a later one can still fit.
          const wholeOrder = [...notes.values()].sort(
            (left, right) =>
              SECTION_TYPES.indexOf(left.type) - SECTION_TYPES.indexOf(right.type) ||
              Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
          );
          let usedTokens = 0;
          for (const note of wholeOrder) {
            if (sections.size >= WHOLE_RECALL_MAX_SECTIONS) break;
            const text = chunkNoteSections(note)
              .map((chunk) => chunk.text)
              .filter(Boolean)
              .join("\n");
            if (!text) continue;
            const tokens = estimateTokens(text);
            if (usedTokens + tokens > maxTokens) continue;
            usedTokens += tokens;
            sections.set(note.id, {
              noteId: note.id,
              type: note.type,
              ...(note.title ? { title: note.title } : {}),
              text,
            });
          }
        } else if (notes.size) {
          const retrieval = await retrieveLongTermMemory({
            root: storage.root,
            queryText,
            scope,
            characterIds,
            noteIds: new Set(notes.keys()),
            includeResolved: true,
            maxTokens,
            minScore: 0,
            semanticWeight: settings.longTermMemorySemanticWeight,
            lexicalWeight: settings.longTermMemoryLexicalWeight,
            graphWeight: settings.longTermMemoryGraphWeight,
            keywordWeight: settings.longTermMemoryKeywordWeight,
            signal,
          });
          for (const { chunk } of retrieval.chunks) {
            const section = sections.get(chunk.noteId);
            const note = notes.get(chunk.noteId);
            if (section) section.text += `\n${chunk.text}`;
            else if (note)
              sections.set(note.id, {
                noteId: note.id,
                type: note.type,
                ...(note.title ? { title: note.title } : {}),
                text: chunk.text,
              });
          }
        }
        // A stable sort keeps the relevance order within each type.
        const ordered = [...sections.values()].sort(
          (left, right) => SECTION_TYPES.indexOf(left.type) - SECTION_TYPES.indexOf(right.type),
        );
        await recordLtmPackageRead(storage.root, "package_recall", caller, ordered.length);
        return { version: LTM_RECALL_SERVICE_VERSION, sections: ordered };
      } catch (error) {
        if (signal?.aborted) return null;
        throw error;
      }
    },
  };
}
