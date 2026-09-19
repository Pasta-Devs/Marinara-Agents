import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlpPostCardModel } from "./SlpPostCard";
import { cn } from "../../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  textareaClass,
  SLP_MEDIA_PICKER_TABS,
  SLP_TEXT_MEDIA_PICKER_TABS,
  SlpMentionSuggestions,
  createSlpLightboxImage,
} from "./SlpPostHelpers";
import { SlpToolButton } from "./SlpPostComposerTools";
import { SlpImageComposer } from "../../base/media/SlpImageComposer";
import { SlpAnchoredPopover } from "../../base/chrome/SlpAnchoredPopover";
import { ConversationMediaPickerPanel } from "../../../components/chat/ConversationMediaPickerPanel";
import { ImageIcon, Smile, X } from "lucide-react";

export interface SlpPostReplyComposerProps {
  nested: boolean;
  post: SlpPostCardModel;
  replyParentInteractionId: string | null;
  replyTargetActor: { handle: string } | null;
  replyText: string;
  replyHasText: boolean;
  replyComposerRef: React.RefObject<HTMLTextAreaElement | null>;
  replyValueRef: React.MutableRefObject<string>;
  handleReplyChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  handleReplyKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  setReplyText: React.Dispatch<React.SetStateAction<string>>;
  activeReplyMention: string | null;
  activeReplyMentionIndex: number;
  replyMentionSuggestions: SlpAccount[];
  selectReplyMention: (account: SlpAccount) => void;
  replyImageUrl: string;
  setReplyImageUrl: React.Dispatch<React.SetStateAction<string>>;
  setImageLightbox: React.Dispatch<React.SetStateAction<unknown>>;
  disableReplyImage: boolean;
  activeReplyComposerTool: string | null;
  setActiveReplyComposerTool: React.Dispatch<React.SetStateAction<string | null>>;
  replyImageToolRef: React.RefObject<HTMLDivElement | null>;
  replyMediaToolRef: React.RefObject<HTMLDivElement | null>;
  replyImageFileRef: React.RefObject<HTMLInputElement | null>;
  replyImageUrlDraft: string;
  setReplyImageUrlDraft: React.Dispatch<React.SetStateAction<string>>;
  applyReplyImageUrl: () => void;
  uploadGlobalImages: { isPending: boolean };
  clearReplyComposer: () => void;
  postReplyPending: boolean;
  submitReply: (post: SlpPostCardModel) => void;
  appendToReply: (text: string) => void;
  mediaPickerTab: string;
  personaAccount: SlpAccount | null;
  creatorReplyRequest?: { asked: boolean; setAsked: (value: boolean) => void };
  setMediaPickerTab: React.Dispatch<React.SetStateAction<string>>;
}

