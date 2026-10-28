import type { ChangeEvent, ReactNode, RefObject } from "react";
import type { SlpTextMention } from "../../../../../shared/src/slp/slp-mentions.js";
import type { SlpPollInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type {
  SlpAccount,
  SlpAuthorSnapshot,
  SlpInteraction,
  SlpInteractionType,
  SlpPost,
  SlpPostImageCrop,
  SlpPostPartnership,
} from "../../../../../shared/src/slp/slp-social.types.js";
import type { ConversationMediaPickerTabId } from "../../../components/chat/ConversationMediaPickerPanel";
import type { ChatImage } from "../../../hooks/use-gallery";
import type { SlpDiscountOffer } from "../../../../../shared/src/slp/slp-post-offers.js";

export type SlpPostUnlockOffer = SlpDiscountOffer & {
  onUnlock: (postId: string, price: number) => void | Promise<void>;
};
export type SlpPostSubscriptionOffer = SlpDiscountOffer & {
  onSubscribe: (creatorAccountId: string, subscribed: boolean, price: number) => void | Promise<void>;
};

export type ReplyComposerTool = "image" | "media";
export type ActiveComposerMention = SlpTextMention & { query: string };

/**
 * Reply image attach/upload/lightbox. Hosts that persist reply images pass this; hosts that
 * don't (NoodleR) omit it — the card then hides the attach-image tool, upload, GIF tab, and
 * lightbox instead of the host having to pass discarded setters and dangling refs.
 */
export interface SlpPostCardMediaCap {
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
export interface SlpPostCardReplyManagementCap {
  editingReplyId: string | null;
  editingReplyContent: string;
  setEditingReplyContent: React.Dispatch<React.SetStateAction<string>>;
  startEditingReply: (reply: SlpInteraction) => void;
  cancelEditingReply: () => void;
  saveEditedReply: (post: SlpPostCardModel, reply: SlpInteraction) => void;
  deleteNoodleReply: (post: SlpPostCardModel, reply: SlpInteraction) => void;
  updateInteraction: { isPending: boolean };
  deleteInteraction: { isPending: boolean };
  /** Gate reply Edit/Delete. Omit for the default author-based check. */
  canManageReply?: (reply: SlpInteraction) => boolean;
}

/** @mention autocomplete in the reply composer. Omit on hosts without mentions (NoodleR). */
export interface SlpPostCardMentionsCap {
  activeReplyMention: ActiveComposerMention | null;
  activeReplyMentionIndex: number;
  replyMentionSuggestions: SlpAccount[];
  selectReplyMention: (account: SlpAccount) => void;
}

type SlpPostCardAuthor = Pick<SlpAuthorSnapshot, "id" | "handle" | "displayName" | "avatarUrl" | "avatarCrop">;
export type SlpPostCardModel = Pick<
  SlpPost,
  "id" | "authorAccountId" | "content" | "imageUrl" | "imagePrompt" | "images" | "metadata" | "createdAt" | "access"
> & {
  title: string | null;
  authorSnapshot: SlpPostCardAuthor | null;
  interactions: SlpInteraction[];
  /**
   * The platform total, where the caller has one. The rows carry the names; this carries the size.
   * Optional because a managed post inside the composer has no projection behind it.
   */
  likeCount?: number;
  /** A joint collab post or a paid partnership: the label under the name. */
  partnership?: SlpPostPartnership | null;
};

export interface SlpPostCardTitleEditingCap {
  editingPostTitle: string;
  setEditingPostTitle: React.Dispatch<React.SetStateAction<string>>;
  maxLength: number;
}

/** `position` is the picture of a set the change is for; 0 is the post picture (R1-039). */
export type SlpPostImageUpdate =
  | { kind: "replace"; file: File; crop: SlpPostImageCrop; position: number }
  | { kind: "crop"; crop: SlpPostImageCrop; position: number }
  | { kind: "remove" };

export type SlpPostImageCropSource =
  | {
      source: File | string;
      crop: SlpPostImageCrop | null;
      mode: "existing";
    }
  | { source: File; crop: SlpPostImageCrop | null; mode: "replace" };

export interface SlpPostCardImageEditingCap {
  update: SlpPostImageUpdate | null;
  cropSource: SlpPostImageCropSource | null;
  loading: boolean;
  error: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  beginCrop: (post: SlpPostCardModel) => void;
  /** The picture of a set that Crop and Replace act on (its position; 0 is the post picture). */
  position: number;
  choosePosition: (position: number) => void;
  selectReplacement: (event: ChangeEvent<HTMLInputElement>) => void;
  applyCrop: (crop: SlpPostImageCrop) => Promise<void>;
  cancelCrop: () => void;
  remove: () => void;
  restore: () => void;
}

export interface SlpPostCardCtx {
  /**
   * The AI assist for a post's text, handed in by the app (a module cannot reach a feature). Absent,
   * the edit sheet shows no assist.
   */
  textAssist?: (input: {
    value: string;
    onApply: (text: string) => void;
    accountId: string;
    story: boolean;
  }) => ReactNode;
  /** W: Stir this post's Creator (the ✦ sheet, with the post as context). Absent, no menu row. */
  stir?: (post: { id: string; authorAccountId: string }) => void;
  accountById?: Map<string, SlpAccount>;
  accountByHandle?: Map<string, SlpAccount>;
  personaAccount: SlpAccount | null;
  postMenuId: string | null;
  setPostMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  editingPostId: string | null;
  editingPostContent: string;
  setEditingPostContent: React.Dispatch<React.SetStateAction<string>>;
  replyPostId: string | null;
  /** The card that shows the post-level composer (`dialog:<id>` for the post dialog). */
  replyKey?: string | null;
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
  startEditingPost: (post: SlpPostCardModel) => void;
  deleteNoodlePost: (post: SlpPostCardModel) => void;
  cancelEditingPost: () => void;
  saveEditedPost: (post: SlpPostCardModel) => void;
  reactToPost: (post: SlpPostCardModel, type: "like", active?: boolean) => void;
  reactToReply: (post: SlpPostCardModel, target: SlpInteraction, active: boolean) => void;
  openReplyComposer: (postId: string, parentInteractionId?: string | null) => void;
  handleReplyChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Reply composer keydown (mention nav / submit shortcuts). Omit on hosts without them. */
  handleReplyKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  clearReplyComposer: () => void;
  submitReply: (post: SlpPostCardModel) => void;
  /** Present only when the host enables creatorReplyRequest. */
  creatorReplyRequest?: { asked: boolean; setAsked: (asked: boolean) => void };
  appendToReply: (text: string) => void;
  reactionPendingFor: (postId: string, type: "like", parentInteractionId?: string | null) => boolean;
  createInteractionPendingFor: (
    postId: string,
    type: SlpInteractionType,
    parentInteractionId?: string | null,
  ) => boolean;
  updatePostPending: boolean;
  /** Human controller edit/delete capability. Viewer-only projections set this false. */
  postManagement: boolean;
  /** NoodleR title editing. Noodle posts omit this capability and remain titleless. */
  titleEditing?: SlpPostCardTitleEditingCap;
  /** Existing-poll editing. Poll-less posts do not expose an add-poll path here. */
  pollEditing?: {
    value: SlpPollInput | null;
    setValue: React.Dispatch<React.SetStateAction<SlpPollInput | null>>;
  };
  /** Allow an empty edited body when the existing post has a poll. */
  allowPollOnlyEdits?: boolean;
  /** Navigate to an author/mention profile. Omit on hosts without profile navigation (NoodleR). */
  openProfile?: (account: SlpAccount | null) => void;
  /** Navigate by NoodleR author ID when no Noodle account object exists. */
  openAuthorProfile?: (accountId: string) => void;
  /** False hides the trend chip (Living world or its "Viral trends" is off). */
  trendsShown?: boolean;
  /** Open the whole post in the media dialog. Absent → the image opens a plain lightbox. */
  openPost?: (postId: string) => void;
  /** Vote in a post's poll. Pollless posts never call it. */
  voteInPoll?: (post: SlpPostCardModel, optionId: string, selectedOptionId: string | null) => void;
  /** Preserve the public timeline's legacy body/poll duplicate suppression. */
  deduplicatePollBody?: boolean;
  /** Post image crop, replacement, and removal capability. */
  imageEditing?: SlpPostCardImageEditingCap;
  /** Generate a missing post image from its saved prompt. */
  /** `asWritten`: the prompt comes from the redraw box and is sent to the provider as written. */
  generatePostImage?: (
    post: Pick<SlpPostCardModel, "id" | "authorAccountId">,
    imagePrompt?: string,
    asWritten?: boolean,
  ) => void;
  /** Every post whose picture is being drawn right now; two draws each keep their state (R1-059). */
  generatingPostImageIds?: readonly string[];
  sharePost?: (post: SlpPostCardModel) => void;
  /** Optional event offer. Omit to keep the discounted unlock action hidden. */
  unlockOffer?: SlpPostUnlockOffer;
  /** Optional event offer. Omit to keep the discounted subscription action hidden. */
  subscriptionOffer?: SlpPostSubscriptionOffer;
  gambleUnlockPost?: (postId: string) => Promise<{
    outcome: "free" | "triple-price" | "already-unlocked";
    amount: number;
  }>;
  reportPost?: (post: SlpPostCardModel) => void;
  /** Reply image/upload capability. Absent → the card hides all reply-image affordances. */
  media?: SlpPostCardMediaCap;
  /**
   * Opening an image fullscreen is not the same capability as attaching one to a reply, so
   * hosts without the reply-image cap (NoodleR) still get a lightbox by passing this.
   */
  setImageLightbox?: React.Dispatch<React.SetStateAction<ChatImage | null>>;
  /** Reply edit/delete capability. Absent → reply management UI stays hidden. */
  replyManagement?: SlpPostCardReplyManagementCap;
  /** @mention autocomplete capability. Absent → no mention suggestions. */
  mentions?: SlpPostCardMentionsCap;
  /** Character limit for the Show more clamp in SlurpClampedText. Host reads from settings. */
  postShowMoreLength?: number;
}

export interface SlpPostCardControllerOptions {
  /**
   * The AI assist for a post's text, handed in by the app (a module cannot reach a feature). Absent,
   * the edit sheet shows no assist.
   */
  textAssist?: (input: {
    value: string;
    onApply: (text: string) => void;
    accountId: string;
    story: boolean;
  }) => ReactNode;
  /** W: Stir this post's Creator (the ✦ sheet, with the post as context). Absent, no menu row. */
  stir?: (post: { id: string; authorAccountId: string }) => void;
  postManagement: boolean;
  /** The Show more threshold from settings; the card cannot read settings itself. */
  postShowMoreLength?: number;
  personaAccount: SlpAccount | null;
  savePost: (
    post: SlpPostCardModel,
    input: {
      title: string | null;
      content: string;
      image: SlpPostImageUpdate | null;
      poll?: SlpPollInput | null;
    },
  ) => Promise<void>;
  deletePost: (post: SlpPostCardModel) => void;
  reactToPost: (post: SlpPostCardModel, type: "like", active?: boolean) => void;
  reactToReply: (post: SlpPostCardModel, target: SlpInteraction, active: boolean) => void;
  submitReply: (
    post: SlpPostCardModel,
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
    type: SlpInteractionType,
    parentInteractionId?: string | null,
  ) => boolean;
  updatePostPending: boolean;
  titleMaxLength?: number;
  allowPollOnlyEdits?: boolean;
  openAuthorProfile?: (accountId: string) => void;
  voteInPoll?: (post: SlpPostCardModel, optionId: string, selectedOptionId: string | null) => void;
  deduplicatePollBody?: boolean;
  imageEditing?: {
    loadPostImage: (post: SlpPostCardModel) => Promise<File | string>;
  };
}
