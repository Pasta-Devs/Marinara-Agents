export type SlpLiveLine = { at: number; kind: "narration" | "crowd" | "reaction"; name?: string; text: string };
export type SlpLiveEvent = { at: number; kind: "tip" | "chat"; name: string; amount?: number; text: string };
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
};
export type SlpLiveShowResponse = SlpLiveShow;
