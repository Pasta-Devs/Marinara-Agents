/** The chat face of Meanwhile: what a character may mention in a linked chat, once. */
import { DAY } from "./clock.js";
import { BRING_UP, CONTEXT_FRAME } from "./prompts.js";
import { cardInfo } from "./routine.js";
import { getMeanwhileRuntime, readMeanwhile, updateMeanwhile, type MeanwhileDocument } from "./store.js";

const MAX_ITEMS = 3;

export interface PromptContextRequest {
  chatId: string;
  targetCharacterIds?: string[];
}

/**
 * At most 3 items for one chat: a hook the user picked up, then undelivered hooks of the target
 * characters, then other accepted events they were in. Pure, no I/O.
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
      (e) => e.circleId === circle.id && e.status === "accepted" && e.weight !== "routine",
    );
    const newest = Math.max(0, ...mine.map((e) => Date.parse(e.end) || 0));
    for (const e of mine) {
      if (e.delivered?.[chatId]) continue;
      if (e.visibility !== "circle" && e.visibility !== `chat:${chatId}`) continue;
      // A separate-worlds Circle keeps what came from another chat out of this one.
      if (!circle.sharedWorld && e.anchors?.length && !e.anchors.some((a) => a.chatId === chatId)) continue;
      const here = targets.filter((id) => e.cast.includes(id));
      if (!here.length) continue;
      const end = Date.parse(e.end) || 0;
      const hooks = here.filter((id) => e.hook?.[id]).map((id) => `${names[id] ?? "Someone"}: ${e.hook![id]}`);
      if (hooks.length) {
        const picked = Boolean(e.pickedUp?.[chatId]);
        items.push({ rank: picked ? 3 : 2, end, line: `${picked ? `${BRING_UP} ` : ""}${hooks.join("; ")}`, id: e.id });
      } else if (end >= newest - 14 * DAY) {
        items.push({ rank: 1, end, line: e.text, id: e.id });
      }
    }
  }
  const top = items.sort((a, b) => b.rank - a.rank || b.end - a.end).slice(0, MAX_ITEMS);
  if (!top.length) return null;
  return { text: `${CONTEXT_FRAME}\n${top.map((i) => `- ${i.line}`).join("\n")}`, eventIds: top.map((i) => i.id) };
}

/** Registered as the package's prompt-context contributor. Reads storage only, no model call. */
export async function contributeMeanwhile(request: PromptContextRequest): Promise<string | null> {
  const doc = await readMeanwhile();
  if (!doc.circles.some((c) => c.linkedChatIds.includes(request.chatId))) return null;
  const runtime = getMeanwhileRuntime();
  const targets = request.targetCharacterIds?.length
    ? request.targetCharacterIds
    : ((await runtime.persistence.getChat(request.chatId))?.characterIds ?? []);
  if (!targets.length) return null;
  const cards = (await runtime.resources.listCharacters(targets)) ?? [];
  const found = pickItems(
    doc,
    request.chatId,
    targets,
    Object.fromEntries(cards.map((card) => [card.id, cardInfo(card.data).name])),
  );
  if (!found) return null;
  const now = Date.now();
  await updateMeanwhile((d) => ({
    ...d,
    events: d.events.map((e) =>
      found.eventIds.includes(e.id) ? { ...e, delivered: { ...e.delivered, [request.chatId]: now } } : e,
    ),
  }));
  return found.text;
}
