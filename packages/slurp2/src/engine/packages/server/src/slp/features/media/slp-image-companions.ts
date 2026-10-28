import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { DB } from "../../../db/connection.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import { resolveIllustratorCharacterReferences } from "../../../services/image/illustrator-references.js";

/** Another Creator the post is about (a partner, a collab), with the card behind their page. */
export type SlurpImageCompanion = { account: SlpAccount; source: SlpAccount | null };

/** The Creators a post's beat names, as picture companions. The author and unknown ids drop out. */
export async function resolveSlurpImageCompanions(
  db: DB,
  ids: unknown,
  authorId: string,
): Promise<SlurpImageCompanion[]> {
  const noodle = createSlurpStorage(db);
  const companions: SlurpImageCompanion[] = [];
  for (const id of new Set(Array.isArray(ids) ? ids : [])) {
    if (typeof id !== "string" || id === authorId) continue;
    const account = await noodle.getNoodlerAccountById(id);
    if (account) companions.push({ account, source: await noodle.resolveAccountSource(account) });
  }
  return companions;
}

/** A companion as the picture prompt sees them: page name, known card name, look, card picture. */
export type SlurpImageCompanionCard = {
  name: string;
  known: string;
  look: string;
  card: { id: string; avatarPath: string | null; appearance: string } | null;
};

/**
 * A companion in the picture brings their card picture, after the Creator's own (at most 6). Only the
 * ones Slurp found in the scene, the same ones that get a look and lift the one-person rule, and asked
 * for by name (0.3.47, player report): the Engine's own prompt match misses a tag-order name
 * ("ryuuzaki umi" for "Umi Ryuuzaki").
 */
export async function slurpCompanionReferenceImages(
  characters: Parameters<typeof resolveIllustratorCharacterReferences>[0]["charactersStore"],
  inPicture: readonly SlurpImageCompanionCard[],
  prompt: string,
  own: string[],
): Promise<string[]> {
  const refs = inPicture.filter((companion) => companion.card);
  if (refs.length === 0) return own;
  const resolution = await resolveIllustratorCharacterReferences({
    charactersStore: characters,
    chatCharacters: refs.map((companion) => ({ name: companion.name, ...companion.card! })),
    persona: null,
    requestedNames: refs.map((companion) => companion.name),
    promptText: prompt,
    maxReferences: 6,
  });
  const named = new Set(refs.map((companion) => companion.name));
  const extra = resolution.referenceImages.filter((_, index) => named.has(resolution.referenceNames[index] ?? ""));
  return Array.from(new Set([...own, ...extra])).slice(0, 6);
}
