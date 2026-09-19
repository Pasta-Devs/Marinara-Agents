import type { NoodleAccount, NoodlerSubscriber } from "@marinara-engine/shared";

/** Fan and follower totals keyed by creator account id. */
export type NoodlerConnectionCounts = Record<string, { fans: number; followers: number }>;
/**
 * A subscriber row, widened for the generated audience.
 *
 * `NoodlerSubscriber` describes an account-backed viewer. Somebody from the population has no
 * account and no profile to open, so the extra fields say which kind of person a row is.
 */
export type SlurpSubscriberEntry = NoodlerSubscriber & {
  audience?: boolean;
  stage?: string;
  spent?: number;
};
/** Somebody in the audience who follows a Creator, by name. */
export type SlurpFollowerEntry = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  avatarCrop: null;
  stage: string;
  audienceArc: string;
  traits: string[];
  spent: number;
  followedAt: string;
};
// The fan card lives in the post modules, so its shape and read hook live there too.
export type { SlurpAudienceMember } from "../../modules/audience/slp-audience-member.js";

export type SlurpAudienceCharacterSummary = {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarCrop: unknown;
  conversationStatus?: string;
};
export type SlurpAudienceCharacterGroup = {
  id: string;
  name: string;
  characterIds: string[];
};
export type SlurpAmbientProfile = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
};
export type NoodleAmbientProfileRerollResult = {
  accounts: NoodleAccount[];
  outcomes: Array<{ accountId: string; status: string; reason?: string }>;
};
