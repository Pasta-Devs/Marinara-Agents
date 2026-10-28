import { create } from "zustand";
import type { SlpStirOrigin, SlpStirPlan, SlpStirPlanRequest } from "../../../../../shared/src/slp/slp-stir.js";

/**
 * The Stir ✦ sheet (W), openable from anywhere: a profile, a post's ⋯, Creator tools, a storyline in
 * Creator settings, a suggestion. A store, like the Creator settings modal, because the doors live in
 * different trees (and different features). Nothing is persisted.
 */
export type SlpStirTarget = { creatorId: string; postId?: string };
export const useSlpStirSheet = create<{
  target: SlpStirTarget | null;
  open: (target: SlpStirTarget) => void;
  close: () => void;
}>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
export const openSlpStir = (target: SlpStirTarget) => useSlpStirSheet.getState().open(target);

/** The Stir tab (W) as a sheet over the page it was opened from; any other move closes it (slp-home-state). */
export const useSlpStirDeck = create<{ open: boolean }>(() => ({ open: false }));

/**
 * A plan that came back after the player left the box (task B: planning never holds them there).
 * Pulse's "Open" and the toast show it in one sheet the app keeps mounted.
 */
export type SlpStirReadyPlan = {
  plan: SlpStirPlan;
  origin: SlpStirOrigin;
  key: number;
  /** What was asked, so the planner's question can be answered from here too. */
  request?: Omit<SlpStirPlanRequest, "followUp">;
};
export const useSlpStirReadyPlan = create<{ ready: SlpStirReadyPlan | null }>(() => ({ ready: null }));
export const openSlpStirReadyPlan = (
  plan: SlpStirPlan,
  origin: SlpStirOrigin,
  request?: Omit<SlpStirPlanRequest, "followUp">,
) => useSlpStirReadyPlan.setState({ ready: { plan, origin, key: Date.now(), request } });

/**
 * The words typed in a Stir box, per box (the tab, or one Creator's ✦ sheet), until a play runs.
 * The ✦ sheet closes while its plan is open, so "Change words" finds them again.
 * ponytail: memory only; lost on reload, which is fine for a draft of one line.
 */
export const useSlpStirDrafts = create<{ drafts: Record<string, string> }>(() => ({ drafts: {} }));
export const setSlpStirDraft = (key: string, text: string) =>
  useSlpStirDrafts.setState((state) => ({ drafts: { ...state.drafts, [key]: text } }));
