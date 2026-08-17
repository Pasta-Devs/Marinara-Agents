import { createHash } from "node:crypto";
import {
  getLtmScopeChatIds,
  isGlobalLtmScope,
  isLtmSourceLikeNote,
  ltmNoteIdSchema,
  ltmScopesOverlap,
  type LtmEvidenceUnit,
  type LtmNote,
  type LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/index.js";
import type { LtmExtractionDiagnostic } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { noteIdForEvidenceUnit } from "./evidence-unit-validation.js";
import { uniqueStrings } from "./ltm-utils.js";
import {
  getLtmScopeGroupIds,
  getLtmScopePersonaIds,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { subjectsEqual } from "./subject-identity.js";

type ScopedTargetStorage = {
  getNotesByIds(ids: string[]): Promise<Map<string, LtmNote>>;
};

export type ScopedEvidenceUnitTargets = {
  units: LtmEvidenceUnit[];
  existingNotes: LtmNote[];
  diagnostics: LtmExtractionDiagnostic[];
  remaps: Map<string, string>;
};

export function canUpdateLtmScopedTarget(existingScope: LtmScope, incomingScope: LtmScope) {
  const existingGlobal = isGlobalLtmScope(existingScope);
  const incomingGlobal = isGlobalLtmScope(incomingScope);
  if (existingGlobal || incomingGlobal) return existingGlobal && incomingGlobal;
  return ltmScopesOverlap(existingScope, incomingScope, { includeGlobal: false });
}

export function scopedVariantNoteId(baseId: string, scope: LtmScope, attempt = 0) {
  const suffix = attempt > 0 ? `${shortScopeHash(scope)}_${attempt + 1}` : shortScopeHash(scope);
  const maxBaseLength = 120 - suffix.length - 1;
  const truncatedBase = baseId.slice(0, maxBaseLength).replace(/_+$/g, "");
  return ltmNoteIdSchema.parse(`${truncatedBase || "memory"}_${suffix}`);
}

export async function resolveScopedEvidenceUnitTargets({
  units,
  existingNotes,
  storage,
  scope,
}: {
  units: LtmEvidenceUnit[];
  existingNotes: LtmNote[];
  storage: ScopedTargetStorage;
  scope: LtmScope;
}): Promise<ScopedEvidenceUnitTargets> {
  const safeExistingById = new Map<string, LtmNote>();
  for (const note of existingNotes) {
    if (isSourceOrScene(note)) continue;
    if (canUpdateLtmScopedTarget(note.scope, scope)) {
      safeExistingById.set(note.id, note);
    }
  }

  const targetIndexes = new Map<string, number>();
  const targetUnits = new Map<string, LtmEvidenceUnit>();
  for (const [index, unit] of units.entries()) {
    const noteId = noteIdForEvidenceUnit(unit);
    if (!targetIndexes.has(noteId)) {
      targetIndexes.set(noteId, index);
      targetUnits.set(noteId, unit);
    }
  }

  const targetNoteIds = Array.from(targetIndexes.keys());
  const targetNotesById = await storage.getNotesByIds(
    targetNoteIds.filter((noteId) => ltmNoteIdSchema.safeParse(noteId).success && !safeExistingById.has(noteId)),
  );
  const remaps = new Map<string, string>();
  const diagnostics: LtmExtractionDiagnostic[] = [];

  for (const noteId of targetNoteIds) {
    const unit = targetUnits.get(noteId)!;
    const existing = safeExistingById.get(noteId) ?? targetNotesById.get(noteId);
    if (!existing || isSourceOrScene(existing)) continue;
    if (canUseEvidenceTarget(existing, unit, scope)) {
      safeExistingById.set(existing.id, existing);
      continue;
    }

    const resolvedNoteId = await resolveScopedVariantNoteId({
      baseId: noteId,
      scope,
      storage,
      safeExistingById,
      unit,
    });
    remaps.set(noteId, resolvedNoteId);

    const resolvedExisting = safeExistingById.get(resolvedNoteId) ?? (await getNoteById(storage, resolvedNoteId));
    if (resolvedExisting && !isSourceOrScene(resolvedExisting) && canUseEvidenceTarget(resolvedExisting, unit, scope)) {
      safeExistingById.set(resolvedExisting.id, resolvedExisting);
    }

    const identityConflict = Boolean(
      unit.subjects && existing.subjects && !subjectsEqual(existing.subjects, unit.subjects),
    );
    diagnostics.push({
      severity: "warning",
      code: identityConflict ? "target_note_identity_variant" : "target_note_scoped_variant",
      candidateIndex: targetIndexes.get(noteId),
      noteId,
      message: identityConflict
        ? `Evidence target ${noteId} is bound to another subject identity, so this source will use ${resolvedNoteId}.`
        : `Evidence target ${noteId} belongs to another scope, so this source will use scoped memory ${resolvedNoteId}.`,
      details: {
        originalNoteId: noteId,
        resolvedNoteId,
        sourceScope: scope,
        targetScope: existing.scope,
      },
    });
  }

  return {
    units: remapEvidenceUnitTargets(units, remaps),
    existingNotes: Array.from(safeExistingById.values()).sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics,
    remaps,
  };
}

async function resolveScopedVariantNoteId({
  baseId,
  scope,
  storage,
  safeExistingById,
  unit,
}: {
  baseId: string;
  scope: LtmScope;
  storage: ScopedTargetStorage;
  safeExistingById: Map<string, LtmNote>;
  unit: LtmEvidenceUnit;
}) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = scopedVariantNoteId(baseId, scope, attempt);
    const legacyCandidate = legacyScopedVariantNoteId(baseId, scope, attempt);
    const legacyExisting = safeExistingById.get(legacyCandidate) ?? (await getNoteById(storage, legacyCandidate));
    if (legacyExisting && canUseEvidenceTarget(legacyExisting, unit, scope)) return legacyCandidate;
    const existing = safeExistingById.get(candidate) ?? (await getNoteById(storage, candidate));
    if (!existing || canUseEvidenceTarget(existing, unit, scope)) return candidate;
  }
  throw new Error(`Unable to resolve scoped long-term memory note id for ${baseId}`);
}

