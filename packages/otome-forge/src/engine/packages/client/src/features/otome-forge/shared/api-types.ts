// ──────────────────────────────────────────────
// Otome Forge: the wire contract between the package's routes and its client (types only)
// ──────────────────────────────────────────────
// Imported by both bundles, so a code or field added on one side has to be handled on the other.
import type { ContentSettings, ImageRating, LimitId } from "./content";
import type { Face, MusicMood } from "./faces";

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
  content: ContentSettings;
  images: ImageSettings;
  connections: Connections;
  forge: ForgeStatus;
}

/** `${R}:player`: the protagonist, from an Engine persona. */
export interface Player {
  personaId: string;
  name: string;
  pronouns: Pronouns;
  traits: string[];
  goal: string;
  /** English, visual-only tags. */
  look: { identityLine: string; outfitLine: string };
  portrait?: string;
  portraitRef?: string;
  art?: Paint;
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
  /** Kit-owned shapes (outfits arrive in M4, expressions in M2b). */
  outfits: unknown[];
  expressions: Record<string, unknown>;
  /** Null until the forge's `bible:<li>` step writes it. */
  bible: Bible | null;
  bibleEdited: boolean;
  createdAt: string;
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

/** One love interest's progress and the state of things between him and the protagonist. */
export interface LiState {
  /** Affection points; they only rise. Level = min(10, 1 + floor(points / 300)). */
  points: number;
  stage: number;
  /** −3..+3, starting at 0; moved only by first-play choices, capped per beat and per chapter. */
  trust: number;
  /** 0..3, starting at 0. */
  tension: number;
  /** How far trust and tension moved in the chapter `key` (the per-chapter cap), and in its beat `beat.i`. */
  chapterDelta: { key: string; trust: number; tension: number; beat?: { i: number; trust: number; tension: number } };
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
  /** `chapter`: the main chapter number it was planted in. */
  conflicts: Array<{ id: string; li: LiId; type: string; status: ConflictStatus; chapter: number }>;
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
}

// ── Story (M2a): chapters, beats, choices. Chapter keys: `main-<n>`, `route-<li>-<stage>`, `repair-<li>-<n>`,
// `story-<itemId>`, `date-<n>`. ──

export type ChapterKind = "main" | "route" | "repair" | "story" | "date";
export type NodeKind = "beat" | "moment" | "confrontation";
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
  /** A stage-gate node (route chapters, M2b). */
  gate?: boolean;
  /** Grievance ids this node may resolve. */
  resolves?: string[];
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
  musicMood: MusicMood;
  /** A key image's brief: `at` is the segment it opens on; `brief` is English. Painted in M2b. */
  cg?: { at: number; brief: string; cast: string[] };
  /** The furthest mainline segment read (skip-read starts here). */
  readThrough: number;
  /** The player ended the scene at segment `at` (no model call); `veil` is what they chose to veil from then on. */
  easedOff?: { at: number; veil?: LimitId[] };
  written: { at: string; connectionId: string; model: string };
  rewrites: number;
}

// ── Story wire shapes ──

export type ChapterState = "unplanned" | "in-progress" | "done";
export type BeatState = "unwritten" | "ready" | "read";

/** A chapter as the client sees it: no guides and no ledger (the plan is the hidden story). */
export type ChapterView = Omit<Chapter, "nodes" | "ledger" | "connectionId"> & {
  nodes: Array<Pick<ChapterNode, "i" | "kind" | "moment" | "cg" | "gate">>;
};

/** A beat as the client sees it: without its effects. */
export type BeatView = Omit<Beat, "effects" | "applied">;

export interface StoryChapterEntry {
  key: string;
  kind: ChapterKind;
  title: string;
  li?: LiId;
  lead: LiId;
  state: ChapterState;
  beatsRead: number;
  /** How many nodes the chapter has. */
  nodes: number;
}

export type LeadReason = "least-recent" | "ripe-conflict";

/** GET /runs/:run/story */
export interface StoryView {
  chapters: StoryChapterEntry[];
  /** The next main chapter and its two Lead candidates; null while a chapter is unfinished or a big choice waits. */
  next: { kind: "main"; number: number; candidates: Array<{ li: LiId; reason: LeadReason }> } | null;
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

/** POST .../beats/:i/read */
export interface ReadResult {
  grants: Grant[];
  starlight: number;
  /** True once the chapter's last node has been read (by this read or an earlier one). */
  chapterDone: boolean;
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

/** The world as the client sees it: no mystery truth or pieces, no web secrets. */
export type WorldView = Omit<World, "mystery" | "web"> & {
  mystery: { question: string };
  web: Omit<WebRow, "secret">[];
};

export interface RunLiView {
  id: LiId;
  name: string;
  pronouns: Pronouns;
  /** A card's canon wins over the bible ("Card canon wins" shows only then). */
  source: Unit["source"];
  accent: string;
  portrait?: string;
  level: number;
  stage: number;
}

/** GET /runs/:run, and the `view` of POST /runs. */
export interface RunView {
  runKey: string;
  world: WorldView;
  player: Player;
  lis: RunLiView[];
  forge: ForgeStatus;
  starlight: number;
}

export type SetupLi =
  | { source: "card"; cardId: string; pronouns: Pronouns }
  | { source: "archetype"; archetype: string; name: string; pronouns: Pronouns; notes?: string };

/** POST /runs {setup}. Limits: premise ≤2000, traits ≤5, goal ≤300, notes ≤500, 2–5 LIs. */
export interface SetupInput {
  title?: string;
  premise: string;
  language: string;
  protagonist: { personaId: string; pronouns: Pronouns; traits: string[]; goal: string };
  lis: SetupLi[];
  content: ContentSettings;
  images: Pick<ImageSettings, "connectionId" | "rating" | "ask" | "expressions">;
  connections: Connections;
}

/** POST /runs/:run/settings. Raising a gated setting needs the 18+ gate; lowering one never does. */
export interface SettingsInput {
  content?: ContentSettings;
  images?: Partial<Pick<ImageSettings, "connectionId" | "rating" | "ask" | "expressions" | "styleProfileId">>;
  connections?: Connections;
  language?: string;
}
