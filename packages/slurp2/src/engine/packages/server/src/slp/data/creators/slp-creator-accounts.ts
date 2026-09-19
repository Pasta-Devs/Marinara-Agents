import { PROFESSOR_MARI_ID } from "@marinara-engine/shared";
import { type SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createSlurpStorage, type SlurpBootstrap } from "../slp-storage.js";
import { parseSlpAvatarCrop } from "../../modules/records/slp-storage-model.js";
import { type SlurpSettings } from "../../modules/settings/slp-settings.js";
import { isSlpProfileGenerated } from "../../modules/creators/slp-profile-selection.js";
import { ensureAmbientNoodleAccounts } from "../audience/slp-ambient-profiles.js";
import {
  characterAvatarCrop,
  characterNameFromRow,
  generatedProfileSettings,
} from "../../modules/creators/slp-public-support.js";

const PROFESSOR_MARI_SLP_BIO =
  "She/Her | 18+ | Skill Issue | Your Assistant After Hours (hey, I get to do fun stuff, too!) | Simp for Il Dottore 24/7 | LLMs Fan";

export async function ensureProfessorMariAccount(
  noodle: ReturnType<typeof createSlurpStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
) {
  const row = await characters.getById(PROFESSOR_MARI_ID);
  const account = await noodle.upsertAccountFromProfile({
    kind: "character",
    entityId: PROFESSOR_MARI_ID,
    displayName: row ? characterNameFromRow(row) : "Professor Mari",
    avatarUrl: row?.avatarPath ?? "/sprites/mari/Mari_profile.png",
    avatarCrop: row ? characterAvatarCrop(row) : null,
    bio: PROFESSOR_MARI_SLP_BIO,
    invited: true,
    syncIdentity: true,
  });
  if (
    account.settings.profile.profileManuallyEdited !== true &&
    (account.bio !== PROFESSOR_MARI_SLP_BIO || !isSlpProfileGenerated(account) || !account.settings.profile.location)
  ) {
    await noodle.updateAccountProfile(account.id, {
      handle: account.handle || "professor_mari",
      displayName: account.displayName || "Professor Mari",
      bio: PROFESSOR_MARI_SLP_BIO,
      avatarUrl: account.avatarUrl || row?.avatarPath || "/sprites/mari/Mari_profile.png",
      profile: generatedProfileSettings("Marinara Engine", null),
    });
  }
}

export async function ensurePersonaAccounts(
  noodle: ReturnType<typeof createSlurpStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
) {
  const personas = await characters.listPersonas();
  const livePersonaIds = new Set<string>();
  for (const persona of personas) {
    livePersonaIds.add(persona.id);
    await noodle.upsertAccountFromProfile({
      kind: "persona",
      entityId: persona.id,
      displayName: persona.convoDisplayName || persona.name || "User",
      avatarUrl: persona.avatarPath ?? null,
      avatarCrop: parseSlpAvatarCrop(persona.avatarCrop),
      bio: persona.aboutMe || persona.description || "",
      invited: true,
    });
  }
  const retiredPersonaIds = new Set(
    (await noodle.listAccounts())
      .filter((account) => account.kind === "persona" && !livePersonaIds.has(account.entityId))
      .map((account) => account.entityId),
  );
  for (const personaId of retiredPersonaIds) await noodle.cleanupRetiredViewer(personaId);
  return livePersonaIds;
}

function filterStalePersonaAccounts(bootstrap: SlurpBootstrap, livePersonaIds: Set<string>): SlurpBootstrap {
  return {
    ...bootstrap,
    accounts: bootstrap.accounts.filter(
      (account) => account.kind !== "persona" || livePersonaIds.has(account.entityId),
    ),
  };
}

function filterExcludedSlpAccounts(bootstrap: SlurpBootstrap, settings: SlurpSettings): SlurpBootstrap {
  if (settings.allowProfessorMari) return bootstrap;
  return {
    ...bootstrap,
    accounts: bootstrap.accounts.filter(
      (account) => account.kind !== "character" || account.entityId !== PROFESSOR_MARI_ID,
    ),
  };
}

