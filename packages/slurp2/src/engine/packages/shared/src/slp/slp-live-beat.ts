import { slpLiveLog, slpLivePrivateOn, type SlpLiveState } from "./slp-live.js";

/** How many seconds of show one model call writes (Backstage "Beat length"). */
export const SLP_LIVE_BEAT_SECONDS = { short: 20, normal: 35, long: 50 } as const;

export type SlpLiveBeatLine = { t: number; who: string; text: string; action?: string };
export type SlpLiveBeat = {
  lines: SlpLiveBeatLine[];
  heat: number;
  strip: boolean;
  place: string | null;
  /** For a hosting player: three suggested next moves. */
  next: string[];
};

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/**
 * The model's beat, or null when it is not one. Bad lines are dropped one by one (Echo Chamber's strict
 * check); a beat with no usable line is no beat.
 */
export function slpLiveParseBeat(raw: unknown): SlpLiveBeat | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const lines = (Array.isArray(value.lines) ? value.lines : []).flatMap((line): SlpLiveBeatLine[] => {
    if (!line || typeof line !== "object") return [];
    const entry = line as Record<string, unknown>;
    const who = text(entry.who, 40);
    const said = text(entry.text, 240);
    const action = text(entry.action, 120);
    const t = Number(entry.t);
    if (!who || (!said && !action) || !Number.isFinite(t)) return [];
    return [{ t, who, text: said, ...(action ? { action } : {}) }];
  });
  const next = (Array.isArray(value.next) ? value.next : [])
    .map((entry) => text(entry, 140))
    .filter(Boolean)
    .slice(0, 3);
  // A hosting player's beat may be only suggestions, when the room is quiet.
  if (!lines.length && !next.length) return null;
  const patch = value.patch && typeof value.patch === "object" ? (value.patch as Record<string, unknown>) : {};
  const heat = Number(patch.heat);
  return {
    lines,
    heat: Number.isFinite(heat) ? Math.max(0, Math.min(10, Math.round(heat))) : 0,
    strip: patch.strip === true,
    place: text(patch.place, 40) || null,
    next,
  };
}

/**
 * Puts a beat into the show at `at` (ms since start). Lines from names not in the room are dropped, the
 * unplayed rest of the previous beat is cut (the player's message cuts in), and the patch is held to what
 * the show allows. Returns how many lines were kept. Mutates `state`.
 */
export function slpLiveApplyBeat(
  state: SlpLiveState,
  beat: SlpLiveBeat,
  input: {
    at: number;
    seconds: number;
    host: string;
    you?: { by: string; name: string; text: string };
    /** The private block the beat was written for: its lines never outlive the block. */
    alone?: { to: number } | null;
    /** The player hosts: their own line is the host's, and the model writes only the room. */
    hosting?: boolean;
  },
): number {
  const { at, seconds } = input;
  state.log = state.log.filter(
    (event) => !((event.kind === "say" || event.kind === "chat" || event.kind === "cam") && event.at > at),
  );
  if (input.you)
    slpLiveLog(
      state,
      input.hosting
        ? { at, kind: "say", by: "host", name: input.host, text: input.you.text }
        : { at, kind: "you", by: input.you.by, name: input.you.name, text: input.you.text },
    );
  const host = input.host.toLowerCase();
  const inRoom = new Map(state.room.map((id) => [(state.names[id] ?? "").toLowerCase(), id]));
  // In a private block only the Creator talks, and nothing private is said after the block ends.
  const alone = input.alone ?? (slpLivePrivateOn(state, at) ? state.private! : null);
  // The first line comes a second after the player's words, so an answer reads as an answer.
  const start = at + (input.you ? 1_000 : 0);
  let last = start;
  let kept = 0;
  for (const line of [...beat.lines].sort((a, b) => a.t - b.t)) {
    const who = line.who.toLowerCase();
    // A fan in the room owns their name, even "Cam" or the Creator's name; only then do the reserved speakers apply.
    const fan = inRoom.get(who);
    // The cam line describes the stage; it keeps its own time and does not space the talk.
    if (!fan && who === "cam") {
      const camAt = start + Math.max(0, Math.min(seconds, line.t)) * 1_000;
      if (line.text && !(alone && camAt >= alone.to)) slpLiveLog(state, { at: camAt, kind: "cam", text: line.text });
      continue;
    }
    const isHost = !fan && (who === "host" || who === host);
    if (isHost ? input.hosting : !fan || alone) continue;
    // Never two lines in the same breath: at least 1.5 s apart, all inside the beat.
    last = Math.max(last + (kept ? 1_500 : 0), start + Math.max(0, Math.min(seconds, line.t)) * 1_000);
    if (alone && last >= alone.to) break;
    slpLiveLog(state, {
      at: last,
      kind: isHost ? "say" : "chat",
      by: isHost ? "host" : fan!,
      name: isHost ? input.host : state.names[fan!]!,
      text: line.text,
      ...(isHost && line.action ? { action: line.action } : {}),
    });
    kept += 1;
  }
  if (!kept && !input.hosting) return 0;
  state.heat = Math.min(100, state.heat + beat.heat);
  // The model writes only the room for a hosting player, so its strip and place do not apply.
  if (!input.hosting) {
    if (beat.strip && state.strip < state.stripMax) {
      state.strip += 1;
      slpLiveLog(state, { at: Math.round((start + last) / 2), kind: "strip", amount: state.strip });
    }
    if (beat.place) state.place = beat.place;
  }
  if (input.hosting) state.next = beat.next;
  // The room's talk comes back as soon as a private block ends.
  state.beatTo = Math.min(Math.max(last, start + seconds * 1_000), alone?.to ?? Infinity);
  return kept;
}
