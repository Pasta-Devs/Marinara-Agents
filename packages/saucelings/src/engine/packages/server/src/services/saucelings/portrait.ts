import { randomUUID } from "node:crypto";
import type { SaucelingFormStrips } from "../../../../shared/src/features/agents/saucelings/types.js";
import { getSaucelingsRuntime } from "./package-runtime.js";

const PACKAGE_ID = "saucelings";
const PORTRAIT_KIND = "saucelings-portrait";
const BACKGROUND_KIND = "saucelings-background";
const FORM_KIND = "saucelings-form";
const FIGURE_KIND = "saucelings-figure";
export const MAX_PORTRAIT_BYTES = 4 * 1024 * 1024;
/** A form strip is one or three 104x104 sprite frames side by side (52 art pixels at 2 image pixels each), so it
 *  stays small. */
export const FORM_SIDE = 104;
export const MAX_FORM_BYTES = 48 * 1024;
/** One form document: its front strip and up to three more (side, happy, grumpy). */
export const MAX_FORM_DOCUMENT_BYTES = 160 * 1024;
const FORM_STRIPS = ["image", "side", "happy", "grumpy"] as const;
/** A caretaker's figure is eight 96x96 frames (the client's FIGURE_POSES) side by side, one image pixel an art
 *  pixel; one painted before 0.6.0 has three. */
export const FIGURE_SIDE = 96;
/** Eight frames of pixel art fit in 128 KB. */
export const MAX_FIGURE_BYTES = 128 * 1024;

const SIGNATURES: Record<string, (bytes: Buffer) => boolean> = {
  "image/png": (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/webp": (bytes) =>
    bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP",
};

/** A portrait the client generated: a PNG, JPEG or WebP data URL whose bytes match its type. */
export function parsePortraitImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/u.exec(value);
  if (!match) return null;
  const [, mimeType, base64] = match;
  if ((base64.length * 3) / 4 > MAX_PORTRAIT_BYTES + 2) return null;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_PORTRAIT_BYTES) return null;
  return SIGNATURES[mimeType](bytes) ? value : null;
}

/** The frame counts a form strip may have (1 is a form painted before strips) and a figure (3 is one painted before
 *  0.6.0), each frame `side` image pixels wide. */
const FORM_FRAMES = [1, 3] as const;
const FIGURE_FRAMES = [8, 3] as const;

/** How many frames a PNG header gives a strip: the count whose width the PNG has, when it is `side` high; else null. */
function stripFrames<N extends number>(bytes: Buffer, side: number, counts: readonly N[]): N | null {
  // The first chunk of a PNG is IHDR: its width and height follow the chunk length and type.
  if (bytes.length < 24 || bytes.subarray(12, 16).toString("latin1") !== "IHDR") return null;
  if (bytes.readUInt32BE(20) !== side) return null;
  const width = bytes.readUInt32BE(16);
  return counts.find((count) => width === side * count) ?? null;
}

const PNG_PREFIX = "data:image/png;base64,";
/** The first 24 bytes of a stored strip, enough for its signature and IHDR. */
const headerOf = (image: string) => Buffer.from(image.slice(PNG_PREFIX.length, PNG_PREFIX.length + 32), "base64");

/** A strip the client made: a PNG data URL of at most `maxBytes` whose header says `side` high and a width that
 *  gives one of the frame counts. */
function parseStrip<N extends number>(
  value: unknown,
  maxBytes: number,
  side: number,
  counts: readonly N[],
): { image: string; frames: N } | null {
  if (typeof value !== "string" || !value.startsWith(PNG_PREFIX)) return null;
  const base64 = value.slice(PNG_PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(base64) || (base64.length * 3) / 4 > maxBytes + 2) return null;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > maxBytes || !SIGNATURES["image/png"](bytes)) return null;
  const frames = stripFrames(bytes, side, counts);
  return frames ? { image: value, frames } : null;
}

/** A form strip the client made: a PNG data URL of at most 48 KB whose header says 104 high and 104 or 312 wide. */
export const parseFormImage = (value: unknown) => parseStrip(value, MAX_FORM_BYTES, FORM_SIDE, FORM_FRAMES);

/** A form's strips from a request: the front `image` and any of side, happy and grumpy, all the same width and at
 *  most 160 KB together. */
export function parseFormStrips(value: Record<string, unknown>): { strips: SaucelingFormStrips; frames: 1 | 3 } | null {
  const front = parseFormImage(value.image);
  if (!front) return null;
  const strips: SaucelingFormStrips = { image: front.image };
  let total = front.image.length;
  for (const key of FORM_STRIPS.slice(1)) {
    if (value[key] === undefined || value[key] === null) continue;
    const strip = parseFormImage(value[key]);
    if (!strip || strip.frames !== front.frames) return null;
    strips[key] = strip.image;
    total += strip.image.length;
  }
  return (total * 3) / 4 <= MAX_FORM_DOCUMENT_BYTES ? { strips, frames: front.frames } : null;
}

/** A caretaker figure the client made: a PNG data URL of at most 128 KB whose header says 96 high and 768 wide
 *  (or 288). */
