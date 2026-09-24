import { inferImageSource } from "@marinara-engine/shared";

type ImageReferenceConnection = {
  imageService?: string | null;
  imageGenerationSource?: string | null;
  serviceHint?: string | null;
  model?: string | null;
  baseUrl?: string | null;
};

/** Unknown image backends receive text only; references are an optional enhancement. */
export function slpImageReferencesSupported(
  connection: ImageReferenceConnection,
  fallback?: ImageReferenceConnection | null,
): boolean {
  const supports = (value: ImageReferenceConnection) => {
    const model = value.model?.toLowerCase() ?? "";
    // Match the Engine's backend resolution: an explicit service wins, otherwise infer it from the
    // model and base URL, so a NanoGPT or OpenRouter connection with no service field still resolves.
    const service = (
      value.imageService ||
      value.imageGenerationSource ||
      value.serviceHint ||
      inferImageSource(model, value.baseUrl ?? "")
    ).toLowerCase();
    if (service === "novelai") return /^nai-diffusion-4-5(?:-(?:curated|full))?$/u.test(model);
    // These Engine adapters forward reference images for every model they serve.
    if (/^(?:automatic1111|comfyui|swarmui|runpod_comfyui|gemini_image|nanogpt|xai)$/u.test(service)) return true;
    return /^(?:gpt-image|gemini)/u.test(model);
  };
  return supports(connection) && (!fallback || supports(fallback));
}
