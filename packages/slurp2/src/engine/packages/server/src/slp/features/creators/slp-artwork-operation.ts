import type { DB } from "../../../db/connection.js";
import { slpIsAdmissionFailure } from "../../base/host/slp-admission.js";
import { logger } from "../../../lib/logger.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createCharacterGalleryStorage } from "../../../services/storage/character-gallery.storage.js";
import { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { createPromptOverridesStorage } from "../../../services/storage/prompt-overrides.storage.js";
import { generateCreatorPostImage } from "../media/slp-media-contract.js";
import {
  slpCreatorAvatarUrl,
  slpCreatorBannerUrl,
  unlinkCreatorAvatar,
  unlinkCreatorBanner,
} from "../../base/identity/slp-avatar.js";
import { resolveCreatorImageConnectionId } from "../../base/media/slp-image-connections.js";
import { resolveCreatorArtwork } from "./slp-public-profiles-service.js";
import { tryCreatorAccountOperation } from "../../base/locking/slp-account-operation-lock.js";
import type { SlpCreatorArtworkPromptOptions } from "../../../../../shared/src/slp/slp-social.types.js";

export type SlpCreatorArtworkOutcome = "idle" | "inherited" | "avatar" | "banner" | "unavailable";

/**
 * An open creator borrows its source's face and gallery, so its artwork is a copy. A hinted or
 * secret creator cannot: it needs its own picture, drawn through the same disclosure-aware image
 * path the posts use (hinted keeps the appearance references, secret gets none).
 */
function artworkPrompt(
  kind: "avatar" | "banner",
  profile: { displayName: string; bio: string; stagePersonality: string },
  options: SlpCreatorArtworkPromptOptions,
): string {
  const voice = [profile.bio, profile.stagePersonality].filter(Boolean).join(" ").slice(0, 400);
  return [
    kind === "avatar" ? "Avatar image." : "Banner image.",
    options.creatorDetails ? `For ${profile.displayName}. ${voice}` : "",
    options.composition
      ? kind === "avatar"
        ? "One head-and-shoulders subject, looking at the camera, soft flattering light, shallow depth of field, centered composition, no interface or decorative frame."
        : "One continuous ultra-wide environmental scene, edge to edge, no text, logo, avatar bubble, framed portrait, or interface. If a person appears, keep them small and part of the environment."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function artworkNegativePrompt(kind: "avatar" | "banner") {
  return kind === "banner"
    ? "profile picture, avatar, avatar bubble, headshot, dominant face, circular portrait, round portrait, badge, medallion, sticker portrait, framed portrait, inset photo, picture-in-picture, profile card, social media interface, UI mockup, collage, text, logo, border"
    : "banner, cover image, profile page, interface, UI mockup, card, collage, inset image, text, logo, border, circular frame";
}

function artworkCompositionGuard(kind: "avatar" | "banner") {
  return kind === "avatar"
    ? "COMPOSITION REQUIREMENT: output one standalone square avatar portrait only. Do not create a banner, profile page, card, UI mockup, inset image, collage, text, logo, border, or circular frame."
    : "COMPOSITION REQUIREMENT: output one continuous ultra-wide background scene only. The profile page draws its own avatar on top of this image, so a second one ruins it. Do not include a profile picture, avatar, avatar bubble, headshot, dominant face, circular or rounded crop, badge, medallion, sticker portrait, framed portrait, inset image, picture-in-picture, card, collage, social-media UI, text, logo, border, or empty placeholder intended to contain a portrait.";
}

export async function generateCreatorArtwork(
  db: DB,
  input: { accountId: string; kind: "avatar" | "banner"; guidance?: string; options?: SlpCreatorArtworkPromptOptions },
): Promise<"avatar" | "banner" | "missing" | "unavailable" | "busy"> {
  const noodle = createSlurpStorage(db);
  const locked = await tryCreatorAccountOperation(input.accountId, async () => {
    const account = await noodle.getNoodlerAccountById(input.accountId);
    if (!account) return "missing" as const;
    const linkedPublicAccount = await noodle.resolveAccountSource(account);
    const disclosureMode = account.settings.privacy.identityDisclosure ?? "open";
    const connections = createConnectionsStorage(db);
    const mappedId = await resolveCreatorImageConnectionId(db, account.id);
    const imageConnection =
      (mappedId ? await connections.getWithKey(mappedId) : null) ?? (await connections.getDefaultForImageGeneration());
    if (!imageConnection) return "unavailable" as const;
    const settings = await noodle.getSettings();
    const guidance = input.guidance?.trim().slice(0, 2000);
    const options = input.options ?? {
      creatorDetails: true,
      appearance: input.kind === "avatar",
      sourceReferences: input.kind === "avatar",
      composition: true,
    };
    const image = await generateCreatorPostImage({
      account,
      linkedPublicAccount,
      disclosureMode,
      postContent: options.creatorDetails ? account.bio : "",
      draftPrompt: [
        artworkPrompt(
          input.kind,
          {
            displayName: account.displayName,
            bio: account.bio,
            stagePersonality: account.settings.privacy.stagePersonality ?? "",
          },
          options,
        ),
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
      compositionGuard: options.composition ? artworkCompositionGuard(input.kind) : undefined,
      negativePromptAdditions: options.composition ? artworkNegativePrompt(input.kind) : undefined,
      suppressStageAppearance: !options.appearance,
      suppressCreatorDetails: !options.creatorDetails,
      suppressCharacterContext: !options.sourceReferences,
    });
    const mediaPath = image.metadata.noodlerMediaPath;
    if (typeof mediaPath !== "string") {
      image.stagedMedia?.compensate();
      return "unavailable" as const;
    }
    image.stagedMedia?.promote();
    try {
      if (input.kind === "avatar") {
        await noodle.updateNoodlerAvatar(account.id, slpCreatorAvatarUrl(account.id, mediaPath));
        unlinkCreatorAvatar(account.id, account.avatarUrl);
      } else {
        await noodle.updateNoodlerBanner(account.id, slpCreatorBannerUrl(account.id, mediaPath));
        unlinkCreatorBanner(account.id, account.settings.profile.bannerUrl ?? null);
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
export async function backfillNextCreatorArtwork(db: DB): Promise<SlpCreatorArtworkOutcome> {
  const noodle = createSlurpStorage(db);
  const settings = await noodle.getSettings();

  const profiles = await noodle.listNoodlerStageProfiles();
  const target = profiles.find((profile) => !profile.avatarUrl || !profile.bannerUrl);
  if (!target) return "idle";
  const kind: "avatar" | "banner" = target.avatarUrl ? "banner" : "avatar";

  const locked = await tryCreatorAccountOperation(target.id, async () => {
    const account = await noodle.getNoodlerAccountById(target.id);
    if (!account) return "idle" as const;
    const linkedPublicAccount = await noodle.resolveAccountSource(account);
    const disclosureMode = account.settings.privacy.identityDisclosure ?? "open";

    // Open creators inherit rather than generate, including ones created before artwork existed.
    if (disclosureMode === "open") {
      if (!linkedPublicAccount) return "idle" as const;
      const artwork = await resolveCreatorArtwork({
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
    const mappedId = await resolveCreatorImageConnectionId(db, target.id);
    const imageConnection =
      (mappedId ? await connections.getWithKey(mappedId) : null) ?? (await connections.getDefaultForImageGeneration());
    if (!imageConnection) return "unavailable" as const;

    const image = await generateCreatorPostImage({
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
      // Unattended work: yield the image connection to anything the user started, and never
      // queue behind another background run.
      admissionMode: { kind: "background" },
      width: kind === "banner" ? 1536 : 1024,
      height: kind === "banner" ? 512 : 1024,
      compositionGuard: artworkCompositionGuard(kind),
      negativePromptAdditions: artworkNegativePrompt(kind),
      suppressCharacterContext: kind === "banner",
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
        await noodle.updateNoodlerAvatar(target.id, slpCreatorAvatarUrl(target.id, mediaPath));
      } else {
        await noodle.updateNoodlerBanner(target.id, slpCreatorBannerUrl(target.id, mediaPath));
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
export async function tryBackfillNextCreatorArtwork(db: DB): Promise<SlpCreatorArtworkOutcome> {
  try {
    return await backfillNextCreatorArtwork(db);
  } catch (error) {
    // A busy connection is not a failure: nothing was sent, so the next poll may simply try again.
    if (slpIsAdmissionFailure(error)) return "idle";
    logger.warn(error, "[slurp] Creator artwork backfill failed");
    return "unavailable";
  }
}
