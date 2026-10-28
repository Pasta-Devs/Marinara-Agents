// ──────────────────────────────────────────────
// Otome Forge: a portrait circle. The portrait when there is one, else initials on the person's accent colour, so
// every screen works without an image connection.
// ──────────────────────────────────────────────
// The image always fills the circle (theme/styles.ts `.of-avatar img`), framed near the top so a full-body look
// shows its face. A card avatar can bring the crop chosen for it in the Engine (`AvatarCrop`'s source rectangle,
// normalized 0–1), which then frames it as the Engine's own avatars do.
import type { CSSProperties } from "react";
import { initialsOf } from "../lib/accent";

/** The Engine's avatar crop (its current source-rectangle shape), as the character list carries it. */
export interface AvatarCrop {
  srcX: number;
  srcY: number;
  srcWidth: number;
  srcHeight: number;
}

/**
 * The crop in a card row: an object or a JSON string, inside the image's bounds; null for anything else.
 * ponytail: the Engine's legacy zoom/offset crops are left uncropped (they show framed like any portrait); the upgrade
 * path is the Engine exposing getAvatarCropStyle to packages.
 */
export function avatarCropOf(value: unknown): AvatarCrop | null {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { srcX, srcY, srcWidth, srcHeight } = parsed as Record<string, unknown>;
  const ok = (entry: unknown): entry is number => typeof entry === "number" && Number.isFinite(entry);
  if (!ok(srcX) || !ok(srcY) || !ok(srcWidth) || !ok(srcHeight)) return null;
  if (srcWidth <= 0 || srcHeight <= 0 || srcX < 0 || srcY < 0) return null;
  if (srcX + srcWidth > 1.001 || srcY + srcHeight > 1.001) return null;
  return { srcX, srcY, srcWidth, srcHeight };
}

/** The crop rectangle stretched over the whole circle (the Engine's getAvatarCropStyle for this shape). */
function cropStyle({ srcX, srcY, srcWidth, srcHeight }: AvatarCrop): CSSProperties {
  return {
    width: `${100 / srcWidth}%`,
    height: `${100 / srcHeight}%`,
    left: `${(-srcX / srcWidth) * 100}%`,
    top: `${(-srcY / srcHeight) * 100}%`,
    maxWidth: "none",
    maxHeight: "none",
    objectFit: "fill",
  };
}

interface AvatarProps {
  name: string;
  url?: string | null;
  /** The ring and initials colour; the look's rose when omitted. */
  accent?: string;
  size?: number;
  className?: string;
  /** A card avatar's Engine crop. */
  crop?: AvatarCrop | null;
}

export function Avatar({ name, url, accent, size = 44, className, crop }: AvatarProps) {
  const style = { width: size, height: size, fontSize: size * 0.4, ...(accent ? { "--of-li-accent": accent } : {}) };
  return (
    <span
      className={className ? `of-avatar ${className}` : "of-avatar"}
      style={style as CSSProperties}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" loading="lazy" style={crop ? cropStyle(crop) : undefined} /> : initialsOf(name)}
    </span>
  );
}
