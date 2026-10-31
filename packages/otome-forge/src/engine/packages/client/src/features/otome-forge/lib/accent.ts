// ──────────────────────────────────────────────
// Otome Forge: each love interest's accent colour
// ──────────────────────────────────────────────
// Before his portrait exists, his colour comes from a hash of his name (so two LIs rarely share one); once it exists,
// the client picks it from the portrait and saves it (POST .../lis/:li/accent). Gallery URLs are same-origin, so the
// canvas is never tainted.
// The pick is a detail, not an average: the most vivid hue a look carries (an earring, the eyes) rather than the mean of
// everything coloured, which is mud. A look is painted on a chroma matte (S/art/prompts.ts MATTES: green, magenta or
// cyan), so the one hue that is both a matte colour and most of the picture is the backdrop and is dropped, and the
// next hue the look actually carries wins. Grey and transparent pixels never vote.

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

/**
 * How the portrait picker works, bumped when its result changes meaning. An accent saved by an older picker is treated
 * as unset, so a story already in progress re-picks its colours instead of keeping what the old one left behind.
 */
export const ACCENT_SAMPLER_VERSION = 2;

/** A palette colour picked from a stable hash of the name. */
export function nameAccent(name: string): string {
  let hash = 2166136261;
  for (const char of name.trim().toLocaleLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return ACCENT_PALETTE[(hash >>> 0) % ACCENT_PALETTE.length]!;
}

/** True while the stored accent is not his own yet (unset, from an older picker, the server default, or his name). */
export function accentIsPlaceholder(li: { accent: string; name: string; accentSampler?: number }): boolean {
  const accent = li.accent.toUpperCase();
  if (!HEX.test(accent) || (li.accentSampler ?? 0) < ACCENT_SAMPLER_VERSION) return true;
  return accent === SERVER_DEFAULT_ACCENT || accent === nameAccent(li.name).toUpperCase();
}

/** The colour to draw him in: his own once he has one, else the colour from his name. */
export function accentOf(li: { accent: string; name: string; accentSampler?: number }): string {
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

/** The hue of an RGB triple, 0–360. */
function hueOf(red: number, green: number, blue: number): number {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (delta === 0) return 0;
  const hue =
    max === red
      ? 60 * (((green - blue) / delta) % 6)
      : max === green
        ? 60 * ((blue - red) / delta + 2)
        : 60 * ((red - green) / delta + 4);
  return (hue + 360) % 360;
}

/** The shortest way round the wheel between two hues. */
export function hueGap(a: number, b: number): number {
  const gap = Math.abs(a - b) % 360;
  return gap > 180 ? 360 - gap : gap;
}

/** The mattes a look is painted on (S/art/prompts.ts MATTES), as hues: chroma green, cyan, magenta. */
const MATTE_HUES = [120, 180, 300] as const;

/** A pixel that could be the backdrop: pure and very saturated at one of the matte hues. */
function looksLikeMatte(red: number, green: number, blue: number, chroma: number): boolean {
  if (chroma < 0.8) return false;
  const hue = hueOf(red, green, blue);
  return MATTE_HUES.some((matte) => hueGap(hue, matte) <= 18);
}

/** 24 hues of 15° (a 360° wheel, so a 15° bucket keeps a red either side of 0 together). */
const BUCKETS = 24;
const BUCKET_DEGREES = 360 / BUCKETS;

/**
 * His accent from RGBA pixels: the most vivid hue the picture actually carries (see the file header), in a soft,
 * readable range. Null when the image has no colour worth picking.
 */
export function accentFromPixels(data: ArrayLike<number>): string | null {
  const weightOf = new Array<number>(BUCKETS).fill(0);
  const chromaOf = new Array<number>(BUCKETS).fill(0);
  const sumOf = Array.from({ length: BUCKETS }, () => [0, 0, 0] as [number, number, number]);
  let total = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const alpha = data[i + 3]! / 255;
    const red = data[i]!;
    const green = data[i + 1]!;
    const blue = data[i + 2]!;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const chroma = (max - min) / 255;
    // Grey (skin in shadow, hair, the surface) says nothing about who he is; only colour votes.
    if (alpha < 0.5 || chroma < 0.2) continue;
    const weight = alpha;
    const bucket = Math.floor(hueOf(red, green, blue) / BUCKET_DEGREES) % BUCKETS;
    weightOf[bucket]! += weight;
    chromaOf[bucket]! += chroma * weight;
    const sums = sumOf[bucket]!;
    sums[0] += red * weight;
    sums[1] += green * weight;
    sums[2] += blue * weight;
    total += weight;
  }
  if (total < 1) return null;
  // The backdrop, when it is one: the biggest hue, in a matte colour and most of the picture. Dropped, so the backdrop
  // never becomes his colour; a look dressed in its matte's own colour keeps it only when it is not most of the picture.
  let best = 0;
  for (let bucket = 1; bucket < BUCKETS; bucket += 1) if (weightOf[bucket]! > weightOf[best]!) best = bucket;
  if (weightOf[best]! > total / 2) {
    const [r, g, b] = sumOf[best]!;
    const w = weightOf[best]!;
    if (looksLikeMatte(r / w, g / w, b / w, (Math.max(r, g, b) - Math.min(r, g, b)) / w / 255)) {
      total -= weightOf[best]!;
      weightOf[best] = 0;
      chromaOf[best] = 0;
      if (total < 1) return null;
    }
  }
  // Among the hues the look really carries (a stray edge pixel is not a colour), the most vivid one wins, so a small
  // bright detail (an earring, the eyes) outbids a large dull field (a coat); the bigger hue breaks a near-tie.
  const PRESENT = 0.02;
  let pick = -1;
  for (let bucket = 0; bucket < BUCKETS; bucket += 1) {
    if (weightOf[bucket]! < total * PRESENT) continue;
    if (pick < 0) {
      pick = bucket;
      continue;
    }
    const chroma = chromaOf[bucket]! / weightOf[bucket]!;
    const bestChroma = chromaOf[pick]! / weightOf[pick]!;
    if (chroma > bestChroma + 0.06 || (Math.abs(chroma - bestChroma) <= 0.06 && weightOf[bucket]! > weightOf[pick]!)) {
      pick = bucket;
    }
  }
  if (pick < 0) return null;
  const [red, green, blue] = sumOf[pick]!;
  const weight = weightOf[pick]!;
  const hue = hueOf(red / weight, green / weight, blue / weight);
  return hslToHex(hue, 0.62, 0.74);
}

/** His accent from the upper half of his portrait, or null when the image can't be read. */
export async function sampleAccent(url: string): Promise<string | null> {
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight / 2, 0, 0, 64, 48);
    return accentFromPixels(context.getImageData(0, 0, 64, 48).data);
  } catch {
    return null;
  }
}

/** How far apart two accents read as colours: closer than this and two name plates look the same. */
const DISTINCT_GAP = 30;

/**
 * A colour for him that none of `others` already has: the sampled one when it is his own, else the colour from his name,
 * else the first palette tone still free. The cast ends up with a different accent each.
 */
export function pickDistinctAccent(sampled: string, name: string, others: readonly string[]): string {
  const taken = others.map((colour) => colour.toUpperCase());
  const clashes = (colour: string) => {
    const hue = hueOf(
      parseInt(colour.slice(1, 3), 16),
      parseInt(colour.slice(3, 5), 16),
      parseInt(colour.slice(5, 7), 16),
    );
    return taken.some(
      (other) =>
        hueGap(
          hue,
          hueOf(
            parseInt(other.slice(1, 3), 16),
            parseInt(other.slice(3, 5), 16),
            parseInt(other.slice(5, 7), 16),
          ),
        ) < DISTINCT_GAP,
    );
  };
  for (const colour of [sampled, nameAccent(name), ...ACCENT_PALETTE]) {
    const candidate = colour.toUpperCase();
    if (HEX.test(candidate) && !clashes(candidate)) return candidate;
  }
  return sampled;
}
