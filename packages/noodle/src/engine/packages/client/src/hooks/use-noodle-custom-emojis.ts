import { useMemo } from "react";
import type { NoodleAccount } from "@marinara-engine/shared";
import { useCharacterGalleryImages, usePersonaGalleryImages } from "./use-characters";
import { useCustomEmojis } from "./use-custom-emojis";
import { mergeNoodleCustomEmojiMap } from "../lib/noodle-custom-emojis";

export function useNoodleCustomEmojiMap(account: NoodleAccount | null): Map<string, string> {
  const { data: globalEmojis } = useCustomEmojis();
  const { data: characterGallery } = useCharacterGalleryImages(account?.kind === "character" ? account.entityId : null);
  const { data: personaGallery } = usePersonaGalleryImages(account?.kind === "persona" ? account.entityId : null);

  return useMemo(
    () => mergeNoodleCustomEmojiMap(globalEmojis ?? [], [characterGallery ?? [], personaGallery ?? []]),
    [characterGallery, globalEmojis, personaGallery],
  );
}
