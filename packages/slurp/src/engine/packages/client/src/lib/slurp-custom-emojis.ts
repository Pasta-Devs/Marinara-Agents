type NamedEmoji = {
  name: string;
  url: string;
};

type NoodleEmojiGalleryImage = {
  customKind?: string | null;
  customName?: string | null;
  url: string;
};

export function mergeNoodleCustomEmojiMap(
  globalEmojis: readonly NamedEmoji[],
  galleries: readonly (readonly NoodleEmojiGalleryImage[])[],
): Map<string, string> {
  const byName = new Map(globalEmojis.map((emoji) => [emoji.name, emoji.url] as const));
  for (const gallery of galleries) {
    for (const image of gallery) {
      if (image.customKind === "emoji" && image.customName) byName.set(image.customName, image.url);
    }
  }
  return byName;
}
