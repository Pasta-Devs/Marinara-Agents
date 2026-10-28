import { api } from "../../../lib/api-client";
import type { SlpPostCardModel } from "./SlpPostTypes";
import { wrapSlpShareCardText } from "./slp-share-card-text";

/**
 * Renders a post as one downloadable PNG in the browser, on a canvas.
 *
 * This used to be composed server-side with `sharp`, which can only draw text by rasterizing an
 * SVG overlay — and that needs fonts installed on the host. Engine installs routinely have none,
 * so every card came out as the post image on a blank slab: no name, no title, no caption. The
 * browser always has fonts and real text metrics, so the card is built here instead.
 */

const WIDTH = 1080;
const PADDING = 64;
const AVATAR = 112;
const CONTENT_WIDTH = WIDTH - PADDING * 2;
const BACKGROUND = "#141019";

export type SlpShareCardInput = {
  displayName: string;
  handle: string;
  title?: string | null;
  content?: string | null;
  avatarUrl?: string | null;
  imageUrl?: string | null;
};

/**
 * Package media sits behind the Engine's admin-secret gate, so it has to come through the API
 * client rather than a plain `<img src>`. Engine-native URLs are fetched as-is.
 */
async function loadBitmap(url: string | null | undefined): Promise<ImageBitmap | null> {
  if (!url) return null;
  try {
    const response = url.startsWith("/api/slurp2/") ? await api.raw(url.slice("/api".length)) : await fetch(url);
    if (!response.ok) return null;
    return await createImageBitmap(await response.blob());
  } catch {
    return null;
  }
}

const TITLE_FONT = "700 46px system-ui, sans-serif";
const BODY_FONT = "400 34px system-ui, sans-serif";

export async function renderSlpShareCard(input: SlpShareCardInput): Promise<Blob | null> {
  const [avatar, image] = await Promise.all([loadBitmap(input.avatarUrl), loadBitmap(input.imageUrl)]);

  // Measure first: the wrapped text and the scaled image together decide the card's height.
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  const width = (value: string) => measure.measureText(value).width;
  measure.font = TITLE_FONT;
  const titleLines = input.title ? wrapSlpShareCardText(width, input.title, CONTENT_WIDTH, 2) : [];
  measure.font = BODY_FONT;
  const bodyLines = input.content ? wrapSlpShareCardText(width, input.content, CONTENT_WIDTH, image ? 4 : 10) : [];

  const scale = image ? Math.min(CONTENT_WIDTH / image.width, 1350 / image.height) : 0;
  const imageWidth = image ? Math.round(image.width * scale) : 0;
  const imageHeight = image ? Math.round(image.height * scale) : 0;
  const headerHeight = PADDING + AVATAR + 48;
  const textHeight = titleLines.length * 58 + (titleLines.length ? 16 : 0) + bodyLines.length * 44;
  const height = headerHeight + textHeight + (image ? imageHeight + 40 : 0) + PADDING;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, WIDTH, height);

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(PADDING + AVATAR / 2, PADDING + AVATAR / 2, AVATAR / 2, 0, Math.PI * 2);
    ctx.clip();
    // Cover-fit the source square into the circle so a portrait avatar is not squashed.
    const cover = Math.max(AVATAR / avatar.width, AVATAR / avatar.height);
    ctx.drawImage(
      avatar,
      PADDING + (AVATAR - avatar.width * cover) / 2,
      PADDING + (AVATAR - avatar.height * cover) / 2,
      avatar.width * cover,
      avatar.height * cover,
    );
    ctx.restore();
  }

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px system-ui, sans-serif";
  ctx.fillText(input.displayName, PADDING + AVATAR + 28, PADDING + 50, CONTENT_WIDTH - AVATAR - 28);
  ctx.fillStyle = "#b9b3c4";
  ctx.font = "400 32px system-ui, sans-serif";
  ctx.fillText(`@${input.handle}`, PADDING + AVATAR + 28, PADDING + 96, CONTENT_WIDTH - AVATAR - 28);

  let cursorY = headerHeight;
  ctx.fillStyle = "#ffffff";
  ctx.font = TITLE_FONT;
  for (const line of titleLines) ctx.fillText(line, PADDING, (cursorY += 58));
  if (titleLines.length) cursorY += 16;
  ctx.fillStyle = "#ded9e6";
  ctx.font = BODY_FONT;
  for (const line of bodyLines) ctx.fillText(line, PADDING, (cursorY += 44));

  if (image) {
    ctx.drawImage(image, PADDING, height - PADDING - imageHeight, imageWidth, imageHeight);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.strokeRect(PADDING + 0.5, height - PADDING - imageHeight + 0.5, imageWidth - 1, imageHeight - 1);
  }

  ctx.fillStyle = "#e0568f";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("slurp", WIDTH - PADDING, height - 32);

  return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

/** Render the card and hand it to the browser as a download. */
export async function downloadSlpShareCard(input: SlpShareCardInput, filename: string): Promise<void> {
  const blob = await renderSlpShareCard(input);
  if (!blob) throw new Error("Could not build the post image.");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** The card's fields as they sit on a post card model. */
export function toSlpShareCardInput(post: SlpPostCardModel): SlpShareCardInput {
  return {
    displayName: post.authorSnapshot?.displayName ?? "",
    handle: post.authorSnapshot?.handle ?? "",
    title: post.title,
    content: post.content,
    avatarUrl: post.authorSnapshot?.avatarUrl ?? null,
    imageUrl: post.images[0]?.imageUrl ?? post.imageUrl,
  };
}
