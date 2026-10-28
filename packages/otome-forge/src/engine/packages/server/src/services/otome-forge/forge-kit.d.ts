// Types for the forge-kit modules Otome Forge imports as `@forge-kit/<module>.mjs`. The kit is plain .mjs that Gacha
// Forge pastes into its bundle, so it carries no types; this declares only the surface Otome uses, and grows with each
// milestone.

declare module "@forge-kit/time-zone-server.mjs" {
  /** Wraps a router's get and post so each handler runs in the request's `timeZone` (body for POST, query for GET). */
  export function forgeTimeZoneRoutes<R extends object>(routes: R): R;
  export function forgeValidTimeZone(value: unknown): string;
  /** "YYYY-MM-DD" of the instant in the current request's time zone. */
  export function forgeDayKey(value?: number | string | Date): string;
}

declare module "@forge-kit/character-card-context.mjs" {
  export interface ForgeCardCanon {
    description: string;
    personality: string;
    backstory: string;
    appearance: string;
  }
  /** Copies of `units` with `forgeCardCanon` read fresh from each linked card; prompt input only, never saved. */
  export function forgeHydrateStoryCharacters<U extends object>(
    units: U[],
    readCard: (cardId: string) => Promise<unknown>,
    logger?: { warn?(message: string, ...args: unknown[]): void },
  ): Promise<Array<U & { forgeCardCanon?: ForgeCardCanon }>>;
  /** "CANONICAL CHARACTER CARD — …" with the card's authored fields, or "" without a card. */
  export function forgeFormatCharacterCardReference(card: unknown, name?: string): string;
  export function logForgeStoryPrompt(
    runtime: unknown,
    label: string,
    messages: unknown,
    options?: { debugMode?: boolean; logPrefix?: string },
  ): void;
}

declare module "@forge-kit/shared-token-estimator.mjs" {
  /** Tokens in `text`, estimated per code point (CJK and Hangul count more than Latin). */
  export function estimateTextTokens(text: string): number;
  /** The longest start (or, with `fromEnd`, end) of `text` that fits `tokenBudget`. */
  export function sliceTextToTokenBudget(text: string, tokenBudget: number, fromEnd?: boolean): string;
}

declare module "@forge-kit/story-memory-integration.mjs" {
  /** Goes verbatim into the system message of every prompt that writes story or his words. */
  export const forgeKnowledgeBoundary: string;
  /** Re-orders side stories opened after the same main chapter by when they opened; other sources keep their place. */
  export function orderForgeStorySources<S extends { kind: string; id: string }>(rows: S[]): S[];
}

declare module "@forge-kit/image-avatar-references.mjs" {
  /** The path when it is a local avatar or gallery file the Engine serves, otherwise "". */
  export function forgeLocalAvatarPath(value: unknown): string;
  /** The one actor whose name matches exactly (case-insensitive), or null. */
  export function forgeMatchImageActor<A extends { name?: string; data?: { name?: string } }>(
    cast: A[],
    name: unknown,
  ): A | null;
  /**
   * Wraps the client's generatePortrait, generateOutfit and generateBannerArt so each call carries the subject's card
   * or persona avatar (or saved portrait) as `referenceImages`. Needs characterCard, personaAvatar and cardAvatarImage.
   */
  export function forgeWrapImageReferenceClient<C extends object>(
    client: C,
    logger?: { debug?(message: string, ...args: unknown[]): void; warn?(message: string, ...args: unknown[]): void },
  ): C;
}

// ── M2a: choices, canon, faces, cancel and story memory ──

declare module "@forge-kit/player-choice-text.mjs" {
  /** The label with terminal punctuation for its script ("." or "。") unless it already ends a sentence. */
  export function forgeChoiceLabel(value: unknown): string;
}

declare module "@forge-kit/player-choices-server.mjs" {
  export interface KitMessage {
    role: "system" | "user" | "assistant";
    content: string;
  }
  export interface KitSegment {
    speaker: string;
    text: string;
    thought?: boolean;
    place?: string;
    gender?: string;
  }
  export interface KitChoiceOption<S extends KitSegment = KitSegment> {
    id: string;
    text: string;
    selection: { kind: "dialogue" | "action"; text: string };
    segments: S[];
  }
  export interface KitChoice<S extends KitSegment = KitSegment> {
    id: string;
    kind: "small" | "big";
    at: number;
    options: Array<KitChoiceOption<S>>;
  }
  /** A beat the choice functions read: its mainline, choices and first-play picks. */
  export interface KitChoiceBeat<S extends KitSegment = KitSegment> {
    segments: S[];
    choices?: Array<KitChoice<S>>;
    choiceCanon?: Record<string, string>;
    /** Who speaks a "dialogue" selection in the canonical text. */
    choiceProtagonist?: string;
  }
  /** Appends PLAYER AGENCY to the planner's system message (a copy) when `enabled`. */
  export function forgeChoicePlanMessages<M extends KitMessage>(messages: M[], enabled: boolean): M[];
  /**
   * Replaces the narrator's "NEVER offer choices; the player only advances. Do not ask the player to pick anything."
   * sentence and appends PLAYER CHOICES (big choices only when `terminal`). Otome never passes `audio`.
   */
  export function forgeChoiceMessages<M extends KitMessage>(
    messages: M[],
    options: { enabled: boolean; terminal: boolean; event?: string },
  ): M[];
  /**
   * Validates the reply's `choices` around `normalizeBeat` (called for the mainline and again for each branch, with
   * `{...options, start, cgOpen: false}`); ids are `choice-<n>`/`option-<n>` from their places in the reply, and unknown
   * option fields are dropped. Null when anything is invalid.
   */
  export function forgeNormalizeChoiceBeat<
    O extends object,
    B extends { segments: KitSegment[]; places: Array<{ name: string }> },
  >(
    raw: unknown,
    options: O,
    normalizeBeat: (raw: unknown, options: O) => B | null,
    settings: { enabled: boolean; terminal: boolean; label?: (text: string) => string },
  ): (B & { choices?: KitChoice[] }) | null;
  /** Writes each speaker's `gender` from the reply's `voices` onto the segments (in place) and returns them. */
  export function forgeSpeakerGenders<S extends KitSegment>(raw: unknown, segments: S[]): S[];
  /** The first choice (of `kind`, when given) with no first-play pick, or undefined. */
  export function forgePendingChoice<S extends KitSegment>(
    beat: KitChoiceBeat<S>,
    kind?: "small" | "big",
  ): KitChoice<S> | undefined;
  /** The mainline with each picked option's marker, selection and branch spliced in; null while a big choice waits. */
  export function forgeCanonicalSegments<S extends KitSegment>(beat: KitChoiceBeat<S>): KitSegment[] | null;
}

