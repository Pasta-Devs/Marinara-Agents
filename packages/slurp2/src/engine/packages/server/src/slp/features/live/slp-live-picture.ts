import type { DB } from "../../../db/connection.js";
import { logger } from "../../../lib/logger.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import { slpLivePictureDue, slpLivePictureScene } from "../../../../../shared/src/slp/slp-live-picture.js";
import type { SlpLiveSettings } from "../../../../../shared/src/slp/slp-live.js";
import { resolveCreatorImageConnectionId } from "../../base/media/slp-image-connections.js";
import { createSlurpLiveStorage } from "../../data/live/slp-live-storage.js";
import { resolveSlurpCreatorMenu, resolveSlurpExplicitLevel } from "../../data/settings/slp-post-guidance-storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { slurpImageNegativePrompt, slurpLevelPhoto } from "../../modules/feed/slp-image-brief.js";
import { generateCreatorPostImage } from "../media/slp-media-contract.js";
import { withSlurpLiveShow } from "./slp-live-lock.js";

/**
 * Takes a live picture when one is due (LIVE-V3-PLAN.md "Pictures"). Marks the show as shooting at once, then
 * draws in the background; the stage keeps the last picture until this one lands. Only called while
 * somebody watches (from a beat), so nobody pays for pictures of an empty room.
 */
export async function shootSlurpLivePicture(db: DB, showId: string, at: number, live: SlpLiveSettings) {
  const storage = createSlurpLiveStorage(db);
  let scene = "";
  let hostId = "";
  await withSlurpLiveShow(showId, async () => {
    const show = await storage.get(showId);
    // A player host's persona Creator draws from the persona's appearance; without one the draw fails quietly.
    if (!show || show.endedAt) return;
    const why = slpLivePictureDue(show.state, at, live);
    if (!why) return;
    scene = slpLivePictureScene(show.state, at, why);
    hostId = show.hostId;
    show.state.pictureAt = at;
    show.state.shooting = at;
    await storage.save(show.id, { state: show.state });
  });
  if (!scene) return;
  const t0 = Date.now();
  const path = await drawLivePicture(db, hostId, scene).catch((error: unknown) => {
    logger.warn(error, "[slurp-live] Picture failed");
    return null;
  });
  await withSlurpLiveShow(showId, async () => {
    const show = await storage.get(showId);
    if (!show) return path?.compensate();
    // A newer shot (after this one went stale) keeps its own mark.
    if (show.state.shooting === at) show.state.shooting = null;
    if (!path || show.endedAt) {
      path?.compensate();
      await storage.save(show.id, { state: show.state });
      return;
    }
    show.state.pictures = [...(show.state.pictures ?? []), { at: at + (Date.now() - t0), path: path.mediaPath }];
    // Saved first: a failed save must not leave a promoted file that nothing points to.
    await storage.save(show.id, { state: show.state }).catch((error: unknown) => {
      path.compensate();
      throw error;
    });
    path.promote();
  });
}

async function drawLivePicture(db: DB, creatorId: string, scene: string) {
  const noodle = createSlurpStorage(db);
  const connections = createConnectionsStorage(db);
  const account = await noodle.getNoodlerAccountById(creatorId);
  if (!account) return null;
  const mappedId = await resolveCreatorImageConnectionId(db, account.id);
  const imageConnection =
    (mappedId ? await connections.getWithKey(mappedId) : null) ?? (await connections.getDefaultForImageGeneration());
  if (!imageConnection) return null;
  const level = await resolveSlurpExplicitLevel(db, account.id).catch(() => "suggestive" as const);
  const image = await generateCreatorPostImage({
    account,
    linkedPublicAccount: await noodle.resolveAccountSource(account),
    disclosureMode: account.settings.privacy.identityDisclosure ?? "open",
    postContent: scene,
    draftPrompt: [scene, slurpLevelPhoto(level)].join("\n"),
    negativePromptAdditions: slurpImageNegativePrompt(level),
    contentPolicy: await resolveSlurpCreatorMenu(db, account.id).catch(() => ""),
    settings: await noodle.getSettings(),
    characters: createCharactersStorage(db),
    promptOverrides: createPromptOverridesStorage(db),
    imageConnection,
    db,
    debugMode: false,
    // Portrait like a Story: the live screen is a portrait column on every screen size.
    story: true,
    previewOnly: false,
  });
  const mediaPath = image.metadata.noodlerMediaPath;
  if (typeof mediaPath !== "string" || !image.stagedMedia) {
    image.stagedMedia?.compensate();
    return null;
  }
  return { mediaPath, promote: () => image.stagedMedia?.promote(), compensate: () => image.stagedMedia?.compensate() };
}
