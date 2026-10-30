// Types for the forge-kit modules Otome Forge imports as `@forge-kit/<module>.mjs`. The kit is plain .mjs that Gacha
// Forge pastes into its bundle, so it carries no types; this declares only the surface Otome uses, and grows with each
// milestone.

declare module "@forge-kit/time-zone-server.mjs" {
  /** Wraps a router's get and post so each handler runs in the request's `timeZone` (body for POST, query for GET). */
  export function forgeTimeZoneRoutes<R extends object>(routes: R): R;
  export function forgeValidTimeZone(value: unknown): string;
  /**
   * "YYYY-MM-DD" of the instant in the current request's time zone. It reads Number(value), so an ISO string would read
   * as now: pass Date.parse(iso). The same holds for forgeWallDate and forgeWeekday.
   */
  export function forgeDayKey(value?: number | Date): string;
  /** The instant's wall-clock time in the request's zone, as a Date whose UTC fields read that local time. */
  export function forgeWallDate(value?: number | Date, timeZone?: string): Date;
  /** Monday 0 … Sunday 6, in the request's time zone. */
  export function forgeWeekday(value?: number | Date): number;
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
  /** What a chat reply recalls with: the player's messages since his last reply (cues), the recent window, speakers. */
  export function forgeChatRecallQuery(
    messages: ReadonlyArray<{ who?: string; text?: unknown }>,
    options?: { speakers?: string[] },
  ): { cues: string[]; window: string; speakers: string[] };
}

// ── M3: phone threads ──

declare module "@forge-kit/chat-continuity-server.mjs" {
  /** True while a reply for that thread is being written (in this process). */
  export function forgeChatReplyBusy(runId: string, unitId: string): boolean;
  /** Runs `send` unless a reply for that thread is already in flight, which resolves the busy result instead. */
  export function withForgeChatSend<T>(
    runId: string,
    unitId: string,
    send: () => Promise<T>,
  ): Promise<T | { ok: false; error: "generation-in-progress"; busy: true; retry: false }>;
  /** One page of a thread, newest last; messages inside closed sessions are marked `archived`. */
  export function forgeChatHistoryPage<M extends object>(
    data: { messages?: M[]; sessions?: Array<{ count?: number }> } | null | undefined,
    page: unknown,
    pageSize: number,
    busy?: boolean,
  ): {
    messages: Array<M & { archived: boolean }>;
    page: number;
    pages: number;
    past: number;
    activeCount: number;
    busy: boolean;
    retry: boolean;
  };
}

