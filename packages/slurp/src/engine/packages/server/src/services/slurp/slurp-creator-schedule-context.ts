type CreatorSource = { kind: string; entityId: string; displayName: string };

type WeekSchedule = {
  weekStart: string;
  enabled?: boolean;
  days: Record<string, Array<{ time: string; activity: string }>>;
};

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

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateKeyInTimeZone(date: Date, zone?: string): string {
  if (!zone) return dateKey(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isStale(schedule: WeekSchedule, localNow: Date, zone?: string): boolean {
  const monday = new Date(localNow);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const weekStart = new Date(schedule.weekStart);
  // Engine schedules store weekStart as the Monday date at UTC midnight. Compare
  // that stable calendar key with the local Monday instead of shifting the stored
  // boundary into the host or viewer time zone.
  const storedWeekKey = dateKeyInTimeZone(weekStart, "UTC");
  return storedWeekKey < dateKey(monday);
}

export function buildSlurpCreatorScheduleContext(
  enabled: boolean,
  schedule: WeekSchedule | null,
  source: CreatorSource,
  localNow: Date,
  zone?: string,
): string | null {
  if (!enabled || !schedule || isStale(schedule, localNow, zone)) return null;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const today = schedule.days[days[(localNow.getDay() + 6) % 7]!];
  if (!today?.length) return null;
  const localDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(localNow);
  return `Current Conversation Schedule for ${source.displayName} (${localDate}${zone ? `, ${zone}` : ""}): ${today.map((block) => `${block.time}: ${block.activity}`).join(", ")}`;
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
 * a creator at lunch or on the train still answers a DM — only these actually stop them.
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
  /** Minutes until the next schedule block starts. `null` when nothing is left today. */
  minutesUntilOnline: number | null;
};

/** No schedule means always reachable: a creator without one must not read as permanently away. */
const ALWAYS_AVAILABLE: SlurpCreatorAvailability = { online: true, activity: null, minutesUntilOnline: 0 };

const minutesOfDay = (time: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(mins) || hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
};

/**
 * Whether the creator is reachable right now, from the same parsed week schedule the prompt
 * context is built from. One parser, so the text a creator says about their day and the delay
 * before they answer can never disagree.
 *
 * A block is treated as running until the next block starts, which is how the Engine schedule
 * reads: the entries are a timeline, not a set of appointments with end times.
 */
export function slurpCreatorAvailability(
  schedule: WeekSchedule | null,
  localNow: Date,
  awayActivities: readonly string[] = SLURP_AWAY_ACTIVITIES,
): SlurpCreatorAvailability {
  if (!schedule) return ALWAYS_AVAILABLE;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const today = schedule.days[days[(localNow.getDay() + 6) % 7]!];
  if (!today?.length) return ALWAYS_AVAILABLE;
  const blocks = today
    .map((block) => ({ at: minutesOfDay(block.time), activity: block.activity }))
    .filter((block): block is { at: number; activity: string } => block.at !== null)
    .sort((left, right) => left.at - right.at);
  if (blocks.length === 0) return ALWAYS_AVAILABLE;

  const nowMinutes = localNow.getHours() * 60 + localNow.getMinutes();
  let current: { at: number; activity: string } | null = null;
  for (const block of blocks) {
    if (block.at <= nowMinutes) current = block;
    else break;
  }
  // Before the first block of the day, the previous day's last activity is still running. Sleep
  // is the overwhelmingly common case there, so treat the pre-dawn gap as away rather than free.
  const activity = current?.activity ?? blocks[blocks.length - 1]!.activity;
  const away = awayActivities.some((needle) => activity.toLowerCase().includes(needle));
  if (!away) return { online: true, activity, minutesUntilOnline: 0 };
  const next = blocks.find(
    (block) => block.at > nowMinutes && !awayActivities.some((needle) => block.activity.toLowerCase().includes(needle)),
  );
  return {
    online: false,
    activity,
    minutesUntilOnline: next ? next.at - nowMinutes : null,
  };
}

/** The availability for one creator, read from the Engine character the profile points at. */
export async function resolveSlurpCreatorAvailability(
  characters: { getById(id: string): Promise<ScheduleCharacter> },
  source: CreatorSource,
  timeZone?: string,
  now: Date = new Date(),
): Promise<SlurpCreatorAvailability> {
  if (source.kind !== "character") return ALWAYS_AVAILABLE;
  const character = await characters.getById(source.entityId);
  if (!scheduleEnabled(character)) return ALWAYS_AVAILABLE;
  const schedule = parseSlurpWeekSchedule(record(record(character?.data).extensions).conversationSchedule);
  if (!schedule || schedule.enabled === false) return ALWAYS_AVAILABLE;
  const localNow = zonedDate(now, timeZone);
  if (isStale(schedule, localNow, timeZone)) return ALWAYS_AVAILABLE;
  return slurpCreatorAvailability(schedule, localNow);
}
