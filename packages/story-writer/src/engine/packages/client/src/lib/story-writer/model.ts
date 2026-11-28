// ──────────────────────────────────────────────
// Story Writer: the data model both the package client and its server use
// ──────────────────────────────────────────────
// Pure TypeScript with no imports, so the server bundle can take it by relative path. The server normalizes every
// write through these functions; the client uses the same defaults for a story it has not saved yet.

export const STORY_WRITER_PACKAGE_ID = "story-writer";

export const DEFAULT_SYSTEM_PROMPT =
  "You are an excellent writer for the user. Your goal is to write the next chapter of this fictional story.";
/** What an unchanged default prompt says with Chapter length "Off (I decide)", which never asks for a chapter. */
export const DEFAULT_WRITER_SYSTEM_PROMPT =
  "You are an excellent writer for the user. Your goal is to write the next part of this fictional story.";
export const DEFAULT_BANNED_PHRASES = "ozone, jaws working, Elara";
export const DEFAULT_CONTINUE_MESSAGE = "Continue.";
export const DEFAULT_CHAPTER_WORDS = 2000;
export const DEFAULT_KEEP_FULL_CHAPTERS = 3;

export const LIMITS = {
  shortText: 2_000,
  longText: 50_000,
  systemPrompt: 20_000,
  chapterText: 400_000,
  summary: 20_000,
  timelineEvents: 200,
  timelineEventText: 1_000,
  quickReplies: 24,
  quickReplyLabel: 40,
  selectedIds: 200,
  chapterWords: { min: 100, max: 20_000 },
  targetWords: { min: 1_000, max: 2_000_000 },
  keepFullChapters: { min: 0, max: 50 },
  authorNoteDepth: { min: 0, max: 100 },
  fontSize: { min: 12, max: 36 },
  chaptersPerStory: 2_000,
  illustrationsPerChapter: 100,
  picturePrompt: 4_000,
  picturePrefix: 1_000,
  illustrationAnchor: 120,
} as const;

/** "document": no pages, one column of chapters that scrolls down. A package before 0.3.0 reads it as "book". */
export type StoryTheme = "book" | "ebook" | "document";
export type StoryColorMode = "app" | "light" | "dark";
export type StorySide = "left" | "right";

/** A saved instruction the quick bar sends in place of the continue message. */
export interface QuickReply {
  id: string;
  /** What the button shows; empty = the instruction itself. */
  label: string;
  text: string;
}

/** Reading and layout preferences and the quick replies. One document per Engine install, shared by every story. */
export interface StoryWriterPreferences {
  theme: StoryTheme;
  colorMode: StoryColorMode;
  /** "" = the theme's own font; "@serif" | "@sans" | "@mono" | "@app"; anything else is a font family name. */
  fontFamily: string;
  /** "" = the theme's ink color; otherwise a #rrggbb color. */
  fontColor: string;
  /** Reading text size in CSS pixels. */
  fontSize: number;
  sidebarSide: StorySide;
  noteSide: StorySide;
  /** Hiding the sticky note only hides it: its text is still sent with every chapter. */
  showAuthorNote: boolean;
  streaming: boolean;
  pageAnimation: boolean;
  lastStoryId: string | null;
  showQuickReplies: boolean;
  quickReplies: QuickReply[];
}

export interface TimelineEvent {
  id: string;
  text: string;
  done: boolean;
}

