type GeneratedMediaSettings = {
  enableImagePrompts: boolean;
  allowGalleryImageAttachments: boolean;
};

export function generatedMediaSettings<T extends GeneratedMediaSettings>(settings: T, rejectedCount: number): T {
  return rejectedCount > 0 ? { ...settings, enableImagePrompts: false, allowGalleryImageAttachments: false } : settings;
}
