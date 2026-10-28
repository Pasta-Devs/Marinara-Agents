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
