// The package side of the Engine's `api.runtime` (Pasta-Devs/Marinara-Agents#1487, capability API 1.341).
//
// Calls, Noodle and Slurp used to bundle their own copies of stateful Engine services: the Local Model
// manager, connection admission, provider routing with the ChatGPT login refresh, the haptics client,
// Spotify, the command and service registries, and the logger. Each copy kept its own state beside the
// Engine's, so a package could start a second llama-server, run background work while the user's chat
// was streaming, or never see another package's commands. The overlays in sources/host-runtime-overlay
// replace those modules with thin calls into the Engine's live services, reached through this binding.
//
// The generated server entry calls `bindHostRuntime(context.api.runtime)` first in activate() and the
// returned cleanup unbinds it. A member the Engine does not provide makes that one feature report
// "needs a newer Marinara Engine"; a package never falls back to a bundled copy, because the copy is
// the bug. This file exists only in the overlay; there is no vendored counterpart.

export type HostLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/** api.runtime.logger. The Engine passes the arguments to its Pino logger unchanged. */
export interface HostRuntimeLogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debugOverride(overrideEnabled: boolean, message: string, ...args: unknown[]): void;
  /** Capability API 1.341. */
  isLevelEnabled?(level: HostLogLevel): boolean;
}

/** The host's provider facade: the whole public surface the Engine hands a package. */
export interface HostProvider {
  readonly maxContextValue: number | null;
  readonly maxTokensOverrideValue: number | null;
  chat(messages: unknown[], options: unknown): AsyncGenerator<string, unknown, unknown>;
  chatComplete(messages: unknown[], options: unknown): Promise<unknown>;
  embed(texts: string[], model: string, signal?: AbortSignal): Promise<number[][]>;
}

export type HostAdmissionMode =
  { kind: "foreground" } | { kind: "background"; beforeAttempt?: () => unknown } | { kind: "none" };

export type HostAttemptOutcome = "completed" | "failed";

export type HostBackgroundSlot = { acquired: false } | { acquired: true; release(outcome?: HostAttemptOutcome): void };

export interface HostHapticDevice {
  index: number;
  name: string;
  type?: string;
  capabilities?: string[];
}

export interface HostHapticStatus {
  connected: boolean;
  devices: HostHapticDevice[];
  scanning?: boolean;
  serverUrl?: string | null;
}

export interface HostHapticCommand {
  deviceIndex: number | "all";
  action: string;
  intensity?: number;
  duration?: number;
  pattern?: string;
}

/** api.runtime.integrations (capability API 1.31; the optional members are 1.341). */
export interface HostIntegrations {
  llm: {
    createProvider(...args: unknown[]): HostProvider;
    withFallback(options: Record<string, unknown> & { primary: HostProvider }): HostProvider;
    localSidecar(): HostProvider;
  };
  images: {
    generate(source: string, baseUrl: string, apiKey: string, serviceHint: string, request: object): Promise<any>;
    save(chatId: string, base64: string, ext: string, options?: { shared?: boolean }): string;
    remove(filePath: string): void;
    stage(chatId: string, base64: string, ext: string): { filePath: string; promote(): void; compensate(): void };
    sweepStaged(): number;
    resolveNovelAiRequestSize(request: object, defaults?: unknown): { width: number; height: number };
    addToChatGallery?(input: {
      chatId: string;
      filePath: string;
      prompt: string;
      provider: string;
      model: string;
      width: number;
      height: number;
    }): Promise<{ id: string }>;
    persistToEntityGalleries?(input: {
      sourceFilePath: string;
      sourceChatImageId?: string | null;
      characterIds?: string[];
      personaIds?: string[];
      prompt: string;
      provider: string;
      model: string;
      width: number;
      height: number;
      signal?: AbortSignal;
      enabled?: boolean;
    }): Promise<{ characterCount: number; personaCount: number }>;
  };
  videos: {
    generate(source: string, baseUrl: string, apiKey: string, serviceHint: string, request: object): Promise<any>;
    save(chatId: string, base64: string): Promise<string>;
    remove(filePath: string): Promise<void>;
    resolveDuration(source: string, serviceHint: string, request: object): number;
    resolveReferenceUpload(enabled: boolean, defaults: unknown): any;
  };
  speech?: {
    transcribe(
      audio: Uint8Array,
      options?: { filename?: string; mimeType?: string; signal?: AbortSignal },
    ): Promise<string | null>;
    /** Capability API 1.341: the Engine's Local Whisper. */
    transcribeLocal?(wav: Uint8Array): Promise<string>;
  };
  admission?: {
    withProvider(provider: HostProvider, connectionId: string, mode?: HostAdmissionMode): HostProvider;
    run<T>(connectionId: string, mode: HostAdmissionMode, operation: () => Promise<T>): Promise<T>;
    tryBackground(connectionId: string, at?: Date): HostBackgroundSlot;
    isFailure(error: unknown): boolean;
  };
  haptics?: {
    status(): HostHapticStatus;
    connect(url?: string): Promise<void>;
    executeCommand(command: HostHapticCommand): Promise<void>;
  };
  spotify?: {
    commandsAvailable(): Promise<boolean>;
    playSong(input: { title: string; artist: string }): Promise<{ track: { name: string; artist: string } }>;
  };
}

