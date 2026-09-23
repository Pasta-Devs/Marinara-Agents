import type {
  CapabilityIntegrationHost,
  CapabilityIntegrationProvider,
  ChatMessage,
  ImageGenResult,
  StagedGalleryImage,
} from "@marinara-engine/shared";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import { withConnectionFallbackProvider } from "../../../services/llm/connection-fallback-provider.js";
import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { withConnectionAdmissionProvider } from "../../../services/generation/connection-admission.js";

let host: CapabilityIntegrationHost | null = null;

export function setSlurpGenerationIntegrations(next: CapabilityIntegrationHost | undefined): void {
  host = next ?? null;
}

export function slurpGenerationIntegrations(): CapabilityIntegrationHost | null {
  return host;
}

export function createSlurpProvider(input: {
  provider: string;
  baseUrl: string;
  apiKey: string;
  maxContext?: number | null;
  openrouterProvider?: string | null;
  maxTokensOverride?: number | null;
  claudeFastMode?: boolean;
  treatAsLocalEndpoint?: boolean;
  defaultParameters?: unknown;
  connectionId?: string;
}): CapabilityIntegrationProvider | null {
  return host?.llm.createProvider(
    input.provider,
    input.baseUrl,
    input.apiKey,
    input.maxContext,
    input.openrouterProvider,
    input.maxTokensOverride,
    input.claudeFastMode,
    input.treatAsLocalEndpoint,
    input.defaultParameters,
    input.connectionId,
  );
}

export function createSlurpFallbackProvider(input: {
  primary: CapabilityIntegrationProvider;
  primaryConnectionId: string;
  fallbackConnection: Parameters<CapabilityIntegrationHost["llm"]["withFallback"]>[0]["fallbackConnection"];
  fallbackBaseUrl: string;
  category: "main" | "agents";
  admissionMode: Parameters<CapabilityIntegrationHost["llm"]["withFallback"]>[0]["admissionMode"];
}): CapabilityIntegrationProvider | null {
  return host?.llm.withFallback(input);
}

export function createSlurpPostProvider(input: {
  connection: {
    id: string;
    provider: string;
    apiKey: string;
    baseUrl?: string | null;
    maxContext?: number | null;
    openrouterProvider?: string | null;
    maxTokensOverride?: number | null;
    claudeFastMode?: string | null;
    treatAsLocalEndpoint?: string | null;
    defaultParameters?: unknown;
  };
  fallbackConnection: Parameters<CapabilityIntegrationHost["llm"]["withFallback"]>[0]["fallbackConnection"];
  admissionMode: Parameters<CapabilityIntegrationHost["llm"]["withFallback"]>[0]["admissionMode"];
}) {
  const primary =
    createSlurpProvider({
      provider: input.connection.provider,
      baseUrl: resolveBaseUrl(input.connection),
      apiKey: input.connection.apiKey,
      maxContext: input.connection.maxContext,
      openrouterProvider: input.connection.openrouterProvider,
      maxTokensOverride: input.connection.maxTokensOverride,
      claudeFastMode: input.connection.claudeFastMode === "true",
      treatAsLocalEndpoint: input.connection.treatAsLocalEndpoint === "true",
      defaultParameters: input.connection.defaultParameters,
      connectionId: input.connection.id,
    }) ??
    createLLMProvider(
      input.connection.provider,
      resolveBaseUrl(input.connection),
      input.connection.apiKey,
      input.connection.maxContext,
      input.connection.openrouterProvider,
      input.connection.maxTokensOverride,
      input.connection.claudeFastMode === "true",
      input.connection.treatAsLocalEndpoint === "true",
      input.connection.defaultParameters,
    );
  const hosted = createSlurpFallbackProvider({
    primary,
    primaryConnectionId: input.connection.id,
    fallbackConnection: input.fallbackConnection,
    fallbackBaseUrl: input.fallbackConnection ? resolveBaseUrl(input.fallbackConnection) : "",
    category: "main",
    admissionMode: input.admissionMode,
  });
  if (hosted) return hosted;
  return withConnectionAdmissionProvider(
    withConnectionFallbackProvider({
      primary,
      primaryConnectionId: input.connection.id,
      fallbackConnection: input.fallbackConnection,
      fallbackBaseUrl: input.fallbackConnection ? resolveBaseUrl(input.fallbackConnection) : "",
      category: "main",
    }),
    input.connection.id,
    input.admissionMode ?? { kind: "foreground" },
  );
}

export function completeSlurpWithHost(
  provider: CapabilityIntegrationProvider,
  messages: ChatMessage[],
  options: Parameters<typeof provider.chatComplete>[1],
) {
  return provider.chatComplete(messages, options);
}

export function generateSlurpImageWithHost(input: {
  source: string;
  baseUrl: string;
  apiKey: string;
  serviceHint: string;
  request: Parameters<CapabilityIntegrationHost["images"]["generate"]>[4];
}): Promise<ImageGenResult> | null {
  return host?.images.generate(input.source, input.baseUrl, input.apiKey, input.serviceHint, input.request) ?? null;
}

export function stageSlurpImageWithHost(chatId: string, base64: string, ext: string): StagedGalleryImage | null {
  return host?.images.stage(chatId, base64, ext) ?? null;
}
