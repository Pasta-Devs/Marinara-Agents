import { getPackageEmbeddingAdapter } from "./package-runtime.js";

export type MemoryRecallEmbeddingOptions = {
  embeddingAdapter?: ReturnType<typeof getPackageEmbeddingAdapter>;
  signal?: AbortSignal;
};

export async function embedLongTermMemoryTexts(
  texts: string[],
  options: MemoryRecallEmbeddingOptions = {},
) {
  const adapter = options.embeddingAdapter ?? getPackageEmbeddingAdapter();
  if (!adapter || texts.length === 0) return null;
  return adapter.embed(texts, options.signal);
}
