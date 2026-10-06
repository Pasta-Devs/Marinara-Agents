/**
 * What each Slurp action answers with (the action layer, `slp-actions.ts`). Split out of that file for
 * its size cap.
 */
import type { SlpBrandDealPreview, SlpBrandFit } from "./slp-brand-deal-preview.js";
import type { SlpStirWorld } from "./slp-actions.js";

/** What each action answers with. Steering and posting answer with what their own routes answer. */
export type SlpActionResult = {
  "write-text": { text: string };
  "improve-text": { text: string };
  "draw-picture": { image: string; prompt: string };
  "use-picture": { url: string | null };
  "undo-picture": { url: string | null };
  "keep-picture": { kept: boolean };
  "steer-creator": unknown;
  "add-idea": unknown;
  "list-creators": { creators: { id: string; name: string; handle: string }[] };
  "write-post": unknown;
  /** `image` is null when the picture could not be drawn; `imageError` says why. */
  "draft-post": { text: string; image: string | null; imageError: string | null };
  "list-world": SlpStirWorld;
  "suggest-collab": { collabId: string };
  "push-collab": { collabId: string };
  "start-rivalry": { rivalryId: string };
  "cool-rivalry": { rivalryId: string };
  "set-up-couple": { coupleId: string };
  "steer-couple": { coupleId: string };
  "couple-page": { coupleId: string; accountId: string | null };
  "set-bond": { bondId: string };
  "end-bond": { bondId: string };
  "start-drama": { runId: string };
  "end-drama": { runId: string };
  "start-event": { occurrenceId: string };
  "steer-storyline": { projectId: string };
  "run-audience": unknown;
  "set-spice": { level: string | null };
  "list-brands": {
    adsOn: boolean;
    brands: {
      id: string;
      name: string;
      category: string;
      logoUrl: string | null;
      /** `fit` only with an accountId: fits, spice (spicier than their page), offBrand (not their thing). */
      products: { id: string; name: string; pitch: string; spice: string; fit?: SlpBrandFit }[];
    }[];
  };
  "offer-brand-deal": { dealId: string | null; preview: SlpBrandDealPreview };
  "draw-brand-picture": { image: string; prompt: string };
  "start-storyline": { projectId: string };
  "set-tip-goal": { accountId: string };
  "new-look": { accountId: string };
  "invent-event": { eventId: string; occurrenceId: string };
  "add-to-couple": { coupleId: string };
  "grant-perk": { accountId: string };
  "set-challenge": { accountId: string; challengeId: string };
  "offer-contract": { accountId: string; contractId: string };
  "cash-favour": { accountId: string; favours: number };
  "throttle-reach": { accountId: string; until: string };
  "plant-rumour": { accountId: string; messageId: string | null };
  "seed-trend": { accountIds: string[] };
  "warn-creator": { accountId: string };
};
