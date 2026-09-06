import type { DB } from "../../db/connection.js";
import { createCharactersStorage } from "../storage/characters.storage.js";
import { createConnectionsStorage } from "../storage/connections.storage.js";
import { createPromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { createSlurpStorage } from "../storage/slurp.storage.js";
import { generateNoodlerPostImage } from "./slurp-images.service.js";
import { resolveNoodlerImageConnectionId } from "./slurp-image-connections.js";

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
  input: { creatorAccountId: string; brief: string },
): Promise<{ mediaPath: string; promote: () => void; compensate: () => void } | "unavailable"> {
  const noodle = createSlurpStorage(db);
  const connections = createConnectionsStorage(db);
  const account = await noodle.getNoodlerAccountById(input.creatorAccountId);
  if (!account) return "unavailable";
  const mappedId = await resolveNoodlerImageConnectionId(db, account.id);
  const imageConnection =
    (mappedId ? await connections.getWithKey(mappedId) : null) ?? (await connections.getDefaultForImageGeneration());
  if (!imageConnection) return "unavailable";

  const linkedPublicAccount = await noodle.resolveAccountSource(account);
  const disclosureMode = account.settings.privacy.identityDisclosure ?? "hinted";
  const settings = await noodle.getSettings();
  const brief = input.brief.trim().slice(0, 2000);
  const image = await generateNoodlerPostImage({
    account,
    linkedPublicAccount,
    disclosureMode,
    postContent: brief,
    draftPrompt: [
      `A commissioned piece by ${account.displayName}, made to order for one fan.`,
      `The fan asked for this: ${brief}`,
      "Draw what they asked for. Keep the creator exactly as their card describes them.",
    ].join("\n"),
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
