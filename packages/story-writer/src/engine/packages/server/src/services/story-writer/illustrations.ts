// ──────────────────────────────────────────────
// Story Writer: painting a picture with the Engine's image connection, over loopback
// ──────────────────────────────────────────────
// The Engine has no package image API that takes a connection id (api.runtime.integrations.images needs the
// connection's credentials), so the server calls the Engine's own routes on 127.0.0.1, as Otome Hearth does:
// POST /api/characters/avatar-generation paints the prompt exactly as given (a prompt override, with debugMode, so the
// Engine logs it in debug mode), POST /api/global-gallery/upload keeps it, and DELETE /api/global-gallery/:id deletes
// it. The Engine refuses that delete while any package document still holds the picture's `global-gallery:<id>`.
// GET /api/characters/:id and /api/characters/personas/:id give the cast's names and avatars, which go with a picture
// that names them as its references.

type Fetch = typeof fetch;

export interface PaintRequest {
  connectionId: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  debugMode: boolean;
  /** The pictures of the cast it shows, as data URLs (at most REFERENCES_MAX). */
  referenceImages?: string[];
  /** NovelAI V5's "Prefer same outfit" off: the prompt says what they wear, so the references give only their looks. */
  preferReferenceOutfit?: false;
}

/** A painted picture, already in the Global Gallery. */
export interface PaintedPicture {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface IllustrationImages {
  /** Paints the prompt and keeps the picture in the Global Gallery. Throws when either step fails; it never retries. */
  paint(request: PaintRequest): Promise<PaintedPicture>;
  /**
   * The avatars of the story's characters and personas that the prompt names (castInPrompt), in the order it names
   * them, as data URLs: at most REFERENCES_MAX. Someone without an avatar, or whose card or picture cannot be read, is
   * left out; it never throws.
   */
  references(cast: { characterIds: string[]; personaIds: string[] }, prompt: string): Promise<string[]>;
  /** Deletes a gallery picture. False when the Engine keeps it (something else uses it) or it is already gone. */
  remove(imageId: string): Promise<boolean>;
}

/** Sent with every picture as its negative prompt: a picture in a book has no writing in it. */
export const PICTURE_NEGATIVE_PROMPT =
  "text, letters, words, writing, captions, speech bubbles, signatures, watermarks, logos, borders, UI";

/** The Engine's avatar-generation route keeps the first four references (characters.routes.ts). */
export const REFERENCES_MAX = 4;

/** Words that say what someone wears, or that they wear nothing: the prompt, not a reference, dresses them. */
const CLOTHES =
  /\b(?:wear(?:s|ing)?|worn|dressed|cloth(?:es|ing)|naked|nude|topless|shirtless|jeans|(?:outfit|uniform|costume|armou?r|robe|gown|dress|shirt|blouse|sweater|hoodie|jacket|coat|cloak|cape|suit|tunic|kimono|skirt|trouser|pant|boot|shoe|hat|helmet|hood|scarf|apron|swimsuit|bikini|lingerie|pajama)(?:e?s)?)\b/i;

/** The prompt names clothes (or their absence), so the references should keep only the cast's likeness. */
export function namesClothes(prompt: string): boolean {
  return CLOTHES.test(prompt);
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The cast members the prompt names by their whole name, spelled and capitalized as the card or persona has it, in the
 * order it first names them. A longer name is read first, so "Ann Lee" is not Ann too, and a part of a name is no one:
 * "Ann" never finds Anna. Case counts because cast names are often words ("amber light" is not Amber).
 * ponytail: a name that opens a sentence as an ordinary word ("Amber light falls...") still matches; telling those
 * apart would need the prompt call to list its cast.
 */
export function castInPrompt<T extends { name: string }>(prompt: string, cast: T[]): T[] {
  let rest = prompt.normalize("NFC");
  const found: Array<{ member: T; at: number }> = [];
  for (const member of [...cast].sort((a, b) => b.name.trim().length - a.name.trim().length)) {
    const name = member.name.normalize("NFC").trim();
    if (!name) continue;
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "gu");
    const at = rest.search(pattern);
    if (at < 0) continue;
    found.push({ member, at });
    rest = rest.replace(pattern, (match) => " ".repeat(match.length));
  }
  return found.sort((a, b) => a.at - b.at).map((item) => item.member);
}

/** A character's name: its card's (data, a JSON string in storage), else the row's. */
function characterName(row: Record<string, unknown>): string {
  let data = row.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = null;
    }
  }
  return str(data && typeof data === "object" ? (data as Record<string, unknown>).name : "") || str(row.name);
}

