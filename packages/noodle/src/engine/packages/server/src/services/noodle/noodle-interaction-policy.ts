import {
  noodleTextMentionsHandle,
  type NoodleAccount,
  type NoodleInteraction,
  type NoodlePost,
} from "@marinara-engine/shared";

export function canCreateGeneratedNoodleInteraction(input: {
  actor: NoodleAccount;
  targetPost: NoodlePost;
  parentInteraction: NoodleInteraction | null;
  existingInteractions: readonly NoodleInteraction[];
}): boolean {
  const { actor, targetPost, parentInteraction, existingInteractions } = input;
  if (parentInteraction?.actorAccountId === actor.id) return false;

  const actorInteractions = existingInteractions.filter(
    (interaction) => interaction.postId === targetPost.id && interaction.actorAccountId === actor.id,
  );
  if (actorInteractions.length === 0) return true;
  if (noodleTextMentionsHandle(targetPost.content, actor.handle)) return true;
  if (!parentInteraction) return false;
  if (noodleTextMentionsHandle(parentInteraction.content, actor.handle)) return true;

  return actorInteractions.some((interaction) => parentInteraction.parentInteractionId === interaction.id);
}
