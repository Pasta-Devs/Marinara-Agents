import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { processLorebooks } from "../../../services/lorebook/index.js";
import { createLorebooksStorage } from "../../../services/storage/lorebooks.storage.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlpLoreReport } from "../../../../../shared/src/slp/slp-deep-details.js";
import { slpLorebookTokenBudget } from "../../modules/prompting/slp-prompt.js";

export type SlurpLoreContext = { text: string; report: SlpLoreReport };

/** Entry and book names for the report; a name that cannot be read is shown as its id. */
async function nameEntries(db: DB, ids: readonly string[]): Promise<SlpLoreReport["included"]> {
  const storage = createLorebooksStorage(db);
  const books = new Map<string, string>();
  const named: SlpLoreReport["included"] = [];
  for (const id of ids) {
    const entry = (await storage.getEntry(id).catch(() => null)) as { name?: string; lorebookId?: string } | null;
    const bookId = entry?.lorebookId ?? "";
    if (bookId && !books.has(bookId)) {
      const book = (await storage.getById(bookId).catch(() => null)) as { name?: string } | null;
      books.set(bookId, book?.name ?? bookId);
    }
    named.push({ name: entry?.name || id, book: books.get(bookId) ?? "" });
  }
  return named;
}

/**
 * Matching lorebook entries for one generation (post or message), and a report of what was used.
 * `texts` are scanned oldest first.
 */
export async function resolveSlurpLoreContext(
  db: DB,
  input: {
    settings: { enableLorebookContext: boolean };
    texts: string[];
    sourceCharacterContext: string;
    source: Pick<SlpAccount, "kind" | "entityId"> | null;
  },
): Promise<SlurpLoreContext> {
  const { settings, texts, sourceCharacterContext, source: linkedPublicAccount } = input;
  const empty = { text: "", report: { enabled: settings.enableLorebookContext, included: [], skipped: [] } };
  if (!settings.enableLorebookContext) return empty;
  // The Engine's own lorebook scan, as Noodle uses it: off until the player opts in, scoped to this
  // Creator's source, and read-only. Recent posts and the card give keyword entries something to match.
  // Lore is a nicety, so a failed scan costs the reply its lore, never the reply.
  try {
    const result = await processLorebooks(
      db,
      [
        ...texts.map((content) => ({ role: "user", content })),
        ...(sourceCharacterContext ? [{ role: "user", content: sourceCharacterContext }] : []),
      ],
      null,
      {
        characterIds: linkedPublicAccount?.kind === "character" ? [linkedPublicAccount.entityId] : [],
        personaId: linkedPublicAccount?.kind === "persona" ? linkedPublicAccount.entityId : null,
        tokenBudget: slpLorebookTokenBudget(1),
        generationTriggers: ["slurp"],
        previewOnly: true,
      },
    );
    return {
      // Slurp has no chat to inject into at a depth, so "At Depth" entries join the rest after the
      // world info instead of being dropped without a word.
      text: [result.worldInfoBefore, result.worldInfoAfter, ...result.depthEntries.map((entry) => entry.content)]
        .filter(Boolean)
        .join("\n"),
      report: {
        enabled: true,
        included: await nameEntries(db, result.activatedEntryIds),
        skipped: result.budgetSkippedEntries.map((entry) => ({ name: entry.name, book: entry.lorebookName })),
      },
    };
  } catch (error) {
    logger.warn(error, "[slurp] Lorebook context failed; generating without it");
    return { ...empty, report: { ...empty.report, enabled: true } };
  }
}