declare module "@forge-kit/image-avatar-references.mjs" {
  /** The path when it is a local avatar or gallery file the Engine serves, otherwise "". */
  export function forgeLocalAvatarPath(value: unknown): string;
  /** The one actor whose name matches exactly (case-insensitive), or null. */
  export function forgeMatchImageActor<A extends { name?: string; data?: { name?: string } }>(
    cast: A[],
    name: unknown,
  ): A | null;
  export interface ImageIdentitySubject {
    cardId?: string;
    personaId?: string;
    portrait?: string;
    avatarPath?: string;
  }
  export interface ImageIdentityClient {
    characterCard(id: string): Promise<{ avatarPath: string } | null>;
    personaAvatar(id: string): Promise<string>;
    cardAvatarImage(path: string): Promise<{ mime: string; base64: string } | null>;
  }
  /** The default card/persona/avatar identity fallback, shared with Gacha Forge. */
  export function forgeSubjectReference(
    client: ImageIdentityClient,
    subject: ImageIdentitySubject,
  ): Promise<string | null>;
  /**
   * Wraps the client's generatePortrait, generateOutfit and generateBannerArt so each call carries the subject's card
   * or persona avatar (or saved portrait) as `referenceImages`. Needs characterCard, personaAvatar and cardAvatarImage.
   */
  export function forgeWrapImageReferenceClient<C extends object>(
    client: C,
    logger?: { debug?(message: string, ...args: unknown[]): void; warn?(message: string, ...args: unknown[]): void },
    options?: {
      logPrefix?: string;
      subjectReference?: (client: C, subject: ImageIdentitySubject) => Promise<string | null>;
    },
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

// ── M2b: expressions, music briefs and soundtrack settings ──

declare module "@forge-kit/story-expressions-server.mjs" {
  /** Each face's edit look: [the sentence for natural-language prompts, the tags for tag prompts]. */
  export type ForgeExpressionLooks = Record<string, [sentence: string, tags: string]>;
  /** Gacha Forge's four looks (anger, fear, sadness, joy); Otome passes its own five (SH/faces.ts FACE_LOOKS). */
  export const forgeExpressionLooks: ForgeExpressionLooks;
  /** True while the world's expressions setting is on (`images.expressions === true` and images not off). */
  export function forgeStoryExpressionsOn(images: unknown): boolean;
  /** Every base image a unit's art uses: its portrait, each outfit's url, and `extra`. */
  export function forgeStoryExpressionBases(unit: unknown, extra?: readonly string[]): Set<string>;
  /** `{expressions: {face: url}}` for a ready set on `base` while expressions are on, else `{}`. */
  export function forgeStoryExpressionCast(
    images: unknown,
    unit: unknown,
    base: string,
    names?: readonly string[],
  ): { expressions?: Record<string, string> };
  /** The cast entry a line's speaker names (exact name, a protagonist pronoun, then a unique first name), or null. */
  export function forgeStorySpeaker<C extends { name?: string; prota?: boolean }>(
    cast: C[],
    speaker: unknown,
  ): C | null;
  /** The cast entries that speak or think in the beat, its branches, or (the protagonist) a spoken choice. */
  export function forgeStoryExpressionSpeakers<C extends { name?: string; prota?: boolean }>(
    cast: C[],
    beat: unknown,
  ): C[];
  /** The edit prompt that changes only the face of `base` to `expression`. */
  export function forgeStoryExpressionPrompt(
    unit: unknown,
    base: string,
    expression: string,
    profile?: { styleText?: string; positiveTags?: string },
    options?: { tagged?: boolean; negative?: string; looks?: ForgeExpressionLooks },
  ): { prompt: string; negativePrompt: string };
  /** A paid image connection as `connection(run)` resolves it. */
  export interface ForgeExpressionTarget {
    id: string;
    provider?: string;
    model?: string;
  }
  export interface ForgeStoryExpressions {
    repaint(
      runId: string,
      unitId: string,
      base: string,
      prompts?: Record<string, unknown>,
    ): Promise<{ state: "ready" | "failed" | "stopped"; at: string; error?: string } | undefined> | null;
    /** Called with the cast a scene is served or written with; queues the faces in the background, returns the cast. */
    queue<C extends { name?: string; prota?: boolean }>(runId: string, run: unknown, cast: C[], beat: unknown): C[];
    /** Package teardown: queued faces of this instance stop before their paid call. */
    dispose(): void;
  }
  export function createForgeStoryExpressions(options: {
    documents: {
      getById(packageId: string, id: string): Promise<{ id: string; data: unknown } | null>;
      list(packageId: string, kind: string): Promise<Array<{ id: string; data: unknown }>>;
    };
    packageId: string;
    logger: {
      warn(message: string, ...args: unknown[]): void;
      info(message: string, ...args: unknown[]): void;
      debug(message: string, ...args: unknown[]): void;
    };
    readRun(runId: string): Promise<unknown>;
    /** The world's image settings, with `portraitWidth` and `portraitHeight` added (the kit reads both). */
    images(run: unknown): {
      expressions?: boolean;
      expressionsSince?: string;
      styleProfileId?: string;
      portraitWidth: number;
      portraitHeight: number;
      [key: string]: unknown;
    };
    connection(run: unknown): Promise<ForgeExpressionTarget | null>;
    /** The image client: generateExpression, uploadToGallery, deleteGalleryImage, cardAvatarImage, personaAvatar. */
    client(): {
      generateExpression(request: Record<string, unknown>): Promise<{
        overrideTook?: boolean;
        sentPrompt?: string;
        prompt?: string;
        [key: string]: unknown;
      }>;
      uploadToGallery(request: Record<string, unknown>): Promise<{ id: string; url: string }>;
      deleteGalleryImage(id: string): Promise<boolean>;
      cardAvatarImage(path: string): Promise<{ mime: string; base64: string } | null>;
      personaAvatar(personaId: string): Promise<string>;
    };
    /** One paid image at a time per image connection. */
    slot<T>(target: ForgeExpressionTarget, task: () => Promise<T>): Promise<T>;
    dedupe<T>(key: string, task: () => Promise<T>): Promise<T>;
    background<T>(task: () => Promise<T>): Promise<T>;
    /** Applies `change` to the unit document (mutating the copy it is given); resolves the saved unit, or null. */
    update(unitId: string, change: (unit: any) => void): Promise<any>;
    /** The base image a unit's faces are painted from (his worn look, or his portrait). */
    base(unit: any): string;
    galleryRef(id: string): string;
    debug?: () => boolean;
    names?: readonly string[];
    looks?: ForgeExpressionLooks;
    localAvatarPath?: (value: unknown) => string;
    logPrefix?: string;
    scopeName?: string;
  }): ForgeStoryExpressions;
}

declare module "@forge-kit/audio-settings.mjs" {
  export interface ForgeAudioSettings {
    tts: boolean;
    otherVoices: boolean;
    combatVoices: boolean;
    generate: boolean;
    homeMusic: string;
    audioConnectionId: string;
    muted: boolean;
    musicVolume: number;
    dialogueVolume: number;
    sfxVolume: number;
    autoplayPauseSeconds: number;
  }
  export interface ForgeSoundtrackTrack {
    cue: string;
    connectionId: string;
    tag: string;
    path: string;
  }
  /** Every audio setting bounded and defaulted; no provider credentials are ever kept. */
  export function normalizeForgeAudio(value: unknown): ForgeAudioSettings;
  /** The value when it is one of `moods`, else the first. */
  export function normalizeForgeMusicMood<M extends string>(value: unknown, moods?: readonly M[]): M;
  /** Gacha Forge's cues; Otome passes its own (SH/cues.ts). */
  export const forgeSoundtrackCues: string[];
  /** The `context.key` a generated track is stored under: `world-<hash of run and connection>-<cue>`. */
  export function forgeSoundtrackContextKey(runId: string, connectionId: string, cue: string): string;
  /**
   * Validates a generated track's tag and path against `scope` and `cues`, then keeps it in `session.audioTracks`
   * (replacing the same tag). False, with nothing kept, for anything else.
   */
  export function recordForgeSoundtrack(
    session: { audioTracks?: ForgeSoundtrackTrack[]; audioBanners?: Record<string, unknown> },
    runId: string,
    track: unknown,
    options?: { scope?: string; cues?: readonly string[] },
  ): boolean;
  /** The kept tracks whose cue is one of `cues`. */
  export function availableForgeSoundtracks(
    session: { audioTracks?: ForgeSoundtrackTrack[]; audioBanners?: Record<string, unknown> } | null | undefined,
    options?: { cues?: readonly string[] },
  ): Array<ForgeSoundtrackTrack & { title: string }>;
}

declare module "@forge-kit/audio-prompts.mjs" {
  export interface ForgeMusicMessage {
    role: "system" | "user";
    content: string;
  }
  /** `{prompt}` when the reply holds a prompt of at most 1000 characters, else null. */
  export function normalizeForgeMusicPrompt(value: unknown): { prompt: string } | null;
  /** P14: the music brief messages for one cue, in English; `run.scenario` is the world description. */
  export function forgeMusicBriefMessages(
    run: { scenario: string },
    cue: string,
    banner: unknown,
    options?: { scenes?: Record<string, string>; medium?: string },
  ): ForgeMusicMessage[];
  export type ForgeMusicBriefResult =
    | { ok: true; prompt: string; cached: boolean }
    | { ok: false; error: "bad-request" | "not-found" | "generation-failed" | "stale-world" | "write-conflict" };
  /** A brief per cue, cached by its messages' fingerprint in `session.audioPrompts`, one billable call per key. */
  export function createForgeMusicPromptService(options: {
    readWorld(runId: string): Promise<{ scenario: string } | null>;
    readSession(runId: string): Promise<{
      audioPrompts?: Record<string, { fingerprint?: string; prompt?: string; event?: boolean }>;
      audioBanners?: Record<string, unknown>;
    } | null>;
    updateSession(
      runId: string,
      change: (data: { audioPrompts?: Record<string, { fingerprint: string; prompt: string }> }) => void,
    ): Promise<unknown>;
    generate(request: {
      runId: string;
      run: unknown;
      messages: ForgeMusicMessage[];
      debugMode: boolean;
    }): Promise<{ ok: boolean; value?: unknown }>;
    log?: (messages: ForgeMusicMessage[], debugMode: boolean) => void;
    scenes?: Record<string, string>;
    medium?: string;
  }): (request: { runId: string; cue: string; debugMode?: boolean }) => Promise<ForgeMusicBriefResult>;
}
