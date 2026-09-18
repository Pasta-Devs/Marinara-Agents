import type {
  NoodleBootstrap,
  NoodleStageProfileInput,
  NoodlerManagedStageProfile,
  NoodlerViewerScope,
} from "@marinara-engine/shared";
import type { ImagePromptReviewItem } from "../../../components/ui/ImagePromptReviewModal.js";

export type SlurpPromptBlockOverride = {
  id: string;
  enabled?: boolean;
  text?: string;
};
export type SlurpDiscoveryGender = "male" | "female" | "other";
export type SlurpStageProfileInput = NoodleStageProfileInput & {
  gender: SlurpDiscoveryGender | null;
  tags: string[];
};
export type SlurpManagedStageProfile = NoodlerManagedStageProfile & {
  gender: SlurpDiscoveryGender | null;
  tags: string[];
};
export type SlurpViewerScope = Omit<NoodlerViewerScope, "creators"> & {
  creators: Array<
    Omit<NoodlerViewerScope["creators"][number], "profile"> & {
      profile: NoodlerViewerScope["creators"][number]["profile"] & {
        gender: SlurpDiscoveryGender | null;
        tags: string[];
      };
    }
  >;
};
export type NoodleRefreshResult = {
  bootstrap: NoodleBootstrap;
  imagePromptReviewItems: ImagePromptReviewItem[];
};
export type SlurpContentRating = "tame" | "suggestive" | "explicit";
