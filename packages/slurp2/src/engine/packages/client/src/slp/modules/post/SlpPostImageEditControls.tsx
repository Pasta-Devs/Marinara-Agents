import { Crop, ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, type ChangeEvent, type RefObject } from "react";
import type { NoodlePostImageCrop } from "@marinara-engine/shared";
import { readNoodlePostImageCrop } from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { PostImageCropEditor, PostImageFrame } from "../../base/media/SlpPostImageCropEditor";
import { labelClass, type NoodlePostCardModel, type NoodlePostImageUpdate } from "./SlpPostCard";

type NoodlePostImageCropSource =
  | {
      source: File | string;
      crop: NoodlePostImageCrop | null;
      mode: "existing";
    }
  | { source: File; crop: NoodlePostImageCrop | null; mode: "replace" };

interface NoodlePostCardImageEditingCap {
  update: NoodlePostImageUpdate | null;
  cropSource: NoodlePostImageCropSource | null;
  loading: boolean;
  error: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  beginCrop: (post: NoodlePostCardModel) => void;
  selectReplacement: (event: ChangeEvent<HTMLInputElement>) => void;
  applyCrop: (crop: NoodlePostImageCrop) => Promise<void>;
  cancelCrop: () => void;
  remove: () => void;
  restore: () => void;
}

export function PostImageEditControls({
  post,
  editing,
  disabled,
  footer,
}: {
  post: NoodlePostCardModel;
  editing: NoodlePostCardImageEditingCap;
  disabled: boolean;
  footer: React.ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  const replacement = editing.update?.kind === "replace" ? editing.update : null;
  const removed = editing.update?.kind === "remove";
  const hasImage = Boolean(replacement || (!removed && post.imageUrl));

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

  const imageActions =
    hasImage && !removed ? (
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-full bg-[var(--background)] p-1 shadow-lg ring-1 ring-[var(--noodle-divider)]">
        <button
          type="button"
          onClick={() => editing.beginCrop(post)}
          disabled={disabled || editing.loading}
          title={
            editing.loading
              ? localizeUi("ui.noodle.postimageeditcontrols.loadingImage")
              : localizeUi("ui.noodle.noodlehome.adjustCrop")
          }
          aria-label={
            editing.loading
              ? localizeUi("ui.noodle.postimageeditcontrols.loadingImage")
              : localizeUi("ui.noodle.noodlehome.adjustCrop")
          }
          aria-busy={editing.loading}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
        >
          {editing.loading ? <Loader2 size={15} className="animate-spin" /> : <Crop size={15} />}
        </button>
        <button
          type="button"
          onClick={editing.remove}
          disabled={disabled || editing.loading}
          title={localizeUi("ui.noodle.noodlehome.removeImage")}
          aria-label={localizeUi("ui.noodle.noodlehome.removeImage")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10 disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      </div>
    ) : null;

  return (
    <section className="space-y-2 rounded-xl border border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/5 p-3">
      <input
        ref={editing.fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={editing.selectReplacement}
      />
      <div className="flex items-center justify-between gap-3">
        <span className={labelClass}>{localizeUi("ui.noodle.postimageeditcontrols.postImage")}</span>
        <div className="flex items-center gap-1">
          {removed ? (
            <>
              <span className="mr-1 text-xs font-semibold text-[var(--muted-foreground)]">
                {localizeUi("ui.noodle.postimageeditcontrols.removedWhenSaved")}
              </span>
              <button
                type="button"
                onClick={() => editing.fileInputRef.current?.click()}
                disabled={disabled || editing.loading}
                title={localizeUi("ui.noodle.postimageeditcontrols.attachReplacementImage")}
                aria-label={localizeUi("ui.noodle.postimageeditcontrols.attachReplacementImage")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--noodle-divider)] text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
              >
                <ImagePlus size={15} />
              </button>
              <button
                type="button"
                onClick={editing.restore}
                disabled={disabled}
                title={localizeUi("ui.noodle.postimageeditcontrols.undoImageRemoval")}
                aria-label={localizeUi("ui.noodle.postimageeditcontrols.undoImageRemoval")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--noodle-divider)] text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
              >
                <RotateCcw size={15} />
              </button>
            </>
          ) : (
            <>
              {!hasImage && (
                <button
                  type="button"
                  onClick={() => editing.fileInputRef.current?.click()}
                  disabled={disabled || editing.loading}
                  title={localizeUi("ui.noodle.postimageeditcontrols.addImage")}
                  aria-label={localizeUi("ui.noodle.postimageeditcontrols.addImage")}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--noodle-divider)] text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
                >
                  <ImagePlus size={15} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {replacement ? (
        <div className="relative overflow-hidden rounded-lg">
          <FileImagePreview file={replacement.file} crop={replacement.crop} />
          {imageActions}
        </div>
      ) : !removed && post.imageUrl ? (
        <div className="relative overflow-hidden rounded-lg">
          <PostImageFrame
            src={post.imageUrl}
            crop={editing.update?.kind === "crop" ? editing.update.crop : readNoodlePostImageCrop(post.metadata)}
            alt={localizeUi("ui.noodle.postimageeditcontrols.currentPost")}
            maxHeight={240}
          />
          {imageActions}
        </div>
      ) : (
        <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-[var(--noodle-divider)] text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.postimageeditcontrols.noImageAttached")}
        </div>
      )}
      {editing.error && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {editing.error}
        </p>
      )}
      <div className="-mx-3 -mb-3 flex flex-wrap justify-end gap-2 px-3 pb-3 pt-1">{footer}</div>
    </section>
  );
}

function FileImagePreview({ file, crop }: { file: File; crop: NoodlePostImageCrop }) {
  const { t: localizeUi } = useUiTranslation();
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <PostImageFrame
      src={url}
      crop={crop}
      alt={localizeUi("ui.noodle.fileimagepreview.replacementPostPreview")}
      maxHeight={240}
    />
  );
}
