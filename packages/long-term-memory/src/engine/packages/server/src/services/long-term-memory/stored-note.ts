import { ltmNoteSchema, ltmScopeSchema } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { withMergedLtmScopeLinks } from "../../../../shared/src/features/agents/long-term-memory/scope.js";
export function parseStoredLtmNote(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return ltmNoteSchema.parse(raw);
  const { previousHash: _, ...note } = raw as Record<string, unknown>;
  const scope = ltmScopeSchema.parse(
    note.scope && typeof note.scope === "object" && !Array.isArray(note.scope) ? note.scope : {},
  );
  return ltmNoteSchema.parse({ ...note, scope: withMergedLtmScopeLinks(scope, {}) });
}