/** The Engine matches a prompt override by this name (characters.routes.ts avatarGenerationPromptId). */
export const PAINT_NAME = "Story Writer illustration";
const PAINT_OVERRIDE_ID = "avatar:story-writer-illustration";

const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

const DATA_URL = /^data:([^;,]+);base64,([\s\S]+)$/;

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The type an image's first bytes say it is, or "" when they match none of IMAGE_TYPES. */
function sniffImageType(bytes: Uint8Array): string {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /^avi[fs]$/.test(ascii(8, 12))) return "image/avif";
  return "";
}

/**
 * The image in the Engine's data URL, typed by its bytes. A provider can answer with a data URL where the Engine
 * expects bare base64 (xAI's `b64_json`), which the Engine wraps again as image/png, so an inner data URL is unwrapped.
 * ponytail: the same shim as Otome Hearth's engineImage; once the Engine unwraps xAI's answer itself, the loop runs once.
 */
export function engineImage(value: string): { mime: string; base64: string } | null {
  let mime = "";
  let payload = value.trim();
  for (let match = DATA_URL.exec(payload); match; match = DATA_URL.exec(payload)) {
    mime = match[1]!.toLowerCase();
    payload = match[2]!.trim();
  }
  const base64 = payload.replace(/\s+/g, "");
  if (!mime || !base64) return null;
  const sniffed = sniffImageType(Buffer.from(base64.slice(0, 32), "base64"));
  return { mime: sniffed || mime, base64 };
}

/** The Engine's own address: http(s)://127.0.0.1:$PORT (7860 by default; https when SSL_CERT and SSL_KEY are set). */
export function loopbackBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const port = Number.parseInt(env.PORT ?? "", 10);
  const scheme = str(env.SSL_CERT) && str(env.SSL_KEY) ? "https" : "http";
  return `${scheme}://127.0.0.1:${Number.isFinite(port) ? port : 7860}`;
}

function wholeSize(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

const sized = (width: number, height: number) =>
  width > 0 && height > 0 && width < 65_536 && height < 65_536 ? { width, height } : null;

/**
 * A picture's pixel size from its header (PNG, GIF, WebP or JPEG), or null for another file. The Engine reports a size
 * only when it adjusted the request itself, and a provider can paint another shape than asked (GPT Image paints
 * 1024×1536 for 896×1152), so the book sizes a picture by its own header.
 * ponytail: the same reader as Slurp's slp-image-size.ts; no EXIF orientation, which painted pictures do not carry.
 */
export function imageSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes.readUInt32BE(0) === 0x89504e47 && bytes.toString("ascii", 12, 16) === "IHDR") {
    return sized(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
  }
  if (bytes.length >= 10 && bytes.toString("ascii", 0, 3) === "GIF") {
    return sized(bytes.readUInt16LE(6), bytes.readUInt16LE(8));
  }
  if (bytes.length >= 30 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") return sized(1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3));
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      return sized(1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff));
    }
    if (chunk === "VP8 ") return sized(bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff);
    return null;
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    // The segments up to the first frame header (SOF0-SOF15, not DHT, JPG or DAC) hold its size.
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1]!;
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return sized(bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5));
      }
      offset += 2 + bytes.readUInt16BE(offset + 2);
    }
  }
  return null;
}

