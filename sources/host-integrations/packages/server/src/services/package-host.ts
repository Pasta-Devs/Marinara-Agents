import type { CapabilityIntegrationHost } from "@marinara-engine/shared";

let host: CapabilityIntegrationHost | undefined;

export function bindPackageIntegrations(value: CapabilityIntegrationHost | undefined): () => void {
  if (!value)
    throw new Error("This package requires Engine capability API 1.31. Update Marinara Engine before activating it.");
  host = value;
  return () => {
    if (host === value) host = undefined;
  };
}

export function packageIntegrations(): CapabilityIntegrationHost {
  if (!host) throw new Error("Package generation services are unavailable outside activation.");
  return host;
}
