import { basename } from "path";
import { type APIProvider } from "@marinara-engine/shared";
import { type SlpAccount, type SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import { logger, logDebugOverride } from "../../../lib/logger.js";
import { clampGenerationMaxOutputTokens } from "../../../services/generation/output-token-limits.js";
import { noodleSamplingOptions } from "../../base/prompting/slp-sampling-options.js";
import {
  resolveStoredChatOptions,
  resolveStoredMaxTokens,
} from "../../../services/generation/generation-parameters.js";
import { parseGameJsonish } from "../../../services/game/jsonish.js";
import { modelAnswerForCorrection, requireModelAnswer } from "../../base/model/slp-model-answer.js";
import type { BaseLLMProvider, ChatMessage } from "../../../services/llm/base-provider.js";
import { createCharacterGalleryStorage } from "../../../services/storage/character-gallery.storage.js";
import { createCharactersStorage } from "../../../services/storage/characters.storage.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { parseNoodleGeneratedProfiles } from "../../modules/creators/slp-generated-profiles.js";
import { allocateAmbientProfileHandles } from "../audience/slp-audience-contract.js";
import { noodleAccountsNeedingProfiles } from "../../modules/creators/slp-profile-selection.js";
import { normalizeNoodleHandle } from "../../base/identity/slp-handle.js";
import { NOODLE_ADULT_PLATFORM_POLICY } from "../../modules/prompting/slp-prompt.js";
import { NOODLE_JSON_OUTPUT_HEADING, noodleResponseFormat } from "../../base/prompting/slp-response-format.js";
import {
  characterContextFromRow,
  escapePromptAttribute,
  generatedProfileSettings,
  parseRecord,
} from "../../modules/creators/slp-public-support.js";
import { composeSlurpPromptBlocks, type SlurpPromptBlockOverrides } from "../../base/prompting/slp-prompt-blocks.js";

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

export async function pickRandomCharacterBannerUrl(
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>,
  characterId: string,
) {
  const images = await characterGallery.listByCharacterId(characterId);
  const image = images.length > 0 ? shuffle(images)[0] : null;
  if (!image) return null;
  const filename = basename(image.filePath.replace(/\\/g, "/"));
  return `/api/characters/${encodeURIComponent(characterId)}/gallery/file/${encodeURIComponent(filename)}`;
}

/**
 * Only OPEN inherits the literal source photo. Hinted and secret create new artwork instead:
 * hinted may use appearance references, while secret receives only redacted appearance text.
 */
export async function resolveNoodlerCreatorArtwork(input: {
  characters: ReturnType<typeof createCharactersStorage>;
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>;
  publicAccount: Pick<SlpAccount, "kind" | "entityId" | "avatarUrl">;
  disclosureMode: SlpIdentityDisclosure;
}): Promise<{ avatarUrl: string | null; bannerUrl: string | null }> {
  if (input.disclosureMode !== "open") return { avatarUrl: null, bannerUrl: null };
  if (input.publicAccount.kind !== "character") {
    return { avatarUrl: input.publicAccount.avatarUrl ?? null, bannerUrl: null };
  }
  const row = await input.characters.getById(input.publicAccount.entityId);
  return {
    // The Noodle account rarely carries its own avatar, so the character row is the real source.
    avatarUrl: input.publicAccount.avatarUrl ?? row?.avatarPath ?? null,
    bannerUrl: await pickRandomCharacterBannerUrl(input.characterGallery, input.publicAccount.entityId),
  };
}

function profileSetupMaxTokens(characterCount: number) {
  return 1024 + Math.max(0, characterCount) * 1024;
}

export function buildNoodleProfileTargetBlock(
  account: Pick<SlpAccount, "entityId" | "displayName" | "handle">,
  row: { id: string; data: unknown },
) {
  return [
    `<profile_target entityId="${escapePromptAttribute(account.entityId)}" currentName="${escapePromptAttribute(
      account.displayName,
    )}" currentHandle="${escapePromptAttribute(account.handle)}">`,
    characterContextFromRow(row),
    `</profile_target>`,
  ].join("\n");
}

export async function generateMissingNoodleProfiles(input: {
  noodle: ReturnType<typeof createSlurpStorage>;
  characters: ReturnType<typeof createCharactersStorage>;
  characterGallery: ReturnType<typeof createCharacterGalleryStorage>;
  accounts: SlpAccount[];
  provider: BaseLLMProvider;
  connection: {
    provider: string;
    model: string;
    maxTokensOverride?: number | null;
    defaultParameters?: unknown;
  };
  debugMode: boolean;
  promptBlocks?: SlurpPromptBlockOverrides;
}) {
  const targets: Array<{
    account: SlpAccount;
    row: { id: string; data: unknown; avatarPath?: string | null };
    bannerUrl: string | null;
  }> = [];
  for (const account of noodleAccountsNeedingProfiles(input.accounts)) {
    const row = await input.characters.getById(account.entityId);
    if (!row) continue;
    const bannerUrl = await pickRandomCharacterBannerUrl(input.characterGallery, account.entityId);
    targets.push({ account, row, bannerUrl });
  }
  if (targets.length === 0) return;

  const characterBlocks = targets.map(({ account, row }) => buildNoodleProfileTargetBlock(account, row)).join("\n\n");
  const outputFormat = [
    NOODLE_JSON_OUTPUT_HEADING,
    JSON.stringify(
      {
        profiles: [
          {
            entityId: "exact entityId from profile_target",
            name: "display name for the social profile",
            handle: "short @nickname without @, lowercase letters/numbers/underscores preferred",
            bio: "short in-character social media bio",
            location: "short profile location, fictional or canonical if known",
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: composeSlurpPromptBlocks(
        "ambientProfile",
        [
          {
            id: "task",
            kind: "editable",
            text: "You set up fake Slurp social media profiles for existing Marinara Engine characters.",
          },
          {
            id: "profileRules",
            kind: "editable",
            text: "Create concise profile metadata only. Do not write posts, replies, likes, or timeline content.",
          },
          { id: "output", kind: "required", text: "Return JSON only. No prose outside the JSON object." },
          {
            id: "profiles",
            kind: "context",
            text: `${NOODLE_ADULT_PLATFORM_POLICY}\nUse each character's personality, setting, and appearance to make the profile feel natural and in character.`,
          },
        ],
        input.promptBlocks,
      ),
    },
    {
      role: "user",
      content: ["# Characters Needing Slurp Profiles", characterBlocks, "", outputFormat].join("\n"),
    },
  ];
  const promptForLog = messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n");
  logDebugOverride(input.debugMode, "[debug/slurp] Profile prompt sent to model:\n%s", promptForLog);
  const maxTokens = clampGenerationMaxOutputTokens({
    provider: input.connection.provider as APIProvider,
    model: input.connection.model,
    maxTokens: resolveStoredMaxTokens(input.connection.defaultParameters, profileSetupMaxTokens(targets.length)),
    maxTokensOverride: input.connection.maxTokensOverride,
  });
  const completionOptions = {
    model: input.connection.model,
    maxTokens,
    ...noodleSamplingOptions(
      resolveStoredChatOptions(input.connection.defaultParameters, input.connection.provider, input.connection.model),
      { temperature: 0.55, topP: 0.9 },
    ),
    stream: false,
    debugMode: input.debugMode,
    responseFormat: noodleResponseFormat(input.connection.model, "profiles"),
  } as const;
  const result = await input.provider.chatComplete(messages, completionOptions);
  let generated: ReturnType<typeof parseNoodleGeneratedProfiles>;
  try {
    generated = parseNoodleGeneratedProfiles(
      parseGameJsonish(requireModelAnswer(result.content ?? "", "public profiles")),
    );
  } catch (error) {
    logger.warn(error, "[slurp] Profile generation returned an unusable response; retrying once");
    generated = { profiles: [], rejected: [] };
  }
  if (generated.profiles.length === 0 && targets.length > 0) {
    logger.warn("[slurp] Profile generation returned no usable profiles; retrying once");
    const retry = await input.provider.chatComplete(
      [
        ...messages,
        ...(modelAnswerForCorrection(result.content)
          ? [{ role: "assistant" as const, content: modelAnswerForCorrection(result.content)! }]
          : []),
        {
          role: "user",
          content: `The previous response contained no usable profiles. Return exactly one valid profile for every requested entityId. Use the requested JSON profile schema. Return JSON only.`,
        },
      ],
      completionOptions,
    );
    generated = parseNoodleGeneratedProfiles(
      parseGameJsonish(requireModelAnswer(retry.content ?? "", "public profiles")),
    );
  }
  if (generated.profiles.length === 0) {
    throw new Error("Profile generation returned no usable profiles after correction.");
  }
  if (generated.rejected.length > 0) {
    logger.warn(
      "[slurp] Skipped %d invalid generated profile row(s); valid profiles will still be applied",
      generated.rejected.length,
    );
  }
  const profileByEntityId = new Map(generated.profiles.map((profile) => [profile.entityId, profile]));
  const allocatedHandles = allocateAmbientProfileHandles(
    targets.map(({ account }) => account),
    profileByEntityId,
    (await input.noodle.listAccounts({ includeHidden: true })).map((account) => account.handle),
  );
  for (const target of targets) {
    const profile = profileByEntityId.get(target.account.entityId);
    if (!profile) continue;
    await input.noodle.updateAccountProfile(target.account.id, {
      handle: allocatedHandles.get(target.account.id) ?? normalizeNoodleHandle(target.account.handle),
      displayName: profile.name,
      bio: profile.bio,
      avatarUrl: target.row.avatarPath ?? target.account.avatarUrl,
      profile: generatedProfileSettings(profile.location, target.bannerUrl),
    });
  }
}
