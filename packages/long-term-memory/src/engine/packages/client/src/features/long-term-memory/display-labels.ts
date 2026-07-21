import type { LtmNote } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export function memoryLabel(note: Pick<LtmNote, "title"> | null | undefined) {
  return note?.title?.trim() || "Untitled memory";
}

export function noteTypeLabel(type: string) {
  return humanizeLabel(type);
}

export function humanizeLabel(value: string) {
  const label = value.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function scopeTargetLabel(
  kind: "chat" | "character" | "group" | "persona",
  id: string,
  targets: ReadonlyArray<{ id: string; label: string }>,
) {
  const target = targets.find(
    (item) => item.id === id || item.id === `${kind}:${id}`,
  );
  if (target?.label && target.label !== id) return target.label;
  return {
    chat: "Chat",
    character: "Character",
    group: "Branch group",
    persona: "Persona",
  }[kind];
}
