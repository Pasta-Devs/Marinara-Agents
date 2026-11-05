/** Promises: plans and stated facts that characters say in linked chats. The beat call must honour them. */
import { createHash } from "node:crypto";
import { msToWall, shiftDay } from "./clock.js";
import { type Gate } from "./beats.js";
import { isRecord } from "./routine.js";
import { promiseMessages } from "./prompts.js";
import { getMeanwhileRuntime, type Circle, type LifeEvent, type PromiseRecord } from "./store.js";

/** About 2k tokens of the newest messages. */
const READ_CHARS = 8000;
const TEXT_MAX = 140;
/** A promise that no beat honoured is dropped this many days after its due day. */
export const DROP_AFTER_DAYS = 2;
/** Only promises from the last days are checked for edits. */
const CHECK_DAYS = 14;

export const hashText = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 12);
// Engine 1.71+ gives the text agents read as `agentContent`.
const textOf = (m: { content: string; agentContent?: string }) => m.agentContent ?? m.content;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type Message = Awaited<ReturnType<ReturnType<typeof getMeanwhileRuntime>["persistence"]["listMessages"]>>[number];

/** The messages of one chat, or null when the chat cannot be read. */
async function readChat(chatId: string): Promise<Message[] | null> {
  try {
    return await getMeanwhileRuntime().persistence.listMessages(chatId);
  } catch {
    return null;
  }
}

/** Every linked chat once per run, shared by the stale check and the promise pass. Null = unreadable. */
export async function readChats(circle: Circle): Promise<Map<string, Message[] | null>> {
  return new Map(await Promise.all(circle.linkedChatIds.map(async (id) => [id, await readChat(id)] as const)));
}

/**
 * One small model call when a linked chat has messages newer than the last pass. Returns the new promises and
 * the new pass marks, or null when there was nothing to read or no budget left (the pass stays where it was).
 * A provider error throws, like every other call.
 */
export async function askPromises(
  circle: Circle,
  cast: Record<string, { name: string; about: string }>,
  pass: Record<string, number>,
  gate: Gate,
  nowMs: number,
  chats: Map<string, Message[] | null>,
): Promise<{ promises: PromiseRecord[]; pass: Record<string, number> } | null> {
  const tz = circle.clock.timezone;
  const fresh: { chatId: string; m: Message }[] = [];
  const marks = { ...pass };
  for (const chatId of circle.linkedChatIds) {
    const seen = pass[chatId] ?? 0;
    for (const m of chats.get(chatId) ?? []) {
      const at = Date.parse(m.createdAt);
      if (!(at > seen) || !textOf(m).trim()) continue;
      fresh.push({ chatId, m });
      marks[chatId] = Math.max(marks[chatId] ?? 0, at);
    }
  }
  if (!fresh.length || gate.left() < 1) return null;
  fresh.sort((a, b) => Date.parse(a.m.createdAt) - Date.parse(b.m.createdAt));
  // Newest first until the cap, then back in time order.
  // ponytail: messages dropped by the cap are never read (the pass mark moves past them); chunk the read if that loses plans.
  const picked: typeof fresh = [];
  let size = 0;
  for (const f of [...fresh].reverse()) {
    size += textOf(f.m).length;
    if (picked.length && size > READ_CHARS) break;
    picked.unshift(f);
  }
  const speaker = (m: Message) => (m.role === "user" ? "User" : (cast[m.characterId ?? ""]?.name ?? "Narrator"));
  const lines = picked.map((f, n) => `m${n + 1} ${speaker(f.m)}: ${textOf(f.m).replace(/\s+/g, " ").slice(0, 1200)}`);
  const today = msToWall(nowMs, tz).slice(0, 10);
  const latest = shiftDay(today, 30);
  const data = await gate.complete(
    promiseMessages({
      setting: circle.setting,
      today,
      cast: circle.castIds.map((id, n) => `${n}: ${cast[id]?.name ?? "Someone"}`),
      messages: lines,
    }),
    700,
    0.2,
  );
  const list = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.promises) ? data.promises : [];
  const promises = new Map<string, PromiseRecord>();
  for (const raw of list) {
    if (!isRecord(raw)) continue;
    const characterId = typeof raw.who === "number" ? circle.castIds[raw.who] : undefined;
    const source = typeof raw.m === "number" ? picked[raw.m - 1] : undefined;
    const text = typeof raw.text === "string" ? raw.text.trim().replace(/\s+/g, " ").slice(0, TEXT_MAX) : "";
    if (!characterId || !source || !text) continue;
    const id = `p:${circle.id}:${source.m.id}:${characterId}`;
    promises.set(id, {
      id,
      circleId: circle.id,
      characterId,
      text,
      // Today to 30 days ahead; anything else counts as today.
      due:
        typeof raw.due === "string" && DAY_RE.test(raw.due) && raw.due >= today && raw.due <= latest ? raw.due : today,
      visibility: circle.sharedWorld ? "circle" : `chat:${source.chatId}`,
      anchor: { chatId: source.chatId, messageId: source.m.id },
      hash: hashText(textOf(source.m)),
      createdAt: nowMs,
      status: "open",
    });
  }
  return { promises: [...promises.values()], pass: marks };
}