/** `fetch` is the server's, with the Engine's local auth added (server-entry.ts); tests pass their own. */
export function createIllustrationImages({
  baseUrl = loopbackBaseUrl(),
  fetch: fetchImpl,
}: {
  baseUrl?: string;
  fetch: Fetch;
}): IllustrationImages {
  async function request(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    const response = await fetchImpl(`${baseUrl}${path}`, init);
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const row = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    if (!response.ok) {
      const reason = str(row.error);
      throw new Error(reason || `The Engine answered ${response.status}.`);
    }
    return row;
  }

  /** One of the Engine's own avatar files as a data URL, or null when it is not one or does not load. */
  async function avatarImage(path: string): Promise<string | null> {
    if (!path.startsWith("/api/") || path.includes("..")) return null;
    try {
      const response = await fetchImpl(`${baseUrl}${path}`);
      if (!response.ok) return null;
      const bytes = Buffer.from(await response.arrayBuffer());
      const mime = sniffImageType(bytes);
      return mime ? `data:${mime};base64,${bytes.toString("base64")}` : null;
    } catch {
      return null;
    }
  }

  async function castMember(path: string, nameOf: (row: Record<string, unknown>) => string) {
    try {
      const row = await request(path);
      return { name: nameOf(row), avatarPath: str(row.avatarPath) };
    } catch {
      return null;
    }
  }

  return {
    async paint({ connectionId, prompt, negativePrompt, width, height, debugMode, ...references }) {
      const painted = await request("/api/characters/avatar-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          name: PAINT_NAME,
          appearance: prompt,
          purpose: "avatar",
          width,
          height,
          debugMode,
          ...(references.referenceImages?.length ? references : {}),
          promptOverrides: [{ id: PAINT_OVERRIDE_ID, prompt, negativePrompt }],
        }),
      });
      const image = engineImage(str(painted.image));
      const ext = image ? IMAGE_TYPES[image.mime] : undefined;
      if (!image || !ext) throw new Error("The Engine returned no picture.");
      const bytes = Buffer.from(image.base64, "base64");
      const size = imageSize(bytes) ?? {
        width: wholeSize(painted.width, width),
        height: wholeSize(painted.height, height),
      };
      // The Engine reads only the fields sent before the file.
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("provider", str(painted.provider) || "image_generation");
      form.append("model", str(painted.model) || "unknown");
      form.append("width", String(size.width));
      form.append("height", String(size.height));
      form.append("file", new Blob([bytes], { type: image.mime }), `story-illustration${ext}`);
      const saved = await request("/api/global-gallery/upload", { method: "POST", body: form });
      const id = str(saved.id);
      const url = str(saved.url);
      if (!id || !url) throw new Error("The Global Gallery did not keep the picture.");
      return { id, url, ...size };
    },

    async references({ characterIds, personaIds }, prompt) {
      const cast = await Promise.all([
        ...characterIds.map((id) => castMember(`/api/characters/${encodeURIComponent(id)}`, characterName)),
        ...personaIds.map((id) =>
          castMember(`/api/characters/personas/${encodeURIComponent(id)}`, (row) => str(row.name)),
        ),
      ]);
      const known = cast.filter((member) => member !== null);
      const images: string[] = [];
      for (const member of castInPrompt(prompt, known)) {
        if (images.length >= REFERENCES_MAX) break;
        const image = member.avatarPath ? await avatarImage(member.avatarPath) : null;
        if (image && !images.includes(image)) images.push(image);
      }
      return images;
    },

    async remove(imageId) {
      if (!str(imageId)) return false;
      try {
        const path = `/api/global-gallery/${encodeURIComponent(str(imageId))}`;
        return (await fetchImpl(`${baseUrl}${path}`, { method: "DELETE" })).ok;
      } catch {
        return false;
      }
    },
  };
}