/** Everything the author sets for one story. Every text field is optional and free-form. */
export interface StorySettings {
  title: string;
  connectionId: string | null;
  /** The Engine image connection Illustrate paints with; null = none, and Illustrate never makes a paid call. */
  imageConnectionId: string | null;
  /** Put before every picture prompt Illustrate writes (artist or quality tags, say); "" = none. */
  picturePromptPrefix: string;
  /** Put before the negative prompt every picture is painted with; "" = none. */
  pictureNegativePrefix: string;
  /**
   * Send the avatars of the story's characters and personas the picture prompt names with the picture, as references.
   * Absent (a story from before 0.7.0) = true.
   */
  pictureReferences: boolean;
  /** Target length of one chapter, in words. */
  chapterWords: number;
  /**
   * Chapter length "Off (I decide)": Generate writes into the chapter the author is on, never ends one and never starts
   * one. `chapterWords` is kept for when a length is picked again. Absent (a story from before 0.5.0) = false.
   */
  writerDecides: boolean;
  /** Target length of the whole story, in words; null = open-ended. */
  targetWords: number | null;
  characterIds: string[];
  personaIds: string[];
  lorebookIds: string[];
  overview: string;
  systemPrompt: string;
  bannedPhrases: string;
  author: string;
  style: string;
  tags: string;
  genre: string;
  rating: string;
  fandom: string;
  relationships: string;
  warnings: string;
  language: string;
  /** Story bible: facts, names and rules the model must keep straight. */
  notes: string;
  /** The user message sent when the author asks for more. */
  continueMessage: string;
  /** The sticky note: the author's instructions for the next chapter. */
  authorNote: string;
  /**
   * Where the note goes, as a user message, like Roleplay's Author's Notes: 0 = right before the continue message,
   * 1 = before the latest chapter, and so on. It never moves above the system prompt.
   */
  authorNoteDepth: number;
  clearNoteAfterChapter: boolean;
  /** Ask the model to open each chapter with a "# Title" heading. */
  chapterTitles: boolean;
  timeline: TimelineEvent[];
  /** Refresh the timeline after each chapter the model writes. */
  autoTimeline: boolean;
  /** The last N chapters always go to the model in full; older chapters with a summary go as their summary. */
  keepFullChapters: number;
  /** Summarize a chapter automatically once it falls outside the last N. */
  autoSummarize: boolean;
}

export type ChapterStatus = "draft" | "complete";

/** A picture beside a paragraph of a chapter, painted by the Engine's image connection and kept in its Global Gallery. */
export interface StoryIllustration {
  id: string;
  /** `global-gallery:<id>`: while a package document holds it, the Engine refuses to delete that gallery image. */
  image: string;
  /** Where the Engine serves the picture: /api/global-gallery/file/<name>. */
  url: string;
  /** The picture prompt it was painted from, which is also its description for screen readers. */
  prompt: string;
  width: number;
  height: number;
  /** The block it sits beside, by its index among the chapter's blocks (markdownBlocks) when it was painted... */
  paragraph: number;
  /** ...and that block's opening words, which find it again after the text above it changes (anchorIndex). */
  anchor: string;
}

