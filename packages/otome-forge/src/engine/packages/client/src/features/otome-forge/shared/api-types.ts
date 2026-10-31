// ──────────────────────────────────────────────
// Otome Forge: the wire contract between the package's routes and its client (types only)
// ──────────────────────────────────────────────
// Imported by both bundles, so a code or field added on one side has to be handled on the other.
import type { ClimaxEnding, ClimaxMove, RouteEntry } from "./arcs";
import type { ContentSettings, ImageRating, LimitId } from "./content";
import type { DatePlan, DateScore } from "./dates";
import type { Face, MusicMood } from "./faces";
import type { ClawRound } from "./claw";
import type { ReadHimPaid } from "./read-him";
import type { NotebookEntry, ReadMePaid } from "./read-me";
import type { ClawLineKind, TapZone, TimeOfDay } from "./home";
import type { BannerKind, PityCounter, Rarity } from "./wish";

export type {
  ClimaxEnding,
  ClimaxKind,
  ClimaxMove,
  CloserEnding,
  CloserMove,
  ConfrontationEnding,
  RouteEntry,
  RouteNext,
  Stance,
} from "./arcs";

/** The `code` of a failed route's `{error, code?}`; the client shows ui.otomeForge.errors.<code> (plan §1.5). */
export type OtomeErrorCode =
  | "bad-request"
  | "age-gate"
  | "not-found"
  | "conflict"
  | "busy"
  | "locked"
  | "insufficient"
  | "declined"
  | "bad-format"
  | "no-connection";

export interface OtomeRunEntry {
  runKey: string;
  title: string;
  createdAt: string;
  lastPlayedAt: string | null;
}

/** The `otome-forge:index` document, as GET /index returns it with every field defaulted. */
export interface OtomeIndex {
  version: 1;
  runs: OtomeRunEntry[];
  /** The run key the picker opens, or null. Always one of `runs`. */
  activeRun: string | null;
  ageGate: { confirmedAt: string } | null;
  lastOpenedAt: string | null;
}

// ── Runs (M1). The documents' full shapes; the server reads each through S/schemas, so every field is present. ──

/** `li-<name slug>-<4>`, from S/ids.ts. */
export type LiId = string;

export interface Pronouns {
  subject: string;
  object: string;
  possessive: string;
}

/** How a person is drawn: "adult {presentation}" goes on every image prompt. */
export type Presentation = "man" | "woman" | "person";

/** A paid image's record (plan §1.8): marked pending before the call, never repainted without a tap. */
export type PaintState = "waiting-consent" | "pending" | "ready" | "failed" | "stopped";
export interface Paint {
  state: PaintState;
  at: string;
  url?: string;
  ref?: string;
  error?: string;
}

/** A free derivative of a retained look, tagged with the Engine cleanup that produced it. */
export interface Cutout extends Paint {
  cleanupRevision?: number;
  /** Retain older derivatives for existing run deletion without deleting an image a live view may still show. */
  previousRefs?: string[];
}

/** The model jobs a world names a connection for; a job without its own uses `narration`. */
export type GenerationJob = "structured" | "narration" | "chat" | "compress";
export interface Connections {
  narration: string;
  structured?: string;
  chat?: string;
  compress?: string;
}

export interface ImageSettings {
  /** The image-generation connection, or null for a world played without images. */
  connectionId: string | null;
  rating: ImageRating;
  /** Ask before painting places, story CGs, banner art and first-open item art. Base looks always ask. */
  ask: boolean;
  expressions: boolean;
  expressionsSince?: string;
  styleProfileId?: string;
  /** The player's own words for how every picture looks (art style, medium); they lead each image prompt. */
  style?: string;
}

export type ForgeStepState = "pending" | "running" | "done" | "failed" | "waiting-consent";
/** Step ids: `world-plan`, `bible:<li>`, `paint:<li>`, `paint:player`. */
export interface ForgeStep {
  id: string;
  state: ForgeStepState;
  error?: string;
  paid?: boolean;
}
export interface ForgeStatus {
  phase: "forging" | "ready";
  steps: ForgeStep[];
}

export type WebStance = "allies" | "uneasy" | "rivals" | "enemies";
export interface WebRow {
  a: LiId;
  b: LiId;
  history: string;
  stance: WebStance;
  debt: string;
  /** Hidden: never in a RunView. */
  secret?: string;
}

/** The kit's normalizeForgeAudio shape (forge-kit audio-settings): the player's audio choices. No credentials. */
export interface AudioSettings {
  tts: boolean;
  otherVoices: boolean;
  /** Kept for the kit's shape; Otome has no combat. */
  combatVoices: boolean;
  generate: boolean;
  /** Generate and retain one theme for each chapter, instead of changing music with every mood. */
  chapterThemes: boolean;
  /** A Music asset folder (including its subfolders), or empty for Engine's mood library. */
  musicFolder: string;
  homeMusic: string;
  audioConnectionId: string;
  muted: boolean;
  musicVolume: number;
  dialogueVolume: number;
  sfxVolume: number;
  autoplayPauseSeconds: number;
}

/** A generated track the client reported (the kit's recordForgeSoundtrack checks it against scope `otome-forge`). */
export interface SoundtrackTrack {
  cue: string;
  connectionId: string;
  tag: string;
  path: string;
}

/** Chapter-owned music is retained independently of the world's bounded mood soundtrack. */
export interface ChapterMusic {
  prompt?: string;
  track?: SoundtrackTrack;
}

