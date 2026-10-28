/**
 * Slurp Support's own thread with each Creator, and what a talk with Support changes for them.
 *
 * Support is one account (`SLURP_SUPPORT_ACCOUNT_ID`), so a Creator has one Support thread whichever
 * persona the player writes from. Older installs kept Support's lines inside a persona's chat (the
 * kept sign-up chat, "write as Slurp Support" before this change); `slurpSupportMessageIds` picks
 * them out so the migration can move them.
 *
 * A Creator's answer to Support may carry a "staff" object: what the talk changed for them. It is
 * read here into one memory (kept at once: it is what they remember of the talk) and a proposal of
 * Stir steps (steering, one post idea, and a wish for the wider world in plain words) that the player
 * confirms with "Do it" in the thread (W: Support proposes, you confirm). Nothing in it can name or
 * touch a fan.
 *
 * Pure, so the rules run in tests.
 */
import { SLURP_SUPPORT_ACCOUNT_ID } from "../../../../../shared/src/slp/slp-support.js";
import {
  SLP_STEERING_MOODS,
  SLP_STEERING_NUDGE_MAX,
  SLP_STEERING_TEXT_MAX,
  SLP_STEERING_TOPIC_MAX,
  SLP_STEERING_TOPICS_MAX,
  type SlpCreatorSteering,
  type SlpSteeringMood,
  type SlpSteeringSupportNote,
} from "../../../../../shared/src/slp/slp-creator-steering.js";
import type { SlpStirStep } from "../../../../../shared/src/slp/slp-stir.js";
import { SLURP_SUPPORT_NAME, type SlurpDmLine } from "./slp-dm-roles.js";

export const isSlurpSupportThread = (thread: { viewerAccountId: string }) =>
  thread.viewerAccountId === SLURP_SUPPORT_ACCOUNT_ID;

/** A line of the kept Support sign-up chat (either side), or a line the player wrote as Support. */
function isSupportLine(line: Pick<SlurpDmLine, "role" | "metadata">): boolean {
  if (line.metadata?.signUpScene === "support") return true;
  return line.role === "viewer" && line.metadata?.supportVoice === true;
}

/**
 * The lines of a persona's chat that belong to Support's thread: Support's own lines, the whole kept
 * Support sign-up chat, and the Creator's answers to Support. `history` is oldest first.
 *
 * A Creator line after a Support line is an answer to Support, except what is the persona's own
 * business: a message to all subscribers, a commission step, a Slurp notice, and paid content the
 * persona already bought.
 */
export function slurpSupportMessageIds(
  history: readonly (Pick<SlurpDmLine, "id" | "role" | "kind" | "price" | "unlockedAt" | "metadata"> & {
    createdAt?: string;
  })[],
): string[] {
  const ids: string[] = [];
  let answeringSupport = false;
  for (const line of history) {
    if (line.role === "viewer") {
      answeringSupport = isSupportLine(line);
      if (answeringSupport) ids.push(line.id);
      continue;
    }
    const answer =
      line.kind === "text" ||
      line.kind === "post_preview" ||
      (line.kind === "ppv" && !(line.price > 0 && line.unlockedAt));
    if (isSupportLine(line) || (answeringSupport && answer)) ids.push(line.id);
  }
  return ids;
}

/** What a talk with Support changed for the Creator, as the Creator said it. */
export type SlurpSupportTakeaway = {
  mood: SlpSteeringMood | null;
  focus: string;
  idea: string;
  more: string;
  less: string;
  takeaway: string;
  /** A change in the wider world the player asked Support for, in plain words (Stir plans it). */
  stir: string;
};

const text = (value: unknown, max: number) =>
  typeof value === "string" && !/^(null|none|n\/a)$/iu.test(value.trim())
    ? value.replace(/\s+/gu, " ").trim().slice(0, max).trim()
    : "";

/** The "staff" field of a reply to Support. Null when it changed nothing. */
export function readSlurpSupportTakeaway(
  raw: unknown,
  supportName: string = SLURP_SUPPORT_NAME,
): SlurpSupportTakeaway | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const mood = SLP_STEERING_MOODS.includes(value.mood as SlpSteeringMood) ? (value.mood as SlpSteeringMood) : null;
  let takeaway = text(value.takeaway, 400);
  // Kept in-world: the memory says who told them, so it never reads as their own idea or a fan's.
  if (takeaway && !/support|staff|slurp/iu.test(takeaway)) takeaway = `${supportName} told me: ${takeaway}`;
  const out = {
    mood,
    focus: text(value.focus, SLP_STEERING_TEXT_MAX),
    idea: text(value.idea, SLP_STEERING_NUDGE_MAX),
    more: text(value.more, SLP_STEERING_TOPIC_MAX),
    less: text(value.less, SLP_STEERING_TOPIC_MAX),
    takeaway,
    stir: text(value.stir, 400),
  };
  return out.mood || out.focus || out.idea || out.more || out.less || out.takeaway || out.stir ? out : null;
}

