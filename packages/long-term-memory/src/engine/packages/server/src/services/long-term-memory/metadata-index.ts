import {
  ltmMetadataIndexSchema,
  type LtmMetadataIndex,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import type { LtmMemoryChunk } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

export type { LtmMetadataIndex } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

function addToBucket(index: Map<string, string[]>, key: string | undefined, chunkId: string) {
  if (!key) return;
  const bucket = index.get(key) ?? [];
  bucket.push(chunkId);
  index.set(key, bucket);
}

function sortBuckets(record: Map<string, string[]>) {
  return Object.fromEntries(
    Array.from(record.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => [key, values.sort((a, b) => a.localeCompare(b))]),
  );
}

export function buildLtmMetadataIndex(chunks: LtmMemoryChunk[]): LtmMetadataIndex {
  const chunksById = new Map<string, LtmMemoryChunk>();
  const byNoteId = new Map<string, string[]>();
  const byTag = new Map<string, string[]>();

  for (const chunk of chunks.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    chunksById.set(chunk.id, chunk);
    addToBucket(byNoteId, chunk.noteId, chunk.id);
    for (const tag of chunk.tags) addToBucket(byTag, tag, chunk.id);
  }

  return ltmMetadataIndexSchema.parse({
    version: 1,
    chunks: Object.fromEntries(Array.from(chunksById.entries()).sort(([a], [b]) => a.localeCompare(b))),
    byNoteId: sortBuckets(byNoteId),
    byTag: sortBuckets(byTag),
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
    const matches = Object.hasOwn(index.byNoteId, noteId) ? index.byNoteId[noteId] : undefined;
    for (const chunkId of (matches ?? []).slice(0, maxBucketEntries)) add(chunkId, 1, `note:${noteId}`);
  }
  for (const tag of query.tags ?? []) {
    const matches = Object.hasOwn(index.byTag, tag) ? index.byTag[tag] : undefined;
    for (const chunkId of (matches ?? []).slice(0, maxBucketEntries)) add(chunkId, 0.8, `tag:${tag}`);
  }

  return Array.from(scores.entries())
    .map(([chunkId, value]) => ({ chunkId, ...value }))
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    .slice(0, maxCandidates);
}