/** `world.audio` (M2b): the settings, each cue's music brief (P14, English), and the generated tracks. */
export interface WorldAudio extends AudioSettings {
  briefs: Record<string, { fingerprint: string; prompt: string }>;
  tracks: SoundtrackTrack[];
}

/** A place the story has been, painted once (M2b, S/art/places.ts); `tags` are English image tags. */
export interface PlaceArt {
  name: string;
  tags: string;
  art?: Paint;
}

/** `${R}:world`. `mystery.truth`, `mystery.pieces` and web secrets never leave the server. */
export interface World {
  version: 1;
  title: string;
  premise: string;
  language: string;
  createdAt: string;
  setting: string;
  mystery: { question: string; truth: string; pieces: Record<LiId, { piece: string; reasonToHide: string }> };
  web: WebRow[];
  openingSituation: string;
  /** The player's own instructions for how the story is written (tense, voice, pacing…), whole; "" or absent: none. */
  writingStyle?: string;
  /** The player's own banned phrases as typed (Settings → Content), added to the built-in list; "" or absent: none. */
  bannedPhrases?: string;
  content: ContentSettings;
  images: ImageSettings;
  connections: Connections;
  forge: ForgeStatus;
  audio: WorldAudio;
  /** Keyed by S/art/places.ts placeKey(name), which keeps the letters of any script; clients look places up by name. */
  places: Record<string, PlaceArt>;
}

/**
 * A complete look won on Wish (M4), in the kit's outfit shape (image-avatar-references, story-expressions-server):
 * `id` is the look's item id, which `wornOutfit` names; `url` is its painted full-body image.
 */
export interface Outfit {
  id: string;
  /** In the world's language. */
  name: string;
  /** English, visual only. */
  outfitLine: string;
  url: string;
  ref?: string;
  at: string;
}

/** P19 (M4): what a love interest noticed about the protagonist's new look, one line of 20 words or fewer. */
export interface Noticed {
  li: LiId;
  text: string;
  /** The outfit id she wore when he noticed. */
  look: string;
  at: string;
}

/** `${R}:player`: the protagonist, from an Engine persona. */
export interface Player {
  personaId: string;
  name: string;
  pronouns: Pronouns;
  traits: string[];
  goal: string;
  /**
   * The persona's full authored story fields, retained as this protagonist's fallback. Chapter and scene generation
   * refreshes them from the selected persona; image-only appearance overrides are not story facts.
   */
  about?: string;
  /** English, visual-only tags. */
  look: { identityLine: string; outfitLine: string };
  portrait?: string;
  portraitRef?: string;
  art?: Paint;
  /** M4: her looks from My Wardrobe. */
  outfits: Outfit[];
  /** Free background-cleaned derivatives of retained generated looks; absent on older stories. */
  cutouts?: Record<string, Cutout>;
  /** M4: the look she wears at home (an outfit id); absent wears her base look. */
  wornOutfit?: string;
  /** M4: his line about the look she wears now (P19), or null. */
  noticed: Noticed | null;
}

export type ArcStageKey = "1" | "2" | "3" | "4" | "5" | "6";
export type RevealStage = 2 | 3 | 4 | 5 | 6;
export type ClawCheat = "steady" | "nudge" | "extra" | "freeze" | "calculate";

export interface BibleSecret {
  id: string;
  truth: string;
  tells: string[];
  revealAt: { stage: RevealStage };
}

/**
 * A love interest's own tastes in sex and intimacy (#1936), for NSFW stories only: short labels the story draws on now
 * and then. They set no limits; the player's content settings decide what a scene may hold.
 */
export interface BibleIntimacy {
  /** What they are into, kinks included. */
  preferences: string[];
  /** Physical traits or moments that draw them. */
  attractions: string[];
}

/** An LI's hidden character bible (behind the spoiler gate). For a card LI it never contradicts the card. */
export interface Bible {
  /** 18 or older, always. */
  age: number;
  pronouns: Pronouns;
  /** "MM-DD". */
  birthday: string;
  role: string;
  publicFace: string;
  archetype: string;
  subversion: string;
  wound: string;
  ghost: string;
  lie: string;
  want: string;
  need: string;
  fear: string;
  /** 3–5 tells. */
  mask: { presents: string; tells: string[] };
  trueSelf: { is: string; showsWhen: string[] };
  flaws: string[];
  virtues: string[];
  contradictions: string[];
  moralCode: string;
  redLines: string[];
  darkness: { kinds: string[] };
  voice: {
    register: string;
    tics: string[];
    never: string[];
    careLanguage: string;
    angerStyle: string;
    jealousyStyle: string;
    samples: { guarded: string; tender: string; angry: string };
  };
  likes: string[];
  dislikes: string[];
  web: Record<LiId, { history: string; stance: string; debt: string; secret?: string }>;
  /** At least one is revealed at stage 4. */
  secrets: BibleSecret[];
  arc: Record<ArcStageKey, { wantsFromHer?: string; seed?: string }>;
  /** English, visual-only tags. */
  look: { identityLine: string; outfitLine: string; presentation: Presentation };
  play: { style: string; cheat: ClawCheat };
  /** Optional (#1936): written for adult NSFW stories only, and added to an older bible only on request. */
  intimacy?: BibleIntimacy;
}