function canUseEvidenceTarget(existing: LtmNote, unit: LtmEvidenceUnit, scope: LtmScope) {
  if (!canUpdateLtmScopedTarget(existing.scope, scope)) return false;
  if (!unit.subjects || !existing.subjects) return true;
  return subjectsEqual(existing.subjects, unit.subjects);
}

async function getNoteById(storage: ScopedTargetStorage, id: string) {
  return (await storage.getNotesByIds([id])).get(id) ?? null;
}

function remapEvidenceUnitTargets(units: LtmEvidenceUnit[], remaps: Map<string, string>) {
  if (remaps.size === 0) return units;
  return units.map((unit) => {
    const currentNoteId = noteIdForEvidenceUnit(unit);
    const resolvedNoteId = remaps.get(currentNoteId);
    const links = unit.links.map((link) =>
      remaps.has(link.target) ? { ...link, target: remaps.get(link.target)! } : link,
    );
    const linksChanged = links.some((link, index) => link.target !== unit.links[index]?.target);
    if (!resolvedNoteId && !linksChanged) return unit;
    return {
      ...unit,
      ...(resolvedNoteId ? { subjectId: subjectIdForResolvedNoteId(unit, resolvedNoteId) } : {}),
      links,
    };
  });
}

function subjectIdForResolvedNoteId(unit: LtmEvidenceUnit, noteId: string) {
  const prefix = `${noteIdPrefixForUnit(unit)}_`;
  if (unit.subjectId.startsWith(prefix)) return noteId;
  return noteId.startsWith(prefix) ? noteId.slice(prefix.length) : noteId;
}

function noteIdPrefixForUnit(unit: LtmEvidenceUnit) {
  if (unit.bucket === "timeline_event") return "timeline";
  if (unit.bucket === "thread") return "thread";
  if (unit.bucket === "world_fact") return "world";
  if (unit.bucket === "tone") return "tone";
  if (unit.bucket.startsWith("relationship_")) return "rel";
  if (unit.bucket === "anchor") return unit.sectionKey.startsWith("tone") ? "tone" : "world";
  return "char";
}

function shortScopeHash(scope: LtmScope) {
  return createHash("sha256").update(scopeIdentitySeed(scope)).digest("hex").slice(0, 10);
}

function scopeIdentitySeed(scope: LtmScope) {
  const groupIds = uniqueStrings(getLtmScopeGroupIds(scope)).sort();
  const personaIds = uniqueStrings(getLtmScopePersonaIds(scope)).sort();
  if (groupIds.length) return `ltm_scope_v2:group:${groupIds.join(",")}:persona:${personaIds.join(",")}`;

  const chatIds = uniqueStrings(getLtmScopeChatIds(scope)).sort();
  if (chatIds.length > 0) return `ltm_scope_v2:chat:${chatIds.join(",")}:persona:${personaIds.join(",")}`;

  const characterIds = uniqueStrings(scope.characterIds ?? []).sort();
  if (characterIds.length > 0)
    return `ltm_scope_v2:character:${characterIds.join(",")}:persona:${personaIds.join(",")}`;

  return `ltm_scope_v2:persona:${personaIds.length ? personaIds.join(",") : "<global>"}`;
}

function legacyScopeIdentitySeed(scope: LtmScope) {
  const groupId = scope.groupId?.trim();
  if (groupId) return `ltm_scope_v1:group:${groupId}`;
  const chatIds = uniqueStrings(getLtmScopeChatIds(scope)).sort();
  if (chatIds.length) return `ltm_scope_v1:chat:${chatIds.join(",")}`;
  const characterIds = uniqueStrings(scope.characterIds ?? []).sort();
  if (characterIds.length) return `ltm_scope_v1:character:${characterIds.join(",")}`;
  return "ltm_scope_v1:global";
}

function legacyScopedVariantNoteId(baseId: string, scope: LtmScope, attempt = 0) {
  const hash = createHash("sha256").update(legacyScopeIdentitySeed(scope)).digest("hex").slice(0, 10);
  const suffix = attempt > 0 ? `${hash}_${attempt + 1}` : hash;
  return ltmNoteIdSchema.parse(`${baseId.slice(0, 120 - suffix.length - 1)}_${suffix}`);
}

function isSourceOrScene(note: Pick<LtmNote, "type" | "tags">) {
  return isLtmSourceLikeNote(note) || note.type === "scene";
}
