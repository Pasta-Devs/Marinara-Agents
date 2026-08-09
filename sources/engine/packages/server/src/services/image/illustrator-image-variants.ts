import { normalizeIllustratorImagesPerGeneration } from "@marinara-engine/shared";

export async function generateIllustratorImageVariants<T>({
  count,
  generate,
  onVariantError,
}: {
  count: unknown;
  generate: (index: number) => Promise<T>;
  onVariantError?: (error: unknown, index: number) => void;
}): Promise<T[]> {
  const variantCount = normalizeIllustratorImagesPerGeneration(count);
  const results: T[] = [];
  let lastError: unknown;

  for (let index = 0; index < variantCount; index += 1) {
    try {
      results.push(await generate(index));
    } catch (error) {
      lastError = error;
      onVariantError?.(error, index);
    }
  }

  if (results.length === 0 && lastError) throw lastError;
  return results;
}
