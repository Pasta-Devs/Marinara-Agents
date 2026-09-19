import { z } from "zod";
import { SLURP_DISCOVERY_TAG_MAX_LENGTH } from "../discovery/slp-discovery-profile.js";

export const slurpPostTypeSchema = z.enum(["post", "story"]);
export const slurpDiscoveryTagNameSchema = z.string().trim().min(1).max(SLURP_DISCOVERY_TAG_MAX_LENGTH);
export const SLP_CREATOR_FEED_PAGE_SIZE = 20;

export const slpCreatorPageCursorSchema = z
  .object({
    cursorAt: z.string().datetime().optional(),
    cursorId: z.string().trim().min(1).max(200).optional(),
  })
  .refine(
    (value) => Boolean(value.cursorAt) === Boolean(value.cursorId),
    "cursorAt and cursorId must be provided together",
  );

export type SlpCreatorViewerSignalResponse = {
  count: number;
  revision: {
    latestPost: string | null;
    latestPostId: string | null;
    latestPostAccountId: string | null;
    latestPostUpdate: string | null;
    updatedPostId: string | null;
    updatedPostAccountId: string | null;
    latestInteraction: string | null;
    interactionPostId: string | null;
    latestCreator: string | null;
  };
};
