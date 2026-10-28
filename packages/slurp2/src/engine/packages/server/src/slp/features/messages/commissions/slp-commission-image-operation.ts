import type { DB } from "../../../../db/connection.js";
import { createCharactersStorage } from "../../../../services/storage/characters.storage.js";
import { createConnectionsStorage } from "../../../../services/storage/connections.storage.js";
import { createPromptOverridesStorage } from "../../../../services/storage/prompt-overrides.storage.js";
import { createSlurpStorage } from "../../../data/slp-storage.js";
import { generateCreatorPostImage } from "../../media/slp-media-contract.js";
import { resolveCreatorImageConnectionId } from "../../../base/media/slp-image-connections.js";
import {
  resolveSlurpCreatorMenu,
  resolveSlurpExplicitLevel,
} from "../../../data/settings/slp-post-guidance-storage.js";
import { slurpImageNegativePrompt, slurpLevelPhoto } from "../../../modules/feed/slp-image-brief.js";
import type { SlurpExplicitLevel } from "../../../modules/feed/slp-post-guidance.js";
import { slurpViewerPhotoPrompt } from "../../../modules/messages/slp-messaging.js";

/**
 * Draw the piece a fan commissioned.
 *
 * A commission is somebody paying a Creator to make a picture, and the delivery could only ever be
 * text. The fan paid, and then a sentence arrived. This closes that: the brief is the prompt.
 *
 * The brief is the fan's words, so it is treated as direction and not as authority. It is clamped,
 * and it goes through the same identity redaction and disclosure rules as any other Slurp image —
 * a secret Creator does not lose their face to a commission that asks for it.
 */
export async function generateSlurpCommissionImage(
  db: DB,
  input: {
    creatorAccountId: string;
    brief: string;
    /** How far the picture goes. Absent: the Creator's own level (a paid piece or a locked PPV). */
    level?: SlurpExplicitLevel;
  },
): Promise<{ mediaPath: string; promote: () => void; compensate: () => void } | "unavailable"> {
  const noodle = createSlurpStorage(db);
  const connections = createConnectionsStorage(db);
  const account = await noodle.getNoodlerAccountById(input.creatorAccountId);
  if (!account) return "unavailable";
  const mappedId = await resolveCreatorImageConnectionId(db, account.id);
  const imageConnection =
    (mappedId ? await connections.getWithKey(mappedId) : null) ?? (await connections.getDefaultForImageGeneration());
  if (!imageConnection) return "unavailable";

  const linkedPublicAccount = await noodle.resolveAccountSource(account);
  // Same default as every other read of this setting. Slurp offers only Open and Hinted, and a
  // Creator with no mode is Open.
  // ponytail: single-site fix; a shared resolveDisclosureMode() helper would stop it drifting again.
  const disclosureMode = account.settings.privacy.identityDisclosure ?? "open";
  const settings = await noodle.getSettings();
  const contentPolicy = await resolveSlurpCreatorMenu(db, account.id).catch(() => "");
  const brief = input.brief.trim().slice(0, 2000);
  const level = input.level ?? (await resolveSlurpExplicitLevel(db, account.id).catch(() => "suggestive" as const));
  const image = await generateCreatorPostImage({
    account,
    linkedPublicAccount,
    disclosureMode,
    postContent: brief,
    draftPrompt: [
      `A commissioned piece by ${account.displayName}, made to order for one fan.`,
      `The fan asked for this: ${brief}`,
      "Draw what they asked for. Keep the creator exactly as their card describes them.",
      slurpLevelPhoto(level),
    ].join("\n"),
    // The same image connection as every post; the level is the Creator's, under the Slurp-wide limit.
    negativePromptAdditions: slurpImageNegativePrompt(level),
    contentPolicy,
    settings,
    characters: createCharactersStorage(db),
    promptOverrides: createPromptOverridesStorage(db),
    imageConnection,
    db,
    debugMode: false,
    previewOnly: false,
  });
  const mediaPath = image.metadata.noodlerMediaPath;
  if (typeof mediaPath !== "string" || !image.stagedMedia) {
    image.stagedMedia?.compensate();
    return "unavailable";
  }
  return {
    mediaPath,
    promote: () => image.stagedMedia?.promote(),
    compensate: () => image.stagedMedia?.compensate(),
  };
}

/**
 * Draw the photo the player took and sends in a chat (R1-054). It is the player's photo, not the
 * Creator's work: the persona's own appearance, no Creator face, name or references, and the
 * Creator spends no energy. The Creator's image connection and style still draw it, as before.
 */
export async function generateSlurpViewerPhoto(
  db: DB,
  /** `personaId` null: Slurp Support's picture shows only the brief, nobody's appearance (0.3.6). */
  input: { creatorAccountId: string; personaId: string | null; brief: string },
): Promise<{ mediaPath: string; promote: () => void; compensate: () => void } | "unavailable"> {
  const noodle = createSlurpStorage(db);
  const connections = createConnectionsStorage(db);
  const account = await noodle.getNoodlerAccountById(input.creatorAccountId);
  if (!account) return "unavailable";
  const mappedId = await resolveCreatorImageConnectionId(db, account.id);
  const imageConnection =
    (mappedId ? await connections.getWithKey(mappedId) : null) ?? (await connections.getDefaultForImageGeneration());
  if (!imageConnection) return "unavailable";
  const characters = createCharactersStorage(db);
  const appearance = input.personaId ? ((await characters.getPersona(input.personaId))?.appearance?.trim() ?? "") : "";
  const brief = input.brief.trim().slice(0, 2000);
  const image = await generateCreatorPostImage({
    account,
    linkedPublicAccount: null,
    disclosureMode: "open",
    postContent: brief,
    draftPrompt: slurpViewerPhotoPrompt(brief, appearance),
    settings: await noodle.getSettings(),
    characters,
    promptOverrides: createPromptOverridesStorage(db),
    imageConnection,
    db,
    debugMode: false,
    previewOnly: false,
    suppressCharacterContext: true,
    suppressStageAppearance: true,
    suppressCreatorDetails: true,
    // The shared terms are for a Creator's own photo ("no second person"); the player's photo can
    // show anyone. Only the device stays out of it.
    negativePromptAdditions: "smartphone, holding phone, selfie stick, text, watermark",
    chargeEnergy: false,
  });
  const mediaPath = image.metadata.noodlerMediaPath;
  if (typeof mediaPath !== "string" || !image.stagedMedia) {
    image.stagedMedia?.compensate();
    return "unavailable";
  }
  return {
    mediaPath,
    promote: () => image.stagedMedia?.promote(),
    compensate: () => image.stagedMedia?.compensate(),
  };
}
