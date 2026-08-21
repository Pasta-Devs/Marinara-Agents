import { areConversationSchedulesEnabled } from "../generation/conversation-context-utils.js";
import { scheduleNeedsRefresh } from "../conversation/schedule.service.js";
import { createChatsStorage } from "../storage/chats.storage.js";
import {
  normalizePromptTimeZone,
  resolveConversationTimeZone,
  toZonedWallClockDate,
} from "../conversation/timezone.js";
import { parseRecord, parseStringArray } from "./slurp-public-support.js";
import { buildSlurpCreatorScheduleContext as formatScheduleContext } from "./slurp-creator-schedule-context.js";

type CreatorSource = { kind: string; entityId: string; displayName: string };

type WeekSchedule = {
  weekStart: string;
  days: Record<string, Array<{ time: string; activity: string }>>;
};

function parseWeekSchedule(value: unknown): WeekSchedule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const schedule = value as Record<string, unknown>;
  return typeof schedule.weekStart === "string" && schedule.days && typeof schedule.days === "object"
    ? (schedule as unknown as WeekSchedule)
    : null;
}

export async function resolveSlurpCreatorScheduleContext(
  chats: ReturnType<typeof createChatsStorage>,
  source: CreatorSource,
  fallbackTimeZone?: string,
  now: Date = new Date(),
): Promise<string> {
  const sourceId = source.entityId;
  for (const chat of await chats.list()) {
    if (chat.mode !== "conversation" || !parseStringArray(chat.characterIds).includes(sourceId)) continue;
    const context = buildSlurpCreatorScheduleContext(parseRecord(chat.metadata), source, fallbackTimeZone, now);
    if (context) return context;
  }
  return "No active Conversation Schedule is available for this Creator today.";
}

export function buildSlurpCreatorScheduleContext(
  metadata: Record<string, unknown>,
  source: CreatorSource,
  fallbackTimeZone?: string,
  now: Date = new Date(),
): string | null {
  if (!areConversationSchedulesEnabled(metadata)) return null;
  const schedule = parseWeekSchedule(parseRecord(metadata.characterSchedules)[source.entityId]);
  if (!schedule) return null;
  const timeZone = resolveConversationTimeZone(metadata) ?? normalizePromptTimeZone(fallbackTimeZone);
  const localNow = toZonedWallClockDate(now, timeZone);
  if (scheduleNeedsRefresh(schedule, localNow)) return null;
  return formatScheduleContext(true, schedule, source, localNow, timeZone);
}
