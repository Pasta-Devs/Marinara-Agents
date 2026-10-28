// ──────────────────────────────────────────────
// Otome Forge: a portrait circle. The portrait when there is one, else initials on the person's accent colour, so
// every screen works without an image connection.
// ──────────────────────────────────────────────
import type { CSSProperties } from "react";
import { initialsOf } from "../lib/accent";

interface AvatarProps {
  name: string;
  url?: string | null;
  /** The ring and initials colour; the look's rose when omitted. */
  accent?: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, url, accent, size = 44, className }: AvatarProps) {
  const style = { width: size, height: size, fontSize: size * 0.4, ...(accent ? { "--of-li-accent": accent } : {}) };
  return (
    <span
      className={className ? `of-avatar ${className}` : "of-avatar"}
      style={style as CSSProperties}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" loading="lazy" /> : initialsOf(name)}
    </span>
  );
}
