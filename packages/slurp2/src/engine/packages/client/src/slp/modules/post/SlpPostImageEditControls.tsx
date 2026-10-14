import { Crop, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { SlpButton } from "../chrome/SlpButton";
import { useEffect, useMemo, type ChangeEvent, type RefObject } from "react";
import type { SlpPostImageCrop } from "../../../../../shared/src/slp/slp-social.types.js";
import { readSlpPostImageCrop } from "../../../../../shared/src/slp/slp-post-images.js";
import { useTranslation as useUiTranslation } from "react-i18next";
import { PostImageCropEditor, PostImageFrame } from "../../base/media/SlpPostImageCropEditor";
import { slpImageFileAccept } from "../../base/media/slp-media-accept";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import type { SlpPostCardModel, SlpPostImageUpdate } from "./SlpPostTypes";
import { SlpPostImageNav } from "./SlpPostImageNav";

type SlpPostImageCropSource =
  | {
      source: File | string;
      crop: SlpPostImageCrop | null;
      mode: "existing";
    }
  | { source: File; crop: SlpPostImageCrop | null; mode: "replace" };

interface SlpPostCardImageEditingCap {
  update: SlpPostImageUpdate | null;
  cropSource: SlpPostImageCropSource | null;
  loading: boolean;
  error: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  beginCrop: (post: SlpPostCardModel) => void;
  position: number;
  choosePosition: (position: number) => void;
  selectReplacement: (event: ChangeEvent<HTMLInputElement>) => void;
  applyCrop: (crop: SlpPostImageCrop) => Promise<void>;
  cancelCrop: () => void;
  remove: () => void;
  restore: () => void;
}

/**
 * The post picture in the edit sheet (design step 7): the picture, then labelled Crop · Replace ·
 * Remove. Remove is one tap and the toast offers Undo; the change is only sent on Save.
 */
export function PostImageEditControls({
  post,
  editing,
  disabled,
}: {
  post: SlpPostCardModel;
  editing: SlpPostCardImageEditingCap;
  disabled: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const replacement = editing.update?.kind === "replace" ? editing.update : null;
  const removed = editing.update?.kind === "remove";
  const hasImage = Boolean(replacement || (!removed && post.imageUrl));
  const busy = disabled || editing.loading;
  // Crop and Replace act on the picture on screen; a set steps through its pictures (R1-039).
  const pictures = post.images.length > 1 ? post.images : [];
  const index = Math.max(
    0,
    pictures.findIndex((image) => image.position === editing.position),
  );
  const picture = pictures[index];
  const shownUrl = picture?.imageUrl ?? post.imageUrl;
  const shownCrop =
    editing.update?.kind === "crop"
      ? editing.update.crop
      : picture && picture.position > 0
        ? (picture.crop ?? null)
        : readSlpPostImageCrop(post.metadata);
  const pending = Boolean(editing.update && editing.update.kind !== "remove");

  if (editing.cropSource) {
    return (
      <PostImageCropEditor
        source={editing.cropSource.source}
        crop={editing.cropSource.crop}
        disabled={disabled}
        onCancel={editing.cancelCrop}
        onApply={editing.applyCrop}
      />
    );
  }

  const remove = () => {
    // Remove takes the whole set (R1-051), so a set says so.
    const removedNote =
      pictures.length > 1
        ? localizeUi("ui.slurp.composer.setRemovedOnSave", {
            defaultValue: "All {{count}} pictures removed when you save",
            count: pictures.length,
          })
        : localizeUi("ui.slurp.composer.imageRemovedOnSave", { defaultValue: "Picture removed when you save" });
    editing.remove();
    toast(removedNote, {
      action: {
        label: localizeUi("ui.slurp.wallet.undo", { defaultValue: "Undo" }),
        onClick: () => editing.restore(),
      },
    });
  };
  const chooseFile = () => editing.fileInputRef.current?.click();

  return (
    <section className="space-y-2" aria-label={localizeUi("ui.noodle.postimageeditcontrols.postImage")}>
      <input
        ref={editing.fileInputRef}
        type="file"
        accept={slpImageFileAccept()}
        className="hidden"
        onChange={editing.selectReplacement}
      />
      {replacement ? (
        <FileImagePreview file={replacement.file} crop={replacement.crop} />
      ) : hasImage && shownUrl ? (
        <div className="relative">
          <PostImageFrame
            src={shownUrl}
            crop={shownCrop}
            alt={localizeUi("ui.noodle.postimageeditcontrols.currentPost")}
            maxHeight={320}
          />
          {!pending && pictures.length > 1 && (
            <SlpPostImageNav
              total={pictures.length}
              index={index}
              onSelect={(next) => editing.choosePosition(pictures[next]!.position)}
            />
          )}
        </div>
      ) : (
        <div className="grid min-h-32 place-items-center rounded-2xl bg-[var(--slurp-surface-raised)] p-4 text-center shadow-[var(--slurp-highlight)] ring-1 ring-inset ring-[var(--noodle-divider)]">
          <div className="space-y-3">
            <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
              {removed
                ? localizeUi("ui.noodle.postimageeditcontrols.removedWhenSaved")
                : localizeUi("ui.noodle.postimageeditcontrols.noImageAttached")}
            </p>
            <SlpButton variant="secondary" disabled={busy} onClick={chooseFile} className="min-h-10 px-4 text-[13px]">
              <ImagePlus size={16} aria-hidden="true" />
              {localizeUi("ui.noodle.postimageeditcontrols.addImage")}
            </SlpButton>
          </div>
        </div>
      )}
      {hasImage && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <SlpButton
            variant="quiet"
            disabled={busy}
            aria-busy={editing.loading}
            onClick={() => editing.beginCrop(post)}
            className="min-h-10 px-4 text-[13px]"
          >
            {editing.loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Crop size={16} aria-hidden="true" />
            )}
            {editing.loading
              ? localizeUi("ui.noodle.postimageeditcontrols.loadingImage")
              : localizeUi("ui.slurp.composer.crop", { defaultValue: "Crop" })}
          </SlpButton>
          <SlpButton variant="quiet" disabled={busy} onClick={chooseFile} className="min-h-10 px-4 text-[13px]">
            <ImagePlus size={16} aria-hidden="true" />
            {localizeUi("ui.slurp.composer.replace", { defaultValue: "Replace" })}
          </SlpButton>
          <SlpButton variant="danger" disabled={busy} onClick={remove} className="min-h-10 px-4 text-[13px]">
            <Trash2 size={16} aria-hidden="true" />
            {localizeUi("ui.slurp.composer.remove", { defaultValue: "Remove" })}
          </SlpButton>
        </div>
      )}
      {pending && pictures.length > 1 && (
        <p className={cn(SLP_TYPE.meta, "text-center text-[var(--slurp-muted)]")}>
          {localizeUi("ui.slurp.post.editOnePicture", {
            defaultValue: "Picture {{number}} of {{total}}. Save to change another one.",
            number: index + 1,
            total: pictures.length,
          })}
        </p>
      )}
      {editing.error && (
        <p role="alert" className="text-xs text-[var(--slurp-danger)]">
          {editing.error}
        </p>
      )}
    </section>
  );
}

function FileImagePreview({ file, crop }: { file: File; crop: SlpPostImageCrop }) {
  const { t: localizeUi } = useUiTranslation();
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <PostImageFrame
      src={url}
      crop={crop}
      alt={localizeUi("ui.noodle.fileimagepreview.replacementPostPreview")}
      maxHeight={320}
    />
  );
}
