import type { ChangeEvent, RefObject } from "react";
import type {
  NoodleAccount,
  NoodleAuthorSnapshot,
  NoodleInteraction,
  NoodleInteractionType,
  NoodlePollInput,
  NoodlePost,
  NoodlePostImageCrop,
  NoodleTextMention,
} from "@marinara-engine/shared";
import type {
  ConversationMediaPickerTabId,
} from "../../../components/chat/ConversationMediaPickerPanel";
import type { ChatImage } from "../../../hooks/use-gallery";

export type ReplyComposerTool = "image" | "media";
export type ActiveComposerMention = NoodleTextMention & { query: string };

/**
 * Reply image attach/upload/lightbox. Hosts that persist reply images pass this; hosts that
 * don't (NoodleR) omit it — the card then hides the attach-image tool, upload, GIF tab, and
 * lightbox instead of the host having to pass discarded setters and dangling refs.
 */
export interface NoodlePostCardMediaCap {
  setImageLightbox: React.Dispatch<React.SetStateAction<ChatImage | null>>;
  replyImageUrl: string;
  setReplyImageUrl: React.Dispatch<React.SetStateAction<string>>;
  replyImageUrlDraft: string;
  setReplyImageUrlDraft: React.Dispatch<React.SetStateAction<string>>;
  replyImageToolRef: RefObject<HTMLDivElement | null>;
  replyImageFileRef: RefObject<HTMLInputElement | null>;
  applyReplyImageUrl: () => void;
  uploadGlobalImages: { isPending: boolean };
}

/** Editing/deleting replies. Omit on hosts without a reply-management path (NoodleR). */
export interface NoodlePostCardReplyManagementCap {
  editingReplyId: string | null;
  editingReplyContent: string;
  setEditingReplyContent: React.Dispatch<React.SetStateAction<string>>;
  startEditingReply: (reply: NoodleInteraction) => void;
  cancelEditingReply: () => void;
  saveEditedReply: (post: NoodlePostCardModel, reply: NoodleInteraction) => void;
  deleteNoodleReply: (post: NoodlePostCardModel, reply: NoodleInteraction) => void;
  updateInteraction: { isPending: boolean };
  deleteInteraction: { isPending: boolean };
  /** Gate reply Edit/Delete. Omit for the default author-based check. */
  canManageReply?: (reply: NoodleInteraction) => boolean;
}

/** @mention autocomplete in the reply composer. Omit on hosts without mentions (NoodleR). */
export interface NoodlePostCardMentionsCap {
  activeReplyMention: ActiveComposerMention | null;
  activeReplyMentionIndex: number;
  replyMentionSuggestions: NoodleAccount[];
  selectReplyMention: (account: NoodleAccount) => void;
}

type NoodlePostCardAuthor = Pick<NoodleAuthorSnapshot, "id" | "handle" | "displayName" | "avatarUrl" | "avatarCrop">;
export type NoodlePostCardModel = Pick<
  NoodlePost,
  "id" | "authorAccountId" | "content" | "imageUrl" | "imagePrompt" | "metadata" | "createdAt" | "access"
> & {
  title: string | null;
  authorSnapshot: NoodlePostCardAuthor | null;
  interactions: NoodleInteraction[];
  /**
   * The platform total, where the caller has one. The rows carry the names; this carries the size.
   * Optional because a managed post inside the composer has no projection behind it.
   */
  likeCount?: number;
};

export interface NoodlePostCardTitleEditingCap {
  editingPostTitle: string;
  setEditingPostTitle: React.Dispatch<React.SetStateAction<string>>;
  maxLength: number;
}

export type NoodlePostImageUpdate =
  | { kind: "replace"; file: File; crop: NoodlePostImageCrop }
  | { kind: "crop"; crop: NoodlePostImageCrop }
  | { kind: "remove" };

export type NoodlePostImageCropSource =
  | {
      source: File | string;
      crop: NoodlePostImageCrop | null;
      mode: "existing";
    }
  | { source: File; crop: NoodlePostImageCrop | null; mode: "replace" };

export interface NoodlePostCardImageEditingCap {
  update: NoodlePostImageUpdate | null;
  cropSource: NoodlePostImageCropSource | null;
  loading: boolean;
  error: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  beginCrop: (post: NoodlePostCardModel) => void;
  selectReplacement: (event: ChangeEvent<HTMLInputElement>) => void;
  applyCrop: (crop: NoodlePostImageCrop) => Promise<void>;
  cancelCrop: () => void;
  remove: () => void;
  restore: () => void;
}

