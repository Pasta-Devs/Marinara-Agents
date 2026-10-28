import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createCharacterGalleryStorage } from "../../../services/storage/character-gallery.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createCreatorSlpImagesService } from "../media/slp-media-contract.js";
import { createGarnishAds } from "../ads/slp-ads-contract.js";
import { createSlurpFirstPostQueue } from "../onboarding/slp-onboarding-contract.js";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { buildCreatorPublicIdentity } from "../feed/slp-feed-contract.js";
import type { FastifyInstance } from "fastify";
import { type SlpCreatorViewerSignalResponse } from "../../modules/requests/slp-request-schemas.js";

/** Storage and service handles every Slurp route shares. Created once per route mount. */
export function createSlpRouteHost<T>(app: FastifyInstance, noodle: T) {
  const characters = createCharactersStorage(app.db);
  const characterGallery = createCharacterGalleryStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const slpCreatorImages = createCreatorSlpImagesService(app.db);
  const ads = createGarnishAds(app.db);
  const firstPostQueue = createSlurpFirstPostQueue(app.db);
  const noodlerViewerSignalCache = new Map<string, { generationKey: string; value: SlpCreatorViewerSignalResponse }>();

  async function resolveNoodlerPublicIdentity(publicAccount: SlpAccount) {
    const source =
      publicAccount.kind === "character"
        ? await characters.getById(publicAccount.entityId)
        : publicAccount.kind === "persona"
          ? await characters
              .getPersona(publicAccount.entityId)
              .then((persona) => (persona ? { data: { name: persona.name } } : null))
          : null;
    return buildCreatorPublicIdentity(publicAccount, source);
  }

  return {
    noodle,
    characters,
    characterGallery,
    connections,
    slpCreatorImages,
    ads,
    firstPostQueue,
    noodlerViewerSignalCache,
    resolveNoodlerPublicIdentity,
  };
}

export type SlpRouteHost = ReturnType<typeof createSlpRouteHost>;
