// ──────────────────────────────────────────────
// Story Writer: painting a picture with the Engine's image connection, over loopback
// ──────────────────────────────────────────────
// The Engine has no package image API that takes a connection id (api.runtime.integrations.images needs the
// connection's credentials), so the server calls the Engine's own routes on 127.0.0.1, as Otome Hearth does:
// POST /api/characters/avatar-generation paints the prompt exactly as given (a prompt override, with debugMode, so the
// Engine logs it in debug mode), POST /api/global-gallery/upload keeps it, and DELETE /api/global-gallery/:id deletes
// it. The Engine refuses that delete while any package document still holds the picture's `global-gallery:<id>`.

type Fetch = typeof fetch;

export interface PaintRequest {
  connectionId: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  debugMode: boolean;
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
  /** Deletes a gallery picture. False when the Engine keeps it (something else uses it) or it is already gone. */
  remove(imageId: string): Promise<boolean>;
}

/** Sent with every picture as its negative prompt: a picture in a book has no writing in it. */
export const PICTURE_NEGATIVE_PROMPT =
  "text, letters, words, writing, captions, speech bubbles, signatures, watermarks, logos, borders, UI";

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

/** `fetch` is the server's, with the Engine's local auth added (server-entry.ts); tests pass their own. */
export function createIllustrationImages({
  baseUrl = loopbackBaseUrl(),
  fetch: fetchImpl,
}: {
  baseUrl?: string;
  fetch: Fetch;
}): IllustrationImages {
  async function request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
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

  return {
    async paint({ connectionId, prompt, negativePrompt, width, height, debugMode }) {
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
          promptOverrides: [{ id: PAINT_OVERRIDE_ID, prompt, negativePrompt }],
        }),
      });
      const image = engineImage(str(painted.image));
      const ext = image ? IMAGE_TYPES[image.mime] : undefined;
      if (!image || !ext) throw new Error("The Engine returned no picture.");
      const size = { width: wholeSize(painted.width, width), height: wholeSize(painted.height, height) };
      // The Engine reads only the fields sent before the file.
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("provider", str(painted.provider) || "image_generation");
      form.append("model", str(painted.model) || "unknown");
      form.append("width", String(size.width));
      form.append("height", String(size.height));
      form.append(
        "file",
        new Blob([Buffer.from(image.base64, "base64")], { type: image.mime }),
        `story-illustration${ext}`,
      );
      const saved = await request("/api/global-gallery/upload", { method: "POST", body: form });
      const id = str(saved.id);
      const url = str(saved.url);
      if (!id || !url) throw new Error("The Global Gallery did not keep the picture.");
      return { id, url, ...size };
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