export async function bootstrapVisibleSlp(
  noodle: ReturnType<typeof createSlurpStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
) {
  const settings = await noodle.getSettings();
  const livePersonaIds = await ensurePersonaAccounts(noodle, characters);
  await ensureAmbientNoodleAccounts(noodle, settings.allowRandomUsers);
  if (settings.allowProfessorMari) await ensureProfessorMariAccount(noodle, characters);
  const existingCharacterAccounts = (await noodle.listAccounts()).filter(
    (account) => account.kind === "character" && account.entityId !== PROFESSOR_MARI_ID,
  );
  const characterRowsById = new Map((await characters.list()).map((row) => [row.id, row]));
  for (const account of existingCharacterAccounts) {
    const row = characterRowsById.get(account.entityId);
    if (!row) {
      // Keep the Slurp Creator and its published state. Storage marks the source as missing,
      // which pauses source-dependent generation and automatic posting.
      continue;
    }
    await noodle.upsertAccountFromProfile({
      kind: "character",
      entityId: row.id,
      displayName: characterNameFromRow(row),
      avatarUrl: row.avatarPath ?? null,
      avatarCrop: characterAvatarCrop(row),
      syncIdentity: true,
    });
  }
  return filterExcludedSlpAccounts(filterStalePersonaAccounts(await noodle.bootstrap(), livePersonaIds), settings);
}

export async function resolvePersonaAccount(
  noodle: ReturnType<typeof createSlurpStorage>,
  characters: ReturnType<typeof createCharactersStorage>,
  personaId?: string,
) {
  const personas = await characters.listPersonas();
  const persona =
    personas.find((p) => p.id === personaId) ?? personas.find((p) => p.isActive === "true") ?? personas[0];
  if (!persona) return null;
  return noodle.upsertAccountFromProfile({
    kind: "persona",
    entityId: persona.id,
    displayName: persona.convoDisplayName || persona.name || "User",
    avatarUrl: persona.avatarPath ?? null,
    avatarCrop: parseSlpAvatarCrop(persona.avatarCrop),
    bio: persona.aboutMe || persona.description || "",
    invited: true,
  });
}

/**
 * Drops character accounts whose character card no longer exists.
 *
 * A Noodle account stores its own name and handle, so a stale account keeps rendering in the
 * "Active Noodle Accounts" list while `characters.getById` returns null for it. The refresh prompt
 * then carries the name with no character card, and the lorebook scan is scoped to a character ID
 * that cannot match anything — every character and lore detail silently disappears from generation
 * with no error. Accounts are left in place (posts still reference them); they are only skipped
 * when choosing who takes part in a refresh.
 *
 * Accounts go stale whenever a character's row stops matching the stored entityId: deleting the
 * character (`characters.remove` does not touch slurp2_accounts, and there is no cascade), or any
 * re-create path that mints a fresh ID, such as a profile import (`characters.create` calls newId).
 */
export async function filterResolvableSlpParticipants(
  accounts: SlpAccount[],
  characters: ReturnType<typeof createCharactersStorage>,
): Promise<{ resolvable: SlpAccount[]; staleAccounts: SlpAccount[] }> {
  const resolvable: SlpAccount[] = [];
  const staleAccounts: SlpAccount[] = [];
  const hasCharacterAccount = accounts.some((account) => account.kind === "character");
  const liveCharacterIds = hasCharacterAccount
    ? new Set((await characters.list()).map((row) => row.id))
    : new Set<string>();
  for (const account of accounts) {
    if (account.kind !== "character") {
      resolvable.push(account);
      continue;
    }
    if (liveCharacterIds.has(account.entityId)) resolvable.push(account);
    else staleAccounts.push(account);
  }
  return { resolvable, staleAccounts };
}
