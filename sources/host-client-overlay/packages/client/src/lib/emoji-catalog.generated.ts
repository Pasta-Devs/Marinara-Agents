// ──────────────────────────────────────────────
// The Engine's emoji catalog, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// The generated catalog is about 94 KB, and every package with an emoji picker carried its own copy of it. The feature
// build stacks this file over the vendored module, so pickers read the Engine's (`__MARINARA_HOST__.data.emojiCatalog`).
// On an Engine without it the package does not load.
import { requireHostMember } from "./marinara-host-bridge";

export type EmojiCategory = { label: string; icon: string; emojis: readonly string[] };

interface EmojiCatalogModule {
  EMOJI_CATEGORIES: readonly EmojiCategory[];
  EMOJI_SEARCH_NAMES: Readonly<Record<string, string>>;
}

const catalog = requireHostMember<EmojiCatalogModule>("the emoji catalog", (host) => host.data?.emojiCatalog);

export const EMOJI_CATEGORIES = catalog.EMOJI_CATEGORIES;
export const EMOJI_SEARCH_NAMES = catalog.EMOJI_SEARCH_NAMES;
