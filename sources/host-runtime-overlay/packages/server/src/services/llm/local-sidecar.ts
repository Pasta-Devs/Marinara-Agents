// Host overlay for services/llm/local-sidecar.ts (Pasta-Devs/Marinara-Agents#1487). Local Model calls run on
// the Engine's own llama-server (api.runtime.integrations.llm.localSidecar), so a package never starts a
// second server or loads the model twice.
import type { BaseLLMProvider } from "./base-provider.js";
import { hostIntegrations } from "../../lib/host-runtime.js";

export const LOCAL_SIDECAR_MODEL = "local-sidecar";

export function getLocalSidecarProvider(): BaseLLMProvider {
  return hostIntegrations().llm.localSidecar() as unknown as BaseLLMProvider;
}
