// Host overlay for services/llm/provider-registry.ts (Pasta-Devs/Marinara-Agents#1487). Every provider is
// the Engine's own (api.runtime.integrations.llm), so the ChatGPT login refresh, rate-limit pauses and
// connection admission are shared with the user's chats instead of running in a second copy.
import type { BaseLLMProvider } from "./base-provider.js";
import { hostIntegrations } from "../../lib/host-runtime.js";

/** Same arguments as the Engine's createLLMProvider; a connectionId books the call as foreground work. */
export function createLLMProvider(
  provider: string,
  baseUrl: string,
  apiKey: string,
  maxContext?: number | null,
  openrouterProvider?: string | null,
  maxTokensOverride?: number | null,
  claudeFastMode?: boolean,
  treatAsLocalEndpoint?: boolean,
  defaultParameters?: unknown,
  connectionId?: string,
): BaseLLMProvider {
  return hostIntegrations().llm.createProvider(
    provider,
    baseUrl,
    apiKey,
    maxContext,
    openrouterProvider,
    maxTokensOverride,
    claudeFastMode,
    treatAsLocalEndpoint,
    defaultParameters,
    connectionId,
  ) as unknown as BaseLLMProvider;
}
