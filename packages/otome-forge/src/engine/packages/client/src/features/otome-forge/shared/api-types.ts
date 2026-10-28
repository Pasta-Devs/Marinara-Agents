// ──────────────────────────────────────────────
// Otome Forge: the wire contract between the package's routes and its client (types only)
// ──────────────────────────────────────────────
// Imported by both bundles, so a code or field added on one side has to be handled on the other.
import type { ConfrontationEnding, RouteEntry, Stance } from "./arcs";
import type { ContentSettings, ImageRating, LimitId } from "./content";
import type { Face, MusicMood } from "./faces";

export type { ConfrontationEnding, RouteEntry, RouteNext, Stance } from "./arcs";

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

/** The kit's normalizeForgeAudio shape (forge-kit audio-settings): the player's audio choices. No credentials. */
export interface AudioSettings {
  tts: boolean;
  otherVoices: boolean;
  /** Kept for the kit's shape; Otome has no combat. */
  combatVoices: boolean;
  generate: boolean;
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
  content: ContentSettings;
  images: ImageSettings;
  connections: Connections;
  forge: ForgeStatus;
  audio: WorldAudio;
  /** Keyed by S/art/places.ts placeKey(name), which keeps the letters of any script; clients look places up by name. */
  places: Record<string, PlaceArt>;
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

/** How far trust and tension moved in one chapter, and in its beat `beat.i` (the per-beat cap). */
export interface ChapterShift {
  trust: number;
  tension: number;
  beat?: { i: number; trust: number; tension: number };
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
  /** M2b: the CGs unlocked once seen. */
  album: { cgs: AlbumCg[] };
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
  /** A key image's brief: `at` is the segment it opens on; `brief` is English. `art` is its paint (M2b, S/art/cg.ts). */
  cg?: { at: number; brief: string; cast: string[]; art?: Paint };
  /** The furthest mainline segment read (skip-read starts here). */
  readThrough: number;
  /** The player ended the scene at segment `at` (no model call); `veil` is what they chose to veil from then on. */
  easedOff?: { at: number; veil?: LimitId[] };
  written: { at: string; connectionId: string; model: string };
  rewrites: number;
  /** Set once the reader was first served it (M2b): a rupture opens no route beat that was never on screen. */
  shown?: true;
  /** A confrontation node's stance game (M2b, P12); `segments` holds its opening. Hidden: the client gets a view. */
  confrontation?: Confrontation;
}

// ── The Confrontation (M2b): three rounds of Press, Hold, Yield or Reveal, one call (P12) ──

export interface ConfrontationOption {
  /** The pill's short label. */
  label: string;
  /** What the protagonist says or does. */
  selection: { kind: "dialogue" | "action"; text: string };
  /** His answer to the stance (1–3 segments). */
  segments: Segment[];
  /** How the stance moves his composure (hidden; S/story/confrontation.ts). */
  composure: -1 | 0 | 1;
}

export interface ConfrontationRound {
  /** His lines opening the round; they follow from any stance of the round before. */
  his: Segment[];
  options: Record<Stance, ConfrontationOption>;
}

/** Stored on the beat. `picks` are the first-play stances, in round order; `ending` is set with the last pick. */
export interface Confrontation {
  /** Whom she confronts. */
  li: LiId;
  rounds: ConfrontationRound[];
  endings: Record<ConfrontationEnding, Segment[]>;
  /** What a walkout leaves between them. */
  grievance: { text: string; severity: "major" };
  /** What she tells him when she picks Reveal, as one third-person sentence. */
  disclosure: string;
  picks: Stance[];
  ending?: ConfrontationEnding;
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
  options: Record<Stance, ConfrontationOptionView>;
  /** The first-play stance, once picked (a replay keeps it). */
  picked?: Stance;
}

export interface ConfrontationEndingView {
  kind: ConfrontationEnding;
  segments: Segment[];
}

/**
 * The stance game as the client sees it, with the beat's own fields: the opening, every round played and the one
 * being played, and the ending once reached. His composure is never shown, nor the answers to stances not taken, nor
 * an ending not reached. Its reading position (`readThrough`, POST .../read {segment}, an Ease off's `at`) indexes its
 * mainline: the opening, then each shown round's `his` lines (a stance's answer shares its round's last index), then
 * the ending.
 */
export type ConfrontationView = Omit<BeatView, "segments" | "choices" | "choiceCanon"> & {
  li: LiId;
  opening: Segment[];
  rounds: ConfrontationRoundView[];
  ending?: ConfrontationEndingView;
};

/** POST .../beats/:i/stance {round, stance}. */
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
export type ChapterView = Omit<Chapter, "nodes" | "ledger" | "connectionId"> & {
  nodes: Array<Pick<ChapterNode, "i" | "kind" | "moment" | "cg" | "gate">>;
};

/** A beat as the client sees it: without its effects or its stored confrontation (POST .../beats/:i sends a view). */
export type BeatView = Omit<Beat, "effects" | "applied" | "confrontation">;

/** GET /runs/:run/art/scene (M2b): what the reader polls while a beat's art is painting. */
export interface SceneArt {
  /** The beat's places in order, each with its record (a place never recorded has no art). */
  places: PlaceArt[];
  /** The beat's key image with its paint, or null. */
  cg: NonNullable<BeatView["cg"]> | null;
  /** Each love interest's faces for the look worn now, once the set is ready and expressions are on. */
  faces: Record<LiId, Partial<Record<Face, string>>>;
  /** The love interests whose faces are still being painted (a failed or stopped set never arrives on its own). */
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
  level: number;
  stage: number;
  /** M2b: his painted faces for the current look, once the whole set is ready and expressions are on. */
  expressions?: Partial<Record<Face, string>>;
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
