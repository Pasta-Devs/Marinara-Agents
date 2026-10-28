/**
 * Which "not now" the away card shows. Everything comes from what the server already knows: the
 * reply status of the last send, the Creator's schedule block (`availability.activity`, the same text
 * the server's away list matched) and a conversation cool-off (`coolUntil`). No guessing from the
 * clock: a Creator without a schedule and without a time back has simply gone quiet.
 */
export type SlurpAwayKind = "away" | "asleep" | "busy" | "gym" | "trip" | "cooling" | "quiet";

export type SlurpAwayInput = {
  status: string | null;
  availability?: { online: boolean; activity: string | null; minutesUntilOnline: number | null } | null;
  coolUntil?: string | null;
  now?: number;
};

const ACTIVITY_KINDS: Array<[SlurpAwayKind, RegExp]> = [
  ["asleep", /\b(sleep|asleep|sleeping|bed|nap)\b/iu],
  ["gym", /\b(gym|workout|work out|training|yoga|pilates)\b/iu],
  ["trip", /\b(flight|flying|driving|drive|train|trip|travel|travelling|traveling|airport|road)\b/iu],
  ["busy", /\b(shoot|shooting|filming|film|on set|recording|meeting|class|lecture|work|shift|studio)\b/iu],
];

/** The kind, and when they are back (epoch ms) if the server said so. */
export function slurpAwayKind(input: SlurpAwayInput): { kind: SlurpAwayKind; backAt: number | null } {
  const now = input.now ?? Date.now();
  const coolUntil = input.coolUntil ? Date.parse(input.coolUntil) : Number.NaN;
  // In a roleplay scene with someone: busy, back when the scene ends.
  if (input.status === "in_scene") return { kind: "busy", backAt: null };
  if (input.status === "cooling" || (Number.isFinite(coolUntil) && coolUntil > now)) {
    return { kind: "cooling", backAt: Number.isFinite(coolUntil) && coolUntil > now ? coolUntil : null };
  }
  const availability = input.availability;
  if (!availability || availability.online) return { kind: "away", backAt: null };
  const backAt =
    availability.minutesUntilOnline !== null && availability.minutesUntilOnline > 0
      ? now + availability.minutesUntilOnline * 60_000
      : null;
  const activity = availability.activity ?? "";
  for (const [kind, pattern] of ACTIVITY_KINDS) if (pattern.test(activity)) return { kind, backAt };
  if (backAt === null) return { kind: "quiet", backAt: null };
  return { kind: "away", backAt };
}
