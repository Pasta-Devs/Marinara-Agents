import type { DB } from "../../db/connection.js";
import { createSlurpStorageContext } from "./host/slp-storage-context.js";
import { createCreatorsStorage1 } from "./creators/slp-creators-storage-1.js";
import { createCreatorsStorage2 } from "./creators/slp-creators-storage-2.js";
import { createCreatorsStorage3 } from "./creators/slp-creators-storage-3.js";
import { createCreatorsStorage4 } from "./creators/slp-creators-storage-4.js";
import { createWardrobeStorage } from "./creators/slp-wardrobe-storage.js";
import { createReserveStorage1 } from "./feed/reserve/slp-reserve-storage-1.js";
import { createReserveStorage2 } from "./feed/reserve/slp-reserve-storage-2.js";
import { createAudienceStorage1 } from "./audience/slp-audience-storage.js";
import { createFeedPostStorage1 } from "./feed/slp-feed-post-storage-1.js";
import { createFeedPostStorage2 } from "./feed/slp-feed-post-storage-2.js";
import { createFeedPostStorage3 } from "./feed/slp-feed-post-storage-3.js";
import { createFeedInteractionStorage1 } from "./feed/slp-feed-interaction-storage-1.js";
import { createFeedInteractionStorage2 } from "./feed/slp-feed-interaction-storage-2.js";
import { createFeedInteractionStorage3 } from "./feed/slp-feed-interaction-storage-3.js";
import { createFeedInteractionStorage4 } from "./feed/slp-feed-interaction-storage-4.js";
import { createFeedRefreshStorage1 } from "./feed/slp-feed-refresh-storage.js";
import { createEconomyStorage1 } from "./economy/slp-economy-storage-1.js";
import { createEconomyStorage2 } from "./economy/slp-economy-storage-2.js";
import { createEconomyStorage3 } from "./economy/slp-economy-storage-3.js";
import { createProjectsStorage1 } from "./projects/slp-projects-storage-1.js";
import { createProjectsStorage2 } from "./projects/slp-projects-storage-2.js";
import { createEconomyTailStorage1 } from "./economy/slp-economy-tail-storage.js";
import { createSlurpMessagesStorageFacet } from "./messages/slp-messages-storage-facet.js";
export type { SlurpMessage, SlurpCommission } from "./messages/slp-messages-storage-types.js";
export type { SlurpBootstrap } from "../modules/settings/slp-settings.js";

export function createSlurpStorage(db: DB) {
  const context = createSlurpStorageContext(db);
  return Object.assign(
    {},
    createCreatorsStorage1(context),
    createCreatorsStorage2(context),
    createCreatorsStorage3(context),
    createCreatorsStorage4(context),
    createWardrobeStorage(context),
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
