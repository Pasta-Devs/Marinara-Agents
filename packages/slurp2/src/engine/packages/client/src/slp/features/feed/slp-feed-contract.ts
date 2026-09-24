import type {
  SlpCreatorManagedPost,
  SlpCreatorPostView,
  SlpPostImageCrop,
} from "../../../../../shared/src/slp/slp-social.types.js";
export type { SlurpReserveStatus, SlurpScheduleSlot } from "../../base/state/slp-state-types.js";
import type { ImagePromptReviewItem } from "../../../components/ui/ImagePromptReviewModal.js";

export type SlurpProfilePost =
  { managed: SlpCreatorManagedPost; viewerPost: SlpCreatorPostView | null } | { viewerPost: SlpCreatorPostView };
export type SlpPostDraft = {
  title: string | null;
  content: string;
  imagePrompt: string | null;
  access: "public";
  authorAccountId: string;
};
export type SlpPostDraftRequest = {
  accountId: string;
  guidance?: string;
  connectionId?: string;
};
export type GeneratedCreatorSlpPost = SlpCreatorManagedPost & {
  imagePromptReview?: ImagePromptReviewItem;
};
export type SlpCreatorPostDraftImage = {
  source: File | string;
  crop: SlpPostImageCrop | null;
};
export type SlpCreatorContentFormat = "caption" | "announcement" | "long_form";

// The Creator settings modal owns one Creator's automation and prepared publishing slots.
export {
  useCreatorReserveStatus,
  useUpdateCreatorAutoPosting,
  useUpdateCreatorScheduleSlot,
} from "./slp-feed-schedule-hooks.js";
