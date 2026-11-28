import { z } from "zod";

// Compatibility surface owned by Marinara-Agents. The base Engine intentionally
// no longer exports individual game APIs, while package client sources still
// consume their package-owned defaults and public-state types by name.
export * from "./engine/packages/shared/dist/index.js";
export * from "./engine/packages/shared/dist/features/turn-games/uno/types.js";
export * from "./engine/packages/shared/dist/features/turn-games/chess/types.js";
export * from "./engine/packages/shared/dist/features/turn-games/poker/types.js";
export * from "./engine/packages/shared/dist/features/turn-games/eightball/types.js";
export * from "./engine/packages/shared/dist/features/turn-games/tic-tac-toe/types.js";
export * from "./engine/packages/shared/dist/features/turn-games/rock-paper-scissors/types.js";

// Lorebook attachment schema from Engine staging. Drop these exports when the shared snapshot includes them.
/** Max images an entry can carry; the upload route and every writer enforce it. */
export const MAX_LOREBOOK_ENTRY_IMAGES = 4;
/** The only path shape an entry image may have: a server-generated file served by the lorebooks routes. */
export const LOREBOOK_ENTRY_IMAGE_PATH_PATTERN =
  /^\/api\/lorebooks\/entry-images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

export const lorebookEntryImageSchema = z.object({
  path: z.string().regex(LOREBOOK_ENTRY_IMAGE_PATH_PATTERN),
  caption: z.string().max(500).default(""),
});
