import type {
  SlpCreatorManagedPost,
  SlpCreatorPostView,
  SlpPostImageCrop,
} from "../../../../../shared/src/slp/slp-social.types.js";
export type { SlurpReserveStatus, SlurpScheduleSlot } from "../../base/state/slp-state-types.js";
import type { ImagePromptReviewItem } from "../../../components/ui/ImagePromptReviewModal.js";

export type SlurpProfilePost =
  { managed: SlpCreatorManagedPost; viewerPost: SlpCreatorPostView | null } | { viewerPost: SlpCreatorPostView };
export type NoodlePostDraft = {
  title: string | null;
  content: string;
  imagePrompt: string | null;
  access: "public";
  authorAccountId: string;
};
export type NoodlePostDraftRequest = {
  accountId: string;
  guidance?: string;
  connectionId?: string;
};
export type GeneratedNoodlerNoodlePost = SlpCreatorManagedPost & {
  imagePromptReview?: ImagePromptReviewItem;
};
export type NoodlerPostDraftImage = {
  source: File | string;
  crop: SlpPostImageCrop | null;
};
export type NoodlerContentFormat = "caption" | "announcement" | "long_form";