/** `${R}:unit:${li}`: the fields the forge kit expects of a character, plus the bible. */
export interface Unit {
  kind: "character";
  id: LiId;
  name: string;
  pronouns: Pronouns;
  source: "card" | "archetype";
  cardId?: string;
  archetype?: string;
  /** The player's notes for an archetype LI (prompt input for the world plan and the bible). */
  notes?: string;
  /** "#rrggbb". */
  accent: string;
  voiceGender: "male" | "female" | "";
  portrait?: string;
  portraitRef?: string;
  art?: Paint;
  identityLine: string;
  outfitLine: string;
  /** M4: his looks from His Wardrobe (the kit reads them as references and as expression bases). */
  outfits: Outfit[];
  /** M4: the look he wears (an outfit id); absent wears his base portrait. */
  wornOutfit?: string;
  /** Kit-owned (M2b): the faces painted for each look, keyed by the look's URL. */
  expressions: Record<string, unknown>;
  /** Null until the forge's `bible:<li>` step writes it. */
  bible: Bible | null;
  bibleEdited: boolean;
  createdAt: string;
  /** His pre-written Home lines (P15), written in the background; absent until the first pack lands. */
  lines?: LinePacks;
  /** Home cut-outs, keyed by the look's URL: `ready` carries the cut-out; `failed` means pan over the uncut look. */
  cutouts: Record<string, Cutout>;
  /** Their Claw Machine plush (#1954): the animal that fits them, drawn as SVG in the background; absent until then. */
  plushArt?: PlushArt;
}

/** A love interest's own plush: the animal (English, one or two words) and its sanitized SVG (S/art/plush-svg.ts). */
export interface PlushArt {
  animal: string;
  svg: string;
  at: string;
}

// ── Home (M3): line packs, the message of the day, and what Home shows ──

/** Tap lines: three per zone and time of day. */
export type TapLines = Record<TapZone, Record<TimeOfDay, string[]>>;

/** One stage's lines (P15): taps, the lines for too many pokes, and the cold lines a rupture shows instead. */
export interface StageLines {
  stage: number;
  tap: TapLines;
  annoyed: string[];
  cold: string[];
  at: string;
}

export type ClawLines = Record<ClawLineKind, string[]>;

/** Lines written once (with his first stage pack): generic rough-day comfort, and the Claw Machine's. */
export interface FixedLines {
  comfort: string[];
  claw: ClawLines;
  at: string;
}

export interface LinePacks {
  stages: Partial<Record<ArcStageKey, StageLines>>;
  fixed: FixedLines | null;
}

/** GET /runs/:run/lis/:li/lines. During a rupture only `cold` is his to say: `tap` is null and `annoyed` empty. */
export interface LinesView {
  /** True once the pack for his current stage exists; until then the nearest stage's pack, or none (catalog lines). */
  ready: boolean;
  stage: number;
  rupture: boolean;
  tap: TapLines | null;
  annoyed: string[];
  cold: string[];
  /** Empty until his fixed lines exist (Rough day? then uses the catalog's comfort lines). */
  comfort: string[];
  claw: ClawLines | null;
}

/** The message of the day's mood chip: one word, and a reason of four words or fewer. */
export interface NoteMood {
  word: string;
  reason: string;
}

/** `${R}:note:${dayKey}:${li}`: one love interest's message of the day (never a care note). */
export interface Note {
  li: LiId;
  /** The local day it was written for, "YYYY-MM-DD" in the request's time zone. */
  dayKey: string;
  text: string;
  /** The face it is written with; "" for his plain look. */
  face: Face | "";
  mood: NoteMood;
  /**
   * Written while a rupture stood between them. A note whose `curt` no longer matches (a rupture opened or was repaired
   * since) is stale: Home shows none and the next request writes the day's note again.
   */
  curt: boolean;
  at: string;
  connectionId: string;
  model: string;
}

export type NoteView = Omit<Note, "connectionId" | "model">;

export type HomeShow = "him" | "me";

/** `state.home`: who Home shows. `li` null means the first love interest in cast order. */
export interface HomeState {
  li: LiId | null;
  show: HomeShow;
}

/**
 * What Home stands up: `look` is his worn look ("him") or the protagonist's ("me"): a painted full-body `look`, or the
 * persona's `avatar`. Null shows initials on a gradient. `cutoutState` "pending" means a cut-out is on its way (ask
 * again later); "uncut" means none will come, so Home pans slowly over the uncut image.
 */
export interface HomeLook {
  url: string;
  source: "look" | "avatar";
  cutout?: string;
  cutoutState: "ready" | "pending" | "uncut";
}

/** GET /runs/:run/home */
export interface HomeView {
  /** The love interest Home is about (state.home.li, else the first in cast order); null with no cast. */
  li: LiId | null;
  show: HomeShow;
  /** Today's note from `li`, or null until POST .../home/note writes it. */
  note: NoteView | null;
  look: HomeLook | null;
  /**
   * His ready faces for the worn look (painted in the background from M2b), each with its cut-out once ready and the
   * cut-out's state, as the look's: Home asks again while one is "pending".
   */
  faces: Partial<Record<Face, { url: string; cutout?: string; cutoutState: HomeLook["cutoutState"] }>>;
  /**
   * L0: his newest unlocked CG (a story CG once seen, a pair portrait, an owned Memory's CG: the Album's), else the
   * newest painted place; null shows the gradient alone.
   */
  backdrop: { url: string; kind: "cg" | "place" } | null;
  lines: { ready: boolean };
  /** A rupture stands between him and the protagonist: the note is curt and Home shows his cold lines. */
  rupture: boolean;
  /** Replies waiting unread across every phone thread. */
  unread: number;
  /** M4: what a love interest said on noticing the look she wears now (P19), shown under her look on Me. */
  noticed: Noticed | null;
  /** M4: a love interest is noticing her new look right now: Home asks again until the line lands. */
  noticing: boolean;
}

