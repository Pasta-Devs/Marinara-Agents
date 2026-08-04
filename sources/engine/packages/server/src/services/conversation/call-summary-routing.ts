import type { createLLMProvider } from "../llm/provider-registry.js";

type LLMProviderArguments = Parameters<typeof createLLMProvider>;

type ProviderConnection = {
  provider: LLMProviderArguments[0];
  apiKey: LLMProviderArguments[2];
  maxContext: LLMProviderArguments[3];
  openrouterProvider: LLMProviderArguments[4];
  maxTokensOverride: LLMProviderArguments[5];
  claudeFastMode?: string | null;
  treatAsLocalEndpoint?: string | null;
  defaultParameters: LLMProviderArguments[8];
};

type SummaryConnection = ProviderConnection & { id: string };
type SummaryChat = { metadata?: unknown; connectionId?: string | null };
type SummaryConnectionsStorage<T extends SummaryConnection> = {
  getWithKey(id: string): Promise<T | null>;
  getDefaultForAgents(): Promise<T | null>;
};

export type CallSummaryConnectionSource = "selected" | "agent-default" | "chat";

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function buildConversationCallProviderArguments(
  connection: ProviderConnection,
  resolveBaseUrl: (connection: ProviderConnection) => string,
): LLMProviderArguments {
  return [
    connection.provider,
    resolveBaseUrl(connection),
    connection.apiKey,
    connection.maxContext,
    connection.openrouterProvider,
    connection.maxTokensOverride,
    connection.claudeFastMode === "true",
    connection.treatAsLocalEndpoint === "true",
    connection.defaultParameters,
  ];
}

export async function resolveCallSummaryConnection<T extends SummaryConnection>(
  connections: SummaryConnectionsStorage<T>,
  chat: SummaryChat,
  resolveBaseUrl: (connection: T) => string,
): Promise<{ connection: T; source: CallSummaryConnectionSource } | null> {
  const metadata = parseMetadata(chat.metadata);
  const selectedId =
    typeof metadata.conversationCallSummaryConnectionId === "string"
      ? metadata.conversationCallSummaryConnectionId.trim()
      : "";
  const candidates: Array<{ connection: T | null; source: CallSummaryConnectionSource }> = [
    { connection: selectedId ? await connections.getWithKey(selectedId) : null, source: "selected" },
    { connection: await connections.getDefaultForAgents(), source: "agent-default" },
    { connection: chat.connectionId ? await connections.getWithKey(chat.connectionId) : null, source: "chat" },
  ];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const connection = candidate.connection;
    if (!connection || seen.has(connection.id)) continue;
    seen.add(connection.id);
    if (connection.provider === "image_generation" || connection.provider === "video_generation") continue;
    if (!resolveBaseUrl(connection)) continue;
    return { connection, source: candidate.source };
  }
  return null;
}

export function buildCallSummaryCompletionOptions(model: string) {
  return { model, maxTokens: 4096, temperature: 0.2 } as const;
}
