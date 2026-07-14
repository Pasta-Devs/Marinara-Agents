import type { BaseLLMProvider } from "./base-provider.js";
import { LocalSidecarProvider } from "./providers/local-sidecar.provider.js";

export const LOCAL_SIDECAR_MODEL = "local-sidecar";

const localSidecarProvider = new LocalSidecarProvider();

export function getLocalSidecarProvider(): BaseLLMProvider {
  return localSidecarProvider;
}
