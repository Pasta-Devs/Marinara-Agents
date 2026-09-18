import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createCharacterGalleryStorage } from "../../../services/storage/character-gallery.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createNoodlerNoodleImagesService } from "../../../services/slurp/slurp-images.service.js";
import { createGarnishAds } from "../../../services/garnish-ads/garnish-ads.service.js";
import { createSlurpFirstPostQueue } from "../../../services/slurp/slurp-first-post-queue.service.js";
import type { NoodleAccount } from "@marinara-engine/shared";
import { buildNoodlerPublicIdentity } from "../../../services/slurp/slurp-generation.service.js";
import type { FastifyInstance } from "fastify";
import { type NoodlerViewerSignalResponse } from "./slp-request-schemas.js";

/** Storage and service handles every Slurp route shares. Created once per route mount. */
export function createSlpRouteHost<T>(app: FastifyInstance, noodle: T) {
  const characters = createCharactersStorage(app.db);
  const characterGallery = createCharacterGalleryStorage(app.db);
  const connections = createConnectionsStorage(app.db);
  const noodlerImages = createNoodlerNoodleImagesService(app.db);
  const ads = createGarnishAds(app.db);
  const firstPostQueue = createSlurpFirstPostQueue(app.db);
  const noodlerViewerSignalCache = new Map<string, { generationKey: string; value: NoodlerViewerSignalResponse }>();

  async function resolveNoodlerPublicIdentity(publicAccount: NoodleAccount) {
    const source =
      publicAccount.kind === "character"
        ? await characters.getById(publicAccount.entityId)
        : publicAccount.kind === "persona"
          ? await characters
              .getPersona(publicAccount.entityId)
              .then((persona) => (persona ? { data: { name: persona.name } } : null))
          : null;
    return buildNoodlerPublicIdentity(publicAccount, source);
  }

  return {
    noodle,
    characters,
    characterGallery,
    connections,
    noodlerImages,
    ads,
    firstPostQueue,
    noodlerViewerSignalCache,
    resolveNoodlerPublicIdentity,
  };
}

export type SlpRouteHost = ReturnType<typeof createSlpRouteHost>;