/** The "staff" answer with every text redacted (`protect`), as it is stored and read back later. */
export function protectSlurpSupportStaff(
  staff: Record<string, unknown> | undefined,
  protect: (value: string) => string | null | undefined,
): Record<string, unknown> | undefined {
  if (!staff) return undefined;
  return Object.fromEntries(
    Object.entries(staff).map(([key, value]) => [key, typeof value === "string" ? (protect(value) ?? "") : value]),
  );
}

/** The newest topic goes last; a full list lets its oldest go. */
function withTopic(list: readonly string[], topic: string): string[] {
  const key = topic.toLocaleLowerCase();
  return [...list.filter((entry) => entry.toLocaleLowerCase() !== key), topic].slice(-SLP_STEERING_TOPICS_MAX);
}

const without = (list: readonly string[], topic: string) =>
  topic ? list.filter((entry) => entry.toLocaleLowerCase() !== topic.toLocaleLowerCase()) : [...list];

/**
 * The Creator's steering after the talk (mood, focus, topics). The ideas list is changed through
 * its own call; the pace is the player's alone. Null when nothing changes.
 */
export function slurpSupportSteeringPatch(
  current: SlpCreatorSteering,
  takeaway: SlurpSupportTakeaway,
): Partial<Pick<SlpCreatorSteering, "mood" | "focus" | "push" | "avoid">> | null {
  const patch: Partial<Pick<SlpCreatorSteering, "mood" | "focus" | "push" | "avoid">> = {};
  if (takeaway.mood && takeaway.mood !== current.mood) patch.mood = takeaway.mood;
  if (takeaway.focus && takeaway.focus !== current.focus) patch.focus = takeaway.focus;
  if (takeaway.more) {
    patch.push = withTopic(current.push, takeaway.more);
    patch.avoid = without(current.avoid, takeaway.more);
  }
  if (takeaway.less) {
    patch.avoid = withTopic(patch.avoid ?? current.avoid, takeaway.less);
    patch.push = without(patch.push ?? current.push, takeaway.less);
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** What the migration needs from storage. `moveMessages` is one transaction. */
export type SlurpSupportMigrationStore = {
  listThreads(): Promise<{ id: string; viewerAccountId: string; creatorAccountId: string }[]>;
  /** Every message of the thread, any order. */
  listMessages(threadId: string): Promise<Parameters<typeof slurpSupportMessageIds>[0][number][]>;
  /** Support's one thread with this Creator, opened when missing. Null when the Creator is gone. */
  openSupportThread(creatorAccountId: string): Promise<string | null>;
  moveMessages(sourceThreadId: string, targetThreadId: string, messageIds: string[]): Promise<void>;
};

const byTime = <T extends { id: string; createdAt?: string }>(left: T, right: T) =>
  (left.createdAt ?? "") === (right.createdAt ?? "")
    ? left.id.localeCompare(right.id)
    : (left.createdAt ?? "").localeCompare(right.createdAt ?? "");

/**
 * Move Support's lines out of every persona's chat into Support's one thread with that Creator.
 *
 * Idempotent: a moved line is in Support's thread, which is never a source, so a second run finds
 * nothing. Nothing is copied or deleted, only moved, so no line can be lost or doubled; a Creator
 * that no longer exists keeps its lines where they are. Runs on start and after every restore, so
 * an old backup is migrated the moment it comes back.
 */
export async function migrateSlurpSupportLines(
  store: SlurpSupportMigrationStore,
): Promise<{ threads: number; messages: number }> {
  let threads = 0;
  let messages = 0;
  for (const thread of await store.listThreads()) {
    if (thread.viewerAccountId === SLURP_SUPPORT_ACCOUNT_ID) continue;
    const history = [...(await store.listMessages(thread.id))].sort(byTime);
    const ids = slurpSupportMessageIds(history);
    if (ids.length === 0) continue;
    const target = await store.openSupportThread(thread.creatorAccountId);
    if (!target) continue;
    await store.moveMessages(thread.id, target, ids);
    threads += 1;
    messages += ids.length;
  }
  return { threads, messages };
}

/** What a talk with Support proposes: the steps to confirm, and a wish for the wider world to plan. */
export type SlurpSupportProposal = { steps: SlpStirStep[]; stir: string };

/** Where a talk with Support may write: Support's own thread, the Creator's memory, and the proposal. */
export type SlurpSupportTalkStore<Outcome> = {
  recordThreadOutcome(threadId: string, outcome: Outcome): Promise<void>;
  readSteering(creatorAccountId: string): Promise<SlpCreatorSteering>;
  /** Keep the proposal on the Creator's reply; the thread shows it as Stir cards with "Do it". */
  propose(replyMessageId: string, proposal: SlurpSupportProposal): Promise<void>;
  /** One memory per Support line, so a retried reply never stores it twice. */
  hasMemory(creatorAccountId: string, sourceHash: string): Promise<boolean>;
  addMemory(
    creatorAccountId: string,
    memory: { text: string; threadId: string; evidence: string; sourceHash: string },
  ): Promise<void>;
};

/**
 * What a talk with Slurp Support changed for the Creator, in-world ("platform staff talked to me").
 *
 * Support's thread keeps its own mood and memories, like any chat, and the Creator keeps one memory of
 * the talk. What the talk would change (mood lately, focus, topics, one post idea, a wish for the
 * wider world) becomes a proposal on the reply: nothing changes until the player says "Do it" (W).
 * Only ever for Support's thread; a fan's thread is refused.
 */
export async function applySlurpSupportTalk<Outcome>(
  store: SlurpSupportTalkStore<Outcome>,
  input: {
    thread: { id: string; viewerAccountId: string; creatorAccountId: string };
    trigger: { id: string; content: string };
    /** The Creator's stored reply, which carries the proposal. */
    reply: { id: string };
    outcome: Outcome;
    staff: unknown;
    supportName: string;
    at?: Date;
  },
): Promise<void> {
  if (!isSlurpSupportThread(input.thread)) return;
  const creatorAccountId = input.thread.creatorAccountId;
  await store.recordThreadOutcome(input.thread.id, input.outcome);
  const takeaway = readSlurpSupportTakeaway(input.staff, input.supportName);
  if (!takeaway) return;
  const sourceHash = `support:${input.trigger.id}`;
  if (takeaway.takeaway && !(await store.hasMemory(creatorAccountId, sourceHash))) {
    await store.addMemory(creatorAccountId, {
      text: takeaway.takeaway,
      threadId: input.thread.id,
      evidence: input.trigger.content,
      sourceHash,
    });
  }
  const proposal = slurpSupportProposal(creatorAccountId, await store.readSteering(creatorAccountId), takeaway);
  if (proposal) await store.propose(input.reply.id, proposal);
}

/**
 * The Stir steps a talk proposes: one steering change (mood, focus, topics) and one post idea for the
 * Creator, plus the world wish. Null when it proposes nothing.
 */
export function slurpSupportProposal(
  creatorAccountId: string,
  steering: SlpCreatorSteering,
  takeaway: SlurpSupportTakeaway,
): SlurpSupportProposal | null {
  const patch = slurpSupportSteeringPatch(steering, takeaway);
  const steps: SlpStirStep[] = [
    ...(patch ? [{ action: "steer-creator", input: { accountId: creatorAccountId, ...patch } }] : []),
    ...(takeaway.idea ? [{ action: "add-idea", input: { accountId: creatorAccountId, text: takeaway.idea } }] : []),
  ];
  return steps.length || takeaway.stir ? { steps, stir: takeaway.stir } : null;
}

/**
 * What Undo puts back: every steering field the talk changed returns to what it said before. The
 * idea and the memory are removed by the caller (they live elsewhere).
 */
export function slurpSupportUndoPatch(
  note: SlpSteeringSupportNote,
): Partial<Pick<SlpCreatorSteering, "mood" | "focus" | "push" | "avoid">> {
  return {
    ...(note.mood ? { mood: note.before.mood } : {}),
    ...(note.focus ? { focus: note.before.focus } : {}),
    ...(note.more || note.less ? { push: note.before.push, avoid: note.before.avoid } : {}),
  };
}

/**
 * Support demands a photo taken right now (0.3.6): not a commission, not a paid picture. The Creator
 * answers the line with a free picture whatever their Images switch says, and a model that forgot
 * the picture still sends one drawn from Support's own words (`slurpSupportPhotoFallback`).
 */
export const isSlurpSupportPhotoDemand = (line: { metadata?: Record<string, unknown> } | null | undefined) =>
  line?.metadata?.supportVoice === true && line.metadata.photoDemand === true;

export const SLURP_SUPPORT_PHOTO_GUIDANCE =
  'Slurp Support asks for a photo taken right now, and you send it. Put it in "image": show exactly what Support asked to see in their message (a place, an object, an outfit, a pose, proof of something), with every detail they named. Only if they named nothing, a candid phone photo of where you are and what you are doing at this moment. Make it this moment, never a photo you sent before. Add a short caption, and answer Support in your own voice about being asked.';

/** The picture when the model forgot one: Support's own words are its subject, so it differs each time. */
export function slurpSupportPhotoFallback(request: string): { prompt: string; caption: string; spicy: boolean } {
  const asked = request.replace(/\s+/gu, " ").trim().slice(0, 400);
  return {
    prompt: asked
      ? `a phone photo taken right now that shows what was asked for: "${asked}"; candid, natural light`
      : "a candid phone photo taken right now, where they are at this moment, natural light, unposed",
    caption: "",
    spicy: false,
  };
}
