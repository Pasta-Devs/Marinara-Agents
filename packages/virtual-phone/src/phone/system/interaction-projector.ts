import { normalizePhoneInteractionLedger, type PhoneEvent, type PhoneInteractionLedger } from "./interaction-model";
import { sanitizeForPrompt } from "./turn-context";

export const INTERACTION_CONTEXT_CHARS = 700;

export interface InteractionProjectionTarget {
  id: string;
  name: string;
}

export interface InteractionProjectionOptions {
  /** Only changes strictly newer than this instant are projected. */
  since?: string;
  now?: string;
}

function after(value: string, since?: string) {
  if (!since) return true;
  const boundary = Date.parse(since);
  return !Number.isFinite(boundary) || Date.parse(value) > boundary;
}

function explicitPromptSummary(event: PhoneEvent) {
  if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) return "";
  const value = (event.data as Record<string, unknown>).promptSummary;
  return typeof value === "string" ? sanitizeForPrompt(value, 150) : "";
}

function canReceiveEvent(event: PhoneEvent, targetId: string) {
  if (event.physicalObserverIds.includes(targetId)) return true;
  if (event.audience.kind === "private" || event.audience.kind === "participants") {
    return event.audience.principalIds.includes(targetId);
  }
  // Network/public scope is authorization, not proof that a character saw a post. A separate
  // viewed/notification event grants perception when it actually happens.
  return false;
}

/**
 * Projects committed interaction state for one roleplay target.
 *
 * It intentionally knows nothing about Messages, Notes, Shop, or any other app. Apps opt into
 * prompt visibility by committing a safe `data.promptSummary`; raw event data is never serialized.
 * Knowledge is projected only for its explicit knower. This is the enforcement point for the
 * rule that owning a phone, receiving a notification, or being in the same chat is not knowledge.
 */
export function projectInteractionContext(
  rawLedger: PhoneInteractionLedger | unknown,
  target: InteractionProjectionTarget,
  options: InteractionProjectionOptions = {},
) {
  const ledger = normalizePhoneInteractionLedger(rawLedger);
  const lines: Array<{ at: string; text: string }> = [];

  const superseded = new Set(ledger.knowledge.flatMap((claim) => claim.supersedes ? [claim.supersedes] : []));
  for (const claim of ledger.knowledge) {
    if (claim.knower.id !== target.id || superseded.has(claim.id) || !after(claim.acquiredAt, options.since)) continue;
    const proposition = sanitizeForPrompt(claim.proposition, 180);
    if (proposition) lines.push({ at: claim.acquiredAt, text: `${target.name} learned: ${proposition}` });
  }

  for (const event of ledger.events) {
    if (!after(event.effectiveAt ?? event.occurredAt, options.since) || !canReceiveEvent(event, target.id)) continue;
    const summary = explicitPromptSummary(event);
    if (summary) lines.push({ at: event.effectiveAt ?? event.occurredAt, text: summary });
  }

  for (const process of ledger.processes) {
    if (!process.participants.some((participant) => participant.id === target.id)) continue;
    if (!after(process.updatedAt, options.since) && !(process.dueAt && after(process.dueAt, options.since))) continue;
    const summary = typeof process.data.promptSummary === "string"
      ? sanitizeForPrompt(process.data.promptSummary, 150)
      : "";
    if (summary) lines.push({ at: process.updatedAt, text: summary });
  }

  const unique = [...new Map(lines.sort((a, b) => a.at.localeCompare(b.at)).map((line) => [line.text, line])).values()];
  if (!unique.length) return null;
  const block = `[Phone — ${unique.map((line) => line.text).join("; ")}.]`;
  if (block.length <= INTERACTION_CONTEXT_CHARS) return block;
  const clipped = block.slice(0, INTERACTION_CONTEXT_CHARS - 1);
  return `${clipped.replace(/\s+\S*$/u, "…")}]`;
}
