import type { SaucelingFormStrips, SaucelingStage } from "../../../../shared/src/features/agents/saucelings/types.js";
import {
  breathingFigure,
  figureFromSheet,
  formFromPainting,
  formsFromSheet,
  readSheet,
  sheetLayout,
  type Rgba,
} from "./form-art.js";

/** A sprite frame is 104 screen pixels (52 art pixels at 2x); a reference is drawn at 4x that so the model sees
 *  big, square pixels. */
const FRAME_PX = 104;
const REFERENCE_PX = 416;
/** Behind a reference's transparent pixels, so a model that drops transparency does not see black. */
const REFERENCE_BACKDROP = "#ececec";
/** A painting is shrunk to this before it is cut out: plenty for a 52-pixel form, and quick to scan. */
const FORM_INPUT_PX = 512;
/** A life sheet holds up to 18 drawings, so it is read at the size it is asked for. */
const SHEET_INPUT_PX = 1024;
/** A picture of the caretaker sent with a request is at most this many pixels a side. */
const PICTURE_REFERENCE_PX = 512;
/** A painting kept in the Album is at most this many pixels a side. */
const ALBUM_PAINTING_PX = 1024;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file is not a picture this browser can open."));
    image.src = src;
  });
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw pictures.");
  return { canvas, context };
}

/** An RGBA picture as a PNG data URL. */
export function pngOf(picture: Rgba): string {
  const { canvas, context } = canvasOf(picture.width, picture.height);
  context.putImageData(new ImageData(new Uint8ClampedArray(picture.data), picture.width, picture.height), 0, 0);
  return canvas.toDataURL("image/png");
}

/** `image`'s size shrunk so its longer side is at most `maxSide`. */
function sizeWithin(image: HTMLImageElement, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  return {
    width: Math.max(1, Math.round(image.naturalWidth * scale)),
    height: Math.max(1, Math.round(image.naturalHeight * scale)),
  };
}

/** A picture's pixels, shrunk first so its longer side is at most `maxSide`. */
async function pixelsOf(src: string, maxSide: number): Promise<Rgba> {
  const image = await loadImage(src);
  const { width, height } = sizeWithin(image, maxSide);
  const input = canvasOf(width, height);
  input.context.drawImage(image, 0, 0, width, height);
  return input.context.getImageData(0, 0, width, height);
}

/** A painting cut out and shrunk into a form strip for `stage` (three 104x104 frames), as a PNG data URL; null
 *  when nothing is left once its background is taken away. */
export async function formImageFrom(src: string, stage: SaucelingStage): Promise<string | null> {
  const form = formFromPainting(await pixelsOf(src, FORM_INPUT_PX), stage);
  return form ? pngOf(form) : null;
}

/** A life sheet cut into the forms of `stages` (its rows, top to bottom) as PNG data URLs; null when its rows
 *  and drawings cannot be found. */
export async function sheetFormsFrom(
  src: string,
  stages: SaucelingStage[],
): Promise<Partial<Record<SaucelingStage, SaucelingFormStrips>> | null> {
  const pixels = await pixelsOf(src, SHEET_INPUT_PX);
  const read = readSheet(pixels, sheetLayout(stages));
  if (!read) return null;
  const forms: Partial<Record<SaucelingStage, SaucelingFormStrips>> = {};
  for (const [stage, strips] of Object.entries(formsFromSheet(pixels, read, stages))) {
    forms[stage as SaucelingStage] = {
      image: pngOf(strips.image),
      ...(strips.side ? { side: pngOf(strips.side) } : {}),
      ...(strips.happy ? { happy: pngOf(strips.happy) } : {}),
      ...(strips.grumpy ? { grumpy: pngOf(strips.grumpy) } : {}),
    };
  }
  return forms;
}

/** Eight drawings of the caretaker cut into their figure strip (eight 96x96 frames, or three when only the first
 *  three can be read), as a PNG data URL with its frame count; null when not even three can be found. */
export async function figureImageFrom(src: string): Promise<{ image: string; frames: number } | null> {
  const figure = figureFromSheet(await pixelsOf(src, SHEET_INPUT_PX));
  return figure ? { image: pngOf(figure), frames: figure.width / figure.height } : null;
}

/** A figure strip that breathes, over its squashed row, and its blink (null when the figure's eyes cannot be found),
 *  as PNG data URLs (see form-art.ts's breathingFigure). */
export async function breathingFigureFrom(src: string): Promise<{ body: string; blink: string | null }> {
  const { body, blink } = breathingFigure(await pixelsOf(src, Infinity));
  return { body: pngOf(body), blink: blink ? pngOf(blink) : null };
}

/** A picture of the caretaker (their avatar or an Engine sprite) shrunk onto a light backdrop, as a JPEG data URL,
 *  for a request to keep their look. */
export async function pictureReference(src: string): Promise<string> {
  const image = await loadImage(src);
  const { width, height } = sizeWithin(image, PICTURE_REFERENCE_PX);
  const { canvas, context } = canvasOf(width, height);
  context.fillStyle = REFERENCE_BACKDROP;
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** A painting shrunk to at most 1024 pixels a side as a WebP data URL (PNG where a browser cannot make WebP), so the
 *  Album stays small; the painting as it came when that is no smaller. */
export async function albumPainting(src: string): Promise<string> {
  const image = await loadImage(src);
  const { width, height } = sizeWithin(image, ALBUM_PAINTING_PX);
  const { canvas, context } = canvasOf(width, height);
  context.drawImage(image, 0, 0, width, height);
  const shrunk = canvas.toDataURL("image/webp", 0.9);
  return shrunk.length < src.length ? shrunk : src;
}

/** The first frame of a sprite strip (on `row` of a species sheet), enlarged with square pixels, as a PNG data URL:
 *  the picture a painting is asked to keep the creature of. */
export async function spriteReference(src: string, row = 0): Promise<string> {
  const image = await loadImage(src);
  const side = Math.min(image.naturalHeight, FRAME_PX);
  const { canvas, context } = canvasOf(REFERENCE_PX, REFERENCE_PX);
  context.fillStyle = REFERENCE_BACKDROP;
  context.fillRect(0, 0, REFERENCE_PX, REFERENCE_PX);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, row * FRAME_PX, side, side, 0, 0, REFERENCE_PX, REFERENCE_PX);
  return canvas.toDataURL("image/png");
}
