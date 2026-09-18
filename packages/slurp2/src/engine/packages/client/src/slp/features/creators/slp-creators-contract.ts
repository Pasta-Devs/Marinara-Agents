import type { SlurpDiscoveryGender } from "../../base/state/slp-state-types.js";

export type SlurpCreatorBulkPatch = {
  gender?: SlurpDiscoveryGender | null;
  tags?: string[];
  addTags?: string[];
  removeTags?: string[];
  autoPosting?: boolean;
  imagesEnabled?: boolean;
};
/**
 * The viewer's wallet. Fetching it is what pays the daily stipend and charges due renewals on the
 * server, so the wallet page opening is also what moves the economy forward.
 */
/**
 * Why a Creator does or does not have an Engine Conversation Schedule today.
 *
 * `stale` is the one that matters: Engine schedules are keyed to a Monday, so one that was not
 * regenerated this week stops applying with no signal anywhere.
 */
export type SlurpScheduleStatus =
  | { state: "not-applicable" }
  | { state: "disabled" }
  | { state: "missing" }
  | { state: "stale" }
  | { state: "empty-today" }
  | { state: "active"; blocks: number };
export type SlurpCreatorMetrics = {
  id: string;
  posts: number;
  followers: number;
  subscribers: number;
  likes: number;
  replies: number;
  earnings: number;
  unread: number;
  arcs: number;
};
