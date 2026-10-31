import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

import {
  type LtmDraftMutation,
  type LtmNote,
  type LtmSubject,
} from "../../../../../shared/src/features/agents/long-term-memory/schema.js";
import { applyLongTermMemoryDraft } from "../drafts/reconciliation.js";
import { LongTermMemoryDraftStore } from "../drafts/draft-store.js";
import { isAdditiveLtmSection } from "../drafts/draft-projector.js";
import { canUpdateLtmScopedTarget } from "../extraction/scoped-targets.js";
import { getPackageResources, logger } from "../package-runtime.js";
import { renderSectionContributions } from "../persistence/section-contributions.js";
import type { LongTermMemoryStorage } from "../persistence/storage.js";
import { withLtmVaultLock } from "../persistence/vault-lock.js";
import { getLtmGlobalSettings } from "../settings.js";

// ponytail: the Engine does not tell a service who calls it, so `caller` is self-reported and any package
// can name itself "slurp2". The list only keeps unknown names out; a package that lies still needs the user's
// "Other Agents can add memories" switch on. Upgrade path: the Engine passes the caller's id
// (`registerService(key, service, { forCaller })`).
export const LTM_INTAKE_CALLERS = ["slurp2"] as const;
export type LtmIntakeCaller = (typeof LTM_INTAKE_CALLERS)[number];

const hashShort = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);

export const ltmPackageSourceNotePrefix = (caller: string) => `source_pkg_${caller}_`;
export const ltmPackageSourceNoteId = (caller: LtmIntakeCaller, recordId: string) =>
  `${ltmPackageSourceNotePrefix(caller)}${hashShort(recordId)}`;

const callerSchema = z.enum(LTM_INTAKE_CALLERS);
// "<caller>:<recordId>" is the provenance sourceId, which allows 120 characters.
const recordIdSchema = z.string().min(1).max(100);
const submitSchema = z
  .object({
    caller: callerSchema,
    recordId: recordIdSchema,
    characterIds: z
      .array(
        z
          .string()
          .min(1)
          .max(120)
          .refine((id) => id.trim() === id && ![...id].some((char) => char < " " || char === "\u007f")),
      )
      .min(1)
      .max(2)
      .refine((ids) => new Set(ids).size === ids.length),
    // One line: a record's line breaks become spaces.
    text: z
      .string()
      .trim()
      .min(1)
      .max(1_000)
      .transform((text) => text.replace(/\s+/g, " ")),
    signal: z.unknown().optional(),
  })
  .strict();
const retractSchema = z
  .object({ caller: callerSchema, recordId: recordIdSchema, signal: z.unknown().optional() })
  .strict();

const MODES = ["roleplay", "conversation"] as const;

function signalOf(input: unknown) {
  return input && typeof input === "object" && "signal" in input && input.signal instanceof AbortSignal
    ? input.signal
    : undefined;
}

const sameIds = (left: readonly string[] = [], right: readonly string[] = []) =>
  left.length === right.length && [...left].sort().join("\n") === [...right].sort().join("\n");

const madeFrom = (note: LtmNote, target: string) =>
  note.links.some((link) => link.target === target && link.relation === "extracted_from");

const characterRef = (subject: LtmSubject, characterId: string) =>
  subject.ref?.kind === "character" && subject.ref.id === characterId;

/** The section key a caller's lines live in on a character note, e.g. `from_slurp2`. */
export const ltmIntakeSectionKey = (caller: LtmIntakeCaller) => `from_${caller}`;

/**
 * The note's sections and links with everything `sourceNoteId` contributed taken out, or `null` when nothing of
 * it is left: the permanent delete removes that note with the source.
 */
function withoutSource(note: LtmNote, sourceNoteId: string): LtmNote | null {
  const sections = Object.fromEntries(
    Object.entries(note.sections).flatMap(([key, section]) => {
      const contributions = section.contributions ?? [];
      const kept = contributions.filter((item) => item.owner !== "source" || item.sourceNoteId !== sourceNoteId);
      if (kept.length === contributions.length) return [[key, section]];
      const rendered = renderSectionContributions(kept, isAdditiveLtmSection(note, key));
      return rendered ? [[key, rendered]] : [];
    }),
  );
  if (!Object.keys(sections).length) return null;
  return {
    ...note,
    sections,
    links: note.links.filter((link) => link.target !== sourceNoteId || link.relation !== "extracted_from"),
  };
}

