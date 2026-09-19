import { Fragment } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { canManageSlpReply } from "../../../../../shared/src/slp/slp-interactions.js";
import { type SlpAccount, type SlpInteraction } from "../../../../../shared/src/slp/slp-social.types.js";
import { type SlpPostCardModel } from "./SlpPostCard";
import type { ChatImage } from "../../../hooks/use-gallery";
import { cn } from "../../../lib/utils";
import { Avatar, SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { formatTime } from "../../base/ui/slp-date-time";
import { createSlpLightboxImage, slpCommentActionClass, textareaClass } from "./SlpPostHelpers";
import { SlpTextContent } from "./SlpMarkdownRenderer";

export interface SlpPostReplyRowProps {
  reply: SlpInteraction;
  nested: boolean;
  post: SlpPostCardModel;
  accountById: Map<string, SlpAccount>;
  accountByHandle: Map<string, SlpAccount>;
  personaAccount: SlpAccount | null;
  highlightedInteractionId: string | null;
  openProfile: (account: SlpAccount | null) => void;
  replyPostId: string | null;
  replyParentInteractionId: string | null;
  replyById: Map<string, SlpInteraction>;
  postInteractions: readonly SlpInteraction[];
  editingReplyId: string | null;
  editingReplyContent: string;
  setEditingReplyContent: React.Dispatch<React.SetStateAction<string>>;
  cancelEditingReply: () => void;
  updateInteraction: { isPending: boolean };
  deleteInteraction: { isPending: boolean };
  startEditingReply: (reply: SlpInteraction) => void;
  saveEditedReply: (post: SlpPostCardModel, reply: SlpInteraction) => void;
  deleteNoodleReply: (post: SlpPostCardModel, reply: SlpInteraction) => void;
  canManageReplyOverride?: (reply: SlpInteraction) => boolean;
  reactToReply: (post: SlpPostCardModel, target: SlpInteraction, active: boolean) => void;
  reactionPendingFor: (postId: string, type: "like", parentInteractionId?: string | null) => boolean;
  openReplyComposer: (postId: string, parentInteractionId?: string | null) => void;
  setImageLightbox: React.Dispatch<React.SetStateAction<ChatImage | null>>;
  renderReplyComposer: (nested: boolean) => React.ReactNode;
}

export function SlpPostReplyRow({
  reply,
  nested,
  post,
  accountById,
  accountByHandle,
  personaAccount,
  highlightedInteractionId,
  openProfile,
  replyPostId,
  replyParentInteractionId,
  replyById,
  postInteractions,
  editingReplyId,
  editingReplyContent,
  setEditingReplyContent,
  cancelEditingReply,
  updateInteraction,
  deleteInteraction,
  startEditingReply,
  saveEditedReply,
  deleteNoodleReply,
  canManageReplyOverride,
  reactToReply,
  reactionPendingFor,
  openReplyComposer,
  setImageLightbox,
  renderReplyComposer,
}: SlpPostReplyRowProps) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const actorAccount = accountById.get(reply.actorAccountId) ?? null;
  const actor = actorAccount ?? reply.actorSnapshot;
  const parentReply = reply.parentInteractionId ? (replyById.get(reply.parentInteractionId) ?? null) : null;
  const parentActorAccount = parentReply ? (accountById.get(parentReply.actorAccountId) ?? null) : null;
  const parentActor = parentActorAccount ?? parentReply?.actorSnapshot ?? null;
  const replyLikes = postInteractions.filter(
    (interaction) => interaction.type === "like" && interaction.parentInteractionId === reply.id,
  );
  const likedReplyByPersona = personaAccount
    ? replyLikes.some((interaction) => interaction.actorAccountId === personaAccount.id)
    : false;
  const canManageReply = canManageReplyOverride
    ? canManageReplyOverride(reply)
    : Boolean(
        personaAccount &&
        canManageSlpReply({
          actorKind: actorAccount?.kind ?? reply.actorSnapshot?.kind,
          actorAccountId: reply.actorAccountId,
          personaAccountId: personaAccount.id,
        }),
      );
  return (
    <Fragment key={reply.id}>
      <div
        data-noodle-interaction-id={reply.id}
        tabIndex={-1}
        className={cn(
          "grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-2 border-b border-[var(--noodle-divider)] bg-transparent py-3 text-xs outline-none transition-shadow duration-300 last:border-b-0",
          nested && "border-b-0 py-2",
          highlightedInteractionId === reply.id && "rounded-lg ring-1 ring-inset ring-[var(--noodle-accent)]/70",
        )}
      >
        <button
          type="button"
          onClick={() => openProfile(actorAccount)}
          disabled={!actorAccount}
          className="h-8 w-8 shrink-0 rounded-full text-left transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
          title={
            actorAccount
              ? localizeUi("ui.noodle.noodlehome.viewValue1", {
                  value1: actorAccount.handle,
                })
              : undefined
          }
        >
          <Avatar
            account={
              actor ?? {
                displayName: localizeUi("ui.slurp.profile.fallbackUser"),
                avatarUrl: null,
              }
            }
            size="sm"
          />
        </button>
        <div className="min-w-0 bg-transparent">
          <div
            data-noodle-comment-metadata
            className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[var(--noodle-accent-foreground)]"
          >
            <button
              type="button"
              onClick={() => openProfile(actorAccount)}
              disabled={!actorAccount}
              className="max-w-full truncate font-semibold !text-[var(--foreground)] transition-colors enabled:hover:!text-[var(--noodle-accent)] disabled:cursor-default"
            >
              {actor?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser")}
            </button>
            <span className="truncate !text-[var(--noodle-accent-foreground)]">
              @{actor?.handle ?? localizeUi("ui.slurp.profile.fallbackHandle")}
            </span>
            <span className="!text-[var(--noodle-accent-foreground)] opacity-75">
              · {formatTime(reply.createdAt, i18n.language)}
            </span>
          </div>
          {parentActor && parentReply?.parentInteractionId && (
            <p className="mt-0.5 text-[var(--muted-foreground)]">
              {localizeUi("ui.noodle.noodlepostcard.replyingTo")}{" "}
              {parentActorAccount ? (
                <button
                  type="button"
                  onClick={() => openProfile(parentActorAccount)}
                  className="font-medium text-[var(--noodle-accent)] hover:underline focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70"
                  aria-label={localizeUi("ui.noodle.noodletextcontent.viewValue1Profile", {
                    value1: parentActorAccount.handle,
                  })}
                >
                  @{parentActorAccount.handle}
                </button>
              ) : (
                <span className="text-[var(--noodle-accent)]">@{parentActor.handle}</span>
              )}
            </p>
          )}
          {editingReplyId === reply.id ? (
            <div className="mt-2 space-y-2" data-component="NoodleView.CommentEditor">
              <textarea
                value={editingReplyContent}
                onChange={(event) => setEditingReplyContent(event.target.value)}
                className={cn(textareaClass, "min-h-20 resize-y")}
                placeholder={localizeUi("ui.noodle.noodlepostcard.editComment")}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEditingReply}
                  disabled={updateInteraction.isPending}
                  className="h-8 rounded-full px-3 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70 disabled:opacity-50"
                >
                  {localizeUi("chat.delete.dialog.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => saveEditedReply(post, reply)}
                  disabled={(!editingReplyContent.trim() && !reply.imageUrl) || updateInteraction.isPending}
                  className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updateInteraction.isPending
                    ? localizeUi("ui.noodle.noodlehome.saving")
                    : localizeUi("ui.noodle.noodlehome.save")}
                </button>
              </div>
            </div>
          ) : reply.content ? (
            <SlpTextContent
              content={reply.content}
              accountByHandle={accountByHandle}
              onOpenProfile={openProfile}
              className="mt-1 leading-5"
            />
          ) : null}
          {reply.imageUrl && (
            <button
              type="button"
              onClick={() => setImageLightbox(createSlpLightboxImage(reply.id, reply.imageUrl!, reply.content ?? ""))}
              className="mt-2 block w-full overflow-hidden rounded-xl text-left ring-offset-[var(--background)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2"
              title={localizeUi("ui.noodle.noodlepostcard.openImage")}
              aria-label={localizeUi("ui.noodle.noodlepostcard.openCommentImage")}
            >
              <SlurpMediaImg
                src={reply.imageUrl}
                alt={localizeUi("ui.noodle.noodlepostcard.imageInValue1SComment", {
                  value1: actor?.displayName ?? localizeUi("ui.slurp.profile.fallbackUser"),
                })}
                className="max-h-72 w-full object-cover"
              />
            </button>
          )}
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => reactToReply(post, reply, likedReplyByPersona)}
              disabled={!personaAccount || reactionPendingFor(post.id, "like", reply.id)}
              className={cn(
                slpCommentActionClass,
                "px-2 font-medium",
                likedReplyByPersona && "bg-[var(--noodle-accent)]/10",
              )}
              title={
                likedReplyByPersona
                  ? localizeUi("ui.noodle.noodlepostcard.unlikeComment")
                  : localizeUi("ui.noodle.noodlepostcard.likeComment")
              }
              aria-busy={reactionPendingFor(post.id, "like", reply.id)}
            >
              <Heart
                size={14}
                fill={likedReplyByPersona ? "currentColor" : "none"}
                strokeWidth={likedReplyByPersona ? 2.4 : 2}
                className={cn(
                  "transition-[fill,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  likedReplyByPersona && "scale-110",
                )}
              />
              {replyLikes.length > 0 && replyLikes.length}
            </button>
            <button
              type="button"
              onClick={() => openReplyComposer(post.id, reply.id)}
              disabled={!personaAccount}
              className={cn(slpCommentActionClass, "w-7")}
              title={localizeUi("ui.noodle.noodlepostcard.reply")}
              aria-label={localizeUi("ui.noodle.noodlepostcard.reply")}
            >
              <MessageCircle size={14} />
            </button>
            {canManageReply && editingReplyId !== reply.id && (
              <>
                <button
                  type="button"
                  onClick={() => startEditingReply(reply)}
                  disabled={updateInteraction.isPending || deleteInteraction.isPending}
                  className={cn(slpCommentActionClass, "w-7")}
                  title={localizeUi("ui.noodle.noodlepostcard.editComment")}
                  aria-label={localizeUi("ui.noodle.noodlepostcard.editComment")}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteNoodleReply(post, reply)}
                  disabled={updateInteraction.isPending || deleteInteraction.isPending}
                  className={cn(slpCommentActionClass, "w-7")}
                  title={localizeUi("ui.noodle.noodlepostcard.deleteComment")}
                  aria-label={localizeUi("ui.noodle.noodlepostcard.deleteComment")}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {replyPostId === post.id && replyParentInteractionId === reply.id && renderReplyComposer(true)}
    </Fragment>
  );
}
