// ──────────────────────────────────────────────
// Otome Forge: the wire contract between the package's routes and its client (types only)
// ──────────────────────────────────────────────
// Imported by both bundles, so a code or field added on one side has to be handled on the other.
import type { ContentSettings, ImageRating } from "./content";

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

/** `${R}:state`. Later milestones add fields with defaults. */
export interface RunState {
  version: 1;
  wallet: { starlight: number };
  lis: Record<LiId, { points: number; stage: number }>;
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
