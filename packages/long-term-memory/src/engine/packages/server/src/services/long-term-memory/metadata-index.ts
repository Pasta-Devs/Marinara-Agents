import {
  ltmMetadataIndexSchema,
  type LtmMetadataIndex,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import type { LtmMemoryChunk } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export type { LtmMetadataIndex } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

type MutableLtmMetadataIndex = Omit<
  LtmMetadataIndex,
  "chunks"
> & {
  chunks: Record<string, LtmMemoryChunk>;
};

function addToBucket(
  index: Record<string, string[]>,
  key: string | undefined,
  chunkId: string,
) {
  if (!key) return;
  const bucket = index[key] ?? [];
  bucket.push(chunkId);
  index[key] = bucket;
}

function sortRecordBuckets(record: Record<string, string[]>) {
  return Object.fromEntries(
    Object.entries(record)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => [key, values.sort((a, b) => a.localeCompare(b))]),
  );
}

export function buildLtmMetadataIndex(
  chunks: LtmMemoryChunk[],
): LtmMetadataIndex {
  const index: MutableLtmMetadataIndex = {
    version: 1,
    chunks: {},
    byNoteId: {},
    byTag: {},
  };

  for (const chunk of chunks.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    index.chunks[chunk.id] = chunk;
    addToBucket(index.byNoteId, chunk.noteId, chunk.id);
    for (const tag of chunk.tags) addToBucket(index.byTag, tag, chunk.id);
  }

  return ltmMetadataIndexSchema.parse({
    ...index,
    chunks: Object.fromEntries(
      Object.entries(index.chunks).sort(([a], [b]) => a.localeCompare(b)),
    ),
    byNoteId: sortRecordBuckets(index.byNoteId),
    byTag: sortRecordBuckets(index.byTag),
  });
}

export function getLtmMetadataMatches(
  index: LtmMetadataIndex,
  query: {
    noteIds?: string[];
    tags?: string[];
  },
  options: { topK?: number; maxBucketEntries?: number } = {},
) {
  const scores = new Map<string, { score: number; reasons: string[] }>();
  const maxBucketEntries = Math.max(1, options.maxBucketEntries ?? 128);
  const maxCandidates = Math.max(1, options.topK ?? 128);

  function add(chunkId: string, score: number, reason: string) {
    if (!scores.has(chunkId) && scores.size >= maxCandidates) return;
    const existing = scores.get(chunkId) ?? { score: 0, reasons: [] };
    existing.score += score;
    existing.reasons.push(reason);
    scores.set(chunkId, existing);
  }

  for (const noteId of query.noteIds ?? []) {
    for (const chunkId of (index.byNoteId[noteId] ?? []).slice(
      0,
      maxBucketEntries,
    ))
      add(chunkId, 1, `note:${noteId}`);
  }
  for (const tag of query.tags ?? []) {
    for (const chunkId of (index.byTag[tag] ?? []).slice(0, maxBucketEntries))
      add(chunkId, 0.8, `tag:${tag}`);
  }

  return Array.from(scores.entries())
    .map(([chunkId, value]) => ({ chunkId, ...value }))
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    .slice(0, maxCandidates);
}
