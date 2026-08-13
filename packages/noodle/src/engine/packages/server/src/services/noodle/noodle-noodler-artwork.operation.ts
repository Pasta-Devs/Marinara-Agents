import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createNoodleStorage } from "../storage/noodle.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { generateNoodlerPostImage } from "./noodle-noodler-images.service.js";
import { noodlerAvatarUrl, noodlerBannerUrl } from "./noodle-noodler-avatar.js";
import { resolveNoodlerImageConnectionId } from "./noodler-image-connections.js";
import { resolveNoodlerCreatorArtwork } from "./noodle-public-profiles.service.js";
import { tryNoodlerAccountOperation } from "./noodle-noodler-account-operation-lock.js";

export type NoodlerArtworkOutcome = "idle" | "inherited" | "avatar" | "banner" | "unavailable";

/**
 * An open creator borrows its source's face and gallery, so its artwork is a copy. A hinted or
 * secret creator cannot: it needs its own picture, drawn through the same disclosure-aware image
 * path the posts use (hinted keeps the appearance references, secret gets none).
 */
function artworkPrompt(
  kind: "avatar" | "banner",
  profile: { displayName: string; bio: string; stagePersonality: string },
): string {
  const voice = [profile.bio, profile.stagePersonality].filter(Boolean).join(" ").slice(0, 400);
  return kind === "avatar"
    ? `Profile picture for the creator page of ${profile.displayName}: head-and-shoulders portrait, looking at the camera, soft flattering light, shallow depth of field, centered composition. ${voice}`
    : `Wide cover banner for the creator page of ${profile.displayName}: their space or a scene that fits them, no text, no logos, room at the centre for a profile picture to overlap. ${voice}`;
}

/**
 * One artwork item per call: this runs on the scheduler poll, so a page of new creators fills in
 * over a few minutes instead of blocking creation on a queue of image generations.
 */
export async function backfillNextNoodlerCreatorArtwork(db: DB): Promise<NoodlerArtworkOutcome> {
  const noodle = createNoodleStorage(db);
  const settings = await noodle.getSettings();
  if (!settings.enableNoodler) return "idle";

  const profiles = await noodle.listNoodlerStageProfiles();
  const target = profiles.find((profile) => !profile.avatarUrl || !profile.bannerUrl);
  if (!target) return "idle";
  const kind: "avatar" | "banner" = target.avatarUrl ? "banner" : "avatar";

  const locked = await tryNoodlerAccountOperation(target.id, async () => {
    const account = await noodle.getNoodlerAccountById(target.id);
    if (!account) return "idle" as const;
    const linkedPublicAccount = account.noodleAccountId
      ? await noodle.getAccountById(account.noodleAccountId)
      : null;
    const disclosureMode = account.settings.privacy.identityDisclosure ?? "secret";

    // Open creators inherit rather than generate, including ones created before artwork existed.
    if (disclosureMode === "open") {
      if (!linkedPublicAccount) return "idle" as const;
      const artwork = await resolveNoodlerCreatorArtwork({
        characters: createCharactersStorage(db),
        characterGallery: createCharacterGalleryStorage(db),
        publicAccount: linkedPublicAccount,
        disclosureMode,
      });
      const value = kind === "avatar" ? artwork.avatarUrl : artwork.bannerUrl;
      if (!value) return "idle" as const;
      if (kind === "avatar") await noodle.updateNoodlerAvatar(target.id, value);
      else await noodle.updateNoodlerBanner(target.id, value);
      return "inherited" as const;
    }

    const connections = createConnectionsStorage(db);
    const mappedId = await resolveNoodlerImageConnectionId(db, target.id);
    const imageConnection =
      (mappedId ? await connections.getWithKey(mappedId) : null) ??
      (await connections.getDefaultForImageGeneration());
    if (!imageConnection) return "unavailable" as const;

    const image = await generateNoodlerPostImage({
      account,
      linkedPublicAccount,
      disclosureMode,
      postContent: account.bio,
      draftPrompt: artworkPrompt(kind, {
        displayName: account.displayName,
        bio: account.bio,
        stagePersonality: account.settings.privacy.stagePersonality ?? "",
      }),
      settings,
      characters: createCharactersStorage(db),
      promptOverrides: createPromptOverridesStorage(db),
      imageConnection,
      db,
      debugMode: false,
      previewOnly: false,
    });
    const mediaPath = image.metadata.noodlerMediaPath;
    if (typeof mediaPath !== "string") {
      image.stagedMedia?.compensate();
      return "unavailable" as const;
    }
    // Promote first, then record: a row pointing at a swept file shows a broken image forever,
    // while a promoted file with no row is reclaimed by the staged-image sweep.
    image.stagedMedia?.promote();
    try {
      if (kind === "avatar") {
        await noodle.updateNoodlerAvatar(target.id, noodlerAvatarUrl(target.id, mediaPath));
      } else {
        await noodle.updateNoodlerBanner(target.id, noodlerBannerUrl(target.id, mediaPath));
      }
    } catch (error) {
      image.stagedMedia?.compensate();
      throw error;
    }
    return kind;
  });
  if (!locked.acquired) return "idle";
  return locked.value;
}

/** Poll-safe wrapper: artwork is cosmetic, so a failure never interrupts the reserve poll. */
export async function tryBackfillNextNoodlerCreatorArtwork(db: DB): Promise<NoodlerArtworkOutcome> {
  try {
    return await backfillNextNoodlerCreatorArtwork(db);
  } catch (error) {
    logger.warn(error, "[noodler] Creator artwork backfill failed");
    return "unavailable";
  }
}
