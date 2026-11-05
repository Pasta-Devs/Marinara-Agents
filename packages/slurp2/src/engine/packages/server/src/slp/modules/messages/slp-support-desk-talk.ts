/**
 * What the Support desk (docs/SUPPORT-DESK.md) adds to a talk with Slurp Support: the Creator's
 * standing in the prompt, an Offer waiting for their answer, a ticket, and the "desk" field of their
 * reply (trust, the answer to the offer, something they let slip, a ticket rating).
 *
 * Pure, so the rules run in tests.
 */
import {
  slpDeskPromptLine,
  type SlpSupportDesk,
  type SlpSupportDeskSettings,
} from "../../../../../shared/src/slp/slp-support-desk.js";
import { SLP_ACTIONS, isSlpActionName } from "../../../../../shared/src/slp/slp-actions.js";

/** An Offer: a Stir step Support put in the thread, waiting for the Creator's answer. */
export type SlurpDeskOffer = {
  action: string;
  input: Record<string, unknown>;
  /** Plain words for the prompt: what Slurp offers. */
  summary: string;
  status: "pending" | "accepted" | "countered" | "declined" | "failed";
  counter?: string;
  error?: string;
};

export function readSlurpDeskOffer(metadata: Record<string, unknown> | null | undefined): SlurpDeskOffer | null {
  const value = metadata?.deskOffer;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const offer = value as Record<string, unknown>;
  if (typeof offer.action !== "string" || !offer.input || typeof offer.input !== "object") return null;
  return {
    action: offer.action,
    input: offer.input as Record<string, unknown>,
    summary: typeof offer.summary === "string" ? offer.summary : "",
    status: (["pending", "accepted", "countered", "declined", "failed"] as const).includes(
      offer.status as SlurpDeskOffer["status"],
    )
      ? (offer.status as SlurpDeskOffer["status"])
      : "pending",
    ...(typeof offer.counter === "string" && offer.counter ? { counter: offer.counter } : {}),
    ...(typeof offer.error === "string" && offer.error ? { error: offer.error } : {}),
  };
}

/** The plain words an Offer is put to the Creator in. Ids stay out: the model never sees them. */
export function slurpDeskOfferSummary(action: string, input: Record<string, unknown>): string {
  const what = isSlpActionName(action) ? SLP_ACTIONS[action].summary : action;
  const terms = Object.entries(input)
    .filter(
      ([key, value]) => !/id$|Id$|Ids$|^preview$/u.test(key) && value !== undefined && value !== null && value !== "",
    )
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
  return `${what}${terms.length ? ` (${terms.join("; ")})` : ""}`.slice(0, 600);
}

/** The newest Offer in the thread that still waits for an answer, with its message id. */
export function findPendingSlurpDeskOffer(
  history: readonly { id: string; role: string; metadata?: Record<string, unknown> | null }[],
): { messageId: string; offer: SlurpDeskOffer } | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const line = history[index]!;
    const offer = line.role === "viewer" ? readSlurpDeskOffer(line.metadata) : null;
    if (offer) return offer.status === "pending" ? { messageId: line.id, offer } : null;
  }
  return null;
}

/** What the Creator's reply prompt is told about where they stand with Slurp. */
export function slurpDeskPromptData(input: {
  desk: SlpSupportDesk;
  settings: SlpSupportDeskSettings;
  supportName: string;
  pendingOffer: SlurpDeskOffer | null;
  /** Support just marked the open ticket resolved: the Creator rates how it went. */
  ticketResolved: boolean;
}): Record<string, string | boolean> {
  const { desk, settings } = input;
  return {
    standing: slpDeskPromptLine(desk, input.supportName),
    // R1: Creators asked Support for things Slurp does not have. These are all it can do.
    whatSupportCanDo:
      "feature you on Discover for a few days, give coins, set a challenge or a contract with a bonus, suggest a collab with another Creator. Never ask Support for anything else: no verification or badges, no blocking or moderation tools, no new app features.",
    ...(input.pendingOffer
      ? {
          pendingOffer: input.pendingOffer.summary,
          ...(settings.refusals ? {} : { youGoAlong: true }),
        }
      : {}),
    ...(desk.ticket && desk.ticket.status !== "resolved" && !input.ticketResolved
      ? { yourOpenTicket: desk.ticket.topic }
      : {}),
    ...(input.ticketResolved ? { ticketResolved: true } : {}),
    ...(desk.pausedAt ? { youLeftSlurp: true } : {}),
  };
}

/** The "desk" field of a reply in Support's thread, read defensively. Null when it is missing. */
export type SlurpDeskReply = {
  trust: "up" | "same" | "down";
  offer: "accept" | "counter" | "decline" | null;
  counter: string;
  intel: string;
  rating: number | null;
};

const text = (value: unknown, max: number) =>
  typeof value === "string" && !/^(null|none|n\/a)$/iu.test(value.trim())
    ? value.replace(/\s+/gu, " ").trim().slice(0, max).trim()
    : "";

export function readSlurpDeskReply(raw: unknown): SlurpDeskReply | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const rating = typeof value.rating === "number" && Number.isFinite(value.rating) ? Math.round(value.rating) : null;
  return {
    trust: value.trust === "up" || value.trust === "down" ? value.trust : "same",
    offer: value.offer === "accept" || value.offer === "counter" || value.offer === "decline" ? value.offer : null,
    counter: text(value.counter, 300),
    intel: text(value.intel, 300),
    rating: rating !== null && rating >= 1 && rating <= 5 ? rating : null,
  };
}

/** The trust a talk moves on its own: a good talk helps a little, a bad one costs more. */
export const slurpDeskTalkTrust = (reply: SlurpDeskReply) =>
  reply.trust === "up" ? 2 : reply.trust === "down" ? -3 : 0;

/**
 * What the Creator's answer means for a pending Offer. With refusals off they always go along; a
 * missing answer leaves the offer waiting for the next reply.
 */
export function slurpDeskOfferOutcome(
  reply: SlurpDeskReply | null,
  refusals: boolean,
): "accepted" | "countered" | "declined" | null {
  if (!reply?.offer) return refusals ? null : "accepted";
  if (!refusals) return "accepted";
  return reply.offer === "accept" ? "accepted" : reply.offer === "counter" ? "countered" : "declined";
}

/** The step an accepted Offer runs: the Creator said yes, so a lever that may still refuse is told to happen. */
export const slurpDeskAcceptedInput = (offer: Pick<SlurpDeskOffer, "input">): Record<string, unknown> =>
  "happen" in offer.input ? { ...offer.input, happen: true } : offer.input;