// ── Phone (M3): one private thread per love interest. S/phone/chat.ts reads and writes these shapes. ──

export interface PhoneMessage {
  /** `m-<time base36>-<8 hex>`, or the client's own id for the player's message. */
  id: string;
  who: "player" | "li";
  /** "" for a sticker on its own. */
  text: string;
  /** One of his faces, sent as a sticker (by either of them). */
  sticker?: Face;
  /** ISO time it was saved. */
  at: string;
  /** The note of the day this message replies to (Reply on Home). */
  quote?: string;
}

/** A closed conversation: messages `start`..`start + count - 1`, and what he remembers of it. */
export interface PhoneSession {
  start: number;
  count: number;
  memory: { text: string; quote: string };
  closedAt: string;
  /** His name when it closed, so a later rename does not rewrite the memory's title. */
  name?: string;
}

/** `${R}:chat:${li}`. */
export interface PhoneThread {
  version: 1;
  li: LiId;
  messages: PhoneMessage[];
  sessions: PhoneSession[];
  seenAt: string | null;
  suggestions: string[];
}

/** GET /runs/:run/phone */
export interface PhoneListView {
  threads: Array<{ li: LiId; last: PhoneMessage | null; unread: number; busy: boolean }>;
}

/** GET /runs/:run/phone/:li?page= : the kit's forgeChatHistoryPage, plus what the thread screen shows around it. */
export interface PhoneHistoryPage {
  /** This page, oldest first; `archived` marks the messages of closed conversations. */
  messages: Array<PhoneMessage & { archived: boolean }>;
  /** 1 is the newest page. */
  page: number;
  pages: number;
  /** The thread-wide index of this page's first message (session `start`s count from it). */
  from: number;
  /** How many conversations are closed. */
  past: number;
  /** Messages in the open conversation. */
  activeCount: number;
  /** His reply (or a close) is being written right now. */
  busy: boolean;
  /** The protagonist's last message is still waiting for a reply: offer Retry. */
  retry: boolean;
  sessions: PhoneSession[];
  suggestions: string[];
  seenAt: string | null;
}

/** POST .../send */
export interface PhoneSendResult {
  /** What this request added or found: the player's message (when it was new or named by `id`), then his reply. */
  messages: PhoneMessage[];
  suggestions: string[];
}

/** Affection from Close and remember (the Grant shape, with its own source). */
export interface PhoneGrant {
  source: "close-and-remember";
  li: LiId;
  affection: number;
}

/** POST .../close */
export interface PhoneCloseResult {
  memory: PhoneSession["memory"];
  /** Empty when nothing was earned: a replay, a one-sided conversation, or the day's cap. */
  grants: PhoneGrant[];
}

// ── Remind Me and the caring message (M6). Tracker data never reaches a server document: the client works out
// today's state (C/lib/cycle.ts) and sends at most its one templated line. ──

/**
 * GET /runs/:run/calendar: the story's days. `md` is "MM-DD", every year; `day` is a local date ("YYYY-MM-DD").
 * Anniversaries are the world's first day and the Love Timeline's firsts (each stage reached, each `first-<what>`; its
 * Snapshots and couple sets stay in the Album); `label` is shown as written (story text) and `year`, when given, is
 * the year it happened (none is drawn before it).
 */
export interface CalendarView {
  birthdays: Array<{ li: LiId; md: string }>;
  anniversaries: Array<{ md: string; label: string; li?: LiId; year?: number }>;
  /** Wish banners' last days (M4); empty before any banner exists. */
  bannerEnds: Array<{ day: string; banner: string }>;
}

/**
 * POST /runs/:run/care-note {li, careLine?}. `careLine` is one of C/lib/cycle.ts careLines, exactly; without it, or
 * while any debug condition holds, the server answers from their comfort lines (`note` null while those aren't written
 * yet: the client shows one of the catalog's). Nothing is stored (Cache-Control: no-store).
 */
export interface CareNoteResult {
  note: string | null;
  source: "model" | "pool";
}

// ── State (M1, with M2a's angst, ledgers and reading progress). Trust and tension are never shown to the player. ──

export type GrievanceSeverity = "minor" | "major" | "rupture";
export type GrievanceStatus = "open" | "addressed" | "forgiven" | "festering";

/** A hurt between a love interest and the protagonist, either way round. Never closes in the beat that opened it. */
export interface Grievance {
  id: string;
  li: LiId;
  /** Who holds it: the love interest against her, or the protagonist against him. */
  by: "li" | "protagonist";
  text: string;
  severity: GrievanceSeverity;
  /** `${chapterKey}/${beatIndex}`: where it was opened. */
  opened: string;
  status: GrievanceStatus;
}

/** How far trust and tension moved in one chapter, and in its beat `beat.i` (the per-beat cap). */
export interface ChapterShift {
  trust: number;
  tension: number;
  beat?: { i: number; trust: number; tension: number };
}