export const parseFigureImage = (value: unknown) =>
  parseStrip(value, MAX_FIGURE_BYTES, FIGURE_SIDE, FIGURE_FRAMES)?.image ?? null;

type ImageKind = typeof PORTRAIT_KIND | typeof BACKGROUND_KIND | typeof FORM_KIND | typeof FIGURE_KIND;

/** The data of one of this package's image documents, or null when the id is not one of that kind. */
async function readImageData(kind: ImageKind, id: string): Promise<Record<string, unknown> | null> {
  const doc = await getSaucelingsRuntime().persistence.documents.getById(PACKAGE_ID, id);
  return doc?.kind === kind && doc.data && typeof doc.data === "object" ? (doc.data as Record<string, unknown>) : null;
}

async function readImage(kind: ImageKind, id: string): Promise<string | null> {
  const image = (await readImageData(kind, id))?.image;
  return typeof image === "string" ? image : null;
}

/** Each image is its own document, which keeps image bytes out of the world document. Returns its id. */
async function saveImage(kind: ImageKind, data: { image: string }, nowIso: string, petId?: string): Promise<string> {
  const id = randomUUID();
  const label =
    kind === PORTRAIT_KIND
      ? "painting"
      : kind === FORM_KIND
        ? "form"
        : kind === FIGURE_KIND
          ? "caretaker"
          : "background";
  await getSaucelingsRuntime().persistence.documents.create({
    id,
    packageId: PACKAGE_ID,
    kind,
    name: `Sauceling ${label}`,
    description: petId ? `Sauceling ${label} for ${petId}` : `Sauceling ${label}`,
    data: petId ? { petId, ...data } : data,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  return id;
}

async function deleteImage(kind: ImageKind, id: string): Promise<void> {
  const documents = getSaucelingsRuntime().persistence.documents;
  const existing = await documents.getById(PACKAGE_ID, id);
  if (existing?.kind === kind) await documents.remove(PACKAGE_ID, existing.id, existing.revision);
}

export const readSaucelingPortrait = (id: string) => readImage(PORTRAIT_KIND, id);
export const saveSaucelingPortrait = (petId: string, image: string, nowIso: string) =>
  saveImage(PORTRAIT_KIND, { image }, nowIso, petId);
export const deleteSaucelingPortrait = (id: string) => deleteImage(PORTRAIT_KIND, id);

export const readSaucelingBackground = (id: string) => readImage(BACKGROUND_KIND, id);
/** Backgrounds are shared by every sauceling, so the document names none. */
export const saveSaucelingBackground = (image: string, nowIso: string) => saveImage(BACKGROUND_KIND, { image }, nowIso);
export const deleteSaucelingBackground = (id: string) => deleteImage(BACKGROUND_KIND, id);

/** A form's strips, the front one only when `frontOnly`; null when it is not a form or its front is unreadable. */
export async function readSaucelingForm(
  id: string,
  frontOnly = false,
): Promise<(SaucelingFormStrips & { frames: 1 | 3 }) | null> {
  const data = await readImageData(FORM_KIND, id);
  const image = data?.image;
  const frames =
    typeof image === "string" && image.startsWith(PNG_PREFIX)
      ? stripFrames(headerOf(image), FORM_SIDE, FORM_FRAMES)
      : null;
  if (!data || !frames) return null;
  const form: SaucelingFormStrips & { frames: 1 | 3 } = { image: image as string, frames };
  if (frontOnly) return form;
  for (const key of FORM_STRIPS.slice(1)) {
    if (typeof data[key] === "string") form[key] = data[key];
  }
  return form;
}
export const saveSaucelingForm = (petId: string, strips: SaucelingFormStrips, nowIso: string) =>
  saveImage(FORM_KIND, strips, nowIso, petId);
export const deleteSaucelingForm = (id: string) => deleteImage(FORM_KIND, id);

/** A stored figure and how many frames it has. A caretaker's figure names the character it shows, not a pet. */
export async function readSaucelingFigure(id: string): Promise<{ image: string; frames: 3 | 8 } | null> {
  const image = await readImage(FIGURE_KIND, id);
  const frames = image?.startsWith(PNG_PREFIX) ? stripFrames(headerOf(image), FIGURE_SIDE, FIGURE_FRAMES) : null;
  return image && frames ? { image, frames } : null;
}
export const saveSaucelingFigure = (characterId: string, image: string, nowIso: string) => {
  const data = { image, characterId };
  return saveImage(FIGURE_KIND, data, nowIso);
};
export const deleteSaucelingFigure = (id: string) => deleteImage(FIGURE_KIND, id);

/** Reset: every painting, every saved background, every form and every caretaker figure. */
export async function removeAllSaucelingPortraits(): Promise<void> {
  const documents = getSaucelingsRuntime().persistence.documents;
  for (const kind of [PORTRAIT_KIND, BACKGROUND_KIND, FORM_KIND, FIGURE_KIND]) {
    for (const doc of await documents.list(PACKAGE_ID, kind)) {
      await documents.remove(PACKAGE_ID, doc.id, doc.revision);
    }
  }
}
