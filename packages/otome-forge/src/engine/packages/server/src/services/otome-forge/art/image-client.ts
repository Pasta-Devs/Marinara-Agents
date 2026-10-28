// ──────────────────────────────────────────────
// Otome Forge: painting over loopback (plan §1.8, "One path")
// ──────────────────────────────────────────────
// A port of Gacha Forge's forgeLegacyImageClient (server.mjs, around offset 185975), reduced to what M1 paints. The
// Engine has no server image API that takes a connection id, so the server calls its own HTTP routes on 127.0.0.1:
// POST /api/characters/avatar-generation paints (with debugMode, so the Engine logs the prompt in debug mode), and
// /api/global-gallery keeps the result. A loopback call is ordinary trusted server code and needs no permission.
// The methods are named generatePortrait, generateOutfit (M4: a look won on Wish) and generateBannerArt so the kit's
// forgeWrapImageReferenceClient adds each subject's card or persona avatar (or saved portrait) as a reference; that
// wrapper also needs characterCard, personaAvatar and cardAvatarImage. generateImage is one paid image with exactly the
// references it is given (a place has none; an expression edit has its base) and saves nothing: uploadToGallery keeps
// it, in the shape the kit's expressions module calls.
import { forgeWrapImageReferenceClient } from "@forge-kit/image-avatar-references.mjs";
import type { CapabilityRuntimeHost } from "@marinara-engine/shared";

/** Whose likeness a look keeps: the fields forgeWrapImageReferenceClient reads to find a reference image. */
export interface ImageSubject {
  kind: "character";
  cardId?: string;
  personaId?: string;
  portrait?: string;
  outfits?: unknown[];
  /** The look worn now: the kit sends its image after the faces for scene and banner art. */
  wornOutfit?: string;
}

export interface PortraitRequest {
  connectionId: string;
  /** Names the prompt override: the Engine matches `avatar:<slug of name>`. */
  name: string;
  /** `unit`, as forgeWrapImageReferenceClient reads it for generatePortrait. */
  unit: ImageSubject;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  debugMode: boolean;
  /** Added by forgeWrapImageReferenceClient; at most 4 reach the provider. */
  referenceImages?: string[];
}

/** A painted image, already in the Global Gallery. `id` names it for `global-gallery:<id>` references. */
export interface PaintedImage {
  url: string;
  id?: string;
}

/** One paid image: the prompt goes to the Engine as the override for `name`, with these references (at most 4). */
export interface ImageRequest {
  connectionId: string;
  /** Names the prompt override (`avatar:<slug of name>`) and the gallery file. */
  name: string;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  debugMode: boolean;
  referenceImages?: string[];
}

/** An image the Engine painted, not saved yet. `overrideTook` is false when the Engine compiled its own prompt. */
export interface GeneratedImage {
  mime: string;
  ext: string;
  base64: string;
  width: number;
  height: number;
  /** The prompt the Engine sent the provider. */
  prompt: string;
  /** The prompt Otome asked for. */
  sentPrompt: string;
  overrideTook: boolean;
}

/** A story CG (M2b) or banner art (M4): `units` are the people in it, whose references the wrapper adds. */
export interface SceneRequest extends ImageRequest {
  units: ImageSubject[];
}

/** The parts of an Engine image style profile a prompt override has to carry itself (the Engine skips the profile). */
export interface StyleProfile {
  styleText: string;
  positiveTags: string;
  negativeTags: string;
  /** The profile writes tag prompts (its promptMode is "tagged" or "danbooru"), not sentences. */
  tagged?: boolean;
}

export interface ImageClient {
  /** Paints one image and uploads it to the Global Gallery. Throws on any failure; it never retries. */
  generatePortrait(request: PortraitRequest): Promise<PaintedImage>;
  /** A new look for the same person (M4, S/art/outfits.ts): as generatePortrait, with the subject's likeness kept. */
  generateOutfit(request: PortraitRequest): Promise<PaintedImage>;
  /** Paints a scene with its people (each one's reference added by the wrapper) and uploads it. Never retries. */
  generateBannerArt(request: SceneRequest): Promise<PaintedImage>;
  /** One paid image, not saved. Throws on any failure; it never retries. */
  generateImage(request: ImageRequest): Promise<GeneratedImage>;
  /** Keeps a painted image in the Global Gallery (the kit's expressions call it with their own fields). */
  uploadToGallery(request: {
    image: Pick<GeneratedImage, "mime" | "ext" | "base64"> & { width?: number; height?: number };
    name: string;
    prompt: string;
    provider?: string;
    model?: string;
  }): Promise<{ id: string; url: string }>;
  /** The chosen image style profile, else the Engine's default, else the first; empty when there is none. */
  styleProfile(profileId?: string): Promise<StyleProfile>;
  deleteGalleryImage(id: string): Promise<boolean>;
  characterCard(cardId: string): Promise<{ avatarPath: string } | null>;
  personaAvatar(personaId: string): Promise<string>;
  cardAvatarImage(path: string): Promise<{ mime: string; base64: string } | null>;
}

