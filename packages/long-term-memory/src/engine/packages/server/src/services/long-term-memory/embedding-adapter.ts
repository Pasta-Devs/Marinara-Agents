import { getPackageEmbeddingAdapter } from "./package-runtime.js";

// ponytail: mirror the Engine's fixed host limits; negotiate only if they become dynamic.
const MAX_EMBEDDING_TEXTS = 128;
const MAX_EMBEDDING_CHARACTERS = 200_000;

export type MemoryRecallEmbeddingOptions = {
  embeddingAdapter?: ReturnType<typeof getPackageEmbeddingAdapter>;
  signal?: AbortSignal;
};

export async function embedLongTermMemoryTexts(texts: string[], options: MemoryRecallEmbeddingOptions = {}) {
  const adapter = options.embeddingAdapter ?? getPackageEmbeddingAdapter();
  if (!adapter || texts.length === 0) return null;
  const vectors: number[][] = [];
  let batch: string[] = [];
  let characters = 0;
  for (const text of texts) {
    if (text.length > MAX_EMBEDDING_CHARACTERS) return null;
    if (
      batch.length > 0 &&
      (batch.length >= MAX_EMBEDDING_TEXTS || characters + text.length > MAX_EMBEDDING_CHARACTERS)
    ) {
      const batchVectors = await adapter.embed(batch, options.signal);
      if (!batchVectors || batchVectors.length !== batch.length) return null;
      vectors.push(...batchVectors);
      batch = [];
      characters = 0;
    }
    batch.push(text);
    characters += text.length;
  }
  if (batch.length > 0) {
    const batchVectors = await adapter.embed(batch, options.signal);
    if (!batchVectors || batchVectors.length !== batch.length) return null;
    vectors.push(...batchVectors);
  }
  return vectors;
}
