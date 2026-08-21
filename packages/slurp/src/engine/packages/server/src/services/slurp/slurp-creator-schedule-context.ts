type CreatorSource = { kind: string; entityId: string; displayName: string };

type WeekSchedule = {
  weekStart: string;
  days: Record<string, Array<{ time: string; activity: string }>>;
};

type ScheduleChat = { mode: string; characterIds: unknown; metadata: unknown };
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

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    return stringArray(JSON.parse(value));
  } catch {
    return [];
  }
}

function timeZone(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return undefined;
  }
}

export function parseSlurpWeekSchedule(value: unknown): WeekSchedule | null {
  const schedule = record(value);
  const days = record(schedule.days);
  if (!Number.isFinite(Date.parse(String(schedule.weekStart))) || Object.keys(days).length === 0) return null;
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
  return new Date(schedule.weekStart).getTime() < monday.getTime();
}

export function buildSlurpCreatorScheduleContext(
  enabled: boolean,
  schedule: WeekSchedule | null,
  source: CreatorSource,
  localNow: Date,
  zone?: string,
): string | null {
  if (!enabled || !schedule || isStale(schedule, localNow)) return null;
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
  chats: { list(): Promise<ScheduleChat[]> },
  characters: { getById(id: string): Promise<ScheduleCharacter> },
  source: CreatorSource,
  fallbackTimeZone?: string,
  now: Date = new Date(),
): Promise<string> {
  if (source.kind !== "character") return "No active Conversation Schedule is available for this Creator today.";
  const character = await characters.getById(source.entityId);
  const schedule = parseSlurpWeekSchedule(record(record(character?.data).extensions).conversationSchedule);
  if (!schedule) return "No active Conversation Schedule is available for this Creator today.";

  for (const chat of await chats.list()) {
    if (chat.mode !== "conversation" || !stringArray(chat.characterIds).includes(source.entityId)) continue;
    const metadata = record(chat.metadata);
    const enabled = metadata.conversationSchedulesEnabled === true;
    const zone =
      timeZone(metadata.conversationTimeZone) ?? timeZone(metadata.promptTimeZone) ?? timeZone(fallbackTimeZone);
    const context = buildSlurpCreatorScheduleContext(enabled, schedule, source, zonedDate(now, zone), zone);
    if (context) return context;
  }
  return "No active Conversation Schedule is available for this Creator today.";
}
