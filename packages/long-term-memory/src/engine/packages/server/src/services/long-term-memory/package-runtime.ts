export type RuntimeLogArgument = string | number | boolean | null | undefined | object;

export type CapabilityRuntimeHost = {
  dataDir?: string;
  getAgentConfig?(): Promise<{ connectionId: string | null; settings: Record<string, unknown> } | null>;
  logger: {
    debug(message: string, ...args: RuntimeLogArgument[]): void;
    info(message: string, ...args: RuntimeLogArgument[]): void;
    warn(message: string, ...args: RuntimeLogArgument[]): void;
    error(error: unknown, message: string, ...args: RuntimeLogArgument[]): void;
    debugOverride?(overrideEnabled: boolean, message: string, ...args: RuntimeLogArgument[]): void;
  };
  isDebugAgentsEnabled?(): boolean;
  languageModels?: {
    resolveForRequest(request: {
      connectionId?: string | null;
      chatConnectionId?: string | null;
      model?: string;
    }): Promise<{
      name: string;
      connectionId: string;
      model: string;
      maxContext: number | null;
      maxOutputTokens: number | null;
      chatComplete(messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>, options?: {
        temperature?: number;
        maxTokens?: number;
        debugMode?: boolean;
        reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
        verbosity?: "low" | "medium" | "high";
        signal?: AbortSignal;
        responseFormat?: Readonly<{ type: string; [key: string]: unknown }>;
      }): Promise<{ content: string | null; finishReason: string; usage?: { promptTokens?: number; completionTokens?: number; completionReasoningTokens?: number; totalTokens?: number } }>;
      fitContext(messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>, options?: { maxTokens?: number }): {
        messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>;
        maxTokens?: number;
        estimatedTokensBefore: number;
        estimatedTokensAfter: number;
        trimmed: boolean;
      };
    }>;
  };
  resources?: {
    listCharacters(characterIds?: string[]): Promise<Array<{ id: string; data: unknown; comment: string }>>;
    listPersonas(personaIds?: string[]): Promise<Array<{ id: string; data: unknown }>>;
    listLorebooks(lorebookIds?: string[]): Promise<Array<{ id: string; data: unknown; entries: unknown[] }>>;
  };
  persistence?: {
    dataDir?: string;
    getChat(chatId: string): Promise<{
      id: string;
      name: string;
      mode: string;
      characterIds: string[];
      groupId: string | null;
      personaId: string | null;
      connectionId: string | null;
      metadata: unknown;
      lastMessageAt: string | null;
      updatedAt: string;
    } | null>;
    listChats(): Promise<Array<{
      id: string;
      name: string;
      mode: string;
      characterIds: string[];
      groupId: string | null;
      personaId: string | null;
      connectionId: string | null;
      metadata: unknown;
      lastMessageAt: string | null;
      updatedAt: string;
    }>>;
    updateChatMetadata(input: {
      chatId: string;
      metadata: Record<string, unknown>;
      updatedAt: string;
    }): Promise<void>;
  };
};

export type PackageEmbeddingAdapter = {
  label: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][] | null>;
};

let host: CapabilityRuntimeHost | null = null;
let registration = 0;
let embeddingAdapter: PackageEmbeddingAdapter | null = null;

function currentHost() {
  if (!host) throw new Error("Long-Term Memory package runtime is not configured");
  return host;
}

export function getPackageRuntime() {
  return currentHost();
}

export function configurePackageRuntime(next: CapabilityRuntimeHost) {
  const token = ++registration;
  host = next;
  return () => {
    if (registration === token) host = null;
  };
}

export function configurePackageEmbeddingAdapter(adapter: PackageEmbeddingAdapter | null) {
  embeddingAdapter = adapter;
}

export function getPackageEmbeddingAdapter() {
  return embeddingAdapter;
}

export function getPackageDataDir() {
  const runtime = currentHost();
  const dataDir = runtime.dataDir ?? runtime.persistence?.dataDir;
  if (!dataDir) throw new Error("Long-Term Memory runtime host did not provide dataDir");
  return dataDir;
}

export function getPackagePersistence() {
  const persistence = currentHost().persistence;
  if (!persistence) throw new Error("Long-Term Memory runtime host did not provide persistence");
  return persistence;
}

export function getPackageLanguageModels() {
  const languageModels = currentHost().languageModels;
  if (!languageModels) throw new Error("Long-Term Memory runtime host did not provide languageModels");
  return languageModels;
}

export function getPackageResources() {
  const resources = currentHost().resources;
  if (!resources) throw new Error("Long-Term Memory runtime host did not provide resources");
  return resources;
}

export function isPackageDebugAgentsEnabled() {
  return currentHost().isDebugAgentsEnabled?.() === true;
}

export const logger = {
  debug: (message: string, ...args: RuntimeLogArgument[]) => currentHost().logger.debug(message, ...args),
  info: (message: string, ...args: RuntimeLogArgument[]) => currentHost().logger.info(message, ...args),
  warn: (first: unknown, second?: RuntimeLogArgument, ...args: RuntimeLogArgument[]) =>
    typeof first === "string"
      ? currentHost().logger.warn(first, second, ...args)
      : currentHost().logger.warn(typeof second === "string" ? second : "Long-Term Memory warning", first as RuntimeLogArgument, ...args),
  error: (error: unknown, message: string, ...args: RuntimeLogArgument[]) =>
    currentHost().logger.error(error, message, ...args),
  debugOverride: (overrideEnabled: boolean, message: string, ...args: RuntimeLogArgument[]) => {
    const runtime = currentHost();
    if (runtime.logger.debugOverride) runtime.logger.debugOverride(overrideEnabled, message, ...args);
    else if (overrideEnabled) runtime.logger.debug(message, ...args);
  },
};

export async function withKeyedLock<T>(
  locks: Map<string, Promise<void>>,
  key: string,
  operation: () => Promise<T>,
) {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => current, () => current);
  locks.set(key, tail);
  try {
    await previous.catch(() => {});
    return await operation();
  } finally {
    release();
    if (locks.get(key) === tail) locks.delete(key);
  }
}
