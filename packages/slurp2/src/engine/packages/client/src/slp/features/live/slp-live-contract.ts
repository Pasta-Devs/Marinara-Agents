export type SlpLiveLine = {
  at: number;
  kind: "narration" | "crowd" | "reaction" | "picture" | "act";
  name?: string;
  text: string;
  mediaId?: string;
};
export type SlpLiveEvent = {
  at: number;
  kind: "tip" | "chat";
  name: string;
  amount?: number;
  text: string;
  personaId?: string;
  fromPlayer?: boolean;
  join?: boolean;
  host?: boolean;
};
export type SlpLiveMenuItem = { id: string; label: string; price: number; picture: boolean };
export type SlpLiveOrder = {
  itemId: string;
  label: string;
  name: string;
  personaId?: string;
  at: number;
  served: boolean;
  requestId: string;
  status?: "pending" | "paid";
};
/** The show's memory (server `SlurpLiveRoom`): what she showed, promised, and what each goal unlocks. */
export type SlpLiveRoomState = {
  shown: string[];
  promises: string[];
  goal?: string;
  secondGoal?: string;
};
export type SlpLiveShow = {
  id: string;
  hostKind: "creator" | "player";
  hostId: string;
  startedAt: string;
  endsAt: string;
  endedAt: string | null;
  goal: number;
  raised: number;
  goalHitAt: string | null;
  script: SlpLiveLine[];
  events: SlpLiveEvent[];
  lastReplyAt: string | null;
  recapPostId: string | null;
  menu: SlpLiveMenuItem[];
  queue: SlpLiveOrder[];
  segment: { index: number; lease: string | null; claimedAt: string | null } | null;
  lastSeenAt: string | null;
  missedSummary: string[] | null;
  announcedFor: string | null;
  mode: "text" | "pictures";
  pictureViewerId?: string | null;
  pictureViewers?: { personaId: string; mode: "text" | "pictures"; seenAt: string | null }[];
  pictureModeBusy?: boolean;
  private?: { personaId: string; until: string; block: number } | null;
  privatePrice?: number;
  picturesAllowed?: boolean;
  viewers?: number;
  room?: SlpLiveRoomState;
};
export type SlpLiveShowResponse = SlpLiveShow;

/** Live chat room types; the server keeps the prompt text for each (slp-live-rooms.ts). */
export const SLP_LIVE_ROOMS = ["default", "simps", "hype", "lurkers", "whales"] as const;
export type SlpLiveRoom = (typeof SLP_LIVE_ROOMS)[number];
