// ──────────────────────────────────────────────
// Otome Forge: logging the final prompt sent to the provider
// ──────────────────────────────────────────────
// Called after context fitting, right before the provider call. In debug mode (the UI's debugMode or DEBUG_AGENTS)
// the kit logs the messages at info through debugOverride, otherwise only at the debug level. Each `redact` string is
// replaced first, so care lines never reach Otome's logs.
import { logForgeStoryPrompt } from "@forge-kit/character-card-context.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";

export const REDACTED = "[cycle state redacted]";

export interface PromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function redactMessages<M extends PromptMessage>(messages: readonly M[], redact: readonly string[] = []): M[] {
  const secrets = redact.filter((value) => value.trim());
  if (!secrets.length) return [...messages];
  return messages.map((message) => ({
    ...message,
    content: secrets.reduce((content, secret) => content.split(secret).join(REDACTED), message.content),
  }));
}

/** Logs the final prompt through the kit's logForgeStoryPrompt with Otome's prefix, after each `redact` is replaced. */
export function logOtomePrompt(
  runtime: Pick<CapabilityRuntimeHost, "logger" | "isDebugAgentsEnabled">,
  label: string,
  messages: readonly PromptMessage[],
  { debugMode = false, redact = [] }: { debugMode?: boolean; redact?: readonly string[] } = {},
): void {
  logForgeStoryPrompt(runtime, label, redactMessages(messages, redact), { debugMode, logPrefix: "otome-forge" });
}
