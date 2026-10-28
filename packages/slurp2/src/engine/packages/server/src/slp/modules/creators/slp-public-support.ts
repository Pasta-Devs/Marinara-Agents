import { extractSlpMentionHandles } from "../../../../../shared/src/slp/slp-mentions.js";
import {
  type SlpAccount,
  type SlpAccountProfileSettings,
  type SlpInteractionType,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { basename } from "path";
import { parseSlpAvatarCrop } from "../records/slp-storage-model.js";
import { normalizeSlpHandle } from "../../base/identity/slp-handle.js";

export function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return parseRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
      : [];
  } catch {
    return [];
  }
}

export {
  characterContextFromRow,
  escapePromptAttribute,
  escapePromptText,
  slpCreatorCharacterCanonText,
} from "../../base/prompting/slp-prompt-safety.js";

export function galleryImageUrl(filePath: string, fallbackChatId: string) {
  const filename = basename(filePath.replace(/\\/g, "/"));
  return `/api/gallery/file/${encodeURIComponent(fallbackChatId)}/${encodeURIComponent(filename)}`;
}

export function characterGalleryImageUrl(characterId: string, filePath: string) {
  const filename = basename(filePath.replace(/\\/g, "/"));
  return `/api/characters/${encodeURIComponent(characterId)}/gallery/file/${encodeURIComponent(filename)}`;
}

export function sinceHoursIso(hours: number) {
  return new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000).toISOString();
}

export function characterAvatarCrop(row: { data: unknown }) {
  return parseSlpAvatarCrop(parseRecord(parseRecord(row.data).extensions).avatarCrop);
}

export function characterNameFromRow(row: { data: unknown } | null | undefined) {
  const data = parseRecord(row?.data);
  return typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Character";
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function mentionedCharacterAccounts(accounts: SlpAccount[], content: string): SlpAccount[] {
  const mentionedHandles = new Set(extractSlpMentionHandles(content).map(normalizeSlpHandle));
  if (mentionedHandles.size === 0) return [];
  return accounts.filter(
    (account) => account.kind === "character" && mentionedHandles.has(normalizeSlpHandle(account.handle)),
  );
}

export function mentionedAccountMetadata(accounts: SlpAccount[]) {
  return {
    mentionedAccountIds: accounts.map((account) => account.id),
    mentionedEntityIds: accounts.map((account) => account.entityId),
  };
}

export function generatedProfileSettings(location: string, bannerUrl: string | null): SlpAccountProfileSettings {
  return {
    profileGenerated: true,
    location,
    bannerUrl: bannerUrl ?? "",
  };
}

export function interactionDigestVerb(type: SlpInteractionType) {
  if (type === "reply") return "replied on";
  if (type === "vote") return "voted in";
  return "liked";
}

export function noodleDigestAccountLabel(account: Pick<SlpAccount, "kind" | "displayName" | "handle">) {
  const identity = `${account.displayName} (@${account.handle})`;
  return account.kind === "persona" ? `Persona ${identity}` : identity;
}
