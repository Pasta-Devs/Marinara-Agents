/** The Stir levers that start and steer a trend (docs/TRENDS.md). Kept apart so `slp-actions.ts` stays under its size limit. */
import { z } from "zod";

const id = z.string().trim().min(1).max(200);

export const SLP_TREND_LEAN_MAX = 80;

export const SLP_TREND_ACTIONS = {
  "start-trend": {
    summary:
      "Start a trend on Slurp now (mirror selfies, a dance, puppies). The right Creators join over the next days, each in their own way; it peaks and dies down. Name a Creator to make them the starter, and say what to lean into to steer it.",
    inputs: {
      label: "The trend's name, a few words.",
      accountId: "The Creator who starts it (optional).",
      lean: "What posts should lean into, a few words (optional).",
    },
    schema: z
      .object({
        label: z.string().trim().min(1).max(60),
        accountId: id.optional(),
        lean: z.string().trim().max(SLP_TREND_LEAN_MAX).optional(),
      })
      .strict(),
  },
  "steer-trend": {
    summary: "Steer a trend that is going round Slurp: what the Creators who join lean into. Empty text clears it.",
    inputs: { trendId: "The trend (from list-world).", lean: "What posts should lean into, a few words." },
    schema: z.object({ trendId: id, lean: z.string().trim().max(SLP_TREND_LEAN_MAX) }).strict(),
  },
} as const;
