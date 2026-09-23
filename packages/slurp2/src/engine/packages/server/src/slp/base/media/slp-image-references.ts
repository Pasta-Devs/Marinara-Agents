type ImageReferenceConnection = {
  imageService?: string | null;
  imageGenerationSource?: string | null;
  serviceHint?: string | null;
  model?: string | null;
};

/** Unknown image backends receive text only; references are an optional enhancement. */
export function slpImageReferencesSupported(
  connection: ImageReferenceConnection,
  fallback?: ImageReferenceConnection | null,
): boolean {
  const supports = (value: ImageReferenceConnection) => {
    const service = (value.imageService || value.imageGenerationSource || value.serviceHint || "").toLowerCase();
    const model = value.model?.toLowerCase() ?? "";
    if (service === "novelai") return /^nai-diffusion-4-5(?:-(?:curated|full))?$/u.test(model);
    if (/^(?:automatic1111|comfyui|swarmui|runpod_comfyui|gemini_image)$/u.test(service)) return true;
    return /^(?:gpt-image|gemini)/u.test(model);
  };
  return supports(connection) && (!fallback || supports(fallback));
}
