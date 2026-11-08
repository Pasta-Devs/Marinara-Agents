// ──────────────────────────────────────────────
// Otome Forge: a portrait circle. The portrait when there is one, else initials on the person's accent colour, so
// every screen works without an image connection.
// ──────────────────────────────────────────────
// The image always fills the circle (theme/styles.ts `.of-avatar img`), anchored at the top. A full-body look (an
// image much taller than wide, its head at the very top) is also zoomed to the head and shoulders once it loads, so the
// circle frames a face; a square or bust avatar (a card's, a persona's) is never zoomed. A card avatar can bring the
// crop chosen for it in the Engine (`AvatarCrop`'s source rectangle, normalized 0–1), which then frames it as the
// Engine's own avatars do.
import type { CSSProperties } from "react";
import { initialsOf } from "../lib/accent";
import { useFaceFrame } from "../lib/use-face-frame";

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
  const frame = useFaceFrame(url, !!crop);
  return (
    <span
      className={className ? `of-avatar ${className}` : "of-avatar"}
      style={style as CSSProperties}
      aria-hidden="true"
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className={frame.className}
          style={crop ? cropStyle(crop) : undefined}
          onLoad={frame.onLoad}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}

/** A love interest's image inside an `.of-avatar` circle drawn by hand (the top bar's chip, the Wardrobe's), framed at
 * the face as Avatar frames it (lib/use-face-frame.ts). */
export function FaceImage({ src }: { src: string }) {
  const frame = useFaceFrame(src);
  return <img src={src} alt="" className={frame.className} onLoad={frame.onLoad} />;
}

/**
 * #2154: the group chat's portraits in one `size` slot: up to three overlapping circles, and "+N" for the rest.
 * Decorative: the row or header beside it names everyone.
 */
export function AvatarCluster({
  people,
  size,
}: {
  people: ReadonlyArray<{ name: string; url?: string | null; accent?: string }>;
  size: number;
}) {
  const shown = people.slice(0, 3);
  const more = people.length - shown.length;
  const each = Math.round(size * 0.58);
  const step = shown.length > 1 ? (size - each) / (shown.length - 1) : (size - each) / 2;
  return (
    <span className="of-avatar-cluster" style={{ width: size, height: size }} aria-hidden="true">
      {shown.map((person, index) => (
        <span
          key={`${index} ${person.name}`}
          className="of-avatar-cluster-item"
          style={{ insetInlineStart: index * step, top: index % 2 ? 0 : size - each }}
        >
          <Avatar name={person.name} url={person.url} accent={person.accent} size={each} />
        </span>
      ))}
      {more > 0 ? <span className="of-avatar-cluster-more">+{more}</span> : null}
    </span>
  );
}
