// ──────────────────────────────────────────────
// Otome Forge: logging the final prompt sent to the provider
// ──────────────────────────────────────────────
// Called after context fitting, right before the provider call. In debug mode (the UI's debugMode or DEBUG_AGENTS)
// the messages are logged at info through debugOverride, otherwise only at the debug level. Each `redact` string is
// replaced first, so care lines never reach Otome's logs.
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

/**
 * ponytail: the kit's logForgeStoryPrompt still prints "[debug/gacha-forge/…]" until its logPrefix option lands (plan
 * M0b); this repeats its ten lines with Otome's prefix. Once M0b lands, call it with { debugMode, logPrefix:
 * "otome-forge" } instead.
 */
export function logOtomePrompt(
  runtime: Pick<CapabilityRuntimeHost, "logger" | "isDebugAgentsEnabled">,
  label: string,
  messages: readonly PromptMessage[],
  { debugMode = false, redact = [] }: { debugMode?: boolean; redact?: readonly string[] } = {},
): void {
  const override =
    debugMode === true ||
    runtime.isDebugAgentsEnabled() === true ||
    /^(1|true)$/iu.test(process.env.DEBUG_AGENTS || "");
  if (!override && runtime.logger.isLevelEnabled?.("debug") === false) return;
  runtime.logger.debugOverride(
    override,
    "[debug/otome-forge/%s] Messages sent to the provider: %s",
    label,
    JSON.stringify(redactMessages(messages, redact)),
  );
}
