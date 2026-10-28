// ──────────────────────────────────────────────
// Otome Forge: each love interest's accent colour
// ──────────────────────────────────────────────
// Before his portrait exists, his colour comes from a hash of his name (so two LIs rarely share one); once it exists,
// the client samples it from the portrait and saves it (POST .../lis/:li/accent). Gallery URLs are same-origin, so the
// canvas is never tainted. Looks are painted on a flat mid-grey background, so grey pixels are left out of the average.

/** The server's accent before anything set one (S/schemas/unit.ts DEFAULT_ACCENT). */
export const SERVER_DEFAULT_ACCENT = "#E7A6B8";

/** Soft jewel tones that read on both looks. */
export const ACCENT_PALETTE = [
  "#E7A6B8",
  "#B79CF2",
  "#9DB8F0",
  "#8FD1C8",
  "#E6C98A",
  "#F0A58F",
  "#C48AB9",
  "#A8D8A0",
] as const;

const HEX = /^#[0-9a-f]{6}$/i;

/** A palette colour picked from a stable hash of the name. */
export function nameAccent(name: string): string {
  let hash = 2166136261;
  for (const char of name.trim().toLocaleLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return ACCENT_PALETTE[(hash >>> 0) % ACCENT_PALETTE.length]!;
}

/** True while the stored accent is not his own yet (the server default, or the colour from his name). */
export function accentIsPlaceholder(li: { accent: string; name: string }): boolean {
  const accent = li.accent.toUpperCase();
  return !HEX.test(accent) || accent === SERVER_DEFAULT_ACCENT || accent === nameAccent(li.name).toUpperCase();
}

/** The colour to draw him in: his own once he has one, else the colour from his name. */
export function accentOf(li: { accent: string; name: string }): string {
  return accentIsPlaceholder(li) ? nameAccent(li.name) : li.accent;
}

/** Up to two initials, for an LI or the protagonist without a portrait. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/u)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}

function hex(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, "0");
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return `#${hex(channel(0))}${hex(channel(8))}${hex(channel(4))}`.toUpperCase();
}

/**
 * The accent from RGBA pixels: the average of the coloured pixels (grey background and transparent ones left out),
 * moved into a soft, readable range. Null when the image has almost no colour.
 */
export function accentFromPixels(data: ArrayLike<number>): string | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3]! / 255;
    const max = Math.max(data[i]!, data[i + 1]!, data[i + 2]!);
    const min = Math.min(data[i]!, data[i + 1]!, data[i + 2]!);
    const chroma = (max - min) / 255;
    if (alpha < 0.5 || chroma < 0.12) continue;
    const w = alpha * chroma;
    r += data[i]! * w;
    g += data[i + 1]! * w;
    b += data[i + 2]! * w;
    weight += w;
  }
  if (weight < 1) return null;
  const [red, green, blue] = [r / weight / 255, g / weight / 255, b / weight / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (delta === 0) return null;
  const hue =
    max === red
      ? 60 * (((green - blue) / delta) % 6)
      : max === green
        ? 60 * ((blue - red) / delta + 2)
        : 60 * ((red - green) / delta + 4);
  return hslToHex((hue + 360) % 360, 0.62, 0.74);
}

/** His accent sampled from the upper half of his portrait, or null when the image can't be read. */
export async function sampleAccent(url: string): Promise<string | null> {
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight / 2, 0, 0, 32, 24);
    return accentFromPixels(context.getImageData(0, 0, 32, 24).data);
  } catch {
    return null;
  }
}
