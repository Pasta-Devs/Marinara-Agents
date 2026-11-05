/** Slice 5: writes what a character does now to their linked conversation chat as the Engine's own status. */
import type { Circle, LifeEvent, StatusSent } from "./store.js";
import { getMeanwhileRuntime, readMeanwhile, updateMeanwhile } from "./store.js";
import { circleNowMs } from "./clock.js";
import { currentBlock } from "./routine.js";

const STATUSES = new Set(["online", "idle", "dnd", "offline"]);
const MIN_MINUTES = 15;
const MAX_MINUTES = 12 * 60;

export interface StatusPlan {
  status: string;
  activity: string;
  /** "2h", "30m", "1h30m": how long the Engine keeps it before the schedule takes over again. */
  duration: string;
  /** Changes when the written text or status changes. */
  key: string;
}

const clock = (minutes: number): string => {
  const m = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.ceil(minutes)));
  return `${m >= 60 ? `${Math.floor(m / 60)}h` : ""}${m % 60 ? `${m % 60}m` : ""}`;
};

/**
 * Pure. Only accepted notable or major events visible to the whole Circle count: the status sits on the
 * character card, so every chat shows it. Proposed, vetoed and stale events never reach it.
 */
export function planStatus(input: {
  circle: Circle;
  characterId: string;
  schedule: unknown;
  events: readonly LifeEvent[];
  nowMs: number;
}): StatusPlan | null {
  const { circle, characterId, schedule, events, nowMs } = input;
  const block = currentBlock(schedule, nowMs, circle.clock.timezone);
  const event = events
    .filter(
      (e) =>
        e.circleId === circle.id &&
        e.status === "accepted" &&
        (e.weight === "notable" || e.weight === "major") &&
        e.visibility === "circle" &&
        e.cast.includes(characterId) &&
        Date.parse(e.start) <= nowMs &&
        nowMs < Date.parse(e.end),
    )
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))[0];
  if (!block && !event) return null;
  const status =
    block?.status && STATUSES.has(block.status)
      ? block.status
      : /sleep/i.test(block?.activity ?? "")
        ? "offline"
        : "online";
  const activity = (event ? event.text : block!.activity).replace(/\s+/g, " ").trim().slice(0, 120);
  const minutes = event ? (Date.parse(event.end) - nowMs) / 60_000 : block!.left;
  return { status, activity, duration: clock(minutes), key: `${status}|${activity}` };
}

/** The Circle that turned the switch on last owns a character's status. */
export function statusOwner(circles: readonly Circle[], characterId: string): string | null {
  const owners = circles
    .filter((c) => c.writeStatus && c.castIds.includes(characterId))
    .sort((a, b) => b.statusSince - a.statusSince || a.id.localeCompare(b.id));
  return owners[0]?.id ?? null;
}

/**
 * One timer pass. Only Circles at speed x1 write, only when the plan changed since the last write for that
 * chat and character, and one chat per character: the first linked Conversation chat that has them.
 */
export async function writeStatuses(
  now: number,
  readSchedules: (circle: Circle) => Promise<{ schedules: Record<string, unknown> }>,
): Promise<void> {
  const runtime = getMeanwhileRuntime();
  const update = runtime.persistence.updateCharacterStatus?.bind(runtime.persistence);
  const doc = await readMeanwhile();
  const mine = doc.circles.filter((c) => c.writeStatus && c.clock.speed === 1);
  if (!update || mine.length === 0) return;
  const chats = await runtime.persistence.listChats();
  const sent: Record<string, StatusSent> = {};
  for (const circle of mine) {
    const { schedules } = await readSchedules(circle);
    const nowMs = circleNowMs(circle.clock, now);
    for (const id of circle.castIds) {
      if (statusOwner(doc.circles, id) !== circle.id) continue;
      const chat = circle.linkedChatIds
        .map((chatId) => chats.find((c) => c.id === chatId))
        .find((c) => c?.mode === "conversation" && c.characterIds.includes(id));
      const plan = chat && planStatus({ circle, characterId: id, schedule: schedules[id], events: doc.events, nowMs });
      if (!chat || !plan || doc.statusSent[`${chat.id}:${id}`]?.key === plan.key) continue;
      try {
        const result = await update(chat.id, id, {
          status: plan.status as never,
          activity: plan.activity,
          duration: plan.duration,
        });
        // null: the Engine kept a status set by hand or a shared room. Remember it so the pass stays quiet.
        sent[`${chat.id}:${id}`] = { key: plan.key, at: result ? now : 0 };
      } catch (error) {
        runtime.logger.warn(
          `[meanwhile] status write failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
  // ponytail: entries of unlinked chats stay in storage (a few bytes each), prune if it ever matters.
  if (Object.keys(sent).length) await updateMeanwhile((d) => ({ ...d, statusSent: { ...d.statusSent, ...sent } }));
}
