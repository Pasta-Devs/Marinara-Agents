/** The show's memory: what she already did on camera, what she promised, refused and keeps joking about. */
export type SlurpLiveRoomLists = { shown: string[]; promises: string[]; refused: string[]; jokes: string[] };
/** `before` is the ledger as it was before the last segment was written, so a dropped segment can be undone. */
export type SlurpLiveRoom = SlurpLiveRoomLists & { before?: SlurpLiveRoomLists & { index: number } };

const LIMITS: Record<keyof SlurpLiveRoomLists, number> = { shown: 12, promises: 3, refused: 8, jokes: 4 };

export function slurpLiveParseRoom(value: string | null | undefined): SlurpLiveRoom {
  let parsed: Partial<Record<keyof SlurpLiveRoomLists | "before", unknown>> = {};
  try {
    parsed = value ? JSON.parse(value) : {};
  } catch {
    parsed = {};
  }
  const list = (key: keyof SlurpLiveRoomLists) =>
    Array.isArray(parsed[key])
      ? (parsed[key] as unknown[]).filter((item): item is string => typeof item === "string")
      : [];
  const lists = { shown: list("shown"), promises: list("promises"), refused: list("refused"), jokes: list("jokes") };
  const before = parsed.before as { index?: unknown } | undefined;
  return before && typeof before.index === "number"
    ? { ...lists, before: { ...slurpLiveParseRoom(JSON.stringify(before)), index: before.index } }
    : lists;
}

/** Undo the ledger changes of a dropped segment; refusals made since then stay. */
export function slurpLiveRoomRewind(room: SlurpLiveRoom, index: number): SlurpLiveRoom {
  if (room.before?.index !== index) return room;
  const { index: _index, ...lists } = room.before;
  return { ...lists, refused: room.refused };
}

/** Reads the model's `did`, `promise` and `joke` fields from a segment answer. */
export function slurpLiveRoomPatch(parsed: unknown): Partial<SlurpLiveRoomLists> {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const item = parsed as Record<string, unknown>;
  const strings = (value: unknown) =>
    (Array.isArray(value) ? value : [value]).filter((entry): entry is string => typeof entry === "string");
  return { shown: strings(item.did), promises: strings(item.promise), jokes: strings(item.joke) };
}

/** Adds new entries once (case-insensitive), newest kept; `keptPromises` clears promises paid off at the goal. */
export function slurpLiveMergeRoom(
  room: SlurpLiveRoom,
  patch: Partial<SlurpLiveRoomLists>,
  keptPromises = false,
): SlurpLiveRoomLists {
  const merge = (key: keyof SlurpLiveRoomLists, base: string[]) => {
    const seen = new Set(base.map((entry) => entry.toLowerCase()));
    const added = (patch[key] ?? [])
      .map((entry) => entry.trim().slice(0, 80))
      .filter((entry) => entry && !seen.has(entry.toLowerCase()) && seen.add(entry.toLowerCase()));
    return [...base, ...added].slice(-LIMITS[key]);
  };
  return {
    shown: merge("shown", room.shown),
    promises: merge("promises", keptPromises ? [] : room.promises),
    refused: merge("refused", room.refused),
    jokes: merge("jokes", room.jokes),
  };
}

/** Prompt lines so a later segment builds on the earlier ones instead of repeating them. */
export function slurpLiveRoomLines(room: SlurpLiveRoom, goalReached: boolean): string[] {
  return [
    room.shown.length ? `Already done on camera (never redo, build past it): ${room.shown.join("; ")}.` : "",
    room.promises.length
      ? goalReached
        ? `Keep what you promised the room now: ${room.promises.join("; ")}.`
        : `You promised for the goal: ${room.promises.join("; ")}. Tease it, do not give it away yet.`
      : "",
    room.refused.length ? `You said no to: ${room.refused.join("; ")}. Stay with that.` : "",
    room.jokes.length ? `Running jokes in this room: ${room.jokes.join("; ")}.` : "",
  ].filter(Boolean);
}
