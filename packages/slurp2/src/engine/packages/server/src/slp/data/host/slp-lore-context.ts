import { lorebookEntryImageSchema, MAX_LOREBOOK_ENTRY_IMAGES } from "@marinara-engine/shared";
import type { DB } from "../../../db/connection.js";
import { inArray } from "../../../db/file-query.js";
import { lorebookEntries } from "../../../db/schema/index.js";
import { logger } from "../../../lib/logger.js";
import { readLorebookReferenceImages } from "../../../services/generation/lorebook-image-prompt.js";
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
    const result = await scanSlurpLorebooks(db, [...texts, sourceCharacterContext], linkedPublicAccount);
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

function scanSlurpLorebooks(db: DB, texts: string[], source: Pick<SlpAccount, "kind" | "entityId"> | null) {
  return processLorebooks(
    db,
    texts.filter(Boolean).map((content) => ({ role: "user", content })),
    null,
    {
      characterIds: source?.kind === "character" ? [source.entityId] : [],
      personaId: source?.kind === "persona" ? source.entityId : null,
      tokenBudget: slpLorebookTokenBudget(1),
      generationTriggers: ["slurp"],
      previewOnly: true,
    },
  );
}

export async function resolveSlurpLoreImageReferences(
  db: DB,
  input: {
    enabled: boolean;
    source: Pick<SlpAccount, "kind" | "entityId"> | null;
    texts: string[];
    prompt: string;
    referenceImages?: string[];
    redactIdentity?: (value: string) => string;
  },
): Promise<{ prompt: string; referenceImages?: string[] }> {
  const { prompt, referenceImages } = input;
  const unchanged = { prompt, referenceImages };
  const room = 6 - (referenceImages?.length ?? 0);
  if (!input.enabled || room <= 0) return unchanged;
  try {
    const result = await scanSlurpLorebooks(db, input.texts, input.source);
    if (!result.activatedEntryIds.length) return unchanged;

    // ponytail: hydrate attachments from the live rows until the vendored scan reports images.
    // Read only entries the scan admitted.
    const rows = await db.select().from(lorebookEntries).where(inArray(lorebookEntries.id, result.activatedEntryIds));
    const entriesById = new Map(rows.map((row) => [row.id, row]));
    const entries = result.activatedEntryIds.flatMap((id) => {
      const row = entriesById.get(id);
      if (!row || row.position === 7 || !("images" in row) || typeof row.images !== "string") return [];
      try {
        const value: unknown = JSON.parse(row.images);
        const images = lorebookEntryImageSchema.array().max(MAX_LOREBOOK_ENTRY_IMAGES).safeParse(value);
        return images.success
          ? [{ id, name: row.name, content: row.content, position: row.position, images: images.data }]
          : [];
      } catch {
        return [];
      }
    });
    const references = await readLorebookReferenceImages(entries, room);
    if (references.referenceLine) {
      const guidance = input.redactIdentity?.(references.referenceLine) ?? references.referenceLine;
      return {
        prompt: `${prompt}\n\n${guidance}`,
        referenceImages: [...(referenceImages ?? []), ...references.images],
      };
    }
  } catch (error) {
    logger.warn(error, "[slurp] Lorebook image references failed; generating without them");
  }
  return unchanged;
}
