import { LOCAL_SIDECAR_CONNECTION_ID } from "@marinara-engine/shared";

export type ConnectionProviderLike = {
  id?: string | null;
  name?: string | null;
  model?: string | null;
  provider?: string | null;
  isDefault?: boolean | string | null;
  isLocalSidecar?: boolean | null;
  defaultParameters?: unknown;
  useForRandom?: boolean | string | null;
};

export type LocalSidecarConnectionOption = {
  id: typeof LOCAL_SIDECAR_CONNECTION_ID;
  name: string;
  model: string;
  provider: "local_sidecar";
  isLocalSidecar: true;
  defaultParameters?: undefined;
  isDefault?: false;
  useForRandom?: "false";
};

export function isLanguageGenerationConnection(connection: ConnectionProviderLike): boolean {
  return connection.provider !== "image_generation" && connection.provider !== "video_generation";
}

export function filterLanguageGenerationConnections<T extends ConnectionProviderLike>(
  connections: readonly T[] | null | undefined,
): T[] {
  return (connections ?? []).filter(isLanguageGenerationConnection);
}

export function createLocalSidecarConnectionOption(modelDisplayName?: string | null): LocalSidecarConnectionOption {
  const model = modelDisplayName?.trim() || "local-sidecar";
  return {
    id: LOCAL_SIDECAR_CONNECTION_ID,
    name: modelDisplayName?.trim() ? `Local Model (${modelDisplayName.trim()})` : "Local Model (sidecar)",
    model,
    provider: "local_sidecar",
    isLocalSidecar: true,
    isDefault: false,
    useForRandom: "false",
  };
}

export function isLocalSidecarConnectionOption(connection: ConnectionProviderLike): boolean {
  return connection.id === LOCAL_SIDECAR_CONNECTION_ID || connection.isLocalSidecar === true;
}

export function appendLocalSidecarConnectionOption<T extends ConnectionProviderLike>(
  connections: readonly T[] | null | undefined,
  includeLocalSidecar: boolean,
  modelDisplayName?: string | null,
): Array<T | LocalSidecarConnectionOption> {
  const languageConnections = filterLanguageGenerationConnections(connections);
  if (!includeLocalSidecar || languageConnections.some((connection) => connection.id === LOCAL_SIDECAR_CONNECTION_ID)) {
    return languageConnections;
  }
  return [...languageConnections, createLocalSidecarConnectionOption(modelDisplayName)];
}
