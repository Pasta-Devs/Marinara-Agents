import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Crop, Move, RotateCcw } from "lucide-react";
import type { NoodlePostImageCrop } from "@marinara-engine/shared";
import { cn } from "../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";

type CropAspect = "original" | "square" | "portrait" | "landscape";

interface NormalizedCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageSize {
  width: number;
  height: number;
}

const ASPECT_OPTIONS: Array<{ value: CropAspect; labelKey: string }> = [
  {
    value: "original",
    labelKey: "ui.noodle.postimagecropeditor.aspect.original",
  },
  { value: "square", labelKey: "ui.noodle.postimagecropeditor.aspect.square" },
  {
    value: "portrait",
    labelKey: "ui.noodle.postimagecropeditor.aspect.portrait",
  },
  {
    value: "landscape",
    labelKey: "ui.noodle.postimagecropeditor.aspect.landscape",
  },
];

export function PostImageCropEditor({
  source,
  crop: initialCrop = null,
  disabled = false,
  onCancel,
  onApply,
}: {
  source: File | string;
  crop?: NoodlePostImageCrop | null;
  disabled?: boolean;
  onCancel: () => void;
  onApply: (crop: NoodlePostImageCrop) => Promise<void>;
}) {
  const { t: localizeUi } = useUiTranslation();
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    centerX: number;
    centerY: number;
  } | null>(null);
  const sourceUrl = useMemo(
    () => (typeof source === "string" ? source : URL.createObjectURL(source)),
    [source],
  );
  const [sourceSize, setSourceSize] = useState<ImageSize | null>(null);
  const [displaySize, setDisplaySize] = useState<ImageSize | null>(null);
  const [aspect, setAspect] = useState<CropAspect>("original");
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (typeof source !== "string") URL.revokeObjectURL(sourceUrl);
    },
    [source, sourceUrl],
  );

  useEffect(() => {
    setSourceSize(null);
    setDisplaySize(null);
    setAspect("original");
    setZoom(1);
    setCenter({ x: 0.5, y: 0.5 });
    setError(null);
  }, [source]);

  useEffect(() => {
    if (!sourceSize || !initialCrop) return;
    if (
      initialCrop.sourceWidth !== sourceSize.width ||
      initialCrop.sourceHeight !== sourceSize.height
    ) {
      return;
    }
    const initialAspect = closestAspect(sourceSize, initialCrop);
    const base = resolveCrop(sourceSize, initialAspect, 1, { x: 0.5, y: 0.5 });
    setAspect(initialAspect);
    setZoom(
      clamp(
        Math.min(
          base.width / initialCrop.width,
          base.height / initialCrop.height,
        ),
        1,
        3,
      ),
    );
    setCenter({
      x: initialCrop.x + initialCrop.width / 2,
      y: initialCrop.y + initialCrop.height / 2,
    });
  }, [initialCrop, sourceSize]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const updateDisplaySize = () => {
      const rect = image.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0)
        setDisplaySize({ width: rect.width, height: rect.height });
    };
    updateDisplaySize();
    const observer = new ResizeObserver(updateDisplaySize);
    observer.observe(image);
    return () => observer.disconnect();
  }, [sourceSize]);

  const crop = sourceSize
    ? resolveCrop(sourceSize, aspect, zoom, center)
    : null;
  const busy = disabled || applying;

  const reset = () => {
    if (busy) return;
    setZoom(1);
    setCenter({ x: 0.5, y: 0.5 });
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!crop || busy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      centerX: crop.x + crop.width / 2,
      centerY: crop.y + crop.height / 2,
    };
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !displaySize || !crop)
      return;
    setCenter({
      x: clamp(
        drag.centerX + (event.clientX - drag.clientX) / displaySize.width,
        crop.width / 2,
        1 - crop.width / 2,
      ),
      y: clamp(
        drag.centerY + (event.clientY - drag.clientY) / displaySize.height,
        crop.height / 2,
        1 - crop.height / 2,
      ),
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const apply = async () => {
    if (!crop || !sourceSize || busy) return;
    setApplying(true);
    setError(null);
    try {
      await onApply({
        ...crop,
        sourceWidth: sourceSize.width,
        sourceHeight: sourceSize.height,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : localizeUi("ui.noodle.postimagecropeditor.couldNotCropImage"),
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="mb-3 space-y-3 rounded-xl border border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Crop size={15} className="text-[var(--noodle-accent)]" />
            {localizeUi("ui.noodle.postimagecropeditor.frameImage")}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {localizeUi(
              "ui.noodle.postimagecropeditor.dragTheFrameToPositionTheImage",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
        >
          <RotateCcw size={13} />
          {localizeUi("ui.characters.charactercliptrimmodal.reset")}
        </button>
      </div>

      <div className="overflow-hidden rounded-lg bg-black/55 p-2">
        <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-md">
          <img
            ref={imageRef}
            src={sourceUrl}
            alt={localizeUi("ui.noodle.postimagecropeditor.cropPreview")}
            draggable={false}
            onLoad={(event) => {
              const image = event.currentTarget;
              setSourceSize({
                width: image.naturalWidth,
                height: image.naturalHeight,
              });
              const rect = image.getBoundingClientRect();
              setDisplaySize({ width: rect.width, height: rect.height });
            }}
            onError={() =>
              setError(
                localizeUi("ui.noodle.postimagecropeditor.couldNotLoadImage"),
              )
            }
            className="block max-h-80 max-w-full select-none object-contain"
          />
          {crop && displaySize && (
            <div
              role="application"
              aria-label={localizeUi(
                "ui.noodle.postimagecropeditor.imageCropFrameDragToReposition",
              )}
              className="absolute touch-none cursor-move overflow-hidden rounded-xl outline outline-2 outline-white"
              style={{
                left: crop.x * displaySize.width,
                top: crop.y * displaySize.height,
                width: crop.width * displaySize.width,
                height: crop.height * displaySize.height,
                boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.58)",
              }}
              onPointerDown={beginDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              tabIndex={0}
              onKeyDown={(event) => {
                if (busy) return;
                const step = event.shiftKey ? 0.025 : 0.01;
                const movement =
                  event.key === "ArrowLeft"
                    ? { x: -step, y: 0 }
                    : event.key === "ArrowRight"
                      ? { x: step, y: 0 }
                      : event.key === "ArrowUp"
                        ? { x: 0, y: -step }
                        : event.key === "ArrowDown"
                          ? { x: 0, y: step }
                          : null;
                if (!movement) return;
                event.preventDefault();
                setCenter({
                  x: clamp(
                    crop.x + crop.width / 2 + movement.x,
                    crop.width / 2,
                    1 - crop.width / 2,
                  ),
                  y: clamp(
                    crop.y + crop.height / 2 + movement.y,
                    crop.height / 2,
                    1 - crop.height / 2,
                  ),
                });
              }}
            >
              <span className="pointer-events-none absolute left-1/3 top-0 h-full border-l border-white/45" />
              <span className="pointer-events-none absolute left-2/3 top-0 h-full border-l border-white/45" />
              <span className="pointer-events-none absolute left-0 top-1/3 w-full border-t border-white/45" />
              <span className="pointer-events-none absolute left-0 top-2/3 w-full border-t border-white/45" />
              <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white">
                <Move size={15} />
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-[var(--background)] p-1">
          {ASPECT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={aspect === option.value}
              disabled={busy}
              onClick={() => {
                setAspect(option.value);
                setCenter({ x: 0.5, y: 0.5 });
              }}
              className={cn(
                "min-h-9 flex-1 rounded-md px-2 text-xs font-bold transition-colors disabled:opacity-50",
                aspect === option.value
                  ? "bg-[var(--noodle-accent)] text-zinc-950"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              {localizeUi(option.labelKey)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 text-xs font-bold text-[var(--muted-foreground)]">
          {localizeUi("ui.noodle.postimagecropeditor.zoom")}
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            disabled={busy}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="min-h-8 min-w-0 flex-1 accent-[var(--noodle-accent)]"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-10 rounded-full border border-[var(--noodle-divider)] px-4 text-xs font-bold disabled:opacity-50"
        >
          {localizeUi("chat.delete.dialog.cancel")}
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!crop || busy}
          className="min-h-10 rounded-full bg-[var(--noodle-accent)] px-5 text-xs font-bold text-zinc-950 disabled:opacity-50"
        >
          {applying
            ? localizeUi("ui.noodle.postimagecropeditor.applying")
            : localizeUi("ui.noodle.postimagecropeditor.applyCrop")}
        </button>
      </div>
    </section>
  );
}

export function PostImageFrame({
  src,
  crop,
  alt,
  maxHeight = 384,
  onError,
}: {
  src: string;
  crop: NoodlePostImageCrop | null;
  alt: string;
  maxHeight?: number;
  onError?: () => void;
}) {
  const validCrop = crop && isValidCrop(crop) ? crop : null;
  if (!validCrop) {
    return (
      <div
        className="flex justify-center overflow-hidden rounded-xl bg-black/30"
        style={{ maxHeight }}
      >
        <img
          src={src}
          alt={alt}
          onError={onError}
          className="max-w-full object-contain"
          style={{ maxHeight }}
        />
      </div>
    );
  }
  const aspectRatio =
    (validCrop.width * validCrop.sourceWidth) /
    (validCrop.height * validCrop.sourceHeight);
  const imageStyle: CSSProperties = {
    left: `${(-validCrop.x / validCrop.width) * 100}%`,
    top: `${(-validCrop.y / validCrop.height) * 100}%`,
    width: `${100 / validCrop.width}%`,
    height: `${100 / validCrop.height}%`,
  };
  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-xl bg-black/30"
      style={{ aspectRatio, maxWidth: maxHeight * aspectRatio }}
    >
      <img
        src={src}
        alt={alt}
        onError={onError}
        className="absolute max-w-none"
        style={imageStyle}
      />
    </div>
  );
}

function isValidCrop(crop: NoodlePostImageCrop): boolean {
  return (
    Number.isFinite(crop.x) &&
    Number.isFinite(crop.y) &&
    Number.isFinite(crop.width) &&
    Number.isFinite(crop.height) &&
    Number.isFinite(crop.sourceWidth) &&
    Number.isFinite(crop.sourceHeight) &&
    crop.sourceWidth > 0 &&
    crop.sourceHeight > 0 &&
    crop.width > 0 &&
    crop.height > 0 &&
    crop.x >= 0 &&
    crop.y >= 0 &&
    // Allow a tiny IEEE-754 tolerance: resolveCrop clamps center to 1 - width/2,
    // so x + width can exceed 1 by an ULP and wrongly reject a valid stored crop.
    crop.x + crop.width <= 1 + CROP_BOUND_TOLERANCE &&
    crop.y + crop.height <= 1 + CROP_BOUND_TOLERANCE
  );
}

const CROP_BOUND_TOLERANCE = 1e-6;

function resolveCrop(
  size: ImageSize,
  aspect: CropAspect,
  zoom: number,
  center: { x: number; y: number },
): NormalizedCrop {
  const sourceRatio = size.width / size.height;
  const targetRatio =
    aspect === "square"
      ? 1
      : aspect === "portrait"
        ? 4 / 5
        : aspect === "landscape"
          ? 16 / 9
          : sourceRatio;
  const baseWidth = sourceRatio > targetRatio ? targetRatio / sourceRatio : 1;
  const baseHeight = sourceRatio > targetRatio ? 1 : sourceRatio / targetRatio;
  const width = baseWidth / zoom;
  const height = baseHeight / zoom;
  const centerX = clamp(center.x, width / 2, 1 - width / 2);
  const centerY = clamp(center.y, height / 2, 1 - height / 2);
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}

function closestAspect(size: ImageSize, crop: NoodlePostImageCrop): CropAspect {
  const ratio =
    (crop.width * crop.sourceWidth) / (crop.height * crop.sourceHeight);
  const sourceRatio = size.width / size.height;
  const candidates: Array<{ aspect: CropAspect; ratio: number }> = [
    { aspect: "original", ratio: sourceRatio },
    { aspect: "square", ratio: 1 },
    { aspect: "portrait", ratio: 4 / 5 },
    { aspect: "landscape", ratio: 16 / 9 },
  ];
  return candidates.reduce((closest, candidate) =>
    Math.abs(candidate.ratio - ratio) < Math.abs(closest.ratio - ratio)
      ? candidate
      : closest,
  ).aspect;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
