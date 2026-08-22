type MemoryNagCandidate = { id: string; text: string };

function selectedMemoryIds(data: unknown): string[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const source = data as Record<string, unknown>;
  const values = source.memoryIds ?? source.memory_ids ?? source.nags;
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values.flatMap((value) => {
        if (typeof value === "string") return [value];
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const id = (value as Record<string, unknown>).id;
        return typeof id === "string" ? [id] : [];
      }),
    ),
  ];
}

export function selectMemoryNagRecall(
  data: unknown,
  candidates: MemoryNagCandidate[],
  maximumNags: number,
): { nags_needed: false } | { nags_needed: true; memoryIds: string[]; nags: string[] } {
  const source = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  if (source?.nags_needed !== true) return { nags_needed: false };
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const memoryIds = selectedMemoryIds(data)
    .filter((id) => candidateById.has(id))
    .slice(0, maximumNags);
  const nags = memoryIds.flatMap((id) => candidateById.get(id)?.text ?? []);
  return nags.length > 0 ? { nags_needed: true, memoryIds, nags } : { nags_needed: false };
}
