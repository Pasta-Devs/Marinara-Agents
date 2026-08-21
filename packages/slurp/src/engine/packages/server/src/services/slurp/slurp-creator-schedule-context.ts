type CreatorSource = { entityId: string; displayName: string };

type WeekSchedule = {
  weekStart: string;
  days: Record<string, Array<{ time: string; activity: string }>>;
};

export function buildSlurpCreatorScheduleContext(
  enabled: boolean,
  schedule: WeekSchedule | null,
  source: CreatorSource,
  localNow: Date,
  timeZone?: string,
  currentMonday?: Date,
): string | null {
  if (!enabled || !schedule || (currentMonday && new Date(schedule.weekStart).getTime() < currentMonday.getTime()))
    return null;
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const today = schedule.days[days[(localNow.getDay() + 6) % 7]!];
  if (!today?.length) return null;
  const localDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(localNow);
  return `Current Conversation Schedule for ${source.displayName} (${localDate}${timeZone ? `, ${timeZone}` : ""}): ${today.map((block) => `${block.time}: ${block.activity}`).join(", ")}`;
}