export interface StoryChapter {
  id: string;
  storyId: string;
  /** Markdown. */
  text: string;
  summary: string;
  /**
   * "draft": started by the author, or cut off; Write continues it. "complete": Write starts a new chapter. Generate
   * (Chapter length "Off") never changes it.
   */
  status: ChapterStatus;
  /** The user message that produced this chapter, so history replays what was really asked. */
  request: string;
  /**
   * Its pictures, in the order they were painted. Only the illustration routes change them: a chapter save, a
   * generation, Continue and Rewrite write the text and leave them as they are.
   */
  illustrations: StoryIllustration[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryRecord {
  id: string;
  settings: StorySettings;
  chapterIds: string[];
  /** Cached totals, kept current by the server on every chapter write. */
  wordCount: number;
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StorySummary {
  id: string;
  title: string;
  wordCount: number;
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryWithChapters {
  story: StoryRecord;
  chapters: StoryChapter[];
}

// ── Server API (prefix /api/story-writer; the host api client takes paths without "/api") ──
// GET    /story-writer/preferences                         → StoryWriterPreferences
// PATCH  /story-writer/preferences       Partial<Prefs>    → StoryWriterPreferences
// GET    /story-writer/stories                             → StorySummary[] (newest updatedAt first)
// POST   /story-writer/stories           { settings? }     → StoryWithChapters
// GET    /story-writer/stories/:id                         → StoryWithChapters
// PATCH  /story-writer/stories/:id       { settings }      → StoryRecord   (settings is a partial StorySettings)
// POST   /story-writer/stories/:id/duplicate               → StoryWithChapters
// DELETE /story-writer/stories/:id                         → { ok: true }
// POST   /story-writer/stories/:id/chapters  ChapterCreate → StoryWithChapters
// PATCH  /story-writer/stories/:id/chapters/:chapterId  ChapterPatch → { story: StoryRecord; chapter: StoryChapter }
// DELETE /story-writer/stories/:id/chapters/:chapterId     → StoryWithChapters
// POST   /story-writer/stories/:id/chapters/:chapterId/illustrations  IllustrationCreate
//                                                          → { story: StoryRecord; chapter: StoryChapter }
// DELETE /story-writer/stories/:id/chapters/:chapterId/illustrations/:illustrationId
//                                                          → { story: StoryRecord; chapter: StoryChapter }
// Errors: { error: string } with 400 (invalid input), 404 (unknown story/chapter), 409 (chapter id taken), 502 (the
// Engine could not paint or keep the picture).

/** Paints a picture with the Engine's image connection and puts it in the chapter beside one of its blocks. */
export interface IllustrationCreate {
  connectionId: string;
  prompt: string;
  paragraph: number;
  anchor: string;
  /** Illustrate again: the illustration this one takes the place of. */
  replace?: string;
  debugMode?: boolean;
}

export interface ChapterCreate {
  /** Optional client id (CLIENT_ID_PATTERN), so a chapter the author starts typing keeps its element. */
  id?: string;
  text?: string;
  summary?: string;
  status?: ChapterStatus;
  request?: string;
}

export interface ChapterPatch {
  text?: string;
  summary?: string;
  status?: ChapterStatus;
  request?: string;
}

export const CLIENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{7,63}$/;

export function storyDocumentId(storyId: string): string {
  return `${STORY_WRITER_PACKAGE_ID}:story:${storyId}`;
}

export function chapterDocumentId(chapterId: string): string {
  return `${STORY_WRITER_PACKAGE_ID}:chapter:${chapterId}`;
}

export const PREFERENCES_DOCUMENT_ID = `${STORY_WRITER_PACKAGE_ID}:preferences`;

export function defaultPreferences(): StoryWriterPreferences {
  return {
    theme: "book",
    colorMode: "app",
    fontFamily: "",
    fontColor: "",
    fontSize: 18,
    sidebarSide: "left",
    noteSide: "right",
    showAuthorNote: true,
    streaming: true,
    pageAnimation: true,
    lastStoryId: null,
    showQuickReplies: true,
    quickReplies: [],
  };
}

export function defaultStorySettings(): StorySettings {
  return {
    title: "",
    connectionId: null,
    imageConnectionId: null,
    picturePromptPrefix: "",
    pictureNegativePrefix: "",
    pictureReferences: true,
    chapterWords: DEFAULT_CHAPTER_WORDS,
    writerDecides: false,
    targetWords: null,
    characterIds: [],
    personaIds: [],
    lorebookIds: [],
    overview: "",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    bannedPhrases: DEFAULT_BANNED_PHRASES,
    author: "",
    style: "",
    tags: "",
    genre: "",
    rating: "",
    fandom: "",
    relationships: "",
    warnings: "",
    language: "",
    notes: "",
    continueMessage: DEFAULT_CONTINUE_MESSAGE,
    authorNote: "",
    authorNoteDepth: 0,
    clearNoteAfterChapter: false,
    chapterTitles: true,
    timeline: [],
    autoTimeline: false,
    keepFullChapters: DEFAULT_KEEP_FULL_CHAPTERS,
    autoSummarize: false,
  };
}

// ── Normalizers: every write passes through these, so stored data always has the full shape ──

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, max: number, fallback: string): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function integer(value: unknown, range: { min: number; max: number }, fallback: number): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(number)));
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

function idList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const ids = value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 200);
  return [...new Set(ids)].slice(0, LIMITS.selectedIds);
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Merges `patch` over `base` and returns a complete, valid preferences object. */
export function normalizePreferences(patch: unknown, base: StoryWriterPreferences = defaultPreferences()) {
  const input = isRecord(patch) ? patch : {};
  const fontColor = "fontColor" in input ? input.fontColor : base.fontColor;
  const lastStoryId = "lastStoryId" in input ? input.lastStoryId : base.lastStoryId;
  const preferences: StoryWriterPreferences = {
    theme: oneOf(input.theme, ["book", "ebook", "document"], base.theme),
    colorMode: oneOf(input.colorMode, ["app", "light", "dark"], base.colorMode),
    fontFamily: text(input.fontFamily, 200, base.fontFamily).trim(),
    fontColor: typeof fontColor === "string" && (fontColor === "" || HEX_COLOR.test(fontColor)) ? fontColor : "",
    fontSize: integer(input.fontSize, LIMITS.fontSize, base.fontSize),
    sidebarSide: oneOf(input.sidebarSide, ["left", "right"], base.sidebarSide),
    noteSide: oneOf(input.noteSide, ["left", "right"], base.noteSide),
    showAuthorNote: typeof input.showAuthorNote === "boolean" ? input.showAuthorNote : base.showAuthorNote,
    streaming: typeof input.streaming === "boolean" ? input.streaming : base.streaming,
    pageAnimation: typeof input.pageAnimation === "boolean" ? input.pageAnimation : base.pageAnimation,
    lastStoryId: typeof lastStoryId === "string" && lastStoryId.length <= 200 ? lastStoryId : null,
    showQuickReplies: typeof input.showQuickReplies === "boolean" ? input.showQuickReplies : base.showQuickReplies,
    quickReplies: normalizeEntries(input.quickReplies, base.quickReplies, "reply", LIMITS.quickReplies, (item) => ({
      label: text(item.label, LIMITS.quickReplyLabel, "").trim(),
      text: text(item.text, LIMITS.shortText, "").trim(),
    })),
  };
  return preferences;
}