export function SlpPostReplyComposer({
  nested,
  post,
  replyParentInteractionId,
  replyTargetActor,
  replyText,
  replyHasText,
  replyComposerRef,
  replyValueRef,
  handleReplyChange,
  handleReplyKeyDown,
  setReplyText,
  activeReplyMention,
  activeReplyMentionIndex,
  replyMentionSuggestions,
  selectReplyMention,
  replyImageUrl,
  setReplyImageUrl,
  setImageLightbox,
  disableReplyImage,
  activeReplyComposerTool,
  setActiveReplyComposerTool,
  replyImageToolRef,
  replyMediaToolRef,
  replyImageFileRef,
  replyImageUrlDraft,
  setReplyImageUrlDraft,
  applyReplyImageUrl,
  uploadGlobalImages,
  clearReplyComposer,
  postReplyPending,
  submitReply,
  appendToReply,
  mediaPickerTab,
  setMediaPickerTab,
  personaAccount,
  creatorReplyRequest,
}: SlpPostReplyComposerProps) {
  const { t: localizeUi } = useUiTranslation();

  return (
    <div
      data-component="NoodleView.ReplyComposer"
      data-noodle-reply-parent-id={replyParentInteractionId ?? ""}
      className={cn("border-[var(--noodle-divider)] py-3", nested ? "ml-10 border-b" : "mt-3 border-y")}
    >
      {replyParentInteractionId && replyTargetActor && (
        <p className="mb-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.noodlepostcard.replyingTo")}{" "}
          <span className="font-semibold text-[var(--noodle-accent)]">@{replyTargetActor.handle}</span>
        </p>
      )}
      <textarea
        ref={replyComposerRef}
        defaultValue={replyText}
        onChange={handleReplyChange}
        onBlur={() => setReplyText(replyValueRef.current)}
        onKeyDown={handleReplyKeyDown}
        className={cn(textareaClass, "min-h-16 resize-none bg-transparent")}
        placeholder={localizeUi("ui.noodle.noodlepostcard.leaveAComment")}
        aria-autocomplete="list"
        aria-controls={activeReplyMention ? "noodle-reply-mention-list" : undefined}
        aria-expanded={Boolean(activeReplyMention)}
        aria-activedescendant={
          activeReplyMention && replyMentionSuggestions.length > 0
            ? `noodle-reply-mention-list-option-${Math.min(
                activeReplyMentionIndex,
                replyMentionSuggestions.length - 1,
              )}`
            : undefined
        }
      />
      <SlpMentionSuggestions
        activeMention={activeReplyMention}
        activeIndex={activeReplyMentionIndex}
        accounts={replyMentionSuggestions}
        listboxId="noodle-reply-mention-list"
        onSelect={selectReplyMention}
      />
      {replyImageUrl && (
        <div className="relative mt-2 overflow-hidden rounded-xl border border-[var(--noodle-divider)]">
          <button
            type="button"
            onClick={() => setImageLightbox(createSlpLightboxImage(`reply-draft-${post.id}`, replyImageUrl))}
            className="block w-full"
            title={localizeUi("ui.noodle.noodlepostcard.openAttachedImage")}
          >
            <img
              src={replyImageUrl}
              alt={localizeUi("ui.noodle.noodlepostcard.attachedReplyPreview")}
              className="max-h-52 w-full object-cover"
            />
          </button>
          <button
            type="button"
            onClick={() => setReplyImageUrl("")}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white [&_svg]:!text-white transition-colors hover:bg-black/80"
            title={localizeUi("ui.noodle.noodlehome.removeImage")}
            aria-label={localizeUi("ui.noodle.noodlepostcard.removeReplyImage")}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {!disableReplyImage && (
            <div ref={replyImageToolRef} className="relative">
              <SlpToolButton
                title={localizeUi("ui.noodle.noodlehome.attachImage")}
                active={activeReplyComposerTool === "image"}
                onClick={() => setActiveReplyComposerTool((current) => (current === "image" ? null : "image"))}
              >
                <ImageIcon size={17} />
              </SlpToolButton>
            </div>
          )}
          <div ref={replyMediaToolRef} className="relative">
            <SlpToolButton
              title={localizeUi("ui.noodle.noodlehome.emojiGifsAndStickers")}
              active={activeReplyComposerTool === "media"}
              onClick={() => setActiveReplyComposerTool((current) => (current === "media" ? null : "media"))}
            >
              <Smile size={17} />
            </SlpToolButton>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {creatorReplyRequest && personaAccount?.id !== post.authorAccountId && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={creatorReplyRequest.asked}
                onChange={(event) => creatorReplyRequest?.setAsked(event.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--noodle-accent)]"
              />
              {localizeUi("ui.noodle.noodlepostcard.askForReply")}
            </label>
          )}
          <button
            type="button"
            onClick={clearReplyComposer}
            className="h-8 rounded-full px-3 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            {localizeUi("chat.delete.dialog.cancel")}
          </button>
          <button
            type="button"
            className="h-8 rounded-full bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!replyHasText || postReplyPending}
            onClick={() => submitReply(post)}
          >
            {postReplyPending
              ? localizeUi("ui.noodle.noodlepostcard.replying")
              : localizeUi("ui.noodle.noodlepostcard.reply")}
          </button>
        </div>
      </div>
      {!disableReplyImage && activeReplyComposerTool === "image" && (
        <SlpAnchoredPopover anchorRef={replyImageToolRef} wide>
          <SlpImageComposer
            imageUrl={replyImageUrlDraft}
            onImageUrlChange={setReplyImageUrlDraft}
            onChooseFile={() => replyImageFileRef.current?.click()}
            onUseImageUrl={applyReplyImageUrl}
            onClose={() => setActiveReplyComposerTool(null)}
            disabled={uploadGlobalImages.isPending}
            hasImage={Boolean(replyImageUrl)}
            fileActionLabel={
              uploadGlobalImages.isPending ? localizeUi("ui.noodle.noodleprofilesurface.uploading") : undefined
            }
          />
        </SlpAnchoredPopover>
      )}
      {activeReplyComposerTool === "media" && (
        <SlpAnchoredPopover anchorRef={replyMediaToolRef} wide>
          <ConversationMediaPickerPanel
            tabs={disableReplyImage ? SLP_TEXT_MEDIA_PICKER_TABS : SLP_MEDIA_PICKER_TABS}
            activeTab={mediaPickerTab}
            onActiveTabChange={setMediaPickerTab}
            onClose={() => setActiveReplyComposerTool(null)}
            onEmojiSelect={appendToReply}
            onGifSelect={(gifUrl) => {
              setReplyImageUrl(gifUrl);
              setActiveReplyComposerTool(null);
            }}
            onStickerSelect={(name) => {
              appendToReply(`sticker:${name}:`);
              setActiveReplyComposerTool(null);
            }}
            className="w-full !border-[var(--marinara-chat-chrome-panel-border)] !bg-[var(--background)] !text-[var(--foreground)] shadow-2xl shadow-black/35"
          />
        </SlpAnchoredPopover>
      )}
    </div>
  );
}
