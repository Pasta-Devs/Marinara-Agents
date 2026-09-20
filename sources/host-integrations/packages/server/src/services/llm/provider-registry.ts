// Package-owned adapters: provider logic and I/O stay on the live Engine host.
import type { CapabilityIntegrationHost } from "@marinara-engine/shared";
import { packageIntegrations } from "../package-host.js";

export const createLLMProvider = (...args: Parameters<CapabilityIntegrationHost["llm"]["createProvider"]>) =>
  packageIntegrations().llm.createProvider(...args);