/**
 * A list of entries with a required text (timeline events, quick replies): entries without text are dropped, each
 * keeps a valid unique id or gets one, and the list is capped. A non-array keeps the fallback.
 */
function normalizeEntries<T extends { text: string }>(
  value: unknown,
  fallback: Array<T & { id: string }>,
  prefix: string,
  limit: number,
  read: (item: Record<string, unknown>) => T,
): Array<T & { id: string }> {
  if (!Array.isArray(value)) return fallback;
  const entries: Array<T & { id: string }> = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const entry = read(item);
    if (!entry.text) continue;
    let id = typeof item.id === "string" && CLIENT_ID_PATTERN.test(item.id) ? item.id : "";
    if (!id || seen.has(id))
      id = `${prefix}-${entries.length.toString(36)}-${entry.text.length.toString(36)}-${seen.size}`;
    seen.add(id);
    entries.push({ id, ...entry });
    if (entries.length >= limit) break;
  }
  return entries;
}

/** Merges a partial settings `patch` over `base` and returns complete, valid settings. */
export function normalizeStorySettings(patch: unknown, base: StorySettings = defaultStorySettings()): StorySettings {
  const input = isRecord(patch) ? patch : {};
  const connectionId = "connectionId" in input ? input.connectionId : base.connectionId;
  const imageConnectionId = "imageConnectionId" in input ? input.imageConnectionId : base.imageConnectionId;
  const targetWords = "targetWords" in input ? input.targetWords : base.targetWords;
  return {
    title: text(input.title, 300, base.title),
    connectionId: typeof connectionId === "string" && connectionId.trim() ? connectionId.trim().slice(0, 200) : null,
    imageConnectionId:
      typeof imageConnectionId === "string" && imageConnectionId.trim() ? imageConnectionId.trim().slice(0, 200) : null,
    picturePromptPrefix: text(input.picturePromptPrefix, LIMITS.picturePrefix, base.picturePromptPrefix),
    pictureNegativePrefix: text(input.pictureNegativePrefix, LIMITS.picturePrefix, base.pictureNegativePrefix),
    pictureReferences: typeof input.pictureReferences === "boolean" ? input.pictureReferences : base.pictureReferences,
    chapterWords: integer(input.chapterWords, LIMITS.chapterWords, base.chapterWords),
    writerDecides: typeof input.writerDecides === "boolean" ? input.writerDecides : base.writerDecides,
    targetWords:
      targetWords === null || targetWords === "" || targetWords === 0
        ? null
        : integer(targetWords, LIMITS.targetWords, base.targetWords ?? LIMITS.targetWords.min),
    characterIds: idList(input.characterIds, base.characterIds),
    personaIds: idList(input.personaIds, base.personaIds),
    lorebookIds: idList(input.lorebookIds, base.lorebookIds),
    overview: text(input.overview, LIMITS.longText, base.overview),
    systemPrompt: text(input.systemPrompt, LIMITS.systemPrompt, base.systemPrompt),
    bannedPhrases: text(input.bannedPhrases, LIMITS.shortText, base.bannedPhrases),
    author: text(input.author, LIMITS.shortText, base.author),
    style: text(input.style, LIMITS.shortText, base.style),
    tags: text(input.tags, LIMITS.shortText, base.tags),
    genre: text(input.genre, LIMITS.shortText, base.genre),
    rating: text(input.rating, LIMITS.shortText, base.rating),
    fandom: text(input.fandom, LIMITS.shortText, base.fandom),
    relationships: text(input.relationships, LIMITS.shortText, base.relationships),
    warnings: text(input.warnings, LIMITS.shortText, base.warnings),
    language: text(input.language, 200, base.language),
    notes: text(input.notes, LIMITS.longText, base.notes),
    continueMessage: text(input.continueMessage, LIMITS.longText, base.continueMessage),
    authorNote: text(input.authorNote, LIMITS.longText, base.authorNote),
    authorNoteDepth: integer(input.authorNoteDepth, LIMITS.authorNoteDepth, base.authorNoteDepth),
    clearNoteAfterChapter:
      typeof input.clearNoteAfterChapter === "boolean" ? input.clearNoteAfterChapter : base.clearNoteAfterChapter,
    chapterTitles: typeof input.chapterTitles === "boolean" ? input.chapterTitles : base.chapterTitles,
    timeline: normalizeEntries(input.timeline, base.timeline, "event", LIMITS.timelineEvents, (item) => ({
      text: text(item.text, LIMITS.timelineEventText, "").trim(),
      done: item.done === true,
    })),
    autoTimeline: typeof input.autoTimeline === "boolean" ? input.autoTimeline : base.autoTimeline,
    keepFullChapters: integer(input.keepFullChapters, LIMITS.keepFullChapters, base.keepFullChapters),
    autoSummarize: typeof input.autoSummarize === "boolean" ? input.autoSummarize : base.autoSummarize,
  };
}

