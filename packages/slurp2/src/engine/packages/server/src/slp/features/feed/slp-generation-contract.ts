import type { SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlpWardrobeScene } from "../../../../../shared/src/slp/slp-wardrobe.js";
import type { SlurpVisualBrief } from "../../base/media/slp-visual-brief.js";
import type { StagedGalleryImage } from "../../../services/image/image-generation.js";
import type { SlpImagePromptReviewItem } from "../media/slp-media-contract.js";

export type GeneratedCreatorPostResult = {
  post: SlpCreatorManagedPost;
  imagePromptReview: SlpImagePromptReviewItem | null;
};

export type PreparedCreatorPostResult = {
  title: string | null;
  content: string;
  imagePrompt: string | null;
  access: "public" | "locked";
  projectId: string | null;
  projectChapter: string | null;
  metadata: Record<string, unknown>;
  compiledPrompt: string;
  scene: SlpWardrobeScene | null;
  wardrobeSelection: { selectedId: string | null; requestedId: string | null; fallback: boolean };
  visualBrief: SlurpVisualBrief | null;
  imageBrief: string | null;
  providerPrompt: string | null;
  stagedMedia?: StagedGalleryImage | null;
};
