type GeneratedMediaSettings = {
  enableImagePrompts: boolean;
  allowGalleryImageAttachments: boolean;
};

export function generatedMediaSettings<T extends GeneratedMediaSettings>(settings: T, rejectedCount: number): T {
  return rejectedCount > 0 ? { ...settings, enableImagePrompts: false, allowGalleryImageAttachments: false } : settings;
}

/**
 * The gallery picture this Creator showed least recently: one never posted first, then the one whose
 * last post is oldest. Taking the first image every time put the same photo under every post whose
 * picture failed (player report: "the same photo three times").
 */
export function slurpLeastRecentGalleryImage<T extends { id: string }>(
  images: readonly T[],
  usedNewestFirst: readonly unknown[],
): T | null {
  let best: T | null = null;
  let bestAge = -1;
  for (const image of images) {
    const index = usedNewestFirst.indexOf(image.id);
    const age = index === -1 ? Number.POSITIVE_INFINITY : index;
    if (age > bestAge) {
      best = image;
      bestAge = age;
    }
    if (age === Number.POSITIVE_INFINITY) break;
  }
  return best;
}
