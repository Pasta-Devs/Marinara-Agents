import { getSharp } from "../../utils/sharp.js";
import { logger } from "../../lib/logger.js";

/**
 * Renders a post as one downloadable PNG: banner-free card with the creator's avatar, name,
 * handle, the post title and caption, and the post image if it has one.
 *
 * Composed server-side with `sharp`, which the Engine already ships, rather than screenshotting
 * the DOM. That costs a hand-built layout — this is a fixed card design, not a pixel copy of the
 * feed — but it needs no new dependency, no headless browser, and it renders identically whether
 * the request came from a phone or a desktop.
 *
 * Text is drawn as an SVG overlay because that is the only text `sharp` can rasterize.
 */

const CARD_WIDTH = 1080;
const PADDING = 64;
const AVATAR_SIZE = 112;
/** Card height with no image: header block plus the text block. */
const HEADER_HEIGHT = PADDING + AVATAR_SIZE + 48;
const IMAGE_WIDTH = CARD_WIDTH - PADDING * 2;

export type SlurpShareCardInput = {
  displayName: string;
  handle: string;
  title: string | null;
  content: string;
  /** Decoded avatar bytes, or null when the creator has no avatar or it could not be read. */
  avatar: Buffer | null;
  /** Decoded post image bytes, or null for a text-only post. */
  image: Buffer | null;
};

/**
 * XML-escape. Every field here is user- or model-authored, so it reaches the SVG untrusted: an
 * unescaped `&` or `<` in a display name would produce invalid XML and fail the whole render.
 */
function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/gu, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      default:
        return "&quot;";
    }
  });
}

/**
 * Greedy wrap at a character budget rather than by measured glyph width.
 *
 * ponytail: character counting, not text metrics, so a line of all-caps or all-`W` runs wide and
 * a line of `i` runs short. Measuring properly means shipping a font metrics library for a card
 * nobody pixel-inspects. Swap in real metrics only if the overflow is ever visible.
 */
function wrap(value: string, perLine: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/u).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= perLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    // A single word longer than the budget is hard-cut: better a clipped word than a blown layout.
    current = word.length > perLine ? `${word.slice(0, perLine - 1)}…` : word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && value.length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, perLine - 1)}…`;
  }
  return lines;
}

export async function renderSlurpShareCard(input: SlurpShareCardInput): Promise<Buffer | null> {
  const sharp = await getSharp();
  if (!sharp) return null;
  try {
    // Resize the post image first: its rendered height decides the card's height.
    let imageLayer: { buffer: Buffer; height: number } | null = null;
    if (input.image) {
      const resized = await sharp(input.image, { animated: false })
        .rotate()
        .resize({ width: IMAGE_WIDTH, height: 1350, fit: "inside", withoutEnlargement: false })
        .png()
        .toBuffer({ resolveWithObject: true });
      imageLayer = { buffer: resized.data, height: resized.info.height };
    }

    const titleLines = input.title ? wrap(input.title, 38, 2) : [];
    const bodyLines = wrap(input.content, 52, imageLayer ? 3 : 8);
    const textHeight = titleLines.length * 58 + bodyLines.length * 44 + (titleLines.length ? 16 : 0);
    const imageHeight = imageLayer ? imageLayer.height + 40 : 0;
    const cardHeight = HEADER_HEIGHT + textHeight + imageHeight + PADDING;

    let cursorY = HEADER_HEIGHT;
    const titleSvg = titleLines
      .map((line) => `<text x="${PADDING}" y="${(cursorY += 58)}" class="title">${escapeXml(line)}</text>`)
      .join("");
    if (titleLines.length) cursorY += 16;
    const bodySvg = bodyLines
      .map((line) => `<text x="${PADDING}" y="${(cursorY += 44)}" class="body">${escapeXml(line)}</text>`)
      .join("");

    const overlay = Buffer.from(
      `<svg width="${CARD_WIDTH}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .name { font: 700 44px sans-serif; fill: #ffffff; }
          .handle { font: 400 32px sans-serif; fill: #b9b3c4; }
          .title { font: 700 46px sans-serif; fill: #ffffff; }
          .body { font: 400 34px sans-serif; fill: #ded9e6; }
          .mark { font: 700 28px sans-serif; fill: #e0568f; }
        </style>
        <rect width="${CARD_WIDTH}" height="${cardHeight}" fill="#141019"/>
        <text x="${PADDING + AVATAR_SIZE + 28}" y="${PADDING + 50}" class="name">${escapeXml(input.displayName)}</text>
        <text x="${PADDING + AVATAR_SIZE + 28}" y="${PADDING + 96}" class="handle">@${escapeXml(input.handle)}</text>
        <text x="${CARD_WIDTH - PADDING}" y="${cardHeight - 32}" class="mark" text-anchor="end">slurp</text>
      </svg>`,
    );

    // Circular avatar: a round mask composited onto the square source.
    const avatarLayer = input.avatar
      ? await sharp(input.avatar, { animated: false })
          .rotate()
          .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
          .composite([
            {
              input: Buffer.from(
                `<svg width="${AVATAR_SIZE}" height="${AVATAR_SIZE}"><circle cx="${AVATAR_SIZE / 2}" cy="${AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}" fill="#fff"/></svg>`,
              ),
              blend: "dest-in",
            },
          ])
          .png()
          .toBuffer()
      : null;

    return await sharp({
      create: {
        width: CARD_WIDTH,
        height: cardHeight,
        channels: 4,
        background: { r: 20, g: 16, b: 25, alpha: 1 },
      },
    })
      .composite([
        { input: overlay, top: 0, left: 0 },
        ...(avatarLayer ? [{ input: avatarLayer, top: PADDING, left: PADDING }] : []),
        ...(imageLayer
          ? [{ input: imageLayer.buffer, top: cardHeight - PADDING - imageLayer.height, left: PADDING }]
          : []),
      ])
      .png()
      .toBuffer();
  } catch (error) {
    logger.warn(error, "[slurp] Failed to render a post share card");
    return null;
  }
}
