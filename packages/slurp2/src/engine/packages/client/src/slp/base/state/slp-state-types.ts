import type { SlpStageProfileInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type {
  SlpBootstrap,
  SlpCreatorManagedStageProfile,
  SlpCreatorViewerScope,
} from "../../../../../shared/src/slp/slp-social.types.js";
import type { ImagePromptReviewItem } from "../../../components/ui/ImagePromptReviewModal.js";

export type SlurpPromptBlockOverride = {
  id: string;
  enabled?: boolean;
  text?: string;
  instructionId?: string;
};
export type SlurpReusablePromptInstruction = { id: string; name: string; text: string; builtin?: boolean };
export type SlurpDiscoveryGender = "male" | "female" | "other";
export type SlurpStageProfileInput = SlpStageProfileInput & {
  gender: SlurpDiscoveryGender | null;
  tags: string[];
};
export type SlurpManagedStageProfile = SlpCreatorManagedStageProfile & {
  bannerUrl: string | null;
  gender: SlurpDiscoveryGender | null;
  tags: string[];
};
export type SlurpViewerScope = Omit<SlpCreatorViewerScope, "creators"> & {
  creators: Array<
    Omit<SlpCreatorViewerScope["creators"][number], "profile"> & {
      profile: SlpCreatorViewerScope["creators"][number]["profile"] & {
        gender: SlurpDiscoveryGender | null;
        tags: string[];
      };
    }
  >;
};
export type SlpRefreshResult = {
  bootstrap: SlpBootstrap;
  imagePromptReviewItems: ImagePromptReviewItem[];
};
export type SlurpContentRating = "tame" | "suggestive" | "explicit";

// The reserve/schedule shapes are read by the shared Backstage kit in modules/ as well as by Feed,
// so they live here rather than behind a modules -> features import.
export type SlurpScheduleSlot = {
  id: string;
  publishAt: string;
  state: "scheduled" | "prepared";
};
export type SlurpReserveStatus = {
  preparedCount: number;
  preparedThrough: string | null;
  textAttemptsUsed: number;
  imageAttemptsUsed: number;
  postsPerDay: number;
  preparationNotBefore: string;
  creators: Array<{
    accountId: string;
    nextPreparedAt: string | null;
    preparedCount: number;
    slots: SlurpScheduleSlot[];
  }>;
};

export type SlurpDiscoverLayout = "grid" | "list";
