// Fakes for the Otome Forge regressions: the Engine's document store, a runtime typed as the host's, and an image
// client that counts paid calls. Shapes follow the Engine (capability-persistence.service.ts createDocumentStore,
// capability-runtime.ts CapabilityRuntimeHost); anything a test has not asked for throws when it is touched.
import type {
  CapabilityDocumentRecord,
  CapabilityDocumentStore,
  CapabilityLanguageModelCompletionOptions,
  CapabilityLanguageModelMessage,
  CapabilityResolvedLanguageModel,
  CapabilityRuntimeHost,
} from "@marinara-engine/shared";

type Integrations = NonNullable<CapabilityRuntimeHost["integrations"]>;
type Admission = NonNullable<Integrations["admission"]>;

/** The Engine's file store rejects a second row with the same primary key (db/file-schema.ts). */
export class FakeUniqueConstraintError extends Error {
  readonly code = "FILE_UNIQUE_CONSTRAINT";

  constructor(id: string) {
    super(`[file-storage] Unique value already exists for capability_documents.id (${id})`);
    this.name = "FileUniqueConstraintError";
  }
}

/** A value whose every property throws: the parts of the host a test did not script. */
function notInFake<T extends object>(name: string, members: Partial<T> = {}): T {
  return new Proxy(members as T, {
    get(target, property, receiver) {
      if (property in target || typeof property === "symbol" || property === "then") {
        return Reflect.get(target, property, receiver);
      }
      throw new Error(`${name}.${property} is not in the Otome Forge fake runtime`);
    },
  });
}

/**
 * Documents keyed by id alone, as `capability_documents.id` is one primary key for every package: a package reads only
 * its own rows, and creating an id another package holds throws. `interfere(id)` makes the next update of that id find
 * a newer revision (another writer got there first); `raceCreate(id, data)` makes the next create of that id lose to a
 * row another request created a moment earlier.
 */
export function createFakeDocuments() {
  const rows = new Map<string, CapabilityDocumentRecord>();
  const interference: Array<{ id: string; change?: (data: any) => unknown }> = [];
  const createRaces: Array<{ id: string; packageId?: string; data: unknown }> = [];
  const clone = <T>(value: T): T => structuredClone(value);

  const insert = (input: Omit<CapabilityDocumentRecord, "revision">): CapabilityDocumentRecord => {
    if (rows.has(input.id)) throw new FakeUniqueConstraintError(input.id);
    const row = { ...clone(input), revision: 1 };
    rows.set(input.id, row);
    return clone(row);
  };

  const documents: CapabilityDocumentStore = {
    async list(packageId, kind) {
      return [...rows.values()]
        .filter((row) => row.packageId === packageId && row.kind === kind)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id))
        .map(clone);
    },
    async getById(packageId, id) {
      const row = rows.get(id);
      return row && row.packageId === packageId ? clone(row) : null;
    },
    async create(input) {
      const raceIndex = createRaces.findIndex((race) => race.id === input.id);
      if (raceIndex >= 0) {
        const [race] = createRaces.splice(raceIndex, 1);
        insert({ ...input, packageId: race.packageId ?? input.packageId, data: race.data });
      }
      return insert(input);
    },
    async update(input) {
      const interferenceIndex = interference.findIndex((entry) => entry.id === input.id);
      const stale = rows.get(input.id);
      if (interferenceIndex >= 0 && stale) {
        const [entry] = interference.splice(interferenceIndex, 1);
        const data = entry.change ? entry.change(clone(stale.data)) : stale.data;
        rows.set(input.id, { ...stale, data, revision: stale.revision + 1 });
      }
      const current = rows.get(input.id);
      if (!current || current.packageId !== input.packageId || current.revision !== input.expectedRevision) return null;
      const next: CapabilityDocumentRecord = {
        ...current,
        name: input.name,
        description: input.description,
        data: clone(input.data),
        revision: current.revision + 1,
        updatedAt: input.updatedAt,
      };
      rows.set(input.id, next);
      return clone(next);
    },
    async remove(packageId, id, expectedRevision) {
      const current = rows.get(id);
      if (!current || current.packageId !== packageId || current.revision !== expectedRevision) return false;
      rows.delete(id);
      return true;
    },
  };

  return {
    documents,
    rows,
    interfere(id: string, change?: (data: any) => unknown) {
      interference.push({ id, change });
    },
    raceCreate(id: string, data: unknown, packageId?: string) {
      createRaces.push({ id, data, packageId });
    },
    /** Gacha Forge's unprefixed index row, which an unprefixed Otome `index` would collide with. */
    seedGachaForgeIndex() {
      const at = "2026-01-01T00:00:00.000Z";
      return insert({
        id: "index",
        packageId: "gacha-forge",
        kind: "index",
        name: "Gacha Forge",
        description: "",
        data: { runs: [] },
        createdAt: at,
        updatedAt: at,
      });
    },
  };
}

export type FakeDocuments = ReturnType<typeof createFakeDocuments>;

export interface FakeLogEntry {
  level: "debug" | "info" | "warn" | "error" | "debugOverride";
  message: string;
  args: unknown[];
  error?: unknown;
  override?: boolean;
}

/** One scripted model reply: text, text with its finish reason, an error to throw, or a function of the request. */
export type FakeReply =
  | string
  | { content: string; finishReason: string }
  | Error
  | ((messages: CapabilityLanguageModelMessage[], options?: CapabilityLanguageModelCompletionOptions) => string);