type Fetch = typeof fetch;
type Logger = Pick<CapabilityRuntimeHost["logger"], "debug" | "warn">;

const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

/** The Engine sends at most this many references to the provider (characters.routes.ts avatar-generation). */
export const REFERENCES_MAX = 4;

export const GALLERY_REF_PREFIX = "global-gallery:";
/** The reference a document keeps for a gallery image, as the Engine's document checks expect. */
export const galleryRef = (id: string) => `${GALLERY_REF_PREFIX}${id}`;

/** Every gallery image id a document refers to (GF's collector), for deleting a run's images with it. */
export function galleryRefIds(value: unknown): string[] {
  let text = "";
  try {
    text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  } catch {
    return [];
  }
  return [...new Set([...text.matchAll(/global-gallery:([A-Za-z0-9_-]+)/g)].map((match) => match[1]))];
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The Engine's own address: http(s)://127.0.0.1:$PORT (7860 by default; https when SSL_CERT and SSL_KEY are set). */
export function loopbackBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const port = Number.parseInt(env.PORT ?? "", 10);
  const scheme = str(env.SSL_CERT) && str(env.SSL_KEY) ? "https" : "http";
  return `${scheme}://127.0.0.1:${Number.isFinite(port) ? port : 7860}`;
}

/** The avatar-generation override id the Engine matches for `name` (characters.routes.ts avatarGenerationPromptId). */
export function avatarOverrideId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
  return `avatar:${slug || "character"}`;
}

