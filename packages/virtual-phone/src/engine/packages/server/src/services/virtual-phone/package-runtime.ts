// ──────────────────────────────────────────────
// Virtual Phone — capability runtime host
//
// Mirrors the host shape the Engine hands to a capability package. Only the
// members this package actually consumes are declared; the phone never sees
// provider credentials and never calls a model provider directly.
// ──────────────────────────────────────────────

export type RuntimeLogArgument = string | number | boolean | null | undefined | object;

export type PhoneChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string };

export type CapabilityRuntimeHost = {
  dataDir?: string;
  logger: {
    debug(message: string, ...args: RuntimeLogArgument[]): void;
    info(message: string, ...args: RuntimeLogArgument[]): void;
    warn(message: string, ...args: RuntimeLogArgument[]): void;
    error(error: unknown, message: string, ...args: RuntimeLogArgument[]): void;
  };
  languageModels?: {
    resolveForRequest(request: {
      connectionId?: string | null;
      chatConnectionId?: string | null;
      model?: string;
    }): Promise<{
      name: string;
      connectionId: string;
      model: string;
      chatComplete(
        messages: PhoneChatMessage[],
        options?: {
          temperature?: number;
          maxTokens?: number;
          signal?: AbortSignal;
          responseFormat?: Readonly<{ type: string; [key: string]: unknown }>;
        },
      ): Promise<{ content: string | null; finishReason: string }>;
      fitContext(
        messages: PhoneChatMessage[],
        options?: { maxTokens?: number },
      ): { messages: PhoneChatMessage[]; maxTokens?: number };
    }>;
  };
  resources?: {
    listCharacters(characterIds?: string[]): Promise<Array<{ id: string; data: unknown; comment: string }>>;
    listPersonas(personaIds?: string[]): Promise<Array<{ id: string; data: unknown }>>;
  };
  persistence?: {
    dataDir?: string;
    getChat(chatId: string): Promise<{
      id: string;
      name: string;
      mode: string;
      characterIds: string[];
      personaId: string | null;
      connectionId: string | null;
      metadata: unknown;
    } | null>;
  };
};

let host: CapabilityRuntimeHost | null = null;
let registration = 0;

export function getPackageRuntime(): CapabilityRuntimeHost {
  if (!host) throw new Error("Virtual Phone package runtime is not configured");
  return host;
}

export function configurePackageRuntime(next: CapabilityRuntimeHost) {
  const token = ++registration;
  host = next;
  return () => {
    if (registration === token) host = null;
  };
}

/**
 * Resolve the model for a page render. The chat's own connection is preferred so
 * the phone speaks in the same voice as the scene it sits inside.
 */
export async function resolvePhoneModel(connectionId: string | null, chatConnectionId: string | null) {
  const runtime = getPackageRuntime();
  if (!runtime.languageModels) {
    throw new Error("This Marinara build does not expose a language-model host to packages.");
  }
  return runtime.languageModels.resolveForRequest({ connectionId, chatConnectionId });
}
