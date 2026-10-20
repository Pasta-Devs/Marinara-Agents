// Host overlay for services/video/video-generation.ts (Pasta-Devs/Marinara-Agents#1487). Video requests and
// files go through the Engine (api.runtime.integrations.videos), so its media queue serialises a package's
// clips with the Engine's own videos on the same connection.
import type { ComfyUiLoraSetting } from "@marinara-engine/shared";
import { hostIntegrations } from "../../lib/host-runtime.js";

export interface LtxDirectorPromptInput {
  globalPrompt: string;
  localPrompts: string;
  segmentLengths: string;
}

export interface VideoReferenceImage {
  base64: string;
  mimeType: "image/png" | "image/jpeg";
  url?: string | null;
}

export type VideoReferencePublicUploadExpiry = "1h" | "12h" | "24h" | "72h";

export interface VideoReferencePublicUploadOptions {
  enabled?: boolean;
  expiry?: VideoReferencePublicUploadExpiry | string | null;
}

export interface VideoGenerationRequest {
  prompt: string;
  model?: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16";
  resolution?: "480p" | "720p" | "1080p";
  referenceImage?: VideoReferenceImage | null;
  comfyWorkflow?: string;
  ltxDirectorPrompt?: LtxDirectorPromptInput;
  comfyLoras?: ComfyUiLoraSetting[];
  atlasModelOptions?: Record<string, unknown>;
  fps?: number;
  lastFrameImage?: VideoReferenceImage | null;
  publicReferenceUpload?: VideoReferencePublicUploadOptions | null;
  signal?: AbortSignal;
  debugMode?: boolean;
  queue?: boolean;
  connectionKey?: string;
  onFallback?: (notice: Record<string, unknown>) => void | Promise<void>;
  fallback?: {
    connectionId: string;
    connectionName: string;
    source: string;
    baseUrl: string;
    apiKey: string;
    serviceHint: string;
    model: string;
    comfyWorkflow?: string;
    comfyLoras?: ComfyUiLoraSetting[];
    atlasModelOptions?: Record<string, unknown>;
    fps?: number;
  };
}

export interface VideoGenerationResult {
  base64: string;
  mimeType: "video/mp4";
  ext: "mp4";
}

export function generateVideo(
  source: string,
  baseUrl: string,
  apiKey: string,
  serviceHint: string,
  request: VideoGenerationRequest,
): Promise<VideoGenerationResult> {
  return hostIntegrations().videos.generate(source, baseUrl, apiKey, serviceHint, request);
}

export function resolveVideoReferencePublicUploadOptions(
  enabled: boolean,
  seedanceDefaults:
    | { temporaryPublicReferenceUploadEnabled?: boolean | null; temporaryPublicReferenceUploadExpiry?: string | null }
    | null
    | undefined,
): VideoReferencePublicUploadOptions | null {
  return hostIntegrations().videos.resolveReferenceUpload(enabled, seedanceDefaults);
}

export function resolveVideoRequestDuration(
  source: string,
  serviceHint: string,
  request: Pick<VideoGenerationRequest, "durationSeconds" | "referenceImage" | "resolution">,
): number {
  return hostIntegrations().videos.resolveDuration(source, serviceHint, request);
}

/** Returns the path relative to the Engine's scene video folder. */
export function saveVideoToDisk(chatId: string, base64: string): Promise<string> {
  return hostIntegrations().videos.save(chatId, base64);
}

export function removeSavedVideoFromDisk(filePath: string): Promise<void> {
  return hostIntegrations().videos.remove(filePath);
}
