import type { SlpWardrobeScene } from "../../../../../shared/src/slp/slp-wardrobe.js";
import { stageImageToDisk } from "../../../services/image/image-generation.js";
import { NOODLER_MEDIA_PREFIX } from "../../base/media/slp-media.js";
import type { SlurpVisualBrief } from "../../base/media/slp-visual-brief.js";
import type { PreparedCreatorPostResult } from "./slp-generation-contract.js";

/** Assemble the scheduled/preview payload without letting generated media objects enter storage. */
export function prepareSlurpCreatorPost(input: {
  creatorAccountId: string;
  reusedMedia: { buffer: Buffer; extension: string } | null;
  title: string | null;
  content: string;
  imagePrompt: string | null;
  access: "public" | "locked";
  projectId: string | null;
  projectChapter: string | null;
  compiledPrompt: string;
  scene: SlpWardrobeScene | null;
  wardrobeSelection: PreparedCreatorPostResult["wardrobeSelection"];
  visualBrief: SlurpVisualBrief | null;
  providerPrompt: string | null;
  metadata: Record<string, unknown>;
  story: boolean;
}): PreparedCreatorPostResult {
  const stagedMedia = input.reusedMedia
    ? stageImageToDisk(
        `${NOODLER_MEDIA_PREFIX}${input.creatorAccountId}`,
        input.reusedMedia.buffer.toString("base64"),
        input.reusedMedia.extension,
      )
    : null;
  return {
    stagedMedia,
    title: input.title,
    content: input.content,
    imagePrompt: input.imagePrompt,
    access: input.access,
    projectId: input.projectId,
    projectChapter: input.projectChapter,
    compiledPrompt: input.compiledPrompt,
    scene: input.scene,
    wardrobeSelection: input.wardrobeSelection,
    visualBrief: input.visualBrief,
    imageBrief: input.imagePrompt,
    providerPrompt: input.providerPrompt,
    metadata: {
      ...input.metadata,
      ...(stagedMedia ? { noodlerMediaPath: stagedMedia.filePath } : {}),
      ...(input.story ? { noodlerPostType: "story" } : {}),
    },
  };
}