export interface FakeRuntimeOptions {
  documents?: CapabilityDocumentStore;
  replies?: FakeReply[];
  debugAgents?: boolean;
  /** Levels the logger reports as enabled through isLevelEnabled; default none. */
  enabledLevels?: string[];
  /** Errors the fake admission treats as its own (`admission.isFailure`). */
  admissionFailures?: Set<unknown>;
  /** How the fake admission runs an admitted operation; by default it just runs it. */
  admissionRun?: <T>(operation: () => Promise<T>) => Promise<T>;
  characters?: Array<{ id: string; data: unknown; comment?: string }>;
  personas?: Array<{ id: string; data: unknown }>;
  /** The connection's own output cap (the resolved model's maxOutputTokens); 4096 by default, null for none. */
  maxOutputTokens?: number | null;
}

/** A runtime typed as the Engine's CapabilityRuntimeHost, with the parts Otome uses scripted and recorded. */
export function createFakeRuntime(options: FakeRuntimeOptions = {}) {
  const replies = [...(options.replies ?? [])];
  const logs: FakeLogEntry[] = [];
  const calls: Array<{
    connectionId: string;
    messages: CapabilityLanguageModelMessage[];
    options?: CapabilityLanguageModelCompletionOptions;
  }> = [];
  const admissions: Array<{ connectionId: string; mode: unknown }> = [];
  const enabledLevels = new Set(options.enabledLevels ?? []);
  const admissionFailures = options.admissionFailures ?? new Set<unknown>();

  const model = (connectionId: string): CapabilityResolvedLanguageModel => ({
    name: `Fake ${connectionId}`,
    connectionId,
    model: "fake-model",
    maxContext: 32768,
    maxOutputTokens: options.maxOutputTokens === undefined ? 4096 : options.maxOutputTokens,
    async chatComplete(messages, completionOptions) {
      calls.push({ connectionId, messages: structuredClone(messages), options: completionOptions });
      const reply = replies.shift();
      if (reply === undefined) throw new Error("The Otome Forge fake model has no scripted reply left");
      if (reply instanceof Error) throw reply;
      if (typeof reply === "object") return { ...reply };
      const content = typeof reply === "function" ? reply(messages, completionOptions) : reply;
      return { content, finishReason: "stop" };
    },
    fitContext(messages, fitOptions) {
      const tokens = messages.reduce((sum, message) => sum + Math.ceil(message.content.length / 4), 0);
      return {
        messages,
        maxTokens: fitOptions?.maxTokens,
        estimatedTokensBefore: tokens,
        estimatedTokensAfter: tokens,
        trimmed: false,
      };
    },
  });

  const record =
    (level: Exclude<FakeLogEntry["level"], "error" | "debugOverride">) =>
    (message: string, ...args: unknown[]) => {
      logs.push({ level, message, args });
    };

  const runtime: CapabilityRuntimeHost = notInFake<CapabilityRuntimeHost>("runtime", {
    isDebugAgentsEnabled: () => options.debugAgents === true,
    json: {
      parseJsonish(raw: string) {
        const text = raw.trim();
        try {
          return JSON.parse(text);
        } catch {
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");
          if (start < 0 || end <= start) throw new Error("No JSON object in the reply");
          return JSON.parse(text.slice(start, end + 1));
        }
      },
    },
    languageModels: {
      resolve: async (connectionId) => model(connectionId ?? "default"),
      resolveForRequest: async (request) => model(request.connectionId ?? "default"),
    },
    logger: {
      debug: record("debug"),
      info: record("info"),
      warn: record("warn"),
      error(error: unknown, message: string, ...args: unknown[]) {
        logs.push({ level: "error", error, message, args });
      },
      debugOverride(override: boolean, message: string, ...args: unknown[]) {
        logs.push({ level: "debugOverride", override, message, args });
      },
      isLevelEnabled: (level) => enabledLevels.has(level),
    },
    persistence: notInFake<CapabilityRuntimeHost["persistence"]>("runtime.persistence", {
      documents: options.documents ?? createFakeDocuments().documents,
    }),
    resources: notInFake<CapabilityRuntimeHost["resources"]>("runtime.resources", {
      listCharacters: async (ids?: string[]) =>
        (options.characters ?? [])
          .filter((character) => !ids || ids.includes(character.id))
          .map((character) => ({ comment: "", ...character })),
      listPersonas: async (ids?: string[]) =>
        (options.personas ?? []).filter((persona) => !ids || ids.includes(persona.id)),
    }),
    integrations: notInFake<Integrations>("runtime.integrations", {
      admission: notInFake<Admission>("runtime.integrations.admission", {
        async run<T>(connectionId: string, mode: unknown, operation: () => Promise<T>) {
          admissions.push({ connectionId, mode });
          return options.admissionRun ? options.admissionRun(operation) : operation();
        },
        isFailure: (error: unknown) => admissionFailures.has(error),
      }),
    }),
  });

  return { runtime, logs, calls, admissions, replies };
}

/** Counts every paid image call (any `generate*` method) and answers with a gallery-like URL. */
export function createFakeImageClient() {
  const paid: Array<{ method: string; args: unknown[] }> = [];
  const client = new Proxy({} as Record<string, (...args: unknown[]) => Promise<{ url: string }>>, {
    get(_target, method) {
      if (typeof method !== "string" || !method.startsWith("generate")) return undefined;
      return async (...args: unknown[]) => {
        paid.push({ method, args });
        return { url: `/api/global-gallery/fake/${method}-${paid.length}.png` };
      };
    },
  });
  return { client, paid };
}