export interface HostAppendMessageInput {
  role: "user" | "assistant" | "system" | "narrator";
  characterId: string | null;
  content: string;
  extra?: Record<string, unknown>;
  createdAt?: string | null;
}

export interface HostMessageRecord {
  id: string;
  chatId: string;
  role: string;
  characterId: string | null;
  content: string;
  createdAt: string;
  [key: string]: unknown;
}

export type HostMetadataPatch =
  | Record<string, unknown>
  | ((current: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>);

/** api.runtime.persistence: the members a package writes chats through (the chat-write ones are 1.341). */
export interface HostPersistence {
  withChatLock<T>(chatId: string, operation: () => Promise<T>): Promise<T>;
  patchChatMetadata?(chatId: string, patch: HostMetadataPatch, options?: { touchUpdatedAt?: boolean }): Promise<void>;
  appendMessages?(chatId: string, messages: HostAppendMessageInput[]): Promise<HostMessageRecord[]>;
  createChatNote?(sourceChatId: string, targetChatId: string, content: string, anchorMessageId?: string): Promise<void>;
  createChatInfluence?(
    sourceChatId: string,
    targetChatId: string,
    content: string,
    anchorMessageId?: string,
  ): Promise<void>;
  /**
   * Added to capability API 1.341 after it was first reported (Pasta-Devs/Marinara-Engine#7886), so feature-detect
   * it. Applies a `[schedule_update]` as a temporary status on the character card; null when nothing changed.
   */
  updateCharacterStatus?(
    chatId: string,
    characterId: string,
    update: { status?: "online" | "idle" | "dnd" | "offline"; activity?: string; duration?: string },
  ): Promise<{ status: "online" | "idle" | "dnd" | "offline"; activity: string | null; expiresAt: string } | null>;
}

export interface HostCommandParse {
  type: "capability";
  commandType: string;
  payload: string | null;
}

/** The members of api.runtime the packages read. Structural: the Engine's own type is the authority. */
export interface HostRuntime {
  logger: HostRuntimeLogger;
  integrations?: HostIntegrations;
  persistence: HostPersistence;
  /** Capability API 1.341: another package's service registered with api.registerService. */
  services?: { get<T = unknown>(key: string): T | null };
  /** Capability API 1.341: the commands every package registered, parsed with the host grammar. */
  commands?: {
    parse(content: string): HostCommandParse[];
    strip(content: string): string;
    instructions(): string[];
  };
}

export class HostRuntimeNotBoundError extends Error {
  constructor() {
    super("The Marinara Engine runtime is not connected yet; this package has not been activated.");
    this.name = "HostRuntimeNotBoundError";
  }
}

/** A host member this package needs is missing. Route handlers answer it with HTTP 501. */
export class HostFeatureUnavailableError extends Error {
  readonly code = "host_feature_unavailable";
  /** The Engine's error handler answers with this status when no package handler caught the error. */
  readonly statusCode = 501;
  readonly feature: string;
  constructor(feature: string) {
    super(`${feature} needs a newer Marinara Engine.`);
    this.name = "HostFeatureUnavailableError";
    this.feature = feature;
  }
}

/** By name, so an error from another bundled copy of this module is recognized too. */
export function isHostFeatureUnavailableError(error: unknown): error is HostFeatureUnavailableError {
  return error instanceof Error && error.name === "HostFeatureUnavailableError";
}

/** The HTTP 501 body the package UI shows: its `error` is the message for the user. */
export function hostFeatureErrorBody(error: HostFeatureUnavailableError) {
  return { error: error.message, code: "host_feature_unavailable" as const, feature: error.feature };
}

const LOG_BUFFER_LIMIT = 200;
type BufferedLog = { method: "debug" | "info" | "warn" | "error" | "debugOverride"; args: unknown[] };

// The binding and the pre-activation log buffer are the only module state in the host overlays.
let bound: HostRuntime | null = null;
const pendingLogs: BufferedLog[] = [];

function writeLog(runtime: HostRuntime, entry: BufferedLog) {
  const method = runtime.logger?.[entry.method] as ((...args: unknown[]) => void) | undefined;
  if (typeof method !== "function") return;
  try {
    Reflect.apply(method, runtime.logger, entry.args);
  } catch {
    // A logging failure must never break the work that logged.
  }
}

/** Connect this package to the Engine's runtime. Returns the cleanup that disconnects it. */
export function bindHostRuntime(runtime: HostRuntime): () => void {
  if (!runtime || typeof runtime !== "object") throw new TypeError("bindHostRuntime needs the Engine's api.runtime.");
  bound = runtime;
  for (const entry of pendingLogs.splice(0)) writeLog(runtime, entry);
  return () => {
    if (bound === runtime) bound = null;
  };
}

export function hostRuntime(): HostRuntime {
  if (!bound) throw new HostRuntimeNotBoundError();
  return bound;
}

/** The member, or HostFeatureUnavailableError naming the feature when this Engine does not provide it. */
export function requireHostMember<T>(feature: string, member: T | null | undefined): T {
  if (member === undefined || member === null) throw new HostFeatureUnavailableError(feature);
  return member;
}

export function hostIntegrations(): HostIntegrations {
  return requireHostMember("Generation through Marinara Engine", hostRuntime().integrations);
}

/** Logs through the Engine; before activation, keeps the newest 200 entries and writes them on bind. */
export function hostLog(method: BufferedLog["method"], args: unknown[]): void {
  if (bound) {
    writeLog(bound, { method, args });
    return;
  }
  pendingLogs.push({ method, args });
  if (pendingLogs.length > LOG_BUFFER_LIMIT) pendingLogs.splice(0, pendingLogs.length - LOG_BUFFER_LIMIT);
}

/** The Engine's LOG_LEVEL decides; an Engine without the check is treated as the default (info). */
export function hostLogLevelEnabled(level: HostLogLevel): boolean {
  const logger = bound?.logger;
  if (typeof logger?.isLevelEnabled !== "function") return level !== "trace" && level !== "debug";
  try {
    return Boolean(logger.isLevelEnabled(level));
  } catch {
    return false;
  }
}

type ErrorReply = { status(code: number): { send(body: unknown): unknown } };

/**
 * A Fastify error handler for a package's own plugin scope: HostFeatureUnavailableError becomes
 * HTTP 501 `{ error, code: "host_feature_unavailable", feature }`; every other error goes on to the
 * Engine's handler unchanged.
 */
export function hostFeatureErrorHandler(error: unknown, _request: unknown, reply: ErrorReply) {
  if (!isHostFeatureUnavailableError(error)) throw error;
  return reply.status(501).send(hostFeatureErrorBody(error));
}

const ROUTE_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

function answerHostFeatureErrors(handler: (...args: unknown[]) => unknown) {
  return async function hostFeatureRouteHandler(this: unknown, request: unknown, reply: ErrorReply) {
    try {
      return await Reflect.apply(handler, this, [request, reply]);
    } catch (error) {
      return hostFeatureErrorHandler(error, request, reply);
    }
  };
}

/**
 * The Engine's privileged-route collector (`api.registerPrivilegedRoutes`), with every route handler
 * answering HostFeatureUnavailableError as HTTP 501. The collector has no error handler of its own:
 * its routes land on the Engine's root scope.
 */
export function withHostFeatureErrors<T extends object>(router: T): T {
  return new Proxy(router, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || !ROUTE_METHODS.has(property) || typeof value !== "function") return value;
      return (...args: unknown[]) =>
        Reflect.apply(
          value,
          target,
          args.map((arg) => (typeof arg === "function" ? answerHostFeatureErrors(arg as never) : arg)),
        );
    },
  });
}
