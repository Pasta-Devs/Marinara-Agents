// ──────────────────────────────────────────────
// Otome Forge: one Album image, large. Previous and Next (and the arrow keys) step through the gallery; Save sends the
// file to the device through the Engine's own image saving (lib/image-download.ts, the iPhone share sheet included).
// A Photo Shoot photo (#2087) can also be deleted: the dialog asks first in place of its own text, so no second
// dialog opens over it.
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Download, Trash2, X } from "lucide-react";
import { Dialog } from "../../components/Dialog";
import { imageFilename, useImageDownload } from "../../lib/image-download";
import { useOtomeProps } from "../../props";
import type { RunView } from "../../shared/api-types";
import type { AlbumImage } from "../../shared/wardrobe";

const SOURCE_KEYS: Record<AlbumImage["source"], string> = {
  story: "ui.otomeForge.album.sourceStory",
  memory: "ui.otomeForge.album.sourceMemory",
  pair: "ui.otomeForge.album.sourcePair",
  sticker: "ui.otomeForge.album.sourceSticker",
  photo: "ui.otomeForge.album.sourcePhoto",
};

interface CgViewerProps {
  view: RunView;
  images: AlbumImage[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  /** Offers Delete for the image shown (a photo); resolves once it is deleted, and throws when it was not. */
  onDelete?: (image: AlbumImage) => Promise<void>;
}

/** "When" for a timestamp, in the player's language and time zone. */
export function useFormatAt() {
  const { localization, timeZone } = useOtomeProps();
  return (at: string) => {
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return "";
    try {
      return new Intl.DateTimeFormat(localization.locale, { dateStyle: "medium", timeZone }).format(date);
    } catch {
      return new Intl.DateTimeFormat(localization.locale, { dateStyle: "medium" }).format(date);
    }
  };
}

export function CgViewer({ view, images, index, onIndex, onClose, onDelete }: CgViewerProps) {
  const { t } = useTranslation();
  const formatAt = useFormatAt();
  const closeRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const questionId = useId();
  const [saved, setSaved] = useState<string | null>(null);
  // Delete asks first, in this dialog: its text and buttons change, and Keep goes back to the image.
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const asked = useRef(false);
  const image = images[index] ?? null;
  const li = image?.li ? view.lis.find((item) => item.id === image.li) : null;
  const title = image?.title || (li ? t("ui.otomeForge.album.cgWith", { name: li.name }) : t("ui.otomeForge.album.cg"));
  // A sticker saves under its own name (mari_laugh.png).
  const extension = /\.(png|jpe?g|webp|gif|avif)$/iu.exec(image?.url ?? "")?.[1]?.toLowerCase() ?? "png";
  const filename = image?.name ? `${image.name}.${extension}` : imageFilename(image?.url ?? "", `otome-forge-${title}`);
  const download = useImageDownload(image?.url ?? null, filename);

  // Not while a save is in flight (its result would settle under the next image), nor while Delete asks.
  const step = (delta: number) => {
    if (download.state === "saving" || confirming) return;
    onIndex((index + delta + images.length) % images.length);
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => setSaved(null), [index]);
  // The button that was pressed is gone once the dialog swaps its actions: focus moves to what stands in for it (and
  // the question is each answer's description, since the dialog that asks it opened before it was asked).
  useEffect(() => {
    if (!asked.current) return;
    (confirming ? keepRef : deleteRef).current?.focus({ preventScroll: true });
  }, [confirming]);
  // The arrow keys step through the gallery from anywhere in this dialog (focus starts on its buttons).
  useEffect(() => {
    if (images.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const dialog = viewerRef.current?.closest('[role="dialog"]');
      if (!dialog || !(event.target instanceof Node) || !dialog.contains(event.target)) return;
      const rtl = dialog.closest("[dir]")?.getAttribute("dir") === "rtl";
      event.preventDefault();
      stepRef.current((event.key === "ArrowRight") !== rtl ? 1 : -1);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [images.length]);
  if (!image) return null;

  const saving = download.state === "saving" || download.state === "preparing";
  const ask = (value: boolean) => {
    asked.current = true;
    setDeleteFailed(false);
    setConfirming(value);
  };
  const remove = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await onDelete(image);
    } catch {
      setDeleteFailed(true);
      setDeleting(false);
    }
  };
  if (confirming) {
    return (
      <Dialog
        wide
        title={title}
        onClose={deleting ? undefined : () => ask(false)}
        initialFocus={keepRef}
        actions={
          <>
            <button
              ref={keepRef}
              type="button"
              className="of-button of-button--quiet of-glass"
              aria-disabled={deleting}
              aria-describedby={questionId}
              onClick={() => {
                if (!deleting) ask(false);
              }}
            >
              {t("ui.otomeForge.album.deletePhotoKeep")}
            </button>
            <button
              type="button"
              className="of-button of-button--primary of-button--danger"
              aria-disabled={deleting}
              aria-describedby={questionId}
              onClick={() => void remove()}
            >
              <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.album.deletePhotoYes")}
            </button>
          </>
        }
      >
        <div ref={viewerRef} className="of-viewer" aria-busy={deleting}>
          <p id={questionId} className="of-body">
            {t("ui.otomeForge.album.deletePhotoText")}
          </p>
          {deleteFailed ? (
            <p className="of-notice of-notice--error" role="alert">
              {t("ui.otomeForge.album.deletePhotoFailed")}
            </p>
          ) : null}
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog
      wide
      title={title}
      onClose={onClose}
      initialFocus={closeRef}
      actions={
        <>
          {onDelete ? (
            <button
              ref={deleteRef}
              type="button"
              className="of-button of-button--quiet of-glass of-viewer-delete"
              onClick={() => ask(true)}
            >
              <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.album.deletePhoto")}
            </button>
          ) : null}
          {download.state !== "unavailable" ? (
            <button
              type="button"
              className="of-button of-button--primary"
              aria-disabled={saving}
              onClick={() => {
                if (saving) return;
                void download.save().then((ok) => setSaved(ok ? t("ui.otomeForge.album.saved") : null));
              }}
            >
              <Download size={16} strokeWidth={2} aria-hidden="true" />
              {download.state === "preparing" ? t("ui.otomeForge.album.preparing") : t("ui.otomeForge.album.save")}
            </button>
          ) : null}
          <button ref={closeRef} type="button" className="of-button of-button--quiet of-glass" onClick={onClose}>
            <X size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.wardrobe.close")}
          </button>
        </>
      }
    >
      <div ref={viewerRef} className="of-viewer">
        <figure className="of-viewer-figure">
          <img className="of-viewer-img" src={image.url} alt={title} decoding="async" />
          <figcaption className="of-viewer-caption">
            <span>{t(SOURCE_KEYS[image.source])}</span>
            {formatAt(image.at) ? <span> · {formatAt(image.at)}</span> : null}
          </figcaption>
        </figure>
        {images.length > 1 ? (
          <div className="of-viewer-steps">
            <button
              type="button"
              className="of-icon-button of-glass"
              aria-label={t("ui.otomeForge.album.previous")}
              title={t("ui.otomeForge.album.previous")}
              onClick={() => step(-1)}
            >
              <ChevronLeft className="of-back-icon" size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="of-viewer-count">
              {t("ui.otomeForge.album.position", { index: index + 1, total: images.length })}
            </span>
            <button
              type="button"
              className="of-icon-button of-glass"
              aria-label={t("ui.otomeForge.album.next")}
              title={t("ui.otomeForge.album.next")}
              onClick={() => step(1)}
            >
              <ChevronRight className="of-back-icon" size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <p className="of-live of-hint" role="status">
          {download.state === "failed" ? t("ui.otomeForge.album.saveFailed") : (saved ?? "")}
        </p>
      </div>
    </Dialog>
  );
}