/** One love interest's progress and the state of things between him and the protagonist. */
export interface LiState {
  /** Affection points may fall within the reached level. Level = min(10, 1 + floor(points / 300)). */
  points: number;
  stage: number;
  /** −3..+3, starting at 0; moved only by first-play choices, capped per beat and per chapter. */
  trust: number;
  /** 0..3, starting at 0. */
  tension: number;
  /** Per unfinished chapter key, how far trust and tension moved in it (the per-chapter cap); let go once it is done. */
  chapterDelta: Record<string, ChapterShift>;
  grievances: Grievance[];
  /** An open rupture shuts his gates until a repair scene. Nothing unlocked is taken back. */
  rupture: { grievanceId: string; since: string } | null;
  /** What the protagonist has told him (he may know it; scene cards carry it). `ref` is `${key}/${i}`. */
  disclosures: Array<{ text: string; at: string; ref: string }>;
  /** Ids of his bible secrets the protagonist has learned. */
  revealed: string[];
  /** The main chapter number he last led, or null if he never has. */
  lastLead: number | null;
  /** The kinds of angst planted for him, newest last (a new conflict never repeats his last two). */
  angst: string[];
  /** Dated firsts for the Love Timeline: first-kind → ISO time. */
  firsts: Record<string, string>;
  /** Indexes into his bible's `mask.tells` the protagonist has learned to read (Read Him, M5). */
  tellsLearned: number[];
  /**
   * What they have come to know about the protagonist (Read Me, #1945), newest last: theirs alone. Only prompts about
   * them carry it (S/story/prompts.ts knowsAboutYou); the player reads, rewrites and deletes it.
   */
  known: NotebookEntry[];
}

/** A chapter's reading progress. `applied` holds `${i}/${choiceId}` for every pick whose effects reached the state. */
export interface ChapterProgress {
  /** Beats read to the end, in order: beat `beatsRead` is the one being read. */
  beatsRead: number;
  /** When the last node was read, or null. */
  completed: string | null;
  applied: string[];
}

export type ConflictAction = "plant" | "escalate" | "complicate" | "resolve";
export type ConflictStatus = "open" | "resolved";

/** Counted, never guessed: what the story has spent, what is still owed, and where each absent LI is. */
export interface Ledgers {
  relationship: Array<{ key: string; li: LiId; line: string }>;
  /**
   * `chapter`: the main chapter number it was planted in; `key`: the chapter it was planted in (absent on rows saved
   * before M2b's planner boundary, which are read as shared).
   */
  conflicts: Array<{ id: string; li: LiId; type: string; status: ConflictStatus; chapter: number; key?: string }>;
  offscreen: Array<{ key: string; li: LiId; line: string }>;
}

export interface TimelineEntry {
  at: string;
  li: LiId;
  kind: string;
  text: string;
  ref?: string;
}

export interface Favorite {
  at: string;
  li?: LiId;
  text: string;
  /**
   * The line: `${chapterKey}/${beatIndex}r${rewrites}/${segmentIndex}`, then `:${optionId}+n` for a picked option's
   * lines (C/hooks/use-reader.ts).
   */
  ref: string;
}

/** A story CG the player has seen (M2b: unlocked only by POST /runs/:run/art/cg/seen). `key` is `${chapterKey}/${i}`. */
export interface AlbumCg {
  key: string;
  url: string;
  ref: string;
  at: string;
  li?: LiId;
}

/** `${R}:state`. Later milestones add fields with defaults. */
export interface RunState {
  version: 1;
  wallet: { starlight: number };
  lis: Record<LiId, LiState>;
  /** Today's capped earnings, keyed by the request's local day. Story earnings are never capped. */
  daily: { dayKey: string; starlight: number; affection: Record<LiId, number> };
  chapters: Record<string, ChapterProgress>;
  ledgers: Ledgers;
  timeline: TimelineEntry[];
  favorites: Favorite[];
  /** Who Home shows (M3). */
  home: HomeState;
  /** M2b: the CGs unlocked once seen. */
  album: { cgs: AlbumCg[] };
  /** M4: each banner kind's pity (GF's counter names), carried over from banner to banner and shared by Echoes. */
  pity: Record<BannerKind, PityCounter>;
  /**
   * What the player owns. M4: the item ids, in the order won, and when each was won (an ISO time, by item id). M5: the
   * plush shelf, prize id → how many (SH/claw.ts).
   */
  owned: { items: string[]; at: Record<string, string>; plush: Record<string, number> };
  /**
   * M4: the love interests whose Memory Selector (affection 10) has been used, each with the Memory it claimed (`true`:
   * an early claim that did not record which).
   */
  selector: Record<LiId, string | true>;
  /** M4: the newest pulls by request id, so a retried pull answers with the same results and charges once. */
  pulls: WishPullRecord[];
  /** Each LI's newest finished Claw Machine rounds (M5): a repeated finish is answered from here; each is his memory. */
  claw: { rounds: ClawRound[] };
  /** The newest paid Read Him sets (M5): the finish's once-only mark, in the same write as its pay. */
  readHim: { paid: ReadHimPaid[] };
  /** The newest paid Read Me sets (#1945): the once-only mark of the write that paid them and filled the notebook. */
  readMe: { paid: ReadMePaid[] };
}

/** One pull as the state keeps it (S/wish/pull.ts), for answering a retried request. */
export interface WishPullRecord {
  id: string;
  banner: string;
  at: string;
  results: Array<{ item: string; rarity: Rarity; isNew: boolean; refund: number }>;
}

// ── Story (M2a): chapters, beats, choices. Chapter keys: `main-<n>`, `route-<li>-<stage>`, `repair-<li>-<n>`,
// `story-<itemId>`, `date-<n>`. ──

export type ChapterKind = "prologue" | "main" | "route" | "repair" | "story" | "date";
/** `confrontation` and `closer` (#1938) are a chapter's climax: a main chapter has exactly one of them. */
export type NodeKind = "beat" | "moment" | "confrontation" | "closer";
/** A moment node's framing: reading his face, a phone call, a date gone wrong. Written as a beat until M2b/M5. */
export type MomentKind = "read-him" | "call" | "date";

