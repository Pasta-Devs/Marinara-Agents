import { slpTextMentionsHandle } from "../../../../../shared/src/slp/slp-mentions.js";
import { type SlpAccount, type SlpInteraction, type SlpPost } from "../../../../../shared/src/slp/slp-social.types.js";

export function canCreateGeneratedSlpInteraction(input: {
  actor: SlpAccount;
  targetPost: SlpPost;
  parentInteraction: SlpInteraction | null;
  existingInteractions: readonly SlpInteraction[];
}): boolean {
  const { actor, targetPost, parentInteraction, existingInteractions } = input;
  if (parentInteraction?.actorAccountId === actor.id) return false;

  const actorInteractions = existingInteractions.filter(
    (interaction) => interaction.postId === targetPost.id && interaction.actorAccountId === actor.id,
  );
  if (actorInteractions.length === 0) return true;
  if (slpTextMentionsHandle(targetPost.content, actor.handle)) return true;
  if (!parentInteraction) return false;
  if (slpTextMentionsHandle(parentInteraction.content, actor.handle)) return true;

  return actorInteractions.some((interaction) => parentInteraction.parentInteractionId === interaction.id);
}
