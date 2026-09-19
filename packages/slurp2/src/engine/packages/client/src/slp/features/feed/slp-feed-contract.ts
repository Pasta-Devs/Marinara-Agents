import type { NoodlePostImageCrop, NoodlerManagedPost, NoodlerPostView } from "@marinara-engine/shared";
export type { SlurpReserveStatus, SlurpScheduleSlot } from "../../base/state/slp-state-types.js";
import type { ImagePromptReviewItem } from "../../../components/ui/ImagePromptReviewModal.js";

export type SlurpProfilePost =
  { managed: NoodlerManagedPost; viewerPost: NoodlerPostView | null } | { viewerPost: NoodlerPostView };
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
export type GeneratedNoodlerNoodlePost = NoodlerManagedPost & {
  imagePromptReview?: ImagePromptReviewItem;
};
export type NoodlerPostDraftImage = {
  source: File | string;
  crop: NoodlePostImageCrop | null;
};
export type NoodlerContentFormat = "caption" | "announcement" | "long_form";