export interface ChapterNode {
  i: number;
  kind: NodeKind;
  moment?: MomentKind;
  /** What happens in this node, for the narrator (hidden from the client). */
  guide: string;
  /** The love interests present. */
  cast: LiId[];
  place?: string;
  /** This node may carry one key image (a brief is stored; M2b paints it). */
  cg?: boolean;
  /** A stage-gate node (route chapters, M2b): the last node; reading it to its end moves his stage. */
  gate?: boolean;
  /** Grievance ids this node may resolve. */
  resolves?: string[];
  /** Bible secret ids the protagonist learns in this node (a route chapter's gate, hidden from the client). */
  reveals?: string[];
}

/** What the planner wrote for the ledgers; saved to the state when the chapter's last node is read. */
export interface ChapterLedger {
  relationship: Array<{ li: LiId; line: string }>;
  conflict: Array<{ id: string; li: LiId; type: string; action: ConflictAction }>;
  offscreen: Array<{ li: LiId; line: string }>;
}

/** `${R}:chapter:${key}`: a chapter's plan. */
export interface Chapter {
  key: string;
  kind: ChapterKind;
  /** Main chapters are numbered from 1. */
  number?: number;
  /** The love interest a route, repair or story chapter belongs to. */
  li?: LiId;
  /** A route chapter: the stage its gate moves him to. */
  stage?: number;
  /** A repair chapter: the rupture grievance its last node resolves (hidden from the client). */
  grievance?: string;
  lead: LiId;
  foil?: LiId;
  title: string;
  /** Content tags shown before a dark chapter: LimitIds plus jealousy, grief, possessiveness, betrayal, violence. */
  tags: string[];
  /** One or two lines on what the chapter is about, without its turns (shown to the player). */
  summary: string;
  nodes: ChapterNode[];
  ledger: ChapterLedger;
  plannedAt: string;
  connectionId: string;
  music?: ChapterMusic;
  /** A Memory's Character Story (M4): the line its card voices, kept with the chapter so the item is always given it. */
  voicedLine?: string;
  /** A date's own plan (M5, SH/dates.ts); hidden from the chapter view. */
  date?: DatePlan;
}

/** A segment of a beat: one line of dialogue, one thought, or one piece of narration. */
export interface Segment {
  /** "" for narration. */
  speaker: string;
  text: string;
  /** An inner line: his (at most one per beat, from stage 2) or the protagonist's thoughts. */
  thought?: boolean;
  /** One of the five faces (SH/faces.ts), on a dialogue or thought line; "" or absent shows his plain portrait. */
  expression?: Face | "";
  place?: string;
  /** The speaker's voice ("male" | "female"), from the beat's `voices`. */
  gender?: string;
}

export interface ChoiceOption {
  /** `option-<n>`, from the option's place in the model's reply. */
  id: string;
  /** The pill's short intent label. */
  text: string;
  /** What the protagonist says or does once picked. */
  selection: { kind: "dialogue" | "action"; text: string };
  /** The branch (empty for a big choice). */
  segments: Segment[];
}

/** The kit's choice shape (player-choices-server.mjs): small choices reconverge; one big choice may end a chapter. */
export interface ForgeChoice {
  /** `choice-<n>`, from the choice's place in the model's reply. */
  id: string;
  kind: "small" | "big";
  /** The zero-based mainline segment after which the options appear. */
  at: number;
  options: ChoiceOption[];
}

/** What one option changes between the protagonist and one love interest (hidden; clamped when applied). */
export interface Effect {
  li: LiId;
  trust?: -1 | 0 | 1;
  tension?: -1 | 0 | 1;
  grievance?: { by: Grievance["by"]; text: string; severity: GrievanceSeverity };
  /** Something the protagonist tells him: he may know it from now on. */
  disclose?: string;
  resolve?: { id: string; status: Exclude<GrievanceStatus, "open"> };
}

/** `${R}:beat:${key}:${i}`: one written node. */
export interface Beat {
  key: string;
  i: number;
  kind: NodeKind;
  places: Array<{ name: string; tags: string }>;
  segments: Segment[];
  choices: ForgeChoice[];
  /** First-play canon: choiceId → optionId. Set once; a replay never changes it. */
  choiceCanon: Record<string, string>;
  /** choiceId → optionId → effects (hidden from the client). */
  effects: Record<string, Record<string, Effect[]>>;
  /** Picks whose effects were applied (hidden from the client). */
  applied: Record<string, true>;
  /** A date's beat (M5): choiceId → optionId → how the date's love interest takes it (hidden from the client). */
  scores?: Record<string, Record<string, DateScore>>;
  musicMood: MusicMood;
  /**
   * A key image's brief: `at` is the segment it opens on; `brief` is English. `art` is its paint (M2b, S/art/cg.ts).
   * `explicit`: the brief shows sex or nudity on the page; kept only when Heat and the image rating were both Explicit
   * as it was written, and painted explicit only while they still are (S/content-contract.ts effectiveImageRating).
   */
  cg?: { at: number; brief: string; cast: string[]; explicit?: true; art?: Paint };
  /** The furthest mainline segment read (skip-read starts here). */
  readThrough: number;
  /** The player ended the scene at segment `at` (no model call); `veil` is what they chose to veil from then on. */
  easedOff?: { at: number; veil?: LimitId[] };
  written: { at: string; connectionId: string; model: string };
  rewrites: number;
  /** Set once the reader was first served it (M2b): a rupture opens no route beat that was never on screen. */
  shown?: true;
  /**
   * A climax node's game: a Confrontation's stance game (M2b, P12) or a Closer's (#1938, P12c); `segments` holds its
   * opening. Hidden: the client gets a view.
   */
  confrontation?: Confrontation;
}

