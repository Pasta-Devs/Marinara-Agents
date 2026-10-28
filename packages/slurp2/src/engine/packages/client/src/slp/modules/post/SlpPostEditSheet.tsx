import { useTranslation as useUiTranslation } from "react-i18next";
import { SlpAutoGrowTextarea } from "../../base/ui/SlpAutoGrowTextarea";
import { SlpButton, SlpPrimaryButton } from "../chrome/SlpButton";
import { SlpSheet } from "../chrome/SlpSheet";
import { SlpPollComposer } from "../poll/SlpPollComposer";
import { PostImageEditControls } from "./SlpPostImageEditControls";
import type { SlpPostCardCtx, SlpPostCardModel } from "./SlpPostTypes";

/**
 * Post edit (design step 7): the same full-screen sheet as the composer on phones, a centred modal
 * on wide screens. The picture with labelled Crop / Replace / Remove, the title, a text field that
 * grows with the post, and a sticky Save. The card underneath keeps showing the post as it is.
 */
export function SlpPostEditSheet({
  open,
  post,
  editablePost,
  ctx,
  editingExistingPoll,
  saveEditDisabled,
}: {
  open: boolean;
  post: SlpPostCardModel;
  /** The post as the image controls see it (the card may hide its picture). */
  editablePost: SlpPostCardModel;
  ctx: SlpPostCardCtx;
  editingExistingPoll: boolean;
  saveEditDisabled: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const {
    cancelEditingPost,
    saveEditedPost,
    editingPostContent,
    setEditingPostContent,
    titleEditing,
    imageEditing,
    pollEditing,
    updatePostPending,
  } = ctx;
  const saveLabel = updatePostPending
    ? localizeUi("ui.noodle.noodlehome.saving")
    : localizeUi("ui.noodle.noodlehome.save");
  return (
    <SlpSheet
      open={open}
      onClose={cancelEditingPost}
      closeDisabled={updatePostPending}
      size="full"
      width="max-w-xl"
      title={localizeUi("ui.slurp.post.editTitle", { defaultValue: "Edit post" })}
      footer={
        // A poll edit saves from the poll editor's own button.
        editingExistingPoll ? undefined : (
          <div className="flex items-center justify-end gap-2">
            <SlpButton variant="tertiary" onClick={cancelEditingPost} disabled={updatePostPending}>
              {localizeUi("chat.delete.dialog.cancel")}
            </SlpButton>
            <SlpPrimaryButton onClick={() => saveEditedPost(post)} disabled={saveEditDisabled} className="px-6">
              {saveLabel}
            </SlpPrimaryButton>
          </div>
        )
      }
    >
      <div className="space-y-4 px-2 pb-2 pt-1">
        {imageEditing && (
          <PostImageEditControls post={editablePost} editing={imageEditing} disabled={updatePostPending} />
        )}
        <div className="space-y-1">
          {titleEditing && (
            <label className="block">
              <span className="sr-only">{localizeUi("ui.noodle.noodlepostcard.titleOptional")}</span>
              <input
                value={titleEditing.editingPostTitle}
                onChange={(event) => titleEditing.setEditingPostTitle(event.target.value)}
                maxLength={titleEditing.maxLength}
                className="h-10 w-full border-0 bg-transparent text-[15px] font-bold text-[var(--slurp-text)] outline-none placeholder:text-[var(--slurp-muted)]"
                placeholder={localizeUi("ui.slurp.composer.titlePlaceholder", { defaultValue: "Title (optional)" })}
              />
            </label>
          )}
          <SlpAutoGrowTextarea
            value={editingPostContent}
            onChange={(event) => setEditingPostContent(event.target.value)}
            aria-label={localizeUi("ui.noodle.noodlepostcard.editPost")}
            placeholder={localizeUi("ui.noodle.noodlepostcard.editPost")}
            className="min-h-24 w-full resize-none border-0 bg-transparent py-1 text-base leading-6 text-[var(--slurp-text)] outline-none placeholder:text-[var(--slurp-muted)] sm:text-[15px]"
          />
          {ctx.textAssist && (
            <div className="flex flex-wrap items-center">
              {ctx.textAssist({
                value: editingPostContent,
                onApply: setEditingPostContent,
                accountId: post.authorAccountId,
                story: post.metadata?.noodlerPostType === "story",
              })}
            </div>
          )}
        </div>
        {editingExistingPoll && pollEditing && (
          <SlpPollComposer
            value={pollEditing.value}
            onChange={pollEditing.setValue}
            onClose={cancelEditingPost}
            onSubmit={() => saveEditedPost(post)}
            submitLabel={saveLabel}
            submitDisabled={saveEditDisabled}
            disabled={updatePostPending}
            title={localizeUi("ui.noodle.noodlehome.editPoll")}
            closeLabel={localizeUi("ui.noodle.noodlepostcard.cancelPostEditing")}
            modalOwned
          />
        )}
      </div>
    </SlpSheet>
  );
}
