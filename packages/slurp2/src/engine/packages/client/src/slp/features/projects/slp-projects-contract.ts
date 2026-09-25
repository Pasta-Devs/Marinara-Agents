import type { SlpArcBlueprint } from "../../../../../shared/src/slp/slp-story-engine.js";

export type SlurpProject = {
  id: string;
  title: string;
  direction: string;
  chapters: string[];
  chapter: number;
  status: "active" | "paused" | "complete" | "suggested";
  posts: number;
  startedAt: string;
  updatedAt: string;
  typeId: string | null;
  tone: string;
  durationDays: number | null;
  phaseDays: ({ min: number; max: number } | null)[];
  chapterStartedAt: string;
  intensity: "background" | "focus";
  origin: "manual" | "auto";
  generated: boolean;
  history: SlurpArcHistoryEntry[];
  completedAt: string | null;
  twist: string;
  choices: (SlurpArcChoice | null)[];
  pollPostId: string | null;
  pollClosesAt: string | null;
  reach: (SlurpArcChapterReach | null)[];
  revertProfileAtEnd: boolean;
  pendingProfile: { chapter: number; bio?: string; location?: string; proposedAt: string; revert: boolean } | null;
  previousProfile: { bio?: string; location?: string } | null;
  /** A crossover's Creators; empty for a single-Creator arc. */
  creatorIds: string[];
  /** The other participants' display names. */
  partnerNames?: string[];
};
/** Mirrors `SlurpArcChapterReach` on the server: what one chapter changes beyond its posts. */
export type SlurpArcChapterReach = {
  mood?: string;
  effects?: SlurpArcEffects;
  profile?: { bio?: string; location?: string };
};
export type SlurpArcEffects = { growth?: number; earnings?: number; loyalty?: number };
/** Mirrors `SlurpArcChoice` on the server: a fan poll at the end of a chapter. */
export type SlurpArcChoice = {
  question: string;
  options: { label: string; chapters: { label: string; minDays: number; maxDays: number }[] }[];
};
/** Mirrors `SlurpArcHistoryEntry` on the server: one chapter visit. */
export type SlurpArcHistoryEntry = {
  chapter: number;
  label: string;
  startedAt: string;
  endedAt: string | null;
  postIds: string[];
  poll?: {
    question: string;
    winner: string;
    votes: { label: string; count: number }[];
    decidedBy: "fans" | "director" | "chance";
  };
  /** Before the `arcStatEffects` cap. */
  effects?: SlurpArcEffects;
};
/** The viewer-safe part of an arc, for the profile timeline. */
export type SlurpArcTimeline = Pick<
  SlurpProject,
  "id" | "title" | "tone" | "chapters" | "chapter" | "status" | "startedAt" | "completedAt" | "history"
> & {
  openChoice: { question: string; closesAt: string | null } | null;
  /** The other Creators in a crossover this viewer may see. */
  partners?: { id: string; handle: string; displayName: string; avatarUrl: string | null }[];
};
/** Mirrors `SlurpCreatorArcConfig` on the server. A missing field uses the global setting. */
export type SlurpCreatorArcConfig = {
  autoMode?: "off" | "suggest" | "auto";
  source?: "library" | "generated" | "mixed";
  cooldownWeeks?: number;
  pace?: "slow" | "normal" | "fast";
  allowedTypeIds?: string[];
  maxActive?: number;
  crossovers?: boolean;
};
/** Mirrors `SlurpArcType` on the server: one entry of the `arcLibrary` setting. */
export type SlurpArcType = SlpArcBlueprint;

/** The per-Creator storyline overrides, also shown as a tab in Creator settings. */
export { ArcConfigSection } from "./SlpArcConfigSection";
export { useSlurpProjects } from "./slp-projects-hooks";
