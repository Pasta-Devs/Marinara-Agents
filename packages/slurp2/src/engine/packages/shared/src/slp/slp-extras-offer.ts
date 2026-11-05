/**
 * Support offers the extras that are still off (docs/CONFIGURATOR.md, slice 4): after the first posts,
 * after the first unlock and after a few days, at most one a day and none while Slurp is paused.
 * Pure, so the rules run in tests; the server keeps the state in one app setting.
 */
import { slpExtensionOn, type SlpExtensionSettings } from "./slp-extensions.js";

/** The order Support offers them in: the recommended one first, ads last. */
export const SLP_EXTRAS_OFFER_ORDER = ["storylines", "world", "stir", "supportDesk", "ads"] as const;
export type SlpExtrasOfferId = (typeof SLP_EXTRAS_OFFER_ORDER)[number];
export const SLP_EXTRAS_TRIGGERS = ["posts", "unlock", "days"] as const;
export type SlpExtrasTrigger = (typeof SLP_EXTRAS_TRIGGERS)[number];

export type SlpExtrasOffer = { id: SlpExtrasOfferId; trigger: SlpExtrasTrigger };
export type SlpExtrasOfferState = {
  firstSeenAt?: string;
  /** Triggers that happened; "days" is read from `firstSeenAt`. */
  reached?: SlpExtrasTrigger[];
  /** Triggers that already sent an offer. */
  fired?: SlpExtrasTrigger[];
  /** "Not now": Support does not offer these again. */
  declined?: SlpExtrasOfferId[];
  pending?: (SlpExtrasOffer & { at: string }) | null;
  lastOfferAt?: string;
};

const DAY_MS = 86_400_000;
const DAYS_TRIGGER_MS = 3 * DAY_MS;

/** The offer to show now, and the state to save when it changed. */
export function slpExtrasOfferNow(
  stored: SlpExtrasOfferState,
  settings: SlpExtensionSettings,
  at: Date,
  paused: boolean,
): { offer: SlpExtrasOffer | null; state: SlpExtrasOfferState; changed: boolean } {
  const state: SlpExtrasOfferState = { ...stored };
  let changed = false;
  if (!state.firstSeenAt) {
    state.firstSeenAt = at.toISOString();
    changed = true;
  }
  // Switched on elsewhere in the meantime: nothing left to offer.
  if (state.pending && slpExtensionOn(settings, state.pending.id)) {
    state.pending = null;
    changed = true;
  }
  const result = (offer: SlpExtrasOffer | null) => ({ offer, state, changed });
  if (paused) return result(null);
  if (state.pending) return result({ id: state.pending.id, trigger: state.pending.trigger });
  if (state.lastOfferAt && at.getTime() - Date.parse(state.lastOfferAt) < DAY_MS) return result(null);
  const reached = new Set(state.reached);
  if (at.getTime() - Date.parse(state.firstSeenAt) >= DAYS_TRIGGER_MS) reached.add("days");
  const trigger = SLP_EXTRAS_TRIGGERS.find((name) => reached.has(name) && !state.fired?.includes(name));
  const id = SLP_EXTRAS_OFFER_ORDER.find(
    (extra) => !slpExtensionOn(settings, extra) && !state.declined?.includes(extra),
  );
  if (!trigger || !id) return result(null);
  state.pending = { id, trigger, at: at.toISOString() };
  state.fired = [...(state.fired ?? []), trigger];
  state.lastOfferAt = state.pending.at;
  changed = true;
  return result({ id, trigger });
}

/** "Add" or "Not now" on the pending offer; another id is a stale card and changes nothing. */
export function slpExtrasOfferAnswered(
  state: SlpExtrasOfferState,
  id: SlpExtrasOfferId,
  add: boolean,
): SlpExtrasOfferState | null {
  if (state.pending?.id !== id) return null;
  return { ...state, pending: null, declined: add ? state.declined : [...(state.declined ?? []), id] };
}

/** A trigger happened; null when it was already recorded. */
export function slpExtrasReached(state: SlpExtrasOfferState, trigger: SlpExtrasTrigger): SlpExtrasOfferState | null {
  return state.reached?.includes(trigger) ? null : { ...state, reached: [...(state.reached ?? []), trigger] };
}
