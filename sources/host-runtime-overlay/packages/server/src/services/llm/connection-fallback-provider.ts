// Host overlay for services/llm/connection-fallback-provider.ts (Pasta-Devs/Marinara-Agents#1487). The
// Engine builds the fallback chain (api.runtime.integrations.llm.withFallback), including connection
// admission for both legs, so `admissionMode` now takes effect: the vendored copy ignored it. The primary
// must be a provider the Engine created (createLLMProvider or getLocalSidecarProvider); a package wrapper
// goes around the result instead.
import type { BaseLLMProvider } from "./base-provider.js";
import type { ConnectionAdmissionMode } from "../generation/connection-admission.js";
import { hostIntegrations } from "../../lib/host-runtime.js";

export type FallbackConnection = {
  id: string;
  name?: string | null;
  provider: string;
  baseUrl: string | null;
  apiKey: string;
  model: string;
  maxContext?: number | null;
  openrouterProvider?: string | null;
  maxTokensOverride?: number | null;
  defaultParameters?: unknown;
  maxParallelJobs?: number | null;
  enableCaching?: string | boolean | null;
  anthropicExtendedCacheTtl?: string | boolean | null;
  cachingAtDepth?: number | null;
  claudeFastMode?: string | boolean | null;
  treatAsLocalEndpoint?: string | boolean | null;
};

export type GenerationProviderOrigin = { kind: "primary" } | { kind: "fallback"; provider: string; model: string };

export type ConnectionFallbackProviderArgs = {
  primary: BaseLLMProvider;
  primaryConnectionId: string;
  primaryConnectionName?: string | null;
  fallbackConnection: FallbackConnection | null | undefined;
  fallbackBaseUrl: string;
  category: "main" | "agents";
  onFallback?: (notice: Record<string, unknown>) => void | Promise<void>;
  onProviderUsed?: (origin: GenerationProviderOrigin) => void;
  /** Defaults to foreground, as in the Engine. */
  admissionMode?: ConnectionAdmissionMode;
  primarySupportsAssistantReasoningPrefill?: boolean;
  fallbackSupportsAssistantReasoningPrefill?: boolean;
};

export function withConnectionFallbackProvider(args: ConnectionFallbackProviderArgs): BaseLLMProvider {
  return hostIntegrations().llm.withFallback(args as never) as unknown as BaseLLMProvider;
}
