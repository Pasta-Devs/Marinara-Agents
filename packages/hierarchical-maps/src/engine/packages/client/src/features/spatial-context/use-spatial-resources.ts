import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Chat, GameMap, Lorebook, LorebookEntry } from "@marinara-engine/shared";
import { PackageApiError, packageApi } from "./package-api";
import { globalGallerySpatialReferenceId } from "../../../../maps-shared/src/maps-model";

export const spatialResourceKeys = {
  chat: (chatId: string) => ["hierarchical-maps", "chat", chatId] as const,
  gallery: (chatId: string) => ["hierarchical-maps", "gallery", chatId] as const,
  globalGallery: ["hierarchical-maps", "global-gallery"] as const,
  lorebooks: ["hierarchical-maps", "lorebooks"] as const,
  lorebookEntries: (lorebookId: string) => ["hierarchical-maps", "lorebooks", lorebookId, "entries"] as const,
};

export interface SpatialGalleryImage {
  id: string;
  chatId: string;
  filePath: string;
  prompt: string;
  provider: string;
  model: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  url: string;
}

export interface SpatialGlobalGalleryImage extends Omit<SpatialGalleryImage, "chatId"> {
  folderId: string | null;
}

export interface SpatialArtworkImage
  extends Pick<SpatialGalleryImage, "id" | "filePath" | "prompt" | "provider" | "model" | "width" | "height" | "createdAt" | "url"> {
  referenceId: string;
  source: "chat" | "global";
}

export interface SpatialGalleryImagePromptPreviewItem {
  id: string;
  kind: "background";
  title: string;
  sourcePrompt: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
}

export interface SpatialGalleryImagePromptPreview {
  requestCount: number;
  connection: {
    id: string;
    name: string;
    model: string;
    source: string;
  };
  styleProfile: {
    id: string;
    name: string;
  };
  campaign: {
    included: boolean;
    artStyleIncluded: boolean;
  };
  chatSettings: {
    imageInstructionsIncluded: boolean;
  };
  width: number;
  height: number;
  items: SpatialGalleryImagePromptPreviewItem[];
}

export interface SpatialMapsArtworkContext {
  locationName: string;
  locationDescription: string;
  locationType: string;
  parentLocationName: string;
  parentLocationDescription: string;
  locationPath: string;
}

export function useSpatialChat(chatId: string | null) {
  return useQuery({
    queryKey: spatialResourceKeys.chat(chatId ?? ""),
    queryFn: () => packageApi.get<Chat>(`/chats/${chatId}`),
    enabled: !!chatId,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof PackageApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 3;
    },
  });
}

export function useSpatialGalleryImages(chatId: string, enabled = true) {
  return useQuery({
    queryKey: spatialResourceKeys.gallery(chatId),
    queryFn: () => packageApi.get<SpatialGalleryImage[]>(`/gallery/${chatId}`),
    enabled: enabled && chatId.length > 0,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof PackageApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 3;
    },
  });
}

export function useSpatialGlobalGalleryImages(enabled = true) {
  return useQuery({
    queryKey: spatialResourceKeys.globalGallery,
    queryFn: () => packageApi.get<SpatialGlobalGalleryImage[]>("/global-gallery"),
    enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof PackageApiError && error.status >= 400 && error.status < 500) return false;
      return failureCount < 3;
    },
  });
}

export function spatialArtworkImages(
  chatImages: SpatialGalleryImage[] = [],
  globalImages: SpatialGlobalGalleryImage[] = [],
): SpatialArtworkImage[] {
  return [
    ...globalImages.map((image) => ({
      ...image,
      referenceId: globalGallerySpatialReferenceId(image.id),
      source: "global" as const,
    })),
    ...chatImages.map((image) => ({ ...image, referenceId: image.id, source: "chat" as const })),
  ];
}

export function resolveSpatialArtworkImage(
  referenceId: string | null | undefined,
  chatImages: SpatialGalleryImage[] = [],
  globalImages: SpatialGlobalGalleryImage[] = [],
): SpatialArtworkImage | null {
  if (!referenceId) return null;
  return spatialArtworkImages(chatImages, globalImages).find((image) => image.referenceId === referenceId) ?? null;
}

export function uploadSpatialGalleryImage(
  chatId: string,
  file: File,
  metadata: Pick<SpatialGalleryImage, "prompt" | "provider" | "model" | "width" | "height">,
): Promise<SpatialGalleryImage> {
  const body = new FormData();
  body.append("prompt", metadata.prompt);
  body.append("provider", metadata.provider);
  body.append("model", metadata.model);
  if (metadata.width !== null) body.append("width", String(metadata.width));
  if (metadata.height !== null) body.append("height", String(metadata.height));
  body.append("file", file);
  return packageApi.upload<SpatialGalleryImage>(`/gallery/${chatId}/upload`, body);
}

export function uploadSpatialGlobalGalleryImage(
  file: File,
  metadata: Pick<SpatialGalleryImage, "prompt" | "provider" | "model" | "width" | "height">,
): Promise<SpatialGlobalGalleryImage> {
  const body = new FormData();
  body.append("prompt", metadata.prompt);
  body.append("provider", metadata.provider);
  body.append("model", metadata.model);
  if (metadata.width !== null) body.append("width", String(metadata.width));
  if (metadata.height !== null) body.append("height", String(metadata.height));
  body.append("file", file);
  return packageApi.upload<SpatialGlobalGalleryImage>("/global-gallery/upload", body);
}

