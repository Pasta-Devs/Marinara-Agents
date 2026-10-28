import { SLURP_DEFAULT_REPLY_DELAYS, slurpDelayInRange, type SlurpReplyDelays } from "../messages/slp-messaging.js";

type CreatorSource = { kind: string; entityId: string; displayName: string };

/** `status` is the Engine's presence for the block; a routine read from the card has none. */
type ScheduleBlock = { time: string; activity: string; status?: unknown };

type WeekSchedule = {
  weekStart: string;
  enabled?: boolean;
  days: Record<string, ScheduleBlock[]>;
};

const SCHEDULE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Yesterday's, today's and tomorrow's blocks, Monday-first like the Engine's day names. */
function scheduleDaysAround(schedule: WeekSchedule, localNow: Date): (ScheduleBlock[] | undefined)[] {
  const today = (localNow.getDay() + 6) % 7;
  return [-1, 0, 1].map((offset) => schedule.days[SCHEDULE_DAYS[(today + offset + 7) % 7]!]);
}

type ScheduleCharacter = { data?: unknown } | null;

function record(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function parseSlurpWeekSchedule(value: unknown): WeekSchedule | null {
  const schedule = record(value);
  const days = record(schedule.days);
  if (!Number.isFinite(Date.parse(String(schedule.weekStart))) || Object.keys(days).length === 0) return null;
  if (schedule.enabled !== undefined && typeof schedule.enabled !== "boolean") return null;
  if (
    !Object.values(days).every(
      (day) =>
        Array.isArray(day) &&
        day.every(
          (block) =>
            !!block &&
            typeof block === "object" &&
            !Array.isArray(block) &&
            typeof (block as Record<string, unknown>).time === "string" &&
            typeof (block as Record<string, unknown>).activity === "string",
        ),
    )
  )
    return null;
  return schedule as unknown as WeekSchedule;
}

function scheduleEnabled(character: ScheduleCharacter): boolean {
  const extensions = record(record(character?.data).extensions);
  for (const key of ["conversationSchedulesEnabled", "conversationScheduleEnabled"]) {
    if (typeof extensions[key] === "boolean") return extensions[key];
  }
  return true;
}

function zonedDate(now: Date, zone?: string): Date {
  if (!zone) return new Date(now);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  return new Date(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
}

function isStale(schedule: WeekSchedule, localNow: Date): boolean {
  const monday = new Date(localNow);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  // Every writer (Engine generator, Engine schedule editor, Slurp regenerate) stores weekStart as
  // Monday at *local* midnight of whichever host or browser wrote it, serialized to UTC. East of UTC
  // that instant falls on Sunday in UTC, so reading the UTC date made a freshly generated schedule
  // stale forever. Compare instants instead: this week's Monday written anywhere from UTC-12 to
  // UTC+14 lands within [mondayUtc - 14h, mondayUtc + 12h]; last week's is at most mondayUtc - 156h.
  const mondayUtc = Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate());
  return Date.parse(schedule.weekStart) < mondayUtc - 14 * 60 * 60 * 1000;
}

export function buildSlurpCreatorScheduleContext(
  enabled: boolean,
  schedule: WeekSchedule | null,
  source: CreatorSource,
  localNow: Date,
  zone?: string,
): string | null {
  // An older week still applies as a weekly routine, as it does in Engine chats. Dropping it made a
  // Creator lose their day the moment a week passed, whatever the reason the date was old.
  if (!enabled || !schedule) return null;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const today = schedule.days[days[(localNow.getDay() + 6) % 7]!];
  if (!today?.length) return null;
  const localDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(localNow);
  // The name is deliberately absent. The model already knows whose schedule this is from the
  // surrounding prompt, and a Hinted or Secret Creator must never receive the source's real
  // display name — this string used to carry it straight past the redaction applied to every
  // neighbouring field.
  return `Current Conversation Schedule (${localDate}${zone ? `, ${zone}` : ""}): ${today.map((block) => `${block.time}: ${block.activity}`).join(", ")}`;
}

export async function resolveSlurpCreatorScheduleContext(
  characters: { getById(id: string): Promise<ScheduleCharacter> },
  source: CreatorSource,
  timeZone?: string,
  now: Date = new Date(),
): Promise<string> {
  if (source.kind !== "character") return "No active Conversation Schedule is available for this Creator today.";
  const character = await characters.getById(source.entityId);
  if (!scheduleEnabled(character)) return "No active Conversation Schedule is available for this Creator today.";
  const schedule = parseSlurpWeekSchedule(record(record(character?.data).extensions).conversationSchedule);
  if (!schedule || schedule.enabled === false)
    return "No active Conversation Schedule is available for this Creator today.";
  const context = buildSlurpCreatorScheduleContext(true, schedule, source, zonedDate(now, timeZone), timeZone);
  if (context) return context;
  return "No active Conversation Schedule is available for this Creator today.";
}

/**
 * Activities that mean "cannot pick up the phone". Everything else counts as reachable, because
 * a creator at lunch or on the train still answers a DM — only these actually stop them. Read only
 * for a block without an Engine status; a status decides on its own.
 */
export const SLURP_AWAY_ACTIVITIES = [
  "sleep",
  "asleep",
  "sleeping",
  "bed",
  "shooting",
  "filming",
  "on set",
  "recording",
  "workout",
  "gym",
  "class",
  "lecture",
  "meeting",
  "driving",
  "flight",
  "flying",
] as const;

export type SlurpCreatorAvailability = {
  online: boolean;
  /** What the schedule says they are doing right now, for the reply prompt. */
  activity: string | null;
  /** Minutes until the next reachable stretch starts. `null` when no return time is known. */
  minutesUntilOnline: number | null;
  /** True when there is no active schedule and the status is guessed from recent posts. */
  estimated?: boolean;
};

/**
 * Infer availability from recent posting activity when no schedule exists.
 *
 * A Creator without a schedule shouldn't read as permanently online—that destroys realism.
 * Instead, infer availability from when they last posted: recent activity suggests they're
 * around, while stale activity suggests they're away.
 *
 * Uses deterministic randomness seeded by creatorId + day so Creators have consistent
 * daily patterns without being perfectly predictable.
 */
function inferAvailabilityFromActivity(
  creatorId: string,
  lastPostedAt: string | null,
  now: Date = new Date(),
  delays: SlurpReplyDelays = SLURP_DEFAULT_REPLY_DELAYS,
): SlurpCreatorAvailability {
  if (delays.messagesUnscheduledAlwaysReachable) return { online: true, activity: null, minutesUntilOnline: 0 };

  if (!lastPostedAt) {
    // Never posted = offline indefinitely
    return { online: false, activity: null, minutesUntilOnline: null };
  }

  const ageMinutes = (now.getTime() - Date.parse(lastPostedAt)) / 60_000;

  // Posted within 15 minutes = definitely online right now
  if (ageMinutes <= 15) {
    return { online: true, activity: "posting", minutesUntilOnline: 0 };
  }

  // Posted 15min-2hr ago = probably around but not actively posting
  // Come back online in 30-90 minutes (deterministic randomness)
  if (ageMinutes <= 120) {
    const seed = simpleHash(creatorId + now.toDateString());
    const variance = (seed % 60) / 59; // 0.0 to 1.0
    const minutesUntilOnline = Math.round(
      slurpDelayInRange(delays.messagesRecentPostAwayMinMinutes, delays.messagesRecentPostAwayMaxMinutes, variance),
    );
    return { online: false, activity: null, minutesUntilOnline };
  }

  // Posted 2-12 hours ago = offline, back in a few hours
  if (ageMinutes <= 720) {
    const seed = simpleHash(creatorId + now.toDateString() + "midday");
    const variance = (seed % 120) / 119; // 0.0 to 1.0
    const minutesUntilOnline = Math.round(
      slurpDelayInRange(delays.messagesStalePostAwayMinMinutes, delays.messagesStalePostAwayMaxMinutes, variance),
    );
    return { online: false, activity: null, minutesUntilOnline };
  }

  // Posted >12 hours ago = offline for the day
  return { online: false, activity: null, minutesUntilOnline: null };
}

/**
 * Simple string hash for deterministic randomness.
 *
 * Not cryptographic, just needs to be consistent per input.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

const clockMinutes = (value: string | undefined): number | null => {
  if (!value) return null;
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59)
    return null;
  return hours * 60 + minutes;
};

/**
 * A block's time in minutes from midnight. The Engine stores a range ("06:00-08:00") and this reads
 * it the way the Engine does (shared `conversation-presence.ts`); an end at or before the start
 * crosses midnight. A bare "06:00" is the older timeline form and has no end of its own.
 */
function blockMinutes(time: string): { start: number; end: number | null } | null {
  const [startText, endText] = time.split("-");
  const start = clockMinutes(startText);
  if (start === null) return null;
  if (endText === undefined) return { start, end: null };
  const end = clockMinutes(endText);
  return end === null ? null : { start, end };
}

type SchedulePresence = "online" | "idle" | "dnd" | "offline";
const SCHEDULE_PRESENCES: ReadonlySet<unknown> = new Set(["online", "idle", "dnd", "offline"]);
type ScheduleSegment = { start: number; end: number; activity: string; presence: SchedulePresence | null };

/**
 * The Creator's day from yesterday to tomorrow as back-to-back segments, in minutes from today's
 * midnight, read the way the Engine reads a Conversation Schedule (`getAdjacentScheduleBlocks`): a
 * range covers its own hours, one that crosses midnight belongs to the day it starts on, the
 * later-starting block wins an overlap, and time no block covers is free time, online (#1436).
 *
 * A bare time runs until the next block of its day starts, and the day's last one wraps round to
 * its first, as the timeline form always did. A day with no readable block is unknown, not free,
 * so nothing is promised about it.
 */
function scheduleSegments(days: readonly (readonly ScheduleBlock[] | undefined)[]): ScheduleSegment[] {
  const blocks: ScheduleSegment[] = [];
  const knownDays: number[] = [];
  days.forEach((day, index) => {
    const offset = (index - 1) * 1440;
    const parsed = (day ?? [])
      .flatMap((block) => {
        const range = typeof block.time === "string" ? blockMinutes(block.time) : null;
        const activity = typeof block.activity === "string" ? block.activity.trim() : "";
        const presence = SCHEDULE_PRESENCES.has(block.status) ? (block.status as SchedulePresence) : null;
        return range && activity ? [{ ...range, activity, presence }] : [];
      })
      .sort((left, right) => left.start - right.start);
    if (parsed.length === 0) return;
    knownDays.push(offset);
    for (const [position, block] of parsed.entries()) {
      const segment = { activity: block.activity, presence: block.presence, start: offset + block.start };
      const next = parsed[position + 1];
      if (block.end !== null) {
        blocks.push({ ...segment, end: offset + block.end + (block.end <= block.start ? 1440 : 0) });
      } else if (next) {
        blocks.push({ ...segment, end: offset + next.start });
      } else {
        blocks.push({ ...segment, end: offset + 1440 });
        blocks.push({ ...segment, start: offset, end: offset + parsed[0]!.start });
      }
    }
  });
  const ordered = blocks.filter((block) => block.end > block.start).sort((left, right) => left.start - right.start);
  const edges = [
    ...new Set([
      ...ordered.flatMap((block) => [block.start, block.end]),
      ...knownDays.flatMap((day) => [day, day + 1440]),
    ]),
  ].sort((left, right) => left - right);
  const segments: ScheduleSegment[] = [];
  for (const [position, start] of edges.entries()) {
    const end = edges[position + 1];
    if (end === undefined) break;
    let owner: ScheduleSegment | null = null;
    for (const block of ordered) if (block.start <= start && start < block.end) owner = block;
    const piece =
      owner ??
      (knownDays.some((day) => day <= start && start < day + 1440)
        ? { activity: "free time", presence: "online" as const }
        : null);
    if (!piece) continue;
    const last = segments.at(-1);
    if (last && last.end === start && last.activity === piece.activity && last.presence === piece.presence)
      last.end = end;
    else segments.push({ start, end, activity: piece.activity, presence: piece.presence });
  }
  return segments;
}

const segmentAt = (segments: readonly ScheduleSegment[], localNow: Date): number => {
  const minutes = localNow.getHours() * 60 + localNow.getMinutes();
  return segments.findIndex((segment) => segment.start <= minutes && minutes < segment.end);
};

/**
 * Blocks nobody posts from. Narrower than `SLURP_AWAY_ACTIVITIES` on purpose: a Creator at the gym,
 * on set, or in class cannot answer a DM quickly, but that is exactly where a post comes from.
 */
export const SLURP_NO_POST_ACTIVITIES = ["sleep", "asleep", "sleeping", "bed", "driving"] as const;

/**
 * Where the day stands at `localNow`: the block running now and the one before it, from the same
 * segments availability reads, so a gap between ranges is free time here too. Used for the post
 * brief's day plan, from a schedule or from a routine extracted from the card. Without `around`,
 * the day repeats, as a routine does.
 *
 * A post due while they sleep or drive was written just before: the moment steps back to the last
 * block they could post from, and `queued` says so.
 */
export function slurpTimelineMoment(
  blocks: readonly ScheduleBlock[],
  localNow: Date,
  around: { yesterday?: readonly ScheduleBlock[]; tomorrow?: readonly ScheduleBlock[] } = {
    yesterday: blocks,
    tomorrow: blocks,
  },
): { current: string; previous: string | null; queued: boolean } | null {
  const segments = scheduleSegments([around.yesterday, blocks, around.tomorrow]);
  const now = segmentAt(segments, localNow);
  if (now === -1) return null;
  const noPost = (segment: ScheduleSegment) =>
    SLURP_NO_POST_ACTIVITIES.some((needle) => segment.activity.toLowerCase().includes(needle));
  const follows = (index: number) => index > 0 && segments[index - 1]!.end === segments[index]!.start;
  let index = now;
  while (noPost(segments[index]!) && follows(index)) index -= 1;
  const current = segments[index]!.activity;
  // A day of nothing but sleep has no block to step back to; say nothing rather than "asleep".
  if (noPost(segments[index]!)) return null;
  const previous = follows(index) ? segments[index - 1]!.activity : null;
  return { current, previous: previous === current ? null : previous, queued: index !== now };
}

/**
 * Today's schedule blocks for a character-backed Creator, with yesterday's and tomorrow's for a
 * range that crosses midnight, or null when there is no usable schedule today. A day without blocks
 * still counts while yesterday's night block runs into it.
 */
export async function resolveSlurpCreatorScheduleBlocks(
  characters: { getById(id: string): Promise<ScheduleCharacter> },
  source: CreatorSource,
  now: Date = new Date(),
  timeZone?: string,
): Promise<{ blocks: ScheduleBlock[]; yesterday: ScheduleBlock[]; tomorrow: ScheduleBlock[]; localNow: Date } | null> {
  if (source.kind !== "character") return null;
  const character = await characters.getById(source.entityId);
  if (!scheduleEnabled(character)) return null;
  const schedule = parseSlurpWeekSchedule(record(record(character?.data).extensions).conversationSchedule);
  if (!schedule || schedule.enabled === false) return null;
  const localNow = zonedDate(now, timeZone);
  const [yesterday, today, tomorrow] = scheduleDaysAround(schedule, localNow);
  if (!today?.length && segmentAt(scheduleSegments([yesterday, today, tomorrow]), localNow) === -1) return null;
  return { blocks: today ?? [], yesterday: yesterday ?? [], tomorrow: tomorrow ?? [], localNow };
}

/**
 * Whether the creator is reachable right now, from the same parsed week schedule the prompt
 * context is built from. One parser, so the text a creator says about their day and the delay
 * before they answer can never disagree.
 *
 * A block's Engine status decides (#1436): offline and dnd are away, online and idle answer. Only a
 * block without one falls back to its activity, matched against `awayActivities`. Free time between
 * blocks is online, as in the Engine. The wait runs to the next reachable stretch the schedule
 * knows about, and is `null` when none is known.
 */
export function slurpCreatorAvailability(
  schedule: WeekSchedule | null,
  localNow: Date,
  awayActivities: readonly string[] = SLURP_AWAY_ACTIVITIES,
): SlurpCreatorAvailability | null {
  if (!schedule) return null;
  const segments = scheduleSegments(scheduleDaysAround(schedule, localNow));
  const index = segmentAt(segments, localNow);
  if (index === -1) return null;
  const away = (segment: ScheduleSegment) =>
    segment.presence
      ? segment.presence === "offline" || segment.presence === "dnd"
      : awayActivities.some((needle) => segment.activity.toLowerCase().includes(needle));
  const current = segments[index]!;
  if (!away(current)) return { online: true, activity: current.activity, minutesUntilOnline: 0 };
  const nowMinutes = localNow.getHours() * 60 + localNow.getMinutes();
  let minutesUntilOnline: number | null = null;
  for (let next = index + 1; next < segments.length; next += 1) {
    // A day the schedule says nothing about ends the search: the wait is unknown, not free.
    if (segments[next]!.start !== segments[next - 1]!.end) break;
    if (!away(segments[next]!)) {
      minutesUntilOnline = segments[next]!.start - nowMinutes;
      break;
    }
  }
  return { online: false, activity: current.activity, minutesUntilOnline };
}

/** The availability for one creator, read from the Engine character the profile points at. */
/**
 * Why a Creator does or does not have a schedule today.
 *
 * Every prompt path collapses all four failure modes into one sentence — "No active Conversation
 * Schedule is available" — which is right for a prompt and useless for a person. The dangerous one
 * is `stale`: Engine schedules are keyed to a Monday, so a schedule that was not regenerated this
 * week silently stops applying. The Creator loses their daily rhythm and their message pacing, and
 * nothing anywhere said so. It just looks like the writing got worse.
 */
export type SlurpScheduleStatus =
  /** Persona-backed. Schedules are a character feature, so there is nothing to report. */
  | { state: "not-applicable" }
  /** The character has Conversation Schedules switched off. */
  | { state: "disabled" }
  /** No schedule has ever been saved for this character. */
  | { state: "missing" }
  /** A schedule exists but belongs to an earlier week, so nothing is reading it. */
  | { state: "stale" }
  /** In use today, with this many blocks. */
  | { state: "active"; blocks: number }
  /** This week's schedule has no blocks for today specifically. */
  | { state: "empty-today" };

export async function resolveSlurpCreatorScheduleStatus(
  characters: { getById(id: string): Promise<ScheduleCharacter> },
  source: CreatorSource,
  timeZone?: string,
  now: Date = new Date(),
): Promise<SlurpScheduleStatus> {
  if (source.kind !== "character") return { state: "not-applicable" };
  const character = await characters.getById(source.entityId);
  if (!scheduleEnabled(character)) return { state: "disabled" };
  const schedule = parseSlurpWeekSchedule(record(record(character?.data).extensions).conversationSchedule);
  if (!schedule) return { state: "missing" };
  if (schedule.enabled === false) return { state: "disabled" };
  const localNow = zonedDate(now, timeZone);
  if (isStale(schedule, localNow)) return { state: "stale" };
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const today = schedule.days[days[(localNow.getDay() + 6) % 7]!];
  return today?.length ? { state: "active", blocks: today.length } : { state: "empty-today" };
}

/** The stored Conversation Schedule object, which also carries talkativeness. */
export async function resolveSlurpCreatorScheduleTraits(
  characters: { getById(id: string): Promise<ScheduleCharacter> },
  source: CreatorSource,
): Promise<unknown> {
  if (source.kind !== "character") return null;
  return record(record(record((await characters.getById(source.entityId))?.data).extensions).conversationSchedule);
}

export async function resolveSlurpCreatorAvailability(
  characters: { getById(id: string): Promise<ScheduleCharacter> },
  source: CreatorSource,
  timeZone?: string,
  now: Date = new Date(),
  lastPostedAt?: string | null,
  delays?: SlurpReplyDelays,
): Promise<SlurpCreatorAvailability> {
  // Persona-backed Creators: try to get schedule from character
  if (source.kind === "character") {
    const character = await characters.getById(source.entityId);

    if (scheduleEnabled(character)) {
      const schedule = parseSlurpWeekSchedule(record(record(character?.data).extensions).conversationSchedule);
      const localNow = zonedDate(now, timeZone);

      // Same rule as the prompt context: an older week repeats rather than switching off.
      if (schedule && schedule.enabled !== false) {
        const availability = slurpCreatorAvailability(schedule, localNow);
        if (availability) return availability;
      }
    }
  }

  // No schedule available: infer from posting activity
  return { ...inferAvailabilityFromActivity(source.entityId, lastPostedAt ?? null, now, delays), estimated: true };
}
