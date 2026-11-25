// ──────────────────────────────────────────────
// Story Writer: Markdown and plain-text export
// ──────────────────────────────────────────────
import { storyDisplayTitle, type StoryIllustration, type StoryWithChapters } from "./model";
import { anchorIndex, markdownBlocks, markdownToPlainText } from "./markdown";

export interface StoryExportOptions {
  /** The localized chapter label; defaults to "Chapter N". */
  chapterLabel?: (chapterNumber: number) => string;
  /**
   * Markdown only: the Engine's address (window.location.origin), so each picture is an image the file links to. Plain
   * text has no pictures.
   */
  pictureBaseUrl?: string;
}

/** Picture prompts are long prose: the alt text keeps them on one line, with no bracket that ends it early. */
function altText(prompt: string): string {
  return prompt
    .replace(/\s+/g, " ")
    .replace(/[[\]\\]/g, "")
    .trim();
}

/**
 * A chapter's body with each picture as a Markdown image before the block it sits beside, as the book shows it.
 * `titled`: the chapter opens with the heading the export prints on its own, so a picture beside it goes after it.
 */
function withPictures(text: string, pictures: StoryIllustration[], titled: boolean, baseUrl: string): string {
  const blocks = markdownBlocks(text);
  const skip = titled && blocks[0]?.html.startsWith("<h") ? 1 : 0;
  const texts = blocks.map((block) => markdownToPlainText(block.source));
  const images = new Map<number, string[]>();
  for (const picture of pictures) {
    const index = Math.max(skip, anchorIndex(texts, picture.paragraph, picture.anchor));
    images.set(index, [...(images.get(index) ?? []), `![${altText(picture.prompt)}](${baseUrl}${picture.url})`]);
  }
  const parts = blocks.slice(skip).flatMap((block, index) => [...(images.get(index + skip) ?? []), block.source]);
  // A chapter whose text is only its heading still shows its pictures.
  if (blocks.length <= skip) parts.push(...(images.get(skip) ?? []));
  return parts.join("\n\n");
}

interface ExportChapter {
  heading: string;
  body: string;
}

/** A chapter's own opening "# Title" line becomes its heading, so the title is not printed twice. */
function exportChapters(story: StoryWithChapters, options: StoryExportOptions): ExportChapter[] {
  const label = options.chapterLabel ?? ((chapterNumber: number) => `Chapter ${chapterNumber}`);
  return story.chapters.flatMap((chapter, index) => {
    if (!chapter.text.trim()) return [];
    const opening = /^\s*#{1,3}\s+(.+?)(?:\s+#+)?\s*(?:\n|$)/.exec(chapter.text);
    const title = opening?.[1]?.trim() ?? "";
    const pictures = chapter.illustrations ?? [];
    const body =
      options.pictureBaseUrl !== undefined && pictures.length
        ? withPictures(chapter.text, pictures, !!opening, options.pictureBaseUrl)
        : (opening ? chapter.text.slice(opening[0].length) : chapter.text).trim();
    return [{ heading: title ? `${label(index + 1)}: ${title}` : label(index + 1), body }];
  });
}

export function storyToMarkdown(
  story: StoryWithChapters,
  fallbackTitle: string,
  options: StoryExportOptions = {},
): string {
  const parts = [`# ${storyDisplayTitle(story.story.settings, fallbackTitle)}`];
  for (const chapter of exportChapters(story, options)) {
    parts.push(`## ${chapter.heading}`);
    if (chapter.body) parts.push(chapter.body);
  }
  return `${parts.join("\n\n")}\n`;
}

export function storyToPlainText(
  story: StoryWithChapters,
  fallbackTitle: string,
  options: StoryExportOptions = {},
): string {
  const parts = [storyDisplayTitle(story.story.settings, fallbackTitle)];
  for (const chapter of exportChapters(story, { ...options, pictureBaseUrl: undefined })) {
    parts.push(chapter.heading);
    const body = markdownToPlainText(chapter.body);
    if (body) parts.push(body);
  }
  return `${parts.join("\n\n")}\n`;
}

/** A file name from the story title; characters that file systems reject become "_". */
export function storyFileName(title: string, extension: string): string {
  const base = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${base || "story"}.${extension}`;
}

export function downloadTextFile(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Safari starts the download after click() returns; revoking at once can cancel it.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
