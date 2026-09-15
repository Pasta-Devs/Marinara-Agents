/**
 * Lorebook-backed world context for ad generation.
 *
 * Ads only read as in-world if they advertise things that exist in the world, so a selected
 * lorebook is folded into the generator's world context. The fingerprint lets a changed book
 * resync itself instead of the pool silently describing an older version of the setting.
 */
import { createHash } from "node:crypto";
import type { DB } from "../../db/connection.js";
import { createLorebooksStorage } from "../storage/lorebooks.storage.js";

/** Entries beyond this add cost without adding much setting, and long books blow the prompt. */
const MAX_ENTRIES = 40;
const MAX_ENTRY_CHARS = 600;
const MAX_CONTEXT_CHARS = 6000;

type LorebookContext = { text: string; revision: string; entryCount: number };

/**
 * Read a lorebook as ad world context. Returns null when the book is gone or empty, so a
 * deleted book falls back to the hand-written context rather than failing generation.
 */
export async function readGarnishLorebookContext(db: DB, lorebookId: string): Promise<LorebookContext | null> {
  const lorebooks = createLorebooksStorage(db);
  const book = await lorebooks.getById(lorebookId);
  if (!book) return null;
  // The storage layer spreads its rows through `Record<string, unknown>`, so `name` and
  // `content` survive at runtime but not in the type. Read them as text rather than trusting it.
  const text_ = (value: unknown) => (typeof value === "string" ? value : "");
  const entries = (await lorebooks.listEntries(lorebookId))
    .filter((entry) => entry.enabled !== false && text_((entry as { content?: unknown }).content).trim().length > 0)
    .slice(0, MAX_ENTRIES);
  if (entries.length === 0) return null;

  const lines = entries.map((entry) => {
    const row = entry as { name?: unknown; content?: unknown; keys?: unknown };
    const keys = Array.isArray(row.keys) && row.keys.length > 0 ? ` (${row.keys.join(", ")})` : "";
    return `- ${text_(row.name) || "Untitled"}${keys}: ${text_(row.content).trim().slice(0, MAX_ENTRY_CHARS)}`;
  });
  const bookName = text_((book as { name?: unknown }).name) || "Lorebook";
  const text = [`Setting from the lorebook "${bookName}":`, ...lines].join("\n").slice(0, MAX_CONTEXT_CHARS);
  return {
    text,
    // Hash the content itself rather than a timestamp: it is what actually changes the ads.
    revision: createHash("sha256").update(text).digest("hex").slice(0, 32),
    entryCount: entries.length,
  };
}
