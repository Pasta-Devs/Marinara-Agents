import { copyFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { extname, join } from "node:path";
import { logger } from "../../lib/logger.js";
import { newId } from "../../utils/id-generator.js";
import { DATA_DIR } from "../../utils/data-dir.js";
import { assertInsideDir } from "../../utils/security.js";
import type { CreateCharacterImageInput } from "../storage/character-gallery.storage.js";
import type { CreatePersonaImageInput } from "../storage/persona-gallery.storage.js";

type CharacterGalleryStore = {
  create(input: CreateCharacterImageInput): Promise<unknown>;
};
type PersonaGalleryStore = {
  create(input: CreatePersonaImageInput): Promise<unknown>;
};

export type GeneratedImageEntityGalleryInput = {
  sourceFilePath: string;
  characterIds?: string[];
  personaIds?: string[];
  characterGallery: CharacterGalleryStore;
  personaGallery: PersonaGalleryStore;
  prompt: string;
  provider: string;
  model: string;
  width: number;
  height: number;
  /** Test-only filesystem override. */
  galleryRoot?: string;
};

function safeEntityIds(ids: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (ids ?? []).filter(
        (id) => id.length > 0 && id !== "." && id !== ".." && !id.includes("/") && !id.includes("\\"),
      ),
    ),
  );
}

/**
 * Copy one chat-gallery image into every explicitly depicted character/persona
 * gallery. Each destination owns its copy, so deleting one gallery item cannot
 * break the chat attachment or another entity's gallery.
 */
export async function persistGeneratedImageToEntityGalleries(
  input: GeneratedImageEntityGalleryInput,
): Promise<{ characterCount: number; personaCount: number }> {
  const galleryRoot = input.galleryRoot ?? join(DATA_DIR, "gallery");
  const sourcePath = assertInsideDir(galleryRoot, join(galleryRoot, input.sourceFilePath));
  if (!existsSync(sourcePath)) {
    logger.warn("[image-gallery] Generated source image is missing: %s", input.sourceFilePath);
    return { characterCount: 0, personaCount: 0 };
  }

  const extension = extname(sourcePath).toLowerCase() || ".png";
  const metadata = {
    prompt: input.prompt,
    provider: input.provider,
    model: input.model,
    width: input.width,
    height: input.height,
  };

  const persistOne = async (
    kind: "characters" | "personas",
    entityId: string,
    createMetadata: (filePath: string) => Promise<unknown>,
  ): Promise<boolean> => {
    const entityDir = assertInsideDir(galleryRoot, join(galleryRoot, kind, entityId));
    if (!existsSync(entityDir)) mkdirSync(entityDir, { recursive: true });
    const filename = `${newId()}${extension}`;
    const destinationPath = assertInsideDir(entityDir, join(entityDir, filename));
    const temporaryPath = assertInsideDir(entityDir, `${destinationPath}.${process.pid}.${Date.now()}.tmp`);
    try {
      copyFileSync(sourcePath, temporaryPath);
      renameSync(temporaryPath, destinationPath);
      const created = await createMetadata(`${kind}/${entityId}/${filename}`);
      if (!created) throw new Error("Gallery metadata row was not created");
      return true;
    } catch (error) {
      try {
        if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
        if (existsSync(destinationPath)) unlinkSync(destinationPath);
      } catch {
        /* best-effort cleanup */
      }
      logger.warn(error, "[image-gallery] Could not save generated image for %s %s", kind, entityId);
      return false;
    }
  };

  let characterCount = 0;
  for (const characterId of safeEntityIds(input.characterIds)) {
    if (
      await persistOne("characters", characterId, (filePath) =>
        input.characterGallery.create({ characterId, filePath, ...metadata }),
      )
    ) {
      characterCount += 1;
    }
  }
  let personaCount = 0;
  for (const personaId of safeEntityIds(input.personaIds)) {
    if (
      await persistOne("personas", personaId, (filePath) =>
        input.personaGallery.create({ personaId, filePath, ...metadata }),
      )
    ) {
      personaCount += 1;
    }
  }
  return { characterCount, personaCount };
}
