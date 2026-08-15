import { ImagePlus, Link, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";

export function NoodleImageComposer({
  imageUrl,
  onImageUrlChange,
  onChooseFile,
  onUseImageUrl,
  onClose,
  disabled = false,
  hasImage = false,
  fileActionLabel,
  urlActionLabel,
}: {
  imageUrl: string;
  onImageUrlChange: (value: string) => void;
  onChooseFile: () => void;
  onUseImageUrl: () => void;
  onClose: () => void;
  disabled?: boolean;
  hasImage?: boolean;
  fileActionLabel?: string;
  urlActionLabel?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const resolvedFileActionLabel =
    fileActionLabel ?? localizeUi("ui.noodle.noodlehome.uploadFromDevice");
  const resolvedUrlActionLabel =
    urlActionLabel ?? localizeUi("ui.noodle.noodlehome.attachUrl");
  return (
    <div className="marinara-chat-popover space-y-3 rounded-2xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] px-4 pb-4 pt-2 text-[var(--marinara-chat-chrome-panel-title)] shadow-2xl shadow-black/35">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          {hasImage
            ? localizeUi("ui.noodle.noodleimagecomposer.replaceImage")
            : localizeUi("ui.noodle.noodleimagecomposer.addAnImage")}
        </h2>
        <button
          type="button"
          disabled={disabled}
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--marinara-chat-chrome-panel-muted)] transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg)] hover:text-[var(--marinara-chat-chrome-panel-title)] disabled:opacity-50"
          aria-label={localizeUi(
            "ui.noodle.noodleimagecomposer.closeImagePicker",
          )}
          title={localizeUi("ui.noodle.noodleimagecomposer.closeImagePicker")}
        >
          <X size={20} />
        </button>
      </div>

      <button
        type="button"
        onClick={onChooseFile}
        disabled={disabled}
        style={{ backgroundColor: "var(--noodle-accent)" }}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--noodle-accent)] px-4 text-sm font-bold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ImagePlus size={17} />
        {resolvedFileActionLabel}
      </button>

      <div className="flex items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-normal text-[var(--marinara-chat-chrome-panel-muted)]">
        <span className="h-px flex-1 bg-[var(--noodle-divider)]" />
        {localizeUi("ui.noodle.noodlehome.or")}
        <span className="h-px flex-1 bg-[var(--noodle-divider)]" />
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold">
          {localizeUi("ui.noodle.noodlehome.imageUrl")}
        </span>
        <input
          type="url"
          inputMode="url"
          value={imageUrl}
          maxLength={2000}
          disabled={disabled}
          onChange={(event) => onImageUrlChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && imageUrl.trim() && !disabled) {
              event.preventDefault();
              onUseImageUrl();
            }
          }}
          placeholder={localizeUi(
            "ui.noodle.noodleimagecomposer.httpsExampleComImagePng",
          )}
          className="mari-chrome-field h-10 w-full px-3 text-sm"
        />
      </label>

      <button
        type="button"
        onClick={onUseImageUrl}
        disabled={disabled || !imageUrl.trim()}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--noodle-accent)]/15 px-4 text-sm font-bold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Link size={17} />
        {resolvedUrlActionLabel}
      </button>
    </div>
  );
}
