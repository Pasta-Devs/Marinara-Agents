// Package-owned adapters: provider logic and I/O stay on the live Engine host.
import type { CapabilityIntegrationHost } from "@marinara-engine/shared";
import { packageIntegrations } from "../package-host.js";

export const getLocalSidecarProvider = (...args: Parameters<CapabilityIntegrationHost["llm"]["localSidecar"]>) =>
  packageIntegrations().llm.localSidecar(...args);

export const LOCAL_SIDECAR_MODEL = "local-sidecar";
