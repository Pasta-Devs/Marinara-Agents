// ──────────────────────────────────────────────
// Story Writer: the data model both the package client and its server use
// ──────────────────────────────────────────────
// Pure TypeScript with no imports, so the server bundle can take it by relative path. The server normalizes every
// write through these functions; the client uses the same defaults for a story it has not saved yet.

export const STORY_WRITER_PACKAGE_ID = "story-writer";

export const DEFAULT_SYSTEM_PROMPT =
  "You are an excellent writer for the user. Your goal is to write the next chapter of this fictional story.";
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
  selectedIds: 200,
  chapterWords: { min: 100, max: 20_000 },
  targetWords: { min: 1_000, max: 2_000_000 },
  keepFullChapters: { min: 0, max: 50 },
  authorNoteDepth: { min: 0, max: 100 },
  fontSize: { min: 12, max: 36 },
  chaptersPerStory: 2_000,
} as const;

export type StoryTheme = "book" | "ebook";
export type StoryColorMode = "app" | "light" | "dark";
export type StorySide = "left" | "right";

/** Reading and layout preferences. One document per Engine install, shared by every story. */
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
  streaming: boolean;
  pageAnimation: boolean;
  lastStoryId: string | null;
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
  /** Target length of one chapter, in words. */
  chapterWords: number;
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

export interface StoryChapter {
  id: string;
  storyId: string;
  /** Markdown. */
  text: string;
  summary: string;
  /** "draft": started by the author, or cut off; Write continues it. "complete": Write starts a new chapter. */
  status: ChapterStatus;
  /** The user message that produced this chapter, so history replays what was really asked. */
  request: string;
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
// Errors: { error: string } with 400 (invalid input), 404 (unknown story/chapter), 409 (chapter id taken).

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
    streaming: true,
    pageAnimation: true,
    lastStoryId: null,
  };
}

export function defaultStorySettings(): StorySettings {
  return {
    title: "",
    connectionId: null,
    chapterWords: DEFAULT_CHAPTER_WORDS,
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
    theme: oneOf(input.theme, ["book", "ebook"], base.theme),
    colorMode: oneOf(input.colorMode, ["app", "light", "dark"], base.colorMode),
    fontFamily: text(input.fontFamily, 200, base.fontFamily).trim(),
    fontColor: typeof fontColor === "string" && (fontColor === "" || HEX_COLOR.test(fontColor)) ? fontColor : "",
    fontSize: integer(input.fontSize, LIMITS.fontSize, base.fontSize),
    sidebarSide: oneOf(input.sidebarSide, ["left", "right"], base.sidebarSide),
    noteSide: oneOf(input.noteSide, ["left", "right"], base.noteSide),
    streaming: typeof input.streaming === "boolean" ? input.streaming : base.streaming,
    pageAnimation: typeof input.pageAnimation === "boolean" ? input.pageAnimation : base.pageAnimation,
    lastStoryId: typeof lastStoryId === "string" && lastStoryId.length <= 200 ? lastStoryId : null,
  };
  return preferences;
}

function normalizeTimeline(value: unknown, fallback: TimelineEvent[]): TimelineEvent[] {
  if (!Array.isArray(value)) return fallback;
  const events: TimelineEvent[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const eventText = text(item.text, LIMITS.timelineEventText, "").trim();
    if (!eventText) continue;
    let id = typeof item.id === "string" && CLIENT_ID_PATTERN.test(item.id) ? item.id : "";
    if (!id || seen.has(id)) id = `event-${events.length.toString(36)}-${eventText.length.toString(36)}-${seen.size}`;
    seen.add(id);
    events.push({ id, text: eventText, done: item.done === true });
    if (events.length >= LIMITS.timelineEvents) break;
  }
  return events;
}

/** Merges a partial settings `patch` over `base` and returns complete, valid settings. */
export function normalizeStorySettings(patch: unknown, base: StorySettings = defaultStorySettings()): StorySettings {
  const input = isRecord(patch) ? patch : {};
  const connectionId = "connectionId" in input ? input.connectionId : base.connectionId;
  const targetWords = "targetWords" in input ? input.targetWords : base.targetWords;
  return {
    title: text(input.title, 300, base.title),
    connectionId: typeof connectionId === "string" && connectionId.trim() ? connectionId.trim().slice(0, 200) : null,
    chapterWords: integer(input.chapterWords, LIMITS.chapterWords, base.chapterWords),
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
    timeline: normalizeTimeline(input.timeline, base.timeline),
    autoTimeline: typeof input.autoTimeline === "boolean" ? input.autoTimeline : base.autoTimeline,
    keepFullChapters: integer(input.keepFullChapters, LIMITS.keepFullChapters, base.keepFullChapters),
    autoSummarize: typeof input.autoSummarize === "boolean" ? input.autoSummarize : base.autoSummarize,
  };
}

/** Normalizes a chapter write. Unknown statuses keep the base status. */
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

export function storyDisplayTitle(settings: Pick<StorySettings, "title">, fallback: string): string {
  return settings.title.trim() || fallback;
}
