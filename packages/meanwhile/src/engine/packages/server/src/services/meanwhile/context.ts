/** The chat face of Meanwhile: what a character may mention in a linked chat, once. */
import { DAY } from "./clock.js";
import { BRING_UP, CONTEXT_FRAME } from "./prompts.js";
import { SUMMARY_PLACEHOLDER, cardInfo } from "./routine.js";
import {
  getMeanwhileRuntime,
  readMeanwhile,
  updateMeanwhile,
  type Circle,
  type LifeEvent,
  type MeanwhileDocument,
} from "./store.js";

/** Events that can reach a prompt at all: accepted, not routine, not the placeholder summary. */
const tellable = (circle: Circle, events: LifeEvent[]) =>
  events.filter(
    (e) =>
      e.circleId === circle.id &&
      e.status === "accepted" &&
      e.weight !== "routine" &&
      !(e.weight === "summary" && e.text === SUMMARY_PLACEHOLDER),
  );

const newestEnd = (events: LifeEvent[]) => events.reduce((n, e) => Math.max(n, Date.parse(e.end) || 0), 0);

/** Shared by pickItems and hiddenBySurprise: may this event be offered in this chat? */
function offeredIn(circle: Circle, e: LifeEvent, chatId: string): boolean {
  if (!circle.linkedChatIds.includes(chatId)) return false;
  if (e.visibility !== "circle" && e.visibility !== `chat:${chatId}`) return false;
  // A separate-worlds Circle keeps what came from another chat out of this one.
  return circle.sharedWorld || !e.anchors?.length || e.anchors.some((a) => a.chatId === chatId);
}

/** Without a hook, only recent events are offered. */
const inWindow = (e: LifeEvent, newest: number) => (Date.parse(e.end) || 0) >= newest - 14 * DAY;

/**
 * Surprise mode (slice 6e): the one place that says what the dashboard hides. An accepted notable, major or
 * summary event stays hidden until a chat prompt took it (`delivered`) or the user picked it up, but only
 * while pickItems could still offer it (same offeredIn and window rules), so a count never gets stuck.
 * Routine events, big events in review and the "Time passed." placeholder stay visible.
 * Every route that shows events filters with this; prompt context ignores it.
 * ponytail: the cast of an event may be in no linked chat (needs an async chat read), so such an event
 * can stay hidden; check the chats here if that turns out to be common.
 */
const newestCache = new WeakMap<LifeEvent[], Map<string, number>>();
export function hiddenBySurprise(doc: MeanwhileDocument, circle: Circle, e: LifeEvent): boolean {
  if (!circle.surprise || !tellable(circle, [e]).length) return false;
  if (Object.keys(e.delivered ?? {}).length || Object.keys(e.pickedUp ?? {}).length) return false;
  let byCircle = newestCache.get(doc.events);
  if (!byCircle) newestCache.set(doc.events, (byCircle = new Map()));
  let newest = byCircle.get(circle.id);
  if (newest === undefined) byCircle.set(circle.id, (newest = newestEnd(tellable(circle, doc.events))));
  return (
    circle.linkedChatIds.some((chatId) => offeredIn(circle, e, chatId)) &&
    (Object.keys(e.hook ?? {}).length > 0 || inWindow(e, newest))
  );
}

export const countHidden = (doc: MeanwhileDocument, circle: Circle): number =>
  doc.events.filter((e) => e.circleId === circle.id && hiddenBySurprise(doc, circle, e)).length;

const MAX_ITEMS = 3;
const LINE_MAX = 160;

export interface PromptContextRequest {
  chatId: string;
  targetCharacterIds?: string[];
}

/**
 * At most 3 items for one chat: a hook the user picked up, then undelivered hooks of the target
 * characters, then other accepted events they were in. Pure, no I/O. Event text is model output,
 * so it goes in quotes.
 */
