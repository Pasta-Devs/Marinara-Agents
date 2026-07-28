import type { LtmLink, LtmNote, LtmSection } from "./schema.js";

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

export function uniqueLinks<T extends Pick<LtmLink, "target" | "relation"> & { aspect?: string }>(links: T[]): T[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.target}\0${link.relation}\0${link.aspect ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function appendText(existing: string | undefined, incoming: string): string {
  const trimmedIncoming = incoming.trim();
  const trimmedExisting = existing?.trim();
  if (!trimmedIncoming) return trimmedExisting ?? "";
  if (!trimmedExisting) return trimmedIncoming;
  if (trimmedExisting.includes(trimmedIncoming)) return trimmedExisting;
  return `${trimmedExisting}\n\n${trimmedIncoming}`;
}

export function tokenize(text: string, minLength = 4): Set<string> {
  const tokens =
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length >= minLength)
      .slice(0, 500) ?? [];
  return new Set(tokens);
}

export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const token of setA) {
    if (setB.has(token)) shared++;
  }
  return shared / (setA.size + setB.size - shared);
}

export function mergeLtmEvidence(section: LtmSection, evidence: string[]): LtmSection {
  return {
    ...section,
    evidence: uniqueStrings([...(section.evidence ?? []), ...evidence]).slice(0, 100),
  };
}

export function shouldAppendCreateNoteSection(note: Pick<LtmNote, "type" | "tags">, sectionKey: string) {
  if (note.type === "timeline_event") return true;
  if (note.type === "relationship" && sectionKey === "history") return true;
  if (note.type === "tone" && sectionKey === "observations") return true;
  if (note.tags.includes("anchor")) return true;
  return false;
}

export function mergeLtmSection(
  existing: LtmSection | undefined,
  incoming: LtmSection,
  append: boolean,
  updatedAt: string,
): LtmSection {
  return mergeLtmEvidence(
    {
      text: append ? appendText(existing?.text, incoming.text) : incoming.text.trim(),
      updatedAt,
      salience: Math.max(existing?.salience ?? 0, incoming.salience ?? 0) || undefined,
      confidence: Math.max(existing?.confidence ?? 0, incoming.confidence ?? 0) || undefined,
      importance: incoming.importance ?? existing?.importance,
      dimensions: incoming.dimensions ?? existing?.dimensions,
      dimensionChanges: incoming.dimensionChanges ?? existing?.dimensionChanges,
    },
    [...(existing?.evidence ?? []), ...(incoming.evidence ?? [])],
  );
}
