import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { processLorebooks } from "../../../services/lorebook/index.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { slpLorebookTokenBudget } from "../../modules/prompting/slp-prompt.js";

/** Matching lorebook entries for one generation (post or message), or "". `texts` are scanned oldest first. */
export async function resolveSlurpLoreContext(
  db: DB,
  input: {
    settings: { enableLorebookContext: boolean };
    texts: string[];
    sourceCharacterContext: string;
    source: Pick<SlpAccount, "kind" | "entityId"> | null;
  },
): Promise<string> {
  const { settings, texts, sourceCharacterContext, source: linkedPublicAccount } = input;
  // The Engine's own lorebook scan, as Noodle uses it: off until the player opts in, scoped to this
  // Creator's source, and read-only. Recent posts and the card give keyword entries something to match.
  // Lore is a nicety, so a failed scan costs the reply its lore, never the reply.
  return settings.enableLorebookContext
    ? await processLorebooks(
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
      )
        .then((result) => [result.worldInfoBefore, result.worldInfoAfter].filter(Boolean).join("\n"))
        .catch((error: unknown) => {
          logger.warn(error, "[slurp] Lorebook context failed; generating without it");
          return "";
        })
    : "";
}