export function pickItems(
  doc: MeanwhileDocument,
  chatId: string,
  targets: readonly string[],
  names: Record<string, string>,
): { text: string; eventIds: string[] } | null {
  const items: { rank: number; end: number; line: string; id: string }[] = [];
  for (const circle of doc.circles.filter((c) => c.linkedChatIds.includes(chatId))) {
    const mine = tellable(circle, doc.events);
    const newest = newestEnd(mine);
    for (const e of mine) {
      if (e.delivered?.[chatId]) continue;
      if (!offeredIn(circle, e, chatId)) continue;
      const here = targets.filter((id) => e.cast.includes(id));
      if (!here.length) continue;
      const end = Date.parse(e.end) || 0;
      const hooks = here.filter((id) => e.hook?.[id]).map((id) => `${names[id] ?? "Someone"}: "${e.hook![id]}"`);
      if (hooks.length) {
        const picked = Boolean(e.pickedUp?.[chatId]);
        items.push({ rank: picked ? 3 : 2, end, line: `${picked ? `${BRING_UP} ` : ""}${hooks.join("; ")}`, id: e.id });
      } else if (inWindow(e, newest)) {
        items.push({ rank: 1, end, line: `"${e.text}"`, id: e.id });
      }
    }
  }
  const top = items.sort((a, b) => b.rank - a.rank || b.end - a.end).slice(0, MAX_ITEMS);
  if (!top.length) return null;
  return {
    text: `${CONTEXT_FRAME}\n${top.map((i) => `- ${i.line.slice(0, LINE_MAX)}`).join("\n")}`,
    eventIds: top.map((i) => i.id),
  };
}

/**
 * Registered as the package's prompt-context contributor. Read-only by the Engine's contract (dry runs
 * call it too): no storage write, no model call. Delivery is marked later by `markDelivered`.
 */
export async function contributeMeanwhile(request: PromptContextRequest): Promise<string | null> {
  const doc = await readMeanwhile();
  if (!doc.circles.some((c) => c.linkedChatIds.includes(request.chatId))) return null;
  const runtime = getMeanwhileRuntime();
  const targets = request.targetCharacterIds?.length
    ? request.targetCharacterIds
    : ((await runtime.persistence.getChat(request.chatId))?.characterIds ?? []);
  if (!targets.length) return null;
  const cards = (await runtime.resources.listCharacters(targets)) ?? [];
  const names = Object.fromEntries(cards.map((card) => [card.id, cardInfo(card.data).name]));
  return pickItems(doc, request.chatId, targets, names)?.text ?? null;
}

/**
 * A note counts as delivered in chat X once X has an assistant message newer than the note was
 * available (its creation, or the user's pick-up). Until then the collector keeps offering it, so
 * a swipe or regenerate still gets it. Run by the timer pass and when the tab opens.
 */
export async function markDelivered(): Promise<void> {
  const doc = await readMeanwhile();
  const persistence = getMeanwhileRuntime().persistence;
  const marks: { id: string; chatId: string; at: number }[] = [];
  for (const chatId of new Set(doc.circles.flatMap((c) => c.linkedChatIds))) {
    const chat = await persistence.getChat(chatId);
    const all = chat && pickItems(doc, chatId, chat.characterIds, {});
    if (!chat || !all) continue;
    const since = (id: string) => {
      const e = doc.events.find((event) => event.id === id)!;
      return Math.max(e.createdAt, e.pickedUp?.[chatId] ?? 0);
    };
    const oldest = Math.min(...all.eventIds.map(since));
    if (!(Date.parse(chat.lastMessageAt ?? "") > oldest)) continue; // no new message: skip the message read
    const replies = (await persistence.listMessages(chatId)).filter((m) => m.role === "assistant");
    // Only characters who spoke since the oldest note were addressed; a reply without a speaker counts for all.
    const fresh = replies.filter((m) => (Date.parse(m.createdAt) || 0) > oldest);
    const spoke = fresh.some((m) => !m.characterId)
      ? chat.characterIds
      : [...new Set(fresh.map((m) => m.characterId!))];
    const found = pickItems(doc, chatId, spoke, {});
    if (!found) continue;
    const last = replies.reduce((n, m) => Math.max(n, Date.parse(m.createdAt) || 0), 0);
    for (const id of found.eventIds) if (last > since(id)) marks.push({ id, chatId, at: last });
  }
  if (!marks.length) return;
  await updateMeanwhile((d) => ({
    ...d,
    events: d.events.map((e) => {
      const mine = marks.filter((m) => m.id === e.id);
      return mine.length
        ? { ...e, delivered: { ...e.delivered, ...Object.fromEntries(mine.map((m) => [m.chatId, m.at])) } }
        : e;
    }),
  }));
}
