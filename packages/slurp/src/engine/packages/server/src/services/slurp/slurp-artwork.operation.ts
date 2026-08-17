import type { DB } from "../../db/connection.js";
import { logger } from "../../lib/logger.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createCharacterGalleryStorage } from "../storage/character-gallery.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { generateNoodlerPostImage } from "./slurp-images.service.js";
import { noodlerAvatarUrl, noodlerBannerUrl, unlinkNoodlerAvatar, unlinkNoodlerBanner } from "./slurp-avatar.js";
import { resolveNoodlerImageConnectionId } from "./slurp-image-connections.js";
import { resolveNoodlerCreatorArtwork } from "./slurp-public-profiles.service.js";
import { tryNoodlerAccountOperation } from "./slurp-account-operation-lock.js";

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
    ? `Standalone avatar portrait for ${profile.displayName}: one head-and-shoulders subject, looking at the camera, soft flattering light, shallow depth of field, centered composition, plain image with no interface or decorative frame. ${voice}`
    : `Ultra-wide environmental cover banner for ${profile.displayName}: one continuous location or atmospheric scene that fits the creator, landscape composition, no text, no logos, no interface. If a person appears, keep them small and integrated into the environment rather than presenting a portrait. ${voice}`;
}

function artworkCompositionGuard(kind: "avatar" | "banner") {
  return kind === "avatar"
    ? "COMPOSITION REQUIREMENT: output one standalone square avatar portrait only. Do not create a banner, profile page, card, UI mockup, inset image, collage, text, logo, border, or circular frame."
    : "COMPOSITION REQUIREMENT: output one continuous ultra-wide background scene only. Do not include a profile picture, avatar, headshot, dominant face, circular crop, framed portrait, inset image, card, collage, social-media UI, text, logo, border, or empty placeholder intended to contain a portrait.";
}

export async function generateNoodlerCreatorArtwork(
  db: DB,
  input: { accountId: string; kind: "avatar" | "banner"; guidance?: string },
): Promise<"avatar" | "banner" | "missing" | "unavailable" | "busy"> {
  const noodle = createSlurpStorage(db);
  const locked = await tryNoodlerAccountOperation(input.accountId, async () => {
    const account = await noodle.getNoodlerAccountById(input.accountId);
    if (!account) return "missing" as const;
    const linkedPublicAccount = await noodle.resolveAccountSource(account);
    const disclosureMode = account.settings.privacy.identityDisclosure ?? "secret";
    const connections = createConnectionsStorage(db);
    const mappedId = await resolveNoodlerImageConnectionId(db, account.id);
    const imageConnection =
      (mappedId ? await connections.getWithKey(mappedId) : null) ?? (await connections.getDefaultForImageGeneration());
    if (!imageConnection) return "unavailable" as const;
    const settings = await noodle.getSettings();
    const guidance = input.guidance?.trim().slice(0, 2000);
    const image = await generateNoodlerPostImage({
      account,
      linkedPublicAccount,
      disclosureMode,
      postContent: account.bio,
      draftPrompt: [
        artworkPrompt(input.kind, {
          displayName: account.displayName,
          bio: account.bio,
          stagePersonality: account.settings.privacy.stagePersonality ?? "",
        }),
        guidance ? `User direction: ${guidance}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      settings,
      characters: createCharactersStorage(db),
      promptOverrides: createPromptOverridesStorage(db),
      imageConnection,
      db,
      debugMode: false,
      previewOnly: false,
      width: input.kind === "banner" ? 1536 : 1024,
      height: input.kind === "banner" ? 512 : 1024,
      compositionGuard: artworkCompositionGuard(input.kind),
      negativePromptAdditions:
        input.kind === "banner"
          ? "profile picture, avatar, headshot, dominant face, circular portrait, framed portrait, inset photo, profile card, social media interface, UI mockup, collage, text, logo, border"
          : "banner, cover image, profile page, interface, UI mockup, card, collage, inset image, text, logo, border, circular frame",
    });
    const mediaPath = image.metadata.noodlerMediaPath;
    if (typeof mediaPath !== "string") {
      image.stagedMedia?.compensate();
      return "unavailable" as const;
    }
    image.stagedMedia?.promote();
    try {
      if (input.kind === "avatar") {
        await noodle.updateNoodlerAvatar(account.id, noodlerAvatarUrl(account.id, mediaPath));
        unlinkNoodlerAvatar(account.id, account.avatarUrl);
      } else {
        await noodle.updateNoodlerBanner(account.id, noodlerBannerUrl(account.id, mediaPath));
        unlinkNoodlerBanner(account.id, account.settings.profile.bannerUrl ?? null);
      }
    } catch (error) {
      image.stagedMedia?.compensate();
      throw error;
    }
    return input.kind;
  });
  return locked.acquired ? locked.value : "busy";
}

/**
 * One artwork item per call: this runs on the scheduler poll, so a page of new creators fills in
 * over a few minutes instead of blocking creation on a queue of image generations.
 */
export async function backfillNextNoodlerCreatorArtwork(db: DB): Promise<NoodlerArtworkOutcome> {
  const noodle = createSlurpStorage(db);
  const settings = await noodle.getSettings();

  const profiles = await noodle.listNoodlerStageProfiles();
  const target = profiles.find((profile) => !profile.avatarUrl || !profile.bannerUrl);
  if (!target) return "idle";
  const kind: "avatar" | "banner" = target.avatarUrl ? "banner" : "avatar";

  const locked = await tryNoodlerAccountOperation(target.id, async () => {
    const account = await noodle.getNoodlerAccountById(target.id);
    if (!account) return "idle" as const;
    const linkedPublicAccount = await noodle.resolveAccountSource(account);
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
      (mappedId ? await connections.getWithKey(mappedId) : null) ?? (await connections.getDefaultForImageGeneration());
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
      width: kind === "banner" ? 1536 : 1024,
      height: kind === "banner" ? 512 : 1024,
      compositionGuard: artworkCompositionGuard(kind),
      negativePromptAdditions:
        kind === "banner"
          ? "profile picture, avatar, headshot, dominant face, circular portrait, framed portrait, inset photo, profile card, social media interface, UI mockup, collage, text, logo, border"
          : "banner, cover image, profile page, interface, UI mockup, card, collage, inset image, text, logo, border, circular frame",
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
