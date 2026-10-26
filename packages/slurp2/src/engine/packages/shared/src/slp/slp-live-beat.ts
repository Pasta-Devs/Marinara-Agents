import { slpLiveLog, type SlpLiveState } from "./slp-live.js";

/** How many seconds of show one model call writes (Backstage "Beat length"). */
export const SLP_LIVE_BEAT_SECONDS = { short: 20, normal: 35, long: 50 } as const;

export type SlpLiveBeatLine = { t: number; who: string; text: string; action?: string };
export type SlpLiveBeat = { lines: SlpLiveBeatLine[]; heat: number; strip: boolean; place: string | null };

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
  if (!lines.length) return null;
  const patch = value.patch && typeof value.patch === "object" ? (value.patch as Record<string, unknown>) : {};
  const heat = Number(patch.heat);
  return {
    lines,
    heat: Number.isFinite(heat) ? Math.max(0, Math.min(10, Math.round(heat))) : 0,
    strip: patch.strip === true,
    place: text(patch.place, 40) || null,
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
  input: { at: number; seconds: number; host: string; you?: { by: string; name: string; text: string } },
): number {
  const { at, seconds } = input;
  state.log = state.log.filter((event) => !((event.kind === "say" || event.kind === "chat") && event.at > at));
  if (input.you) slpLiveLog(state, { at, kind: "you", by: input.you.by, name: input.you.name, text: input.you.text });
  const inRoom = new Map(state.room.map((id) => [(state.names[id] ?? "").toLowerCase(), id]));
  const host = input.host.toLowerCase();
  // The first line comes a second after the player's words, so an answer reads as an answer.
  const start = at + (input.you ? 1_000 : 0);
  let last = start;
  let kept = 0;
  for (const line of [...beat.lines].sort((a, b) => a.t - b.t)) {
    const who = line.who.toLowerCase();
    const fan = inRoom.get(who);
    const isHost = who === "host" || who === host;
    if (!isHost && !fan) continue;
    // Never two lines in the same breath: at least 1.5 s apart, all inside the beat.
    last = Math.max(last + (kept ? 1_500 : 0), start + Math.max(0, Math.min(seconds, line.t)) * 1_000);
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
  if (!kept) return 0;
  state.heat = Math.min(100, state.heat + beat.heat);
  if (beat.strip && state.strip < state.stripMax) {
    state.strip += 1;
    slpLiveLog(state, { at: Math.round((start + last) / 2), kind: "strip", amount: state.strip });
  }
  if (beat.place) state.place = beat.place;
  state.beatTo = Math.max(last, start + seconds * 1_000);
  return kept;
}