export const GALLERY_REF_PREFIX = "global-gallery:";
const GALLERY_REF = /^global-gallery:[A-Za-z0-9_-]{1,200}$/;
const GALLERY_FILE_URL = /^\/api\/global-gallery\/file\/[A-Za-z0-9._%-]{1,300}$/;

/** A chapter's stored pictures: each with a valid id, gallery reference and gallery URL, at most one per id. */
export function normalizeIllustrations(value: unknown): StoryIllustration[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const list: StoryIllustration[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const { id, image, url } = item;
    if (typeof id !== "string" || !CLIENT_ID_PATTERN.test(id) || seen.has(id)) continue;
    if (typeof image !== "string" || !GALLERY_REF.test(image)) continue;
    if (typeof url !== "string" || !GALLERY_FILE_URL.test(url)) continue;
    seen.add(id);
    list.push({
      id,
      image,
      url,
      prompt: text(item.prompt, LIMITS.picturePrompt, ""),
      width: integer(item.width, { min: 1, max: 8192 }, 1024),
      height: integer(item.height, { min: 1, max: 8192 }, 1024),
      paragraph: integer(item.paragraph, { min: 0, max: 1_000_000 }, 0),
      anchor: text(item.anchor, LIMITS.illustrationAnchor, ""),
    });
    if (list.length >= LIMITS.illustrationsPerChapter) break;
  }
  return list;
}

/** Normalizes a chapter write. Unknown statuses keep the base status. Pictures are never part of one. */
export function normalizeChapterPatch(patch: unknown): ChapterPatch {
  const input = isRecord(patch) ? patch : {};
  const result: ChapterPatch = {};
  if (typeof input.text === "string") result.text = input.text.slice(0, LIMITS.chapterText);
  if (typeof input.summary === "string") result.summary = input.summary.slice(0, LIMITS.summary);
  if (input.status === "draft" || input.status === "complete") result.status = input.status;
  if (typeof input.request === "string") result.request = input.request.slice(0, LIMITS.longText);
  return result;
}

// ── Text helpers shared by the client, the server and the prompt ──

/** Counts words the way a reader would: Markdown markers and scene breaks do not count. */
export function countWords(markdown: string): number {
  const plain = markdown
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?)/gm, "")
    .replace(/^\s*(?:\*{3,}|-{3,}|_{3,})\s*$/gm, " ")
    .replace(/[*_~=`]+/g, "");
  const matches = plain.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  const words = matches?.length ?? 0;
  // CJK text has no spaces: count each ideograph/kana as a word.
  const cjk = plain.match(/[぀-ヿ㐀-鿿豈-﫿]/g)?.length ?? 0;
  return cjk > words ? cjk : words;
}

/** The chapter's own title: its first "# " heading, if it opens with one. */
export function chapterTitle(markdown: string): string {
  const match = /^\s*#{1,3}\s+(.+?)\s*#*\s*$/m.exec(markdown.split(/\n\s*\n/, 1)[0] ?? "");
  return match?.[1]?.trim() ?? "";
}

/** A prompt with a prefix in front, joined as the Engine joins a connection's own prompt prefix ("prefix, prompt"). */
export function withPrefix(prefix: string, prompt: string): string {
  const lead = prefix.trim().replace(/[\s,;.]+$/, "");
  return (lead && prompt.trim() ? `${lead}, ${prompt.trim()}` : lead || prompt.trim()).slice(0, LIMITS.picturePrompt);
}

export function storyDisplayTitle(settings: Pick<StorySettings, "title">, fallback: string): string {
  return settings.title.trim() || fallback;
}
