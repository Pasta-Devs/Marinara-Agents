import { cp, mkdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  ltmNoteForkApplyRequestSchema,
  ltmNoteForkApplyResponseSchema,
  ltmNoteForkPreviewRequestSchema,
  ltmNoteForkPreviewResponseSchema,
  type LtmNote,
  type LtmNoteForkApplyRequest,
  type LtmNoteForkApplyResponse,
  type LtmNoteForkPreviewRequest,
  type LtmNoteForkPreviewResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { nowIso } from "./ltm-utils.js";
import { getLongTermMemoryRoot } from "./paths.js";
import { LongTermMemoryStorage } from "./storage.js";
import { withLtmVaultLock } from "./vault-lock.js";
import { invalidateLtmVaultSnapshot } from "./vault-snapshot.js";
import { createHash } from "node:crypto";
import {
  getLtmScopeChatIds,
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
  normalizeLtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/index.js";
import { isAdditiveLtmSection } from "./draft-projector.js";
import { renderSectionContributions, sectionContributions } from "./section-contributions.js";
import { equivalentLtmForkAvailability } from "./scoped-targets.js";
import { LtmServiceError } from "./service-error.js";
import { uniqueLtmKeywords } from "../../../../shared/src/features/agents/long-term-memory/keywords.js";
import { uniqueLinks } from "../../../../shared/src/features/agents/long-term-memory/utils.js";

function text(note: LtmNote) {
  return Object.values(note.sections)
    .map((section) => section.text)
    .join(" ")
    .toLocaleLowerCase();
}

function similarity(left: string, right: string) {
  const a = new Set(
    left
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
  const b = new Set(
    right
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function contentHash(notes: LtmNote[]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        notes
          .map((note) => ({
            id: note.id,
            version: note.version,
            modes: note.modes,
            scope: normalizeLtmScope(note.scope),
            sections: note.sections,
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      ),
    )
    .digest("hex");
}

function mergedSections(notes: LtmNote[]) {
  const sections: LtmNote["sections"] = {};
  for (const key of new Set(notes.flatMap((note) => Object.keys(note.sections)))) {
    const entries = notes.flatMap((note) => (note.sections[key] ? [{ note, section: note.sections[key]! }] : []));
    const source = entries.map((entry) => entry.section);
    const lines = [
      ...new Set(
        source.flatMap((section) =>
          section.text
            .split(/\r?\n/g)
            .map((line) => line.trim())
            .filter(Boolean),
        ),
      ),
    ];
    sections[key] = renderSectionContributions(
      source.flatMap((section) => sectionContributions(section)),
      isAdditiveLtmSection(entries[0]!.note, key),
    ) ?? { ...source[0], text: lines.join("\n"), updatedAt: nowIso() };
  }
  return sections;
}

function blockingReasons(notes: LtmNote[]) {
  const reasons: string[] = [];
  for (const key of new Set(notes.flatMap((note) => Object.keys(note.sections)))) {
    const lifecycles = new Set(
      notes.filter((note) => note.sections[key]).map((note) => isAdditiveLtmSection(note, key)),
    );
    if (lifecycles.size > 1) {
      reasons.push(`Conflicting ${key.replace(/_/g, " ")} lifecycles require an explicit review choice.`);
      continue;
    }
    if (lifecycles.has(true)) continue;
    const values = new Set(
      notes
        .flatMap((note) => (note.sections[key] ? [note.sections[key]!.text.trim().replace(/\s+/g, " ")] : []))
        .filter(Boolean),
    );
    if (values.size > 1)
      reasons.push(`Conflicting ${key.replace(/_/g, " ")} values require an explicit review choice.`);
  }
  return reasons;
}

async function selectedNotes(request: LtmNoteForkPreviewRequest, root?: string) {
  const notes = await new LongTermMemoryStorage(root).getNotesByIds(request.noteIds);
  if (notes.size !== request.noteIds.length) throw new Error("One or more fork notes no longer exist.");
  const selected = request.noteIds.map((id) => notes.get(id)!);
  if (selected.some((note) => note.type !== "thread" && note.type !== "world"))
    throw new Error("Only thread and world notes can be reviewed as forks.");
  if (new Set(selected.map((note) => note.type)).size !== 1) throw new Error("Fork notes must have the same type.");
  if (selected.some((note) => note.status === "archived"))
    throw new Error("Archived notes cannot be selected as forks.");
  const ordered = [...selected].sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
  const scopeKey = (scope: LtmNote["scope"]) => {
    const normalized = normalizeLtmScope(scope);
    return JSON.stringify({
      chats: getLtmScopeChatIds(normalized).sort(),
      groups: getLtmScopeGroupIds(normalized).sort(),
      characters: [...(normalized.characterIds ?? [])].sort(),
      personas: getLtmScopePersonaIds(normalized).sort(),
    });
  };
  const modeKey = (modes: LtmNote["modes"]) => JSON.stringify([...new Set(modes)].sort());
  if (ordered.some((note) => !equivalentLtmForkAvailability(ordered[0]!, note)))
    throw new LtmServiceError(
      "Fork notes must have equivalent availability scopes and compatible chat modes.",
      400,
      "ltm_fork_availability_mismatch",
    );
  return ordered;
}

export async function previewLtmNoteForkRepair(
  request: LtmNoteForkPreviewRequest,
  options: { root?: string } = {},
): Promise<LtmNoteForkPreviewResponse> {
  const parsed = ltmNoteForkPreviewRequestSchema.parse(request);
  const notes = await selectedNotes(parsed, options.root);
  const canonical = [...notes].sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  )[0]!;
  const scores = notes
    .filter((note) => note.id !== canonical.id)
    .map((note) => similarity(text(canonical), text(note)));
  const reasons = [
    ...(scores.some((score) => score < 0.72) ? ["Fork notes are not sufficiently similar for a reviewed merge."] : []),
    ...blockingReasons(notes),
  ];
  return ltmNoteForkPreviewResponseSchema.parse({
    candidates: [
      {
        noteIds: notes.map((note) => note.id),
        canonicalNoteId: canonical.id,
        noteType: canonical.type,
        similarity: Math.min(...scores),
        blockingReasons: reasons,
        contentHash: contentHash(notes),
      },
    ],
  });
}

export async function applyLtmNoteForkRepair(
  request: LtmNoteForkApplyRequest,
  options: { root?: string } = {},
): Promise<LtmNoteForkApplyResponse> {
  const parsed = ltmNoteForkApplyRequestSchema.parse(request);
  const root = options.root ?? getLongTermMemoryRoot();
  return withLtmVaultLock(root, async () => {
    const notes = await selectedNotes(parsed, root);
    const canonical = notes[0]!;
    if (parsed.canonicalNoteId !== canonical.id)
      throw new LtmServiceError(
        "Canonical fork note does not match the deterministic preview selection.",
        409,
        "ltm_fork_canonical_mismatch",
      );
    const scores = notes
      .filter((note) => note.id !== canonical.id)
      .map((note) => similarity(text(canonical), text(note)));
    if (Math.min(...scores) < 0.72)
      throw new LtmServiceError(
        "Fork notes are not sufficiently similar for a reviewed merge.",
        409,
        "ltm_fork_similarity_insufficient",
      );
    if (contentHash(notes) !== parsed.contentHash)
      throw new LtmServiceError(
        "Fork preview is stale. Refresh before applying the repair.",
        409,
        "ltm_fork_preview_stale",
      );
    const reasons = blockingReasons(notes);
    if (reasons.length) throw new LtmServiceError(reasons.join(" "), 409, "ltm_fork_conflict");
    const backupId = randomUUID();
    const backupDirectory = join(dirname(root), "backups", "long-term-memory-forks", backupId);
    await mkdir(backupDirectory, { recursive: true });
    await cp(root, join(backupDirectory, basename(root)), { recursive: true, errorOnExist: true, force: false });
    try {
      const storage = new LongTermMemoryStorage(root);
      const archivedNoteIds = notes.filter((note) => note.id !== parsed.canonicalNoteId).map((note) => note.id);
      await storage.projectNote(parsed.canonicalNoteId, canonical.type, (current) => {
        if (!current) throw new Error("Canonical fork note no longer exists.");
        return {
          ...current,
          sections: mergedSections(notes),
          tags: [...new Set(notes.flatMap((note) => note.tags))].slice(0, 100),
          keywords: uniqueLtmKeywords(notes.flatMap((note) => note.keywords)).slice(0, 30),
          manualKeywords: uniqueLtmKeywords(notes.flatMap((note) => note.manualKeywords ?? [])).slice(0, 30),
          suppressedKeywords: uniqueLtmKeywords(notes.flatMap((note) => note.suppressedKeywords ?? [])).slice(0, 30),
          conflicts: [
            ...new Map(
              notes.flatMap((note) => note.conflicts ?? []).map((conflict) => [JSON.stringify(conflict), conflict]),
            ).values(),
          ].slice(0, 250),
          links: uniqueLinks(notes.flatMap((note) => note.links)).slice(0, 250),
        };
      });
      for (const noteId of archivedNoteIds) {
        await storage.redirectReferences(noteId, parsed.canonicalNoteId);
        await storage.updateNote(noteId, { status: "archived" });
      }
      return ltmNoteForkApplyResponseSchema.parse({
        canonicalNoteId: parsed.canonicalNoteId,
        archivedNoteIds,
        backupId,
      });
    } catch (error) {
      const restoreRoot = join(dirname(root), `.${basename(root)}-fork-restore-${randomUUID()}`);
      const failedRoot = join(dirname(root), `.${basename(root)}-fork-failed-${randomUUID()}`);
      const recoveryErrors: Error[] = [];
      let rootRecovered = false;
      try {
        await cp(join(backupDirectory, basename(root)), restoreRoot, {
          recursive: true,
          errorOnExist: true,
          force: false,
        });
      } catch (recoveryError) {
        recoveryErrors.push(
          new Error(
            `restoreRoot ${restoreRoot}: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
          ),
        );
      }
      if (!recoveryErrors.length) {
        try {
          await rename(root, failedRoot);
        } catch (recoveryError) {
          recoveryErrors.push(
            new Error(
              `failedRoot ${failedRoot}: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
            ),
          );
        }
      }
      if (!recoveryErrors.length) {
        try {
          await rename(restoreRoot, root);
          rootRecovered = true;
        } catch (recoveryError) {
          recoveryErrors.push(
            new Error(
              `restoreRoot ${restoreRoot} -> ${root}: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
            ),
          );
        }
      }
      if (!rootRecovered) {
        try {
          await rename(failedRoot, root);
          rootRecovered = true;
        } catch (recoveryError) {
          recoveryErrors.push(
            new Error(
              `failedRoot ${failedRoot} -> ${root}: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
            ),
          );
        }
      } else {
        try {
          await rm(failedRoot, { recursive: true, force: true });
        } catch (recoveryError) {
          recoveryErrors.push(
            new Error(
              `remove failedRoot ${failedRoot}: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
            ),
          );
        }
      }
      invalidateLtmVaultSnapshot(root);
      if (recoveryErrors.length)
        throw new AggregateError(
          [error, ...recoveryErrors],
          `Fork merge failed; recovery artifacts preserved at restoreRoot=${restoreRoot}, failedRoot=${failedRoot}.`,
        );
      throw error;
    }
  });
}
