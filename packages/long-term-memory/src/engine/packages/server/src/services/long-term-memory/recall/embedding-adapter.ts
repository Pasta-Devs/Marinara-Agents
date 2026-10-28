// ponytail: mirror the Engine's fixed host limits; negotiate only if they become dynamic.
const MAX_EMBEDDING_TEXTS = 128;
const MAX_EMBEDDING_CHARACTERS = 200_000;

export type MemoryRecallEmbeddingOptions = {
  embeddingAdapter?: PackageEmbeddingAdapter | null;
  signal?: AbortSignal;
};

// Indexed chunks are documents; only a recall search query is a query. Kept off the shared options
// type so a rebuild or retrieval input cannot carry it.
export async function embedLongTermMemoryTexts(
  texts: string[],
  options: MemoryRecallEmbeddingOptions & { inputType?: "query" | "document" } = {},
) {
  const adapter = options.embeddingAdapter;
  if (!adapter || texts.length === 0) return null;
  options.signal?.throwIfAborted();
  // The type is a positional argument: older Engines hand the second argument to AbortSignal.any.
  const inputType = options.inputType ?? "document";
  const vectors: number[][] = [];
  let batch: string[] = [];
  let characters = 0;
  for (const text of texts) {
    options.signal?.throwIfAborted();
    if (text.length > MAX_EMBEDDING_CHARACTERS) return null;
    if (
      batch.length > 0 &&
      (batch.length >= MAX_EMBEDDING_TEXTS || characters + text.length > MAX_EMBEDDING_CHARACTERS)
    ) {
      const batchVectors = await adapter.embed(batch, options.signal, inputType);
      options.signal?.throwIfAborted();
      if (!batchVectors || batchVectors.length !== batch.length) return null;
      vectors.push(...batchVectors);
      batch = [];
      characters = 0;
    }
    batch.push(text);
    characters += text.length;
  }
  if (batch.length > 0) {
    const batchVectors = await adapter.embed(batch, options.signal, inputType);
    options.signal?.throwIfAborted();
    if (!batchVectors || batchVectors.length !== batch.length) return null;
    vectors.push(...batchVectors);
  }
  return vectors;
}
import type { PackageEmbeddingAdapter } from "../package-runtime.js";
