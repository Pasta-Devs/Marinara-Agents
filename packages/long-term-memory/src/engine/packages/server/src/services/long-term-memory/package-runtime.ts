import { LtmServiceError } from "./service-error.js";

export type RuntimeLogArgument = string | number | boolean | null | undefined | object;

export type PackageLanguageModelError = Error & {
  status?: number;
  code?: string;
  param?: string;
  parameter?: string;
  retryAfterMs?: number;
};

export type CapabilityRuntimeHost = {
  dataDir?: string;
  embeddings?: PackageEmbeddingAdapter;
  resolveEmbeddings?(): Promise<PackageEmbeddingAdapter>;
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
      chatComplete(
        messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>,
        options?: {
          temperature?: number;
          maxTokens?: number;
          debugMode?: boolean;
          reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
          verbosity?: "low" | "medium" | "high";
          signal?: AbortSignal;
          responseFormat?: Readonly<{ type: string; [key: string]: unknown }>;
        },
      ): Promise<{
        content: string | null;
        finishReason: string;
        usage?: {
          promptTokens?: number;
          completionTokens?: number;
          completionReasoningTokens?: number;
          totalTokens?: number;
        };
      }>;
      fitContext(
        messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>,
        options?: { maxTokens?: number },
      ): {
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
    listPersonas(personaIds?: string[]): Promise<Array<{ id: string; data: unknown; comment?: string }>>;
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
    listChats(): Promise<
      Array<{
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
      }>
    >;
    listMessages(chatId: string): Promise<
      Array<{
        id: string;
        chatId: string;
        role: string;
        characterId: string | null;
        content: string;
        activeSwipeIndex: number;
        extra: unknown;
        createdAt: string;
        agentContent?: string;
      }>
    >;
    /** Engines that have it skip messages the user hid or showed by hand and return the ids actually changed. */
    setMessagesHiddenFromAI?(chatId: string, messageIds: string[], hidden: boolean): Promise<string[]>;
  };
};

export type PackageLanguageModel = Awaited<
  ReturnType<NonNullable<CapabilityRuntimeHost["languageModels"]>["resolveForRequest"]>
>;

export type PackageEmbeddingAdapter = {
  spaceId: string;
  label: string;
  embed(texts: string[], signal?: AbortSignal, inputType?: "query" | "document"): Promise<number[][] | null>;
};

let host: CapabilityRuntimeHost | null = null;
let registration = 0;

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

export function getPackageEmbeddingAdapter() {
  return host?.embeddings ?? null;
}

export async function resolvePackageEmbeddingAdapter(explicitAdapter?: PackageEmbeddingAdapter | null) {
  if (explicitAdapter !== undefined) return explicitAdapter;
  const runtime = currentHost();
  return (await runtime.resolveEmbeddings?.()) ?? runtime.embeddings ?? null;
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

// The Engine words a missing, deleted or unusable model connection for users. Anything else the resolver throws,
// such as a database or key-file error, can name file paths, so it goes on to routeError, which logs it.
// ponytail: matches the Engine's current wording, so a reworded setup message gets the route's fallback until the
// Engine marks these errors with a code.
const LANGUAGE_MODEL_SETUP_ERRORS = [
  "Choose a language model connection ",
  "No language model connection ",
  "The selected connection ",
  "The selected language model connection ",
  "Language model connection not found: ",
  "Chat language model connection not found: ",
  "Decision connections cannot ",
];

export async function resolvePackageLanguageModel(
  request: Parameters<NonNullable<CapabilityRuntimeHost["languageModels"]>["resolveForRequest"]>[0],
) {
  try {
    return await getPackageLanguageModels().resolveForRequest(request);
  } catch (error) {
    if (error instanceof Error && LANGUAGE_MODEL_SETUP_ERRORS.some((start) => error.message.startsWith(start)))
      throw new LtmServiceError(error.message, 400, "ltm_model_configuration");
    throw error;
  }
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
  debug: (message: string, ...args: RuntimeLogArgument[]) => host?.logger.debug(message, ...args),
  info: (message: string, ...args: RuntimeLogArgument[]) => host?.logger.info(message, ...args),
  warn: (first: unknown, second?: RuntimeLogArgument, ...args: RuntimeLogArgument[]) => {
    if (!host) return;
    if (typeof first === "string") return host.logger.warn(first, second, ...args);
    // The host's warn takes the message first, and pino (the Engine's logger) drops an argument the message
    // has no placeholder for, so an error passed first goes into the message.
    const cause = first instanceof Error ? (first.stack ?? first.message) : String(first);
    host.logger.warn(`${typeof second === "string" ? second : "Long-Term Memory warning"}: ${cause}`, ...args);
  },
  error: (error: unknown, message: string, ...args: RuntimeLogArgument[]) =>
    host?.logger.error(error, message, ...args),
  debugOverride: (overrideEnabled: boolean, message: string, ...args: RuntimeLogArgument[]) => {
    const runtime = host;
    if (!runtime) return;
    if (runtime.logger.debugOverride) runtime.logger.debugOverride(overrideEnabled, message, ...args);
    else if (overrideEnabled) runtime.logger.debug(message, ...args);
  },
};

export async function withKeyedLock<T>(locks: Map<string, Promise<void>>, key: string, operation: () => Promise<T>) {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(
    () => current,
    () => current,
  );
  locks.set(key, tail);
  try {
    await previous.catch(() => {});
    return await operation();
  } finally {
    release();
    if (locks.get(key) === tail) locks.delete(key);
  }
}
