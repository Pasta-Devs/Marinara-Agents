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