function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "portrait"
  );
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** The loopback client, wrapped so portraits and scenes carry their subjects' avatars as references. */
export function createImageClient({
  baseUrl = loopbackBaseUrl(),
  fetch: fetchImpl = globalThis.fetch,
  logger,
}: { baseUrl?: string; fetch?: Fetch; logger?: Logger } = {}): ImageClient {
  async function request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetchImpl(`${baseUrl}${path}`, init);
    if (!response.ok) {
      let reason = "";
      try {
        reason = str(((await response.json()) as { error?: unknown } | null)?.error);
      } catch {
        reason = "";
      }
      throw new Error(`engine ${path} -> ${response.status}${reason ? `: ${reason}` : ""}`);
    }
    return response.json();
  }

  const client: ImageClient = {
    async generateImage({ connectionId, name, prompt, negativePrompt, width, height, debugMode, referenceImages }) {
      const result = (await request("/api/characters/avatar-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId,
          name,
          appearance: prompt,
          purpose: "avatar",
          width,
          height,
          debugMode,
          referenceImages: referenceImages?.length ? referenceImages.slice(0, REFERENCES_MAX) : undefined,
          promptOverrides: [{ id: avatarOverrideId(name), prompt, negativePrompt }],
        }),
      })) as { image?: unknown; prompt?: unknown } | null;
      const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(str(result?.image));
      const mime = match?.[1].toLowerCase() ?? "";
      const base64 = match?.[2].replace(/\s+/g, "") ?? "";
      if (!IMAGE_TYPES[mime] || !base64) throw new Error("engine returned no usable image");
      const sent = str(result?.prompt);
      return {
        mime,
        ext: IMAGE_TYPES[mime],
        base64,
        width,
        height,
        prompt: sent,
        sentPrompt: prompt,
        overrideTook: sent === prompt,
      };
    },

    async uploadToGallery({ image, name, prompt, provider, model }) {
      // The Engine reads only the fields sent before the file.
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("provider", str(provider) || "image_generation");
      form.append("model", str(model) || "unknown");
      if (image.width && image.height) {
        form.append("width", String(Math.round(image.width)));
        form.append("height", String(Math.round(image.height)));
      }
      form.append(
        "file",
        new Blob([Buffer.from(image.base64, "base64")], { type: image.mime }),
        `${fileSlug(name)}${image.ext}`,
      );
      const saved = (await request("/api/global-gallery/upload", { method: "POST", body: form })) as {
        id?: unknown;
        url?: unknown;
      } | null;
      const id = str(saved?.id);
      const url = str(saved?.url);
      if (!id || !url) throw new Error("gallery upload returned no image");
      return { id, url };
    },

    async generatePortrait({ connectionId, name, prompt, negativePrompt, width, height, debugMode, referenceImages }) {
      const image = await client.generateImage({
        connectionId,
        name,
        prompt,
        negativePrompt,
        width,
        height,
        debugMode,
        referenceImages,
      });
      return client.uploadToGallery({ image, name, prompt });
    },

    async generateOutfit({ unit: _unit, ...request }) {
      // `unit` only tells the wrapper whose likeness to keep; its reference is in `referenceImages` by now.
      const image = await client.generateImage(request);
      return client.uploadToGallery({ image, name: request.name, prompt: request.prompt });
    },

    async generateBannerArt({ units: _units, ...request }) {
      // `units` only tell the wrapper whose references to add; they are in `referenceImages` by now.
      const image = await client.generateImage(request);
      return client.uploadToGallery({ image, name: request.name, prompt: request.prompt });
    },

    async styleProfile(profileId) {
      const empty: StyleProfile = { styleText: "", positiveTags: "", negativeTags: "" };
      try {
        const raw = (await request("/api/app-settings/ui")) as { value?: unknown } | null;
        const value = raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
        type Profiles = { profiles?: unknown; defaultProfileId?: unknown };
        const settings = (typeof value === "string" ? parseJson(value) : value) as {
          imageStyleProfiles?: Profiles;
          styleProfiles?: Profiles;
        } | null;
        const profiles = settings?.imageStyleProfiles ?? settings?.styleProfiles;
        const list = (Array.isArray(profiles?.profiles) ? profiles.profiles : []) as Array<Record<
          string,
          unknown
        > | null>;
        const find = (id: string) => (id ? list.find((profile) => str(profile?.id) === id) : undefined);
        const profile = find(str(profileId)) ?? find(str(profiles?.defaultProfileId)) ?? list[0];
        if (!profile) return empty;
        const mode = str(profile.promptMode);
        return {
          styleText: str(profile.baseStyle) === "auto" ? "" : str(profile.styleText),
          positiveTags: str(profile.positiveTags),
          negativeTags: str(profile.negativeTags),
          tagged: mode === "tagged" || mode === "danbooru",
        };
      } catch (error) {
        logger?.warn("[otome-forge] could not read the image style profiles: %s", String(error));
        return empty;
      }
    },

    async deleteGalleryImage(id) {
      if (!str(id)) return false;
      try {
        return (await fetchImpl(`${baseUrl}/api/global-gallery/${encodeURIComponent(str(id))}`, { method: "DELETE" }))
          .ok;
      } catch {
        return false;
      }
    },

    async characterCard(cardId) {
      const card = (await request(`/api/characters/${encodeURIComponent(cardId)}`)) as { avatarPath?: unknown } | null;
      return card && typeof card === "object" ? { avatarPath: str(card.avatarPath) } : null;
    },

    async personaAvatar(personaId) {
      try {
        const persona = (await request(`/api/characters/personas/${encodeURIComponent(personaId)}`)) as {
          avatarPath?: unknown;
        } | null;
        return str(persona?.avatarPath);
      } catch (error) {
        logger?.warn("[otome-forge] could not read persona %s for its avatar: %s", personaId, String(error));
        return "";
      }
    },

    async cardAvatarImage(path) {
      if (!path.startsWith("/")) return null;
      try {
        const response = await fetchImpl(`${baseUrl}${path}`);
        if (!response.ok) return null;
        const mime = str(response.headers.get("content-type")).split(";")[0].toLowerCase();
        if (!IMAGE_TYPES[mime]) return null;
        const bytes = Buffer.from(await response.arrayBuffer());
        return bytes.length ? { mime, base64: bytes.toString("base64") } : null;
      } catch {
        return null;
      }
    },
  };
  return forgeWrapImageReferenceClient(client, logger, { logPrefix: "[otome-forge]" });
}

const clients = new WeakMap<object, ImageClient>();

/** One loopback client per Engine runtime (the forge job and the routes share it). */
export function imageClientFor(runtime: Pick<CapabilityRuntimeHost, "logger">): ImageClient {
  let client = clients.get(runtime);
  if (!client) {
    client = createImageClient({ logger: runtime.logger });
    clients.set(runtime, client);
  }
  return client;
}