declare module "@forge-kit/story-expressions.mjs" {
  /** The value when it is one of `names`, otherwise "". */
  export function normalizeForgeStoryExpression(value: unknown, names?: readonly string[]): string;
}

declare module "@forge-kit/story-cancel-server.mjs" {
  export type ForgeCancelled = { ok: false; error: "cancelled" | "bad-request" | "reset-in-progress" };
  export interface ForgeStoryCancellation {
    /** Runs `operation` with the run's abort signal; a Cancel while it runs resolves `{ok:false, error:"cancelled"}`. */
    run<T>(runId: string, operation: (signal: AbortSignal) => Promise<T>): Promise<T | ForgeCancelled>;
    /** A committed write (a choice, a completion) that Cancel never interrupts. */
    mutate<T>(runId: string, operation: () => Promise<T>): Promise<T | ForgeCancelled>;
    /** Aborts the run's running generations; false when none was ever started. */
    cancel(runId: string): boolean;
    dispose(): void;
  }
  export function createForgeStoryCancellation(options?: { resetDrainTimeoutMs?: number }): ForgeStoryCancellation;
  /** Throws an AbortError when the current run scope was cancelled (no-op outside one). */
  export function forgeStoryAssertActive(): void;
  export function forgeStoryGenerationSignal(): AbortSignal | undefined;
}

declare module "@forge-kit/story-memory.mjs" {
  export type ForgeMemoryJob = "structured" | "narration" | "chat" | "compress";
  /** One canonical source of memory, as a package's reader returns it. */
  export interface ForgeMemorySource {
    id: string;
    kind: "chapter" | "character-story" | "story-event" | "chat";
    title: string;
    content: string;
    order: number;
    /** Who may recall it: a `chat` source only for these ids' own readers and scenes they are in. */
    audience?: string[];
    opening?: { after: number; opened: number };
  }
  export interface ForgeMemoryStatus {
    phase: "stale" | "pending" | "ready" | "error" | "context-unknown";
    retryable: boolean;
    reason?: string;
    recordCount?: number;
    [key: string]: unknown;
  }
  export interface ForgeRecallOptions {
    runId: string;
    job: ForgeMemoryJob;
    connectionId?: string;
    /** A private reader (one LI's own chat): only his `chat` and `character-story` sources. */
    reader?: string;
    /** The LIs present: `chat` sources only when one of them is in their audience. */
    cast?: string[];
    query?: unknown;
    target?: unknown;
    listed?: string[];
    excludeChapterIds?: string[];
    signal?: AbortSignal;
  }
  export interface ForgeRecallResult {
    status: ForgeMemoryStatus;
    budget?: number | null;
    maxContext?: number | null;
    overview: string;
    details: Array<{ id: string; kind: string; title: string; content: string }>;
    /** Required recent canon: summaries the overview misses, and the latest chapter (`latest: true`, sent in full). */
    recent?: Array<{ id: string; kind: string; title: string; content?: string; summary?: boolean; latest?: boolean }>;
    lagging?: boolean;
    text: string;
  }
  export interface ForgeStoryMemory {
    maintain(options: {
      runId: string;
      target?: unknown;
      job?: ForgeMemoryJob;
      connectionId?: string;
      debugMode?: boolean;
    }): Promise<unknown>;
    recall(options: ForgeRecallOptions): Promise<ForgeRecallResult>;
    status(runId: string): Promise<ForgeMemoryStatus>;
    invalidate(runId: string): void;
  }
  export function createForgeStoryMemory(options: {
    readMemory(runId: string): Promise<{ data: unknown; revision: number | null } | null>;
    updateMemory(runId: string, write: { expectedRevision: number | null; data: unknown }): Promise<boolean>;
    readSources(runId: string, target?: unknown): Promise<ForgeMemorySource[]>;
    orderSources?: (sources: ForgeMemorySource[]) => ForgeMemorySource[];
    resolveContext(
      runId: string,
      options: { job?: ForgeMemoryJob; connectionId?: string },
    ): Promise<{ maxContext: number | null; [key: string]: unknown }>;
    summarize(request: {
      runId: string;
      kind: string;
      messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
      tokenBudget?: number;
      job?: ForgeMemoryJob;
      connectionId?: string;
      debugMode?: boolean;
      signal?: AbortSignal;
    }): Promise<string>;
    fitsSummary?: (request: unknown) => boolean | Promise<boolean>;
    estimateTokens(text: string): number;
    resolveEmbeddings?: (runId: string) => Promise<unknown>;
    log?: (error: unknown) => void;
  }): ForgeStoryMemory;
  /** What recall searches with: cues (latest last), a recent window, plan text and the speakers' names. */
  export function forgeRecallQuery(value: unknown): {
    cues: string[];
    window: string;
    plan: string;
    speakers: string[];
  };
}