// ── A chapter's climax game, one call: the Confrontation (M2b, P12: three rounds of Press, Hold, Yield or Reveal) or
// the Closer (#1938, P12c: three rounds of Reassure, Tease, Mirror or Ask). Both share these shapes; a game's moves
// and endings are its kind's (SH/arcs.ts CLIMAX_MOVES, CLIMAX_ENDINGS). ──

export interface ConfrontationOption {
  /** The pill's short label. */
  label: string;
  /** What the protagonist says or does. */
  selection: { kind: "dialogue" | "action"; text: string };
  /** The love interest's answer to the move (1–3 segments). */
  segments: Segment[];
  /** How the move shifts their composure, or a Closer's guard (hidden; S/story/confrontation.ts). */
  composure: -1 | 0 | 1;
}

export interface ConfrontationRound {
  /** The love interest's lines opening the round; they follow from any move of the round before. */
  his: Segment[];
  /** One option per move of the game's kind. */
  options: Partial<Record<ClimaxMove, ConfrontationOption>>;
}

/** Stored on the beat. `picks` are the first-play moves, in round order; `ending` is set with the last pick. */
export interface Confrontation {
  /** "closer" for a Closer; absent for a Confrontation (every game stored before 0.4.0 is one). */
  kind?: "closer";
  /** The love interest the game is played with. */
  li: LiId;
  rounds: ConfrontationRound[];
  /** One list per ending of the game's kind. */
  endings: Partial<Record<ClimaxEnding, Segment[]>>;
  /** What a walkout (major) or a Shut out (minor) leaves between them. */
  grievance: { text: string; severity: "major" | "minor" };
  /** What the protagonist tells them with Reveal or Mirror, as one third-person sentence. */
  disclosure: string;
  picks: ClimaxMove[];
  ending?: ClimaxEnding;
}

export interface ConfrontationOptionView {
  label: string;
  selection: ConfrontationOption["selection"];
  /** His answer: only on the stance that was picked. */
  segments?: Segment[];
}

export interface ConfrontationRoundView {
  /** 1–3. */
  round: number;
  his: Segment[];
  /** One option per move of the game's kind, in its order. */
  options: Partial<Record<ClimaxMove, ConfrontationOptionView>>;
  /** The first-play move, once picked (a replay keeps it). */
  picked?: ClimaxMove;
}

export interface ConfrontationEndingView {
  kind: ClimaxEnding;
  segments: Segment[];
}

/**
 * A climax game as the client sees it, with the beat's own fields (its `kind`, the node's, says which game it is): the
 * opening, every round played and the one being played, and the ending once reached. Composure (a Closer's guard) is
 * never shown, nor the answers to moves not taken, nor an ending not reached. Its reading position (`readThrough`, POST .../read {segment}, an Ease off's `at`) indexes its
 * mainline: the opening, then each shown round's `his` lines (a stance's answer shares its round's last index), then
 * the ending.
 */
export type ConfrontationView = Omit<BeatView, "segments" | "choices" | "choiceCanon"> & {
  li: LiId;
  opening: Segment[];
  rounds: ConfrontationRoundView[];
  ending?: ConfrontationEndingView;
};

/** POST .../beats/:i/stance {round, stance}: a Confrontation's stance or a Closer's move. */
export interface StanceResult {
  /** The round just played, with its pick and his answer. */
  round: ConfrontationRoundView;
  /** The next round, until the last one is played. */
  next?: ConfrontationRoundView;
  /** After the last round. */
  ending?: ConfrontationEndingView;
  confrontation: ConfrontationView;
  /** As for a choice: something changed between them ("He'll remember that."). */
  remembered: boolean;
  rememberedBy: LiId[];
}

// ── Story wire shapes ──

export type ChapterState = "unplanned" | "in-progress" | "done";
export type BeatState = "unwritten" | "ready" | "read";

/** A chapter as the client sees it: no guides and no ledger (the plan is the hidden story). */
export type ChapterView = Omit<Chapter, "nodes" | "ledger" | "connectionId" | "date" | "music"> & {
  music?: Pick<ChapterMusic, "track">;
  nodes: Array<Pick<ChapterNode, "i" | "kind" | "moment" | "cg" | "gate">>;
};

/**
 * A beat as the client sees it: without its effects, its stored confrontation (POST .../beats/:i sends a view) or a
 * date's scores.
 */
export type BeatView = Omit<Beat, "effects" | "applied" | "confrontation" | "scores">;

/** GET /runs/:run/art/scene (M2b): what the reader polls while a beat's art is painting. */
export interface SceneArt {
  /** The beat's places in order, each with its record (a place never recorded has no art). */
  places: PlaceArt[];
  /** The beat's key image with its paint, or null. */
  cg: NonNullable<BeatView["cg"]> | null;
  /** Cleaned faces for the look worn now; originals awaiting or failing cleanup are never stage art. */
  faces: Record<LiId, Partial<Record<Face, string>>>;
  /** Faces are still painting or being freely cleaned; failed/stopped work never keeps polling. */
  facesComing: LiId[];
}

export interface StoryChapterEntry {
  key: string;
  kind: ChapterKind;
  title: string;
  li?: LiId;
  /** A route chapter: the stage it opens. */
  stage?: number;
  lead: LiId;
  state: ChapterState;
  beatsRead: number;
  /** How many nodes the chapter has. */
  nodes: number;
}