export interface NoodlePostCardCtx {
  accountById?: Map<string, NoodleAccount>;
  accountByHandle?: Map<string, NoodleAccount>;
  personaAccount: NoodleAccount | null;
  postMenuId: string | null;
  setPostMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  editingPostId: string | null;
  editingPostContent: string;
  setEditingPostContent: React.Dispatch<React.SetStateAction<string>>;
  replyPostId: string | null;
  replyParentInteractionId: string | null;
  replyText: string;
  replyHasText: boolean;
  setReplyText: React.Dispatch<React.SetStateAction<string>>;
  activeReplyComposerTool: ReplyComposerTool | null;
  setActiveReplyComposerTool: React.Dispatch<React.SetStateAction<ReplyComposerTool | null>>;
  highlightedInteractionId: string | null;
  mediaPickerTab: ConversationMediaPickerTabId;
  setMediaPickerTab: React.Dispatch<React.SetStateAction<ConversationMediaPickerTabId>>;
  replyComposerRef: RefObject<HTMLTextAreaElement | null>;
  replyValueRef: RefObject<string>;
  replyMediaToolRef: RefObject<HTMLDivElement | null>;
  startEditingPost: (post: NoodlePostCardModel) => void;
  deleteNoodlePost: (post: NoodlePostCardModel) => void;
  cancelEditingPost: () => void;
  saveEditedPost: (post: NoodlePostCardModel) => void;
  reactToPost: (post: NoodlePostCardModel, type: "like", active?: boolean) => void;
  reactToReply: (post: NoodlePostCardModel, target: NoodleInteraction, active: boolean) => void;
  openReplyComposer: (postId: string, parentInteractionId?: string | null) => void;
  handleReplyChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Reply composer keydown (mention nav / submit shortcuts). Omit on hosts without them. */
  handleReplyKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  clearReplyComposer: () => void;
  submitReply: (post: NoodlePostCardModel) => void;
  /** Present only when the host enables creatorReplyRequest. */
  creatorReplyRequest?: { asked: boolean; setAsked: (asked: boolean) => void };
  appendToReply: (text: string) => void;
  reactionPendingFor: (postId: string, type: "like", parentInteractionId?: string | null) => boolean;
  createInteractionPendingFor: (
    postId: string,
    type: NoodleInteractionType,
    parentInteractionId?: string | null,
  ) => boolean;
  updatePostPending: boolean;
  /** Human controller edit/delete capability. Viewer-only projections set this false. */
  postManagement: boolean;
  /** NoodleR title editing. Noodle posts omit this capability and remain titleless. */
  titleEditing?: NoodlePostCardTitleEditingCap;
  /** Existing-poll editing. Poll-less posts do not expose an add-poll path here. */
  pollEditing?: {
    value: NoodlePollInput | null;
    setValue: React.Dispatch<React.SetStateAction<NoodlePollInput | null>>;
  };
  /** Allow an empty edited body when the existing post has a poll. */
  allowPollOnlyEdits?: boolean;
  /** Navigate to an author/mention profile. Omit on hosts without profile navigation (NoodleR). */
  openProfile?: (account: NoodleAccount | null) => void;
  /** Navigate by NoodleR author ID when no Noodle account object exists. */
  openAuthorProfile?: (accountId: string) => void;
  /** Open the whole post in the media dialog. Absent → the image opens a plain lightbox. */
  openPost?: (postId: string) => void;
  /** Vote in a post's poll. Pollless posts never call it. */
  voteInPoll?: (post: NoodlePostCardModel, optionId: string, selectedOptionId: string | null) => void;
  /** Preserve the public timeline's legacy body/poll duplicate suppression. */
  deduplicatePollBody?: boolean;
  /** Post image crop, replacement, and removal capability. */
  imageEditing?: NoodlePostCardImageEditingCap;
  /** Generate a missing post image from its saved prompt. */
  generatePostImage?: (post: Pick<NoodlePostCardModel, "id" | "authorAccountId">, imagePrompt?: string) => void;
  generatingPostImageId?: string | null;
  /** Reply image/upload capability. Absent → the card hides all reply-image affordances. */
  media?: NoodlePostCardMediaCap;
  /**
   * Opening an image fullscreen is not the same capability as attaching one to a reply, so
   * hosts without the reply-image cap (NoodleR) still get a lightbox by passing this.
   */
  setImageLightbox?: React.Dispatch<React.SetStateAction<ChatImage | null>>;
  /** Reply edit/delete capability. Absent → reply management UI stays hidden. */
  replyManagement?: NoodlePostCardReplyManagementCap;
  /** @mention autocomplete capability. Absent → no mention suggestions. */
  mentions?: NoodlePostCardMentionsCap;
  /** Character limit for the Show more clamp in SlurpClampedText. Host reads from settings. */
  postShowMoreLength?: number;
}

export interface NoodlePostCardControllerOptions {
  postManagement: boolean;
  personaAccount: NoodleAccount | null;
  savePost: (
    post: NoodlePostCardModel,
    input: {
      title: string | null;
      content: string;
      image: NoodlePostImageUpdate | null;
      poll?: NoodlePollInput | null;
    },
  ) => Promise<void>;
  deletePost: (post: NoodlePostCardModel) => void;
  reactToPost: (post: NoodlePostCardModel, type: "like", active?: boolean) => void;
  reactToReply: (post: NoodlePostCardModel, target: NoodleInteraction, active: boolean) => void;
  submitReply: (
    post: NoodlePostCardModel,
    input: {
      content: string;
      parentInteractionId: string | null;
      askForReply: boolean;
    },
  ) => Promise<void>;
  /**
   * Show the "Ask for a reply" composer toggle. NoodleR Creators can answer a comment, and that
   * answer costs a provider request, so the player decides per comment instead of every comment
   * silently triggering one. Noodle omits this: its authors have no such reply operation.
   */
  creatorReplyRequest?: boolean;
  reactionPendingFor: (postId: string, type: "like", parentInteractionId?: string | null) => boolean;
  createInteractionPendingFor: (
    postId: string,
    type: NoodleInteractionType,
    parentInteractionId?: string | null,
  ) => boolean;
  updatePostPending: boolean;
  titleMaxLength?: number;
  allowPollOnlyEdits?: boolean;
  openAuthorProfile?: (accountId: string) => void;
  voteInPoll?: (post: NoodlePostCardModel, optionId: string, selectedOptionId: string | null) => void;
  deduplicatePollBody?: boolean;
  imageEditing?: {
    loadPostImage: (post: NoodlePostCardModel) => Promise<File | string>;
  };
}
