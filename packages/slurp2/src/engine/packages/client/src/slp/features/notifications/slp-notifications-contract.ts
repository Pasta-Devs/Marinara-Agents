export type SlurpEventKind =
  | "subscribed"
  | "lapsed"
  | "tip"
  | "unlock"
  | "ppv_unlock"
  | "commission_requested"
  | "commission_accepted"
  | "comment"
  | "message"
  | "milestone"
  | "audience_arc"
  | "returned"
  | "arc_phase"
  | "arc_complete"
  | "arc_started"
  | "drama"
  | "couple"
  | "fan_note"
  | "sign_up"
  | "live";
export type SlurpEventItem = {
  id: string;
  kind: SlurpEventKind;
  creatorAccountId: string | null;
  subjectId: string | null;
  actorLabel: string | null;
  actorAvatarUrl: string | null;
  /** One readable line about the event, from the free bank. Null for events that need none. */
  note: string | null;
  amount: number;
  weight: number;
  createdAt: string;
  seenAt: string | null;
  /** A fan's note to the player's page: the player's heart and one reply. */
  answer?: { hearted: boolean; reply: string | null } | null;
};
export type SlurpEventGroup =
  | { type: "single"; event: SlurpEventItem }
  | {
      type: "group";
      kind: SlurpEventKind;
      count: number;
      total: number;
      latestAt: string;
      ids: string[];
      events: SlurpEventItem[];
    };

export { SlpFanNoteActions } from "./SlpFanNoteActions";
