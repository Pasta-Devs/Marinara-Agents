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

/**
 * Surprise mode (slice 6e): the one place that says what the dashboard hides. An accepted notable, major or
 * summary event, or any event with a hook, stays hidden until a chat prompt took it (`delivered`) or the user
 * picked it up. Routine events, big events in review and the "Time passed." placeholder stay visible.
 * Every route that shows events filters with this; prompt context ignores it.
 */
export function hiddenBySurprise(circle: Circle, e: LifeEvent): boolean {
  return (
    circle.surprise &&
    e.status === "accepted" &&
    e.text !== SUMMARY_PLACEHOLDER &&
    e.weight !== "routine" &&
    !Object.keys(e.delivered ?? {}).length &&
    !Object.keys(e.pickedUp ?? {}).length
  );
}

export const countHidden = (doc: MeanwhileDocument, circle: Circle): number =>
  doc.events.filter((e) => e.circleId === circle.id && hiddenBySurprise(circle, e)).length;

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
    const mine = doc.events.filter(
      (e) =>
        e.circleId === circle.id &&
        e.status === "accepted" &&
        e.weight !== "routine" &&
        !(e.weight === "summary" && e.text === SUMMARY_PLACEHOLDER),
    );
    let newest = 0;
    for (const e of mine) newest = Math.max(newest, Date.parse(e.end) || 0);
    for (const e of mine) {
      if (e.delivered?.[chatId]) continue;
      if (e.visibility !== "circle" && e.visibility !== `chat:${chatId}`) continue;
      // A separate-worlds Circle keeps what came from another chat out of this one.
      if (!circle.sharedWorld && e.anchors?.length && !e.anchors.some((a) => a.chatId === chatId)) continue;
      const here = targets.filter((id) => e.cast.includes(id));
      if (!here.length) continue;
      const end = Date.parse(e.end) || 0;
      const hooks = here.filter((id) => e.hook?.[id]).map((id) => `${names[id] ?? "Someone"}: "${e.hook![id]}"`);
      if (hooks.length) {
        const picked = Boolean(e.pickedUp?.[chatId]);
        items.push({ rank: picked ? 3 : 2, end, line: `${picked ? `${BRING_UP} ` : ""}${hooks.join("; ")}`, id: e.id });
      } else if (end >= newest - 14 * DAY) {
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
    const found = chat && pickItems(doc, chatId, chat.characterIds, {});
    if (!chat || !found) continue;
    const since = (id: string) => {
      const e = doc.events.find((event) => event.id === id)!;
      return Math.max(e.createdAt, e.pickedUp?.[chatId] ?? 0);
    };
    const oldest = Math.min(...found.eventIds.map(since));
    if (!(Date.parse(chat.lastMessageAt ?? "") > oldest)) continue; // no new message: skip the message read
    let last = 0;
    for (const m of await persistence.listMessages(chatId)) {
      if (m.role === "assistant") last = Math.max(last, Date.parse(m.createdAt) || 0);
    }
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
