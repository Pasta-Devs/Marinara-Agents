// Fakes for the Otome Forge regressions: the Engine's document store, a runtime typed as the host's, an image client
// that counts paid calls, and a deterministic embedder (long-term recall, 0.19.0). Shapes follow the Engine (capability-persistence.service.ts createDocumentStore,
// capability-runtime.ts CapabilityRuntimeHost); anything a test has not asked for throws when it is touched.
import type {
  CapabilityDocumentRecord,
  CapabilityDocumentStore,
  CapabilityEmbeddingHost,
  CapabilityLanguageModelCompletion,
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

/**
 * One scripted model reply: text, text with its finish reason (and the usage the provider reports), an error to throw,
 * or a function of the request.
 */
export type FakeReply =
  | string
  | { content: string; finishReason: string; usage?: CapabilityLanguageModelCompletion["usage"] }
  | Error
  | ((messages: CapabilityLanguageModelMessage[], options?: CapabilityLanguageModelCompletionOptions) => string);

export interface FakeRuntimeOptions {
  documents?: CapabilityDocumentStore;
  replies?: FakeReply[];
  /** The arc plan the fake writes for the arc planner's calls (#1980); the default is fakeArcReply. */
  arcReply?: (prompt: string) => string;
  /** The lines the fake writes for the personality quiz's calls (#2174); the default is fakeQuizReply. */
  quizReply?: (messages: CapabilityLanguageModelMessage[]) => string;
  debugAgents?: boolean;
  /** Levels the logger reports as enabled through isLevelEnabled; default none. */
  enabledLevels?: string[];
  /** Errors the fake admission treats as its own (`admission.isFailure`). */
  admissionFailures?: Set<unknown>;
  /** How the fake admission runs an admitted operation, in its mode; by default it just runs it. */
  admissionRun?: <T>(operation: () => Promise<T>, mode: { kind: string }) => Promise<T>;
  characters?: Array<{ id: string; data: unknown; comment?: string }>;
  personas?: Array<{ id: string; data: unknown }>;
  /** The connection's own output cap (the resolved model's maxOutputTokens); 4096 by default, null for none. */
  maxOutputTokens?: number | null;
  /** The connection's context window (the resolved model's maxContext); 32768 by default, null for unknown. */
  maxContext?: number | null;
  /** The Engine's runtime.embeddings (an older Engine's only embedder); absent, touching it throws. */
  embeddings?: CapabilityEmbeddingHost;
  /** Capability API 1.818's runtime.embeddingsFor; absent, the runtime has none (an older Engine). */
  embeddingsFor?: (connectionId: string | null) => Promise<CapabilityEmbeddingHost | null>;
}

/** True for a personality quiz call (#2174): the love interests' answers, or new statements with theirs. */
export const isQuizCall = (messages: ReadonlyArray<{ content: string }>) =>
  !!messages[0] &&
  (messages[0].content.startsWith("You answer a personality quiz") ||
    messages[0].content.includes("new statements for a personality quiz"));

/**
 * The lines the fake model writes for a personality quiz call (#2174), in its line format: a 3 from every love interest
 * the prompt lists for each statement it asks, or for twelve new statements when it asks for new ones. Opening a story
 * queues the answers in the background, so a test that never looks at the quiz never spends a scripted reply on it.
 */
export function fakeQuizReply(messages: ReadonlyArray<{ content: string }>): string {
  const user = messages[1]?.content ?? "";
  const names = [...user.matchAll(/^(.+?) \([^()\n/]+\/[^()\n/]+\/[^()\n/]+\)$/gmu)].map((match) => match[1]!);
  const asked = user.includes("THE STATEMENTS\n")
    ? user.split("THE STATEMENTS\n")[1]!.split("\n\n")[0]!.split("\n")
    : Array.from({ length: 12 }, (_, index) => `A fake new statement, number ${index + 1}.`);
  return asked.map((statement) => `${statement}: ${names.map((name) => `${name} 3`).join(" | ")}`).join("\n");
}

/**
 * The arc plan the fake model writes when a chapter plan asks for one (#1980): ten short chapters, a piece in the fifth
 * and the truth in the last. A test that wants a different arc can script its own reply.
 */
export function fakeArcReply(prompt = ""): string {
  // The arc planner's prompt says which kind it was asked for; a breathing arc is four chapters, no plot.
  const breathing = prompt.includes("BREATHING arc");
  const purposes = Array.from({ length: breathing ? 4 : 10 }, (_, index) =>
    breathing
      ? `A quiet day with someone, the ${index + 1}th of the arc.`
      : `The quay darkens on day ${index + 1} and someone lies about it.`,
  );
  return JSON.stringify({
    kind: breathing ? "breathing" : "story",
    label: "The drowned bell",
    theme: "trust paid for in secrets",
    goal: "The protagonist learns who rang the bell.",
    chapters: purposes,
    endsWith: breathing ? null : { what: "The bell is raised and the one who rang it is named.", chapter: 10 },
    reveals: breathing
      ? []
      : [
          { chapter: 5, kind: "piece", li: "li-kai-ab12", what: "Kai knew it was rung on purpose." },
          { chapter: 10, kind: "truth", what: "The harbour master gave the order." },
        ],
    antagonist: breathing
      ? null
      : { name: "The harbour master", want: "The town stays quiet.", whyNow: "The bell has started again." },
  });
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
    maxContext: options.maxContext === undefined ? 32768 : options.maxContext,
    maxOutputTokens: options.maxOutputTokens === undefined ? 4096 : options.maxOutputTokens,
    async chatComplete(messages, completionOptions) {
      calls.push({ connectionId, messages: structuredClone(messages), options: completionOptions });
      // #1980: the chapter planner now plans its arc first (story/arc.ts). The fake answers that call itself, so every
      // test's scripted replies still line up with the calls it really cares about.
      const arcCall = messages.some((message) => message.content.includes("You are the arc planner"));
      if (arcCall) {
        const prompt = messages.map((message) => message.content).join("\n");
        return { content: (options.arcReply ?? fakeArcReply)(prompt), finishReason: "stop" };
      }
      // #2174: opening a story queues its love interests' quiz answers; the fake answers those calls itself too.
      if (isQuizCall(messages))
        return { content: (options.quizReply ?? fakeQuizReply)(messages), finishReason: "stop" };
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
    ...(options.embeddings ? { embeddings: options.embeddings } : {}),
    // Not in the staging Engine's type yet (capability API 1.818), so it goes in as the host would add it.
    ...((options.embeddingsFor ? { embeddingsFor: options.embeddingsFor } : {}) as object),
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
          return options.admissionRun ? options.admissionRun(operation, mode as { kind: string }) : operation();
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

/** One word's slot in a fake vector (FNV-1a), so texts that share words point the same way. */
function wordSlot(word: string, dimensions: number): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < word.length; index += 1) hash = Math.imul(hash ^ word.charCodeAt(index), 0x01000193);
  return (hash >>> 0) % dimensions;
}

/** A text as the fake embedder sees it: each word (letters and digits, lower case) adds 1 to its slot. */
export function wordVector(text: string, dimensions = 1024): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) vector[wordSlot(word, dimensions)]! += 1;
  return vector;
}

/**
 * A deterministic embedder with the Engine's caps (128 texts, 200k characters: more gives null, as the host does):
 * `vectorOf` (wordVector by default) for each text. Every call is recorded; `fail` makes the next calls throw or give
 * no vectors until it is called with false.
 */
export function createFakeEmbedder({
  spaceId = "fake:words:v1",
  label = "Fake words",
  vectorOf = (text: string) => wordVector(text),
}: { spaceId?: string; label?: string; vectorOf?: (text: string) => number[] } = {}) {
  const calls: Array<{ texts: string[]; inputType?: string }> = [];
  let failing: false | "throw" | "null" = false;
  const host: CapabilityEmbeddingHost = {
    spaceId,
    label,
    async embed(texts, _signal, inputType) {
      calls.push({ texts: [...texts], inputType });
      if (!texts.length || texts.length > 128 || texts.reduce((total, text) => total + text.length, 0) > 200_000) {
        return null;
      }
      if (failing === "throw") throw new Error("FAKE-EMBEDDINGS-DOWN");
      if (failing === "null") return null;
      return texts.map(vectorOf);
    },
  };
  return {
    host,
    calls,
    fail(mode: false | "throw" | "null") {
      failing = mode;
    },
  };
}