export type LeadReason = "least-recent" | "ripe-conflict";

/** A rupture's repair chapter on offer ("Make it right"): planned on POST /runs/:run/repairs/:li, or already planned. */
export interface RepairEntry {
  li: LiId;
  key: string;
}

/** GET /runs/:run/story */
export interface StoryView {
  chapters: StoryChapterEntry[];
  /** The next main chapter and its two Lead candidates; null while a chapter is unfinished or a big choice waits. */
  next: { kind: "main"; number: number; candidates: Array<{ li: LiId; reason: LeadReason }> } | null;
  /** M2b: each love interest's stage and next route chapter, in cast order. */
  routes: RouteEntry[];
  /** M2b: a repair chapter for each love interest a rupture stands with. */
  repairs: RepairEntry[];
}

/** GET /runs/:run/chapters/:key */
export interface ChapterDetail {
  chapter: ChapterView;
  beats: Array<{ i: number; state: BeatState }>;
}

/** What one request earned. */
export interface Grant {
  source: "beat" | "chapter" | "lead" | "foil";
  starlight?: number;
  li?: LiId;
  affection?: number;
}

/** What an activity (Read Him, a date, a Claw round) earned, within the day's caps. */
export interface ActivityGrant {
  source: "read-him" | "read-me" | "date" | "claw";
  starlight?: number;
  li?: LiId;
  affection?: number;
}

/** POST .../beats/:i/read */
export interface ReadResult {
  grants: Grant[];
  starlight: number;
  /** True once the chapter's last node has been read (by this read or an earlier one). */
  chapterDone: boolean;
  /** M2b: this read passed a route chapter's gate and moved him to `stage`. */
  stageUp?: { li: LiId; stage: number };
  /** M2b: this read finished a repair chapter, and the rupture with him is closed. */
  repaired?: LiId;
}

/** GET /runs/:run/memory/status and POST .../memory/retry → {status}: the kit's story memory status (Debug only). */
export interface MemoryStatus {
  phase: "ready" | "pending" | "stale" | "error" | "context-unknown";
  retryable: boolean;
  /** English, for Debug: not-prepared, interrupted, configure-context, generation-failed, … */
  reason?: string;
  recordCount?: number;
}

// ── Wire shapes ──

/** The world as the client sees it: no mystery truth or pieces, no web secrets, no music briefs. */
export type WorldView = Omit<World, "mystery" | "web" | "audio"> & {
  mystery: { question: string };
  web: Omit<WebRow, "secret">[];
  audio: Omit<WorldAudio, "briefs">;
};

export interface RunLiView {
  id: LiId;
  name: string;
  pronouns: Pronouns;
  /** A card's canon wins over the bible ("Card canon wins" shows only then). */
  source: Unit["source"];
  /** M2b: his Engine card (his explicit Engine voice), when he comes from one. */
  cardId?: string;
  /** M2b: the voice pool for a love interest without an Engine voice. */
  voiceGender: Unit["voiceGender"];
  accent: string;
  portrait?: string;
  /** Visual intent only, safe to read without opening a spoiler-heavy Bible. */
  look?: Pick<Bible["look"], "identityLine" | "outfitLine">;
  /** His look's paint record (the forge screen shows a failed paint's reason in debug mode). */
  art?: Paint;
  /** Which of this view's images are cut-outs (no backdrop): shown whole rather than cropped and faded. */
  cut?: string[];
  /** His bible has its intimacy block (#1936): only that it exists, never its text. */
  intimacy?: true;
  level: number;
  /** Current-level progress only; optional while a pre-update run view remains cached. */
  affectionProgress?: { current: number; required: number };
  stage: number;
  /** M2b: his painted faces for the current look, once the whole set is ready and expressions are on. */
  expressions?: Partial<Record<Face, string>>;
  /** M4: the look he wears from His Wardrobe, when not his base portrait (its outfit id and image). */
  worn?: { id: string; url: string };
}

/** GET /runs/:run, and the `view` of POST /runs. */
export interface RunView {
  runKey: string;
  world: WorldView;
  player: Player;
  lis: RunLiView[];
  forge: ForgeStatus;
  /** Free sprite cleanup is still running; poll the run until the retained look's derivative is ready. */
  cutoutsPending?: true;
  starlight: number;
  /** GET /runs/:run: the prologue has been read to its end (Begin then goes straight Home). */
  prologue?: boolean;
}

export type SetupLi =
  | { source: "card"; cardId: string; pronouns: Pronouns }
  | { source: "archetype"; archetype: string; name: string; pronouns: Pronouns; notes?: string };

/** POST /runs {setup}. Limits: premise ≤2000, traits ≤5, goal ≤300, notes ≤500, 2–5 LIs. */
export interface SetupInput {
  title?: string;
  premise: string;
  language: string;
  writingStyle?: string;
  protagonist: { personaId: string; pronouns: Pronouns; traits: string[]; goal: string };
  lis: SetupLi[];
  content: ContentSettings;
  images: Pick<ImageSettings, "connectionId" | "rating" | "ask" | "expressions" | "style">;
  connections: Connections;
}

/** POST /runs/:run/settings. Raising a gated setting needs the 18+ gate; lowering one never does. */
export interface SettingsInput {
  content?: ContentSettings;
  images?: Partial<Pick<ImageSettings, "connectionId" | "rating" | "ask" | "expressions" | "styleProfileId" | "style">>;
  connections?: Connections;
  language?: string;
  writingStyle?: string;
  bannedPhrases?: string;
}