export function createLtmIntakeService(storage: LongTermMemoryStorage, root = storage.root) {
  const enabled = async () => (await getLtmGlobalSettings(root)).longTermMemoryAcceptFromPackages;

  // Callers hold the vault lock.
  // `optedOutNoteIds` (a replace only): memories the user archived or narrowed are excluded from the delete, so they
  // keep their sections, old line included, and lose only their link to the source.
  async function retractUnlocked(sourceNoteId: string, optedOutNoteIds: readonly string[] = []) {
    if (!(await storage.getNote(sourceNoteId))) return false;
    // Everything that can stop the delete is checked before the first write, so a failed retract changes nothing:
    // the full listing fails on an unreadable note as the delete would, and a note made from a note this deletes
    // would widen the delete's lineage.
    const notes = await storage.listNotes();
    const deleted = [sourceNoteId];
    const excluded: string[] = [];
    const kept: Array<[LtmNote, LtmNote]> = [];
    for (const note of notes.filter((item) => madeFrom(item, sourceNoteId))) {
      if (optedOutNoteIds.includes(note.id)) {
        excluded.push(note.id);
        continue;
      }
      const next = withoutSource(note, sourceNoteId);
      if (next) kept.push([note, next]);
      else deleted.push(note.id);
    }
    if (notes.some((note) => deleted.slice(1).some((id) => madeFrom(note, id))))
      throw new Error("Long-term memory could not remove the package record: other memories were made from it.");
    for (const [note, next] of kept) await storage.projectNote(note.id, note.type, () => next);
    // The other notes no longer come from the source, so its lineage is the source and the notes it alone made.
    await storage.deleteNotesPermanently(deleted, {
      retractExtracted: true,
      excludedNoteIds: excluded,
      lineageSourceNoteId: sourceNoteId,
      expectedLineageNoteIds: [...deleted, ...excluded],
    });
    return true;
  }

  async function submitUnlocked(input: z.infer<typeof submitSchema>) {
    const sourceNoteId = ltmPackageSourceNoteId(input.caller, input.recordId);
    const sourceId = `${input.caller}:${input.recordId}`;
    const existing = await storage.getNote(sourceNoteId);
    const listCharacterNotes = () => storage.listNotes({ type: "character", skipInvalid: true });
    // Listed before any retract: a retract can delete the memory a later check has to see.
    const before = await listCharacterNotes();
    // Unchanged only while a character memory still holds the line; a source left by a failed apply is rewritten.
    if (
      existing?.sections.source?.text === input.text &&
      sameIds(existing.scope.characterIds, input.characterIds) &&
      before.some((note) => madeFrom(note, sourceNoteId))
    )
      return "unchanged" as const;
    // A changed line or a changed list of characters replaces the old one everywhere it went.
    let names = new Map<string, string>();
    try {
      const characters = await getPackageResources().listCharacters(input.characterIds);
      names = new Map(
        characters.flatMap((character) => {
          const name = (character.data as { name?: unknown } | null)?.name;
          return [[character.id, typeof name === "string" ? name.trim().slice(0, 200) : ""] as const];
        }),
      );
      // A record about a character the host does not have is not accepted.
      if (input.characterIds.some((id) => !names.has(id))) return null;
    } catch {
      // A host without resources still gets the memory, only without a title.
    }

    const sectionKey = ltmIntakeSectionKey(input.caller);
    const memoryId = (characterId: string) => `char_${input.caller}_${hashShort(characterId)}`;
    // The oldest memory of the character that recall serves in every mode intake writes for.
    const targetFor = (notes: LtmNote[], characterId: string) =>
      notes
        .filter((note) => note.subjects?.some((subject) => characterRef(subject, characterId)))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .find(
          (note) =>
            note.status !== "archived" &&
            note.subjects?.length === 1 &&
            MODES.every((mode) => note.modes.includes(mode)) &&
            canUpdateLtmScopedTarget(note.scope, { characterIds: [characterId] }),
        );
    // The memory intake made earlier and the user archived or narrowed: leave that character out. Decided before
    // a replace retracts the old line, which deletes a memory holding only that line.
    const optedOut = input.characterIds.filter(
      (id) => !targetFor(before, id) && before.some((note) => note.id === memoryId(id)),
    );
    if (optedOut.length === input.characterIds.length) return null;
    if (existing) await retractUnlocked(sourceNoteId, optedOut.map(memoryId));

    const scope = { characterIds: [...input.characterIds] };
    // Apply needs each change to name its source note; the record id says where it came from.
    const evidence = [`source_note:${sourceNoteId}`, sourceId];
    const timestamp = new Date().toISOString();
    const characterNotes = existing ? await listCharacterNotes() : before;
    const mutations = input.characterIds.flatMap((characterId): LtmDraftMutation[] => {
      if (optedOut.includes(characterId)) return [];
      const about = characterNotes
        .filter((note) => note.subjects?.some((subject) => characterRef(subject, characterId)))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      const target = targetFor(characterNotes, characterId);
      const base = {
        id: randomUUID(),
        // A standing fact, not an event: only "change" claims need a timeline event from the same source.
        claimKind: "static" as const,
        risk: "low" as const,
        confidence: 0.8,
        summary: input.text,
        evidence,
      };
      if (target) return [{ ...base, kind: "append_section", noteId: target.id, sectionKey, text: input.text }];
      const noteId = memoryId(characterId);
      const key =
        about.flatMap((note) => note.subjects ?? []).find((subject) => characterRef(subject, characterId))?.key ??
        `character:${characterId}`;
      const name = names.get(characterId);
      return [
        {
          ...base,
          kind: "create_note",
          note: {
            id: noteId,
            ...(name ? { title: name } : {}),
            type: "character",
            status: "active",
            modes: [...MODES],
            scope: { characterIds: [characterId] },
            tags: [],
            keywords: [],
            suppressedKeywords: [],
            links: [],
            subjects: [{ key, ref: { kind: "character", id: characterId } }],
            sections: { [sectionKey]: { text: input.text, updatedAt: timestamp } },
          },
        },
      ];
    });
    if (!mutations.length) return null;

    await storage.createNote({
      id: sourceNoteId,
      type: "source",
      status: "active",
      modes: [...MODES],
      scope,
      tags: ["package_record"],
      keywords: [],
      links: [],
      provenance: { kind: "package_record", sourceId },
      sections: { source: { text: input.text, updatedAt: timestamp, confidence: 0.8, evidence } },
    });
    try {
      const draft = await new LongTermMemoryDraftStore(root).createDraft({
        scope,
        modes: [...MODES],
        source: { sourceNoteId },
        response: { summary: input.text, mutations },
        reviewRequired: false,
      });
      if (!draft.source.extractionFingerprint) throw new Error("Long-term memory could not bind the package record.");
      await storage.updateNote(sourceNoteId, { extractionFingerprint: draft.source.extractionFingerprint });
      await applyLongTermMemoryDraft(draft.id, {
        root,
        actor: `package:${input.caller}`,
        mutationIds: draft.mutations.map((mutation) => mutation.id),
      });
    } catch (error) {
      // Leave no source behind that a repeated call would report as unchanged.
      await retractUnlocked(sourceNoteId).catch((cleanup) =>
        logger.warn(cleanup, "Long-term memory could not remove a package record that failed to apply"),
      );
      throw error;
    }
    return "applied" as const;
  }

  return {
    version: 1 as const,
    /**
     * Adds one line a package knows about one or two characters to each one's character memory. Returns `null` for
     * invalid input, an unknown caller or character, an aborted call, while "Other Agents can add memories" is off, or when
     * every named character's memory from an earlier record was archived or narrowed by the user.
     */
    async submit(input: unknown): Promise<{ version: 1; status: "applied" | "unchanged" } | null> {
      const signal = signalOf(input);
      const parsed = submitSchema.safeParse(input);
      if (!parsed.success) return null;
      const status = await withLtmVaultLock(root, async () =>
        signal?.aborted || !(await enabled()) ? null : submitUnlocked(parsed.data),
      );
      return status && { version: 1, status };
    },
    /** Takes a package's line out again. `null` as for `submit`; `missing` when there was nothing to remove. */
    async retract(input: unknown): Promise<{ version: 1; status: "retracted" | "missing" } | null> {
      const signal = signalOf(input);
      const parsed = retractSchema.safeParse(input);
      if (!parsed.success) return null;
      const sourceNoteId = ltmPackageSourceNoteId(parsed.data.caller, parsed.data.recordId);
      const removed = await withLtmVaultLock(root, async () =>
        signal?.aborted || !(await enabled()) ? null : retractUnlocked(sourceNoteId),
      );
      return removed === null ? null : { version: 1, status: removed ? "retracted" : "missing" };
    },
  };
}
