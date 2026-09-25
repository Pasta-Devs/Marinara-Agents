import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { processLorebooks } from "../../../services/lorebook/index.js";
import type { SlpAccount, SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";
import { slpLorebookTokenBudget } from "../../modules/prompting/slp-prompt.js";

/** Matching lorebook entries for one post, or "". Split from the generator to keep it under size. */
export async function resolveSlurpPostLore(
  db: DB,
  input: {
    settings: { enableLorebookContext: boolean };
    recentPosts: Pick<SlpCreatorManagedPost, "content">[];
    sourceCharacterContext: string;
    source: Pick<SlpAccount, "kind" | "entityId"> | null;
  },
): Promise<string> {
  const { settings, recentPosts, sourceCharacterContext, source: linkedPublicAccount } = input;
  // The Engine's own lorebook scan, as Noodle uses it: off until the player opts in, scoped to this
  // Creator's source, and read-only. Recent posts and the card give keyword entries something to match.
  // Lore is a nicety, so a failed scan costs the post its lore, never the post.
  return settings.enableLorebookContext
    ? await processLorebooks(
        db,
        [
          ...recentPosts
            .slice()
            .reverse()
            .map((post) => ({ role: "user", content: post.content })),
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
          logger.warn(error, "[slurp] Lorebook context failed; generating the post without it");
          return "";
        })
    : "";
}