/**
 * Promises whose anchor message was deleted or edited. A chat that cannot be read is skipped, so a read
 * error never makes a promise stale.
 */
export async function staleAnchors(
  circle: Circle,
  promises: readonly PromiseRecord[],
  nowMs: number,
  chats: Map<string, Message[] | null>,
): Promise<Set<string>> {
  const tz = circle.clock.timezone;
  const since = shiftDay(msToWall(nowMs, tz).slice(0, 10), -CHECK_DAYS);
  const mine = promises.filter(
    (p) => p.circleId === circle.id && (p.status === "open" || p.status === "kept") && p.due >= since,
  );
  const stale = new Set<string>();
  for (const chatId of new Set(mine.map((p) => p.anchor.chatId))) {
    const messages = chats.get(chatId);
    if (!messages) continue;
    const byId = new Map(messages.map((m) => [m.id, textOf(m)]));
    for (const p of mine) {
      if (p.anchor.chatId !== chatId) continue;
      const text = byId.get(p.anchor.messageId);
      if (text === undefined || hashText(text) !== p.hash) stale.add(p.anchor.messageId);
    }
  }
  return stale;
}

/** Marks stale promises and the events built on them. Pure. */
export function applyStale(
  promises: PromiseRecord[],
  events: LifeEvent[],
  stale: ReadonlySet<string>,
): { promises: PromiseRecord[]; events: LifeEvent[] } {
  if (!stale.size) return { promises, events };
  return {
    promises: promises.map((p) =>
      stale.has(p.anchor.messageId) && p.status !== "dropped" ? { ...p, status: "stale" } : p,
    ),
    events: events.map((e) =>
      (e.status === "accepted" || e.status === "proposed") && e.anchors?.some((a) => stale.has(a.messageId))
        ? { ...e, status: "stale" }
        : e,
    ),
  };
}

/** Open promises past their due day plus the grace days are dropped. Pure. */
export function dropOld(promises: PromiseRecord[], today: string): PromiseRecord[] {
  const limit = shiftDay(today, -DROP_AFTER_DAYS);
  return promises.map((p) => (p.status === "open" && p.due < limit ? { ...p, status: "dropped" } : p));
}

/** True when a linked chat has a message that the promise pass has not read yet. */
export async function hasNewMessages(circle: Circle, pass: Record<string, number>): Promise<boolean> {
  for (const chatId of circle.linkedChatIds) {
    const seen = pass[chatId] ?? 0;
    if ((await readChat(chatId))?.some((m) => Date.parse(m.createdAt) > seen && textOf(m).trim())) return true;
  }
  return false;
}
