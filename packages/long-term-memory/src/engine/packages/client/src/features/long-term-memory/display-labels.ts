import type { LtmNote } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export function memoryLabel(note: Pick<LtmNote, "title"> | null | undefined) {
  return note?.title?.trim() || "Untitled memory";
}

export function noteTypeLabel(type: string) {
  return type.replaceAll("_", " ");
}

export function scopeTargetLabel(
  kind: "chat" | "character" | "group" | "persona",
  id: string,
  targets: ReadonlyArray<{ id: string; label: string }>,
) {
  const target = targets.find(
    (item) => item.id === id || item.id === `${kind}:${id}`,
  );
  if (target) return target.label;
  return {
    chat: "Chat",
    character: "Character",
    group: "Branch group",
    persona: "Persona",
  }[kind];
}
