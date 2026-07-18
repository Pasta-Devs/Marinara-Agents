import {
  ltmMetadataIndexSchema,
  type LtmMetadataIndex,
  type LtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  getLtmScopeChatIds,
  isGlobalLtmScope,
} from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import type { LtmMemoryChunk } from "./chunking.js";

export type { LtmMetadataIndex } from "../../../../shared/src/features/agents/long-term-memory/schema.js";

type MutableLtmMetadataIndex = Omit<
  LtmMetadataIndex,
  "chunks" | "byMode" | "byScope"
> & {
  chunks: Record<string, LtmMemoryChunk>;
  byMode: Record<string, string[]>;
  byScope: {
    chatId: Record<string, string[]>;
    groupId: Record<string, string[]>;
    characterId: Record<string, string[]>;
    global: string[];
  };
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
    byType: {},
    byStatus: {},
    byTag: {},
    byMode: {},
    byScope: {
      chatId: {},
      groupId: {},
      characterId: {},
      global: [],
    },
  };

  for (const chunk of chunks.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    index.chunks[chunk.id] = chunk;
    addToBucket(index.byNoteId, chunk.noteId, chunk.id);
    addToBucket(index.byType, chunk.noteType, chunk.id);
    addToBucket(index.byStatus, chunk.status, chunk.id);
    for (const tag of chunk.tags) addToBucket(index.byTag, tag, chunk.id);
    for (const mode of chunk.modes ?? [])
      addToBucket(index.byMode, mode, chunk.id);
    for (const chatId of getLtmScopeChatIds(chunk.scope)) {
      addToBucket(index.byScope.chatId, chatId, chunk.id);
    }
    addToBucket(index.byScope.groupId, chunk.scope.groupId, chunk.id);
    for (const characterId of chunk.scope.characterIds ?? []) {
      addToBucket(index.byScope.characterId, characterId, chunk.id);
    }
    if (isGlobalLtmScope(chunk.scope)) index.byScope.global.push(chunk.id);
  }

  return ltmMetadataIndexSchema.parse({
    ...index,
    chunks: Object.fromEntries(
      Object.entries(index.chunks).sort(([a], [b]) => a.localeCompare(b)),
    ),
    byNoteId: sortRecordBuckets(index.byNoteId),
    byType: sortRecordBuckets(index.byType),
    byStatus: sortRecordBuckets(index.byStatus),
    byTag: sortRecordBuckets(index.byTag),
    byMode: sortRecordBuckets(index.byMode),
    byScope: {
      chatId: sortRecordBuckets(index.byScope.chatId),
      groupId: sortRecordBuckets(index.byScope.groupId),
      characterId: sortRecordBuckets(index.byScope.characterId),
      global: index.byScope.global.sort((a, b) => a.localeCompare(b)),
    },
  });
}

export function getLtmMetadataMatches(
  index: LtmMetadataIndex,
  query: {
    noteIds?: string[];
    tags?: string[];
    scope?: LtmScope;
    characterIds?: string[];
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

  const scope = query.scope;
  for (const chatId of getLtmScopeChatIds(scope)) {
    for (const chunkId of (index.byScope.chatId[chatId] ?? []).slice(
      0,
      maxBucketEntries,
    )) {
      add(chunkId, 1, `chat:${chatId}`);
    }
  }
  if (scope?.groupId) {
    for (const chunkId of (index.byScope.groupId[scope.groupId] ?? []).slice(
      0,
      maxBucketEntries,
    )) {
      add(chunkId, 0.8, `group:${scope.groupId}`);
    }
  }
  const characterIds = Array.from(
    new Set([...(scope?.characterIds ?? []), ...(query.characterIds ?? [])]),
  );
  for (const characterId of characterIds) {
    for (const chunkId of (index.byScope.characterId[characterId] ?? []).slice(
      0,
      maxBucketEntries,
    )) {
      add(chunkId, 0.7, `character:${characterId}`);
    }
  }

  return Array.from(scores.entries())
    .map(([chunkId, value]) => ({ chunkId, ...value }))
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    .slice(0, maxCandidates);
}
