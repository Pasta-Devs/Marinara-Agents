import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { ConnectionAdmissionMode } from "../../../services/generation/connection-admission.js";
import type { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import type { SlpCreatorPostMediaUpload } from "../../base/media/slp-media.js";
import type {
  SlurpPromptBlockOverrides,
  SlurpReusablePromptInstruction,
} from "../../base/prompting/slp-prompt-blocks.js";
import type { FormattedCreatorGenerationRequest } from "./slp-post-prompt.js";
import type { SlpCreatorManagedPost } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlpWardrobeScene } from "../../../../../shared/src/slp/slp-wardrobe.js";
import type { SlurpVisualBrief } from "../../base/media/slp-visual-brief.js";
import type { StagedGalleryImage } from "../../../services/image/image-generation.js";
import type { SlpImagePromptReviewItem } from "../media/slp-media-contract.js";

export type GeneratedCreatorPostResult = {
  post: SlpCreatorManagedPost;
  imagePromptReview: SlpImagePromptReviewItem | null;
};

export type PreparedCreatorPostResult = {
  title: string | null;
  content: string;
  imagePrompt: string | null;
  access: "public" | "locked";
  projectId: string | null;
  projectChapter: string | null;
  metadata: Record<string, unknown>;
  compiledPrompt: string;
  scene: SlpWardrobeScene | null;
  wardrobeSelection: { selectedId: string | null; requestedId: string | null; fallback: boolean };
  visualBrief: SlurpVisualBrief | null;
  imageBrief: string | null;
  providerPrompt: string | null;
  stagedMedia?: StagedGalleryImage | null;
};

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

export type SlpCreatorPostGenerationInput = {
  account: SlpAccount;
  request: FormattedCreatorGenerationRequest;
  connection: GenerationConnection;
  media?: SlpCreatorPostMediaUpload;
  prepareOnly?: boolean;
  /** Scheduler-owned automatic runs pass background so they yield to user generation. */
  admissionMode?: ConnectionAdmissionMode;
  /** Clock captured by the caller so prompt construction and scheduling agree in tests and production. */
  generatedAt?: Date;
  /** Scheduled publication time. Omitted for posts generated for immediate publication. */
  publicationTime?: Date;
  /** False keeps the Story rotation out: "Create posts now" asks for feed posts, not Stories. */
  allowStory?: boolean;
  /** A slot held for a teased drop: the drop wins over the player's idea, which waits for the next slot (U). */
  heldDrop?: boolean;
  /** Preview calls use the supplied draft without changing saved settings. */
  promptBlocks?: SlurpPromptBlockOverrides;
  promptInstructions?: SlurpReusablePromptInstruction[];
  /** The scheduled slot this post fills, so its plan and its slot stay one record. */
  slotId?: string | null;
  /** Skip continuity writes when `prepareOnly` is used for a settings preview. */
  previewOnly?: boolean;
  skipImagePromptPreview?: boolean;
};
