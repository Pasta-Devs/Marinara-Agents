// Split from noodle-noodler-source.ts so the identity-minimization helpers stay a
// pure module that regressions can import without an Engine database.
import type {
  SlpAccount,
  SlpCreatorSourceSnapshot,
  SlpIdentityDisclosure,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { createHash } from "node:crypto";
import { slpCreatorReservePolicyFingerprint } from "../../modules/records/slp-storage-model.js";
import type { DB } from "../../../db/connection.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { parseRecord } from "../../modules/creators/slp-public-support.js";
import { slpCreatorCharacterCanonText } from "../../base/prompting/slp-prompt-safety.js";
import {
  slurpAudienceCharacterVoice,
  slurpCharacterIdFromFanEntityId,
} from "../../../../../shared/src/slp/slp-audience-characters.js";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * How an invited character writes, for a direct-message prompt.
 *
 * A generated audience member gets its voice from its Fan Type. An invited character is the whole
 * point of being invited, so its own card supplies the voice instead — the same text and the same
 * budget the fan-activity cast already uses, so a character sounds the same in a DM as in a comment.
 *
 * Returns undefined for anybody who is not an invited character, or whose card is gone, which
 * leaves the existing Fan Type voice in place rather than describing nobody.
 */
export async function resolveSlurpCharacterFanVoice(
  db: DB,
  entityId: string | null | undefined,
  voiceBudget: number,
): Promise<string | undefined> {
  const characterId = slurpCharacterIdFromFanEntityId(entityId);
  if (!characterId) return undefined;
  const card = await createCharactersStorage(db)
    .getById(characterId)
    .catch(() => null);
  return slurpAudienceCharacterVoice(card, voiceBudget);
}

export async function resolveCreatorCharacterCanon(
  db: DB,
  publicAccount: Pick<SlpAccount, "kind" | "entityId"> | null,
  disclosureMode: SlpIdentityDisclosure,
): Promise<string> {
  if (!publicAccount) return "";
  const characters = createCharactersStorage(db);
  if (publicAccount.kind === "character") {
    const source = await characters.getById(publicAccount.entityId);
    return source ? slpCreatorCharacterCanonText(source.data, disclosureMode === "open") : "";
  }
  if (publicAccount.kind === "persona") {
    const source = await characters.getPersona(publicAccount.entityId);
    return source
      ? slpCreatorCharacterCanonText(
          {
            name: source.name,
            description: source.description,
            personality: source.personality,
            scenario: source.scenario,
            appearance: source.appearance,
            backstory: source.backstory,
          },
          disclosureMode === "open",
        )
      : "";
  }
  return "";
}

export async function resolveCreatorSourceSnapshot(
  db: DB,
  publicAccount: Pick<SlpAccount, "kind" | "entityId" | "displayName" | "handle">,
): Promise<SlpCreatorSourceSnapshot | null> {
  const characters = createCharactersStorage(db);
  if (publicAccount.kind === "character") {
    const source = await characters.getById(publicAccount.entityId);
    if (!source) return null;
    const data = parseRecord(source.data);
    const extensions = parseRecord(data.extensions);
    return {
      publicDisplayName: publicAccount.displayName,
      publicHandle: publicAccount.handle,
      name: text(data.name),
      description: text(data.description),
      personality: text(data.personality),
      scenario: text(data.scenario),
      appearance: text(data.appearance) || text(extensions.appearance),
      backstory: text(data.backstory) || text(extensions.backstory),
    };
  }
  if (publicAccount.kind === "persona") {
    const source = await characters.getPersona(publicAccount.entityId);
    if (!source) return null;
    return {
      publicDisplayName: publicAccount.displayName,
      publicHandle: publicAccount.handle,
      name: text(source.name),
      description: text(source.description),
      personality: text(source.personality),
      scenario: text(source.scenario),
      appearance: text(source.appearance),
      backstory: text(source.backstory),
    };
  }
  return null;
}

/**
 * A hash of what a prepared post was written from: the card as a post reads it and the
 * Conversation Schedule. The source row's `updatedAt` could not serve: the Engine bumps it on every
 * conversation status change, so posts were rewritten for edits that never happened.
 */
export async function resolveCreatorSourceContentHash(
  db: DB,
  publicAccount: Pick<SlpAccount, "kind" | "entityId"> | null,
  disclosureMode: SlpIdentityDisclosure,
): Promise<string | null> {
  if (!publicAccount) return null;
  const canon = await resolveCreatorCharacterCanon(db, publicAccount, disclosureMode);
  const character =
    publicAccount.kind === "character" ? await createCharactersStorage(db).getById(publicAccount.entityId) : null;
  const schedule = character
    ? (parseRecord(parseRecord(character.data).extensions).conversationSchedule ?? null)
    : null;
  return createHash("sha256")
    .update(`${canon}\n${JSON.stringify(schedule)}`)
    .digest("hex");
}

/** The reserve fingerprint for a slot, with the content hash staleness is judged on. */
export async function slpCreatorReserveFingerprintFor(
  db: DB,
  account: Parameters<typeof slpCreatorReservePolicyFingerprint>[0],
  settings: Parameters<typeof slpCreatorReservePolicyFingerprint>[1],
  source: (Pick<SlpAccount, "kind" | "entityId"> & { updatedAt?: string | null }) | null,
): Promise<string> {
  const contentHash = await resolveCreatorSourceContentHash(
    db,
    source,
    account.settings.privacy.identityDisclosure ?? "open",
  ).catch(() => null);
  return slpCreatorReservePolicyFingerprint(account, settings, source?.updatedAt ?? null, contentHash);
}
