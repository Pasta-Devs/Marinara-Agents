import type { DB } from "../db/connection.js";
import { createSlurpStorageContext } from "./base/host/slp-storage-context.js";
import { createCreatorsStorage1 } from "./features/creators/slp-creators-storage-1.js";
import { createCreatorsStorage2 } from "./features/creators/slp-creators-storage-2.js";
import { createCreatorsStorage3 } from "./features/creators/slp-creators-storage-3.js";
import { createCreatorsStorage4 } from "./features/creators/slp-creators-storage-4.js";
import { createReserveStorage1 } from "./features/feed/reserve/slp-reserve-storage-1.js";
import { createReserveStorage2 } from "./features/feed/reserve/slp-reserve-storage-2.js";
import { createAudienceStorage1 } from "./features/audience/slp-audience-storage.js";
import { createFeedPostStorage1 } from "./features/feed/slp-feed-post-storage-1.js";
import { createFeedPostStorage2 } from "./features/feed/slp-feed-post-storage-2.js";
import { createFeedPostStorage3 } from "./features/feed/slp-feed-post-storage-3.js";
import { createFeedInteractionStorage1 } from "./features/feed/slp-feed-interaction-storage-1.js";
import { createFeedInteractionStorage2 } from "./features/feed/slp-feed-interaction-storage-2.js";
import { createFeedInteractionStorage3 } from "./features/feed/slp-feed-interaction-storage-3.js";
import { createFeedInteractionStorage4 } from "./features/feed/slp-feed-interaction-storage-4.js";
import { createFeedRefreshStorage1 } from "./features/feed/slp-feed-refresh-storage.js";
import { createEconomyStorage1 } from "./features/economy/slp-economy-storage-1.js";
import { createEconomyStorage2 } from "./features/economy/slp-economy-storage-2.js";
import { createEconomyStorage3 } from "./features/economy/slp-economy-storage-3.js";
import { createProjectsStorage1 } from "./features/projects/slp-projects-storage-1.js";
import { createProjectsStorage2 } from "./features/projects/slp-projects-storage-2.js";
import { createEconomyTailStorage1 } from "./features/economy/slp-economy-tail-storage.js";
import { createSlurpMessagesStorageFacet } from "./features/messages/slp-messages-storage-facet.js";

export {
  DEFAULT_SLURP_SETTINGS,
  isSlurpViewerActorAccount,
  normalizeSlurpSettings,
  slurpSettingsSchema,
  SLURP_GUIDANCE_PRESETS,
} from "./base/settings/slp-settings.js";
export type {
  SlurpPromptBlockOverrides,
  SlurpSettings,
  SlurpSettingsUpdateInput,
} from "./base/settings/slp-settings.js";
export {
  noodlerReservePolicyFingerprint,
  normalizeNoodleAccountSettings,
  normalizePersistedInteger,
  normalizeScheduler,
  parseNoodleAvatarCrop,
  remapNoodlerReservePolicyFingerprint,
} from "./base/host/slp-storage-model.js";
export type {
  NoodlerCreatorReplyClaimResult,
  NoodlerPostPageCursor,
  NoodlerPostPageOptions,
  NoodlerPreparedImageState,
  NoodlerPreparedPostPayload,
  NoodlerPreparedPostState,
  SlurpAccount,
  SlurpManagedStageProfile,
  SlurpReserveStatus,
  SlurpScheduleSlot,
  SlurpSourceKind,
} from "./base/host/slp-storage-model.js";
export { snapshotForAccount } from "./base/host/slp-storage-mappers.js";
export {
  NOODLER_SUBSCRIPTION_COST,
  NOODLER_UNLOCK_COST,
  noodlerUnlockPriceFromMetadata,
  noodlerUnlockPriceMetadata,
} from "../services/slurp/slurp-prices.js";

export function createSlurpStorage(db: DB) {
  const context = createSlurpStorageContext(db);
  return Object.assign(
    {},
    createCreatorsStorage1(context),
    createCreatorsStorage2(context),
    createCreatorsStorage3(context),
    createCreatorsStorage4(context),
    createReserveStorage1(context),
    createReserveStorage2(context),
    createAudienceStorage1(context),
    createFeedPostStorage1(context),
    createFeedPostStorage2(context),
    createFeedPostStorage3(context),
    createFeedInteractionStorage1(context),
    createFeedInteractionStorage2(context),
    createFeedInteractionStorage3(context),
    createFeedInteractionStorage4(context),
    createFeedRefreshStorage1(context),
    createEconomyStorage1(context),
    createEconomyStorage2(context),
    createEconomyStorage3(context),
    createProjectsStorage1(context),
    createProjectsStorage2(context),
    createEconomyTailStorage1(context),
  );
}

export function createSlurpMessagesStorage(db: DB) {
  return createSlurpMessagesStorageFacet(db, createSlurpStorage);
}
