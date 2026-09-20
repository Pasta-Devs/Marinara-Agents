// Package-owned adapters: provider logic and I/O stay on the live Engine host.
import type { CapabilityIntegrationHost } from "@marinara-engine/shared";
import { packageIntegrations } from "../package-host.js";

export const withConnectionFallbackProvider = (...args: Parameters<CapabilityIntegrationHost["llm"]["withFallback"]>) =>
  packageIntegrations().llm.withFallback(...args);

export type { FallbackConnection, GenerationProviderOrigin } from "@marinara-engine/shared";