const globalArtworkDigestCache = new Map<string, Promise<string | null>>();

async function sha256Blob(blob: Blob): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function blobsHaveSameContent(left: Blob, right: Blob): Promise<boolean> {
  if (left.size !== right.size) return false;
  const [leftBytes, rightBytes] = await Promise.all([left.arrayBuffer(), right.arrayBuffer()]);
  const leftView = new Uint8Array(leftBytes);
  const rightView = new Uint8Array(rightBytes);
  return leftView.every((value, index) => value === rightView[index]);
}

function globalArtworkDigest(image: SpatialGlobalGalleryImage): Promise<string | null> {
  const cached = globalArtworkDigestCache.get(image.id);
  if (cached) return cached;
  const digest = packageApi
    .blob(image.url)
    .then(sha256Blob)
    .catch(() => {
      globalArtworkDigestCache.delete(image.id);
      return null;
    });
  globalArtworkDigestCache.set(image.id, digest);
  return digest;
}

export async function reuseOrUploadSpatialGlobalGalleryImage(
  file: File,
  metadata: Pick<SpatialGalleryImage, "prompt" | "provider" | "model" | "width" | "height">,
  globalImages: SpatialGlobalGalleryImage[],
): Promise<{ image: SpatialGlobalGalleryImage; reused: boolean }> {
  const sourceDigest = await sha256Blob(file);
  for (const image of globalImages) {
    if (sourceDigest) {
      if ((await globalArtworkDigest(image)) === sourceDigest) return { image, reused: true };
      continue;
    }
    const existing = await packageApi.blob(image.url).catch(() => null);
    if (existing && (await blobsHaveSameContent(file, existing))) return { image, reused: true };
  }
  const image = await uploadSpatialGlobalGalleryImage(file, metadata);
  if (sourceDigest) globalArtworkDigestCache.set(image.id, Promise.resolve(sourceDigest));
  return { image, reused: false };
}

export function useGenerateSpatialGalleryImage(chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      prompt: string;
      title?: string;
      mapsArtworkContext?: SpatialMapsArtworkContext;
      promptOverride?: string;
      negativePromptOverride?: string;
      debugMode?: boolean;
    }) =>
      packageApi.post<SpatialGalleryImage>(`/gallery/${chatId}/generate-image`, input),
    onSuccess: (image) => {
      queryClient.setQueryData<SpatialGalleryImage[]>(spatialResourceKeys.gallery(chatId), (current = []) => [
        image,
        ...current.filter((candidate) => candidate.id !== image.id),
      ]);
    },
  });
}

export function usePreviewSpatialGalleryImages(chatId: string) {
  return useMutation({
    mutationFn: (input: {
      items: Array<{
        id: string;
        title: string;
        prompt: string;
        mapsArtworkContext?: SpatialMapsArtworkContext;
      }>;
      debugMode?: boolean;
    }) =>
      packageApi.post<SpatialGalleryImagePromptPreview>(`/gallery/${chatId}/generate-image/preview`, input),
  });
}

export function useSpatialLorebooks() {
  return useQuery({
    queryKey: spatialResourceKeys.lorebooks,
    queryFn: () => packageApi.get<Lorebook[]>("/lorebooks"),
    staleTime: 5 * 60_000,
  });
}

export function useSpatialLorebookEntries(lorebookIds: string[]): {
  entries: LorebookEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} {
  const uniqueIds = Array.from(new Set(lorebookIds));
  const queries = useQueries({
    queries: uniqueIds.map((lorebookId) => ({
      queryKey: spatialResourceKeys.lorebookEntries(lorebookId),
      queryFn: () => packageApi.get<LorebookEntry[]>(`/lorebooks/${lorebookId}/entries`),
    })),
  });
  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const error = queries.find((query) => query.isError)?.error ?? null;
  const allSucceeded = queries.length === 0 || queries.every((query) => query.isSuccess);
  return {
    entries: allSucceeded ? queries.flatMap((query) => query.data ?? []) : undefined,
    isLoading,
    isError,
    error,
  };
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function getSpatialExcludedLorebookIds(chat: Pick<Chat, "metadata">): string[] {
  const value = parseMetadata(chat.metadata).excludedLorebookIds;
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

export type UpdateGameMapBindingInput =
  | { target: "map"; chatId: string; mapId: string; spatialLocationId: string | null }
  | {
      target: "cell";
      chatId: string;
      mapId: string;
      x: number;
      y: number;
      spatialLocationId: string | null;
    }
  | {
      target: "node";
      chatId: string;
      mapId: string;
      nodeId: string;
      spatialLocationId: string | null;
    };

interface UpdateGameMapBindingResponse {
  map: GameMap;
  maps?: GameMap[];
  activeGameMapId?: string | null;
  sessionChat: Chat;
}

export function useUpdateSpatialGameMapBinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateGameMapBindingInput) =>
      packageApi.put<UpdateGameMapBindingResponse>("/game/map/binding", input),
    onSuccess: (response, variables) => {
      queryClient.setQueryData(spatialResourceKeys.chat(variables.chatId), response.sessionChat);
      void queryClient.invalidateQueries({
        queryKey: ["spatial-context", variables.chatId, "game-map-reconciliation"],
      });
    },
  });
}
