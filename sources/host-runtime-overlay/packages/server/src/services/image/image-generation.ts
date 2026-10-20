// Host overlay for services/image/image-generation.ts (Pasta-Devs/Marinara-Agents#1487). Image requests and
// gallery files go through the Engine (api.runtime.integrations.images): its provider code, its per-
// connection queue and admission, and its gallery folder. The vendored copy queued and admitted image
// work on its own, out of sight of the Engine's illustrations.
import type {
  ImageGenerationDefaultsProfile,
  NovelAiDefaults,
  SceneIllustrationCharacterPrompt,
} from "@marinara-engine/shared";
import type { ConnectionAdmissionMode } from "../generation/connection-admission.js";
import { hostIntegrations } from "../../lib/host-runtime.js";

export interface ImageGenRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  model?: string;
  imageEndpointId?: string;
  comfyWorkflow?: string;
  imageDefaults?: ImageGenerationDefaultsProfile | null;
  referenceImage?: string;
  referenceImages?: string[];
  characterPrompts?: SceneIllustrationCharacterPrompt[];
  transparentBackground?: boolean;
  signal?: AbortSignal;
  debugMode?: boolean;
  /** Defaults to foreground: the caller is servicing a user-visible request. */
  admissionMode?: ConnectionAdmissionMode;
  onFallback?: (notice: Record<string, unknown>) => void | Promise<void>;
  fallback?: {
    connectionId: string;
    connectionName: string;
    provider: string;
    source: string;
    baseUrl: string;
    apiKey: string;
    serviceHint: string;
    model: string;
    imageEndpointId?: string;
    comfyWorkflow?: string;
    imageDefaults?: ImageGenerationDefaultsProfile | null;
    imageGenerationSource?: string;
    imageService?: string;
    prompt?: string;
    negativePrompt?: string | null;
  };
}

export interface ImageGenResult {
  base64: string;
  mimeType: string;
  ext: string;
  effectivePrompt?: string;
  effectiveNegativePrompt?: string;
  effectiveConnection?: { connectionId: string; connectionName: string; provider: string; model: string };
}

export type SaveImageToDiskOptions = { shared?: boolean };

export type StagedGalleryImage = { filePath: string; promote: () => void; compensate: () => void };

export function generateImage(
  source: string,
  baseUrl: string,
  apiKey: string,
  serviceHint: string,
  request: ImageGenRequest,
): Promise<ImageGenResult> {
  return hostIntegrations().images.generate(source, baseUrl, apiKey, serviceHint, request);
}

/** Returns the path relative to the Engine's gallery folder. */
export function saveImageToDisk(
  chatId: string,
  base64: string,
  ext: string,
  options: SaveImageToDiskOptions = {},
): string {
  return hostIntegrations().images.save(chatId, base64, ext, options);
}

export function removeSavedImageFromDisk(filePath: string): void {
  hostIntegrations().images.remove(filePath);
}

/** Stage provider output without making it visible in the gallery. */
export function stageImageToDisk(chatId: string, base64: string, ext: string): StagedGalleryImage {
  return hostIntegrations().images.stage(chatId, base64, ext);
}

export function sweepStagedImages(): number {
  return hostIntegrations().images.sweepStaged();
}

export function resolveNovelAiRequestSize(
  request: ImageGenRequest,
  defaults?: NovelAiDefaults,
): { width: number; height: number } {
  return hostIntegrations().images.resolveNovelAiRequestSize(request, defaults);
}
