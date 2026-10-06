import { useSlurpCreatorMessagingSettings } from "../../features/messages/slp-messages-hooks";
import { useSlpViewerPersonaId } from "../../features/creators/slp-creators-hooks";
import {
  SLP_CREATOR_POST_CONTENT_MAX_LENGTH,
  SLP_CREATOR_POST_TITLE_MAX_LENGTH,
  slpPollInputSchema,
} from "../../../../../shared/src/slp/slp-social.schema.js";
import type { SlpPollInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type {
  SlpCreatorManagedPost,
  SlpCreatorPostView,
  SlpPostImageCrop,
} from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpManagedStageProfile } from "../../base/state/slp-state-types";
import type { SlpCreatorContentFormat, SlurpProfilePost } from "../../features/feed/slp-feed-contract";
import { useSlurpSettings } from "../../features/settings/slp-settings-hooks";
import { slurpIntentFitsAccess } from "../../../../../shared/src/slp/slp-content-axes.js";
import { SlpComposerPurpose } from "../../modules/post/SlpComposerPurpose";
import { SlpComposerAudience } from "../../modules/post/SlpComposerAudience";
import { SlpOpenContinuityButton } from "../../base/navigation/SlpOpenContinuityButton";
import { SlpAnchoredPopover } from "../../base/chrome/SlpAnchoredPopover";
import { SlpImageComposer } from "../../base/media/SlpImageComposer";
import { SlpPollComposer } from "../../modules/poll/SlpPollComposer";
import { PostImageCropEditor } from "../../base/media/SlpPostImageCropEditor";
import {
  ConversationMediaPickerPanel,
  type ConversationMediaPickerTabId,
} from "../../../components/chat/ConversationMediaPickerPanel";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { Avatar, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlpAutoGrowTextarea } from "../../base/ui/SlpAutoGrowTextarea";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { SlpButton, SlpChip, SlpPrimaryButton, SlpSegment } from "../../modules/chrome/SlpButton";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Crop, ImagePlus, Link2, ListChecks, Loader2, Pencil, Send, Smile, Trash2 } from "lucide-react";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { SlpPictureAssist, SlpPostGuide, SlpTextAssist } from "../../features/assist/slp-assist-contract";
import { useSlurpTiesMutations } from "../../features/projects/slp-projects-contract";
import { useSlurpUIStore } from "../../base/state/slp-package-store";
import { cn } from "../../../lib/utils";
import {
  errorMessage,
  isEmptyCreatorPostDraft,
  isSlurpStory,
  type SlpCreatorPostDraft,
  type SlpCreatorPostSubmission,
  type PendingCreatorImage,
  SlpCreatorDraftImageFrame,
} from "./SlpHomeHelpers";
export type { PendingCreatorImage } from "./SlpHomeHelpers";

export type SlpCreatorComposerTool = "image" | "poll" | "media" | "draw";

/**
 * The one composer (design step 7): a full-screen glass sheet on phones, a centred modal on wide
 * screens. Post | Story switch in the header, media first, then caption, access chips and the
 * operator settings under "Advanced", with a sticky Post bar. The draft lives outside the sheet,
 * so closing it keeps what was written.
 */
export function NoodlerPostComposer({
  open,
  onClose,
  profile,
  availablePosts,
  draft,
  onDraftChange,
  onClearDraft,
  onDiscardDraft,
  onManualPost,
  manualPending,
}: {
  open: boolean;
  onClose: () => void;
  profile: SlurpManagedStageProfile;
  availablePosts: SlurpProfilePost[];
  draft: SlpCreatorPostDraft;
  onDraftChange: (patch: Partial<SlpCreatorPostDraft>) => void;
  onClearDraft: () => void;
  onDiscardDraft: () => void;
  onManualPost: (input: SlpCreatorPostSubmission) => Promise<void>;
  manualPending: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  // The configured Story size, as a ratio, so an uploaded Story is cropped to the same shape an
  // automatic one is drawn at. Falls back to 4:5 before the settings query resolves.
  const composerSettings = useSlurpSettings().data;
  const storyAspectRatio =
    composerSettings && composerSettings.storyImageHeight > 0
      ? composerSettings.storyImageWidth / composerSettings.storyImageHeight
      : 4 / 5;
  // The Creator's own unlock price, the one the server stamps on a locked post (weekly dynamic
  // pricing moves it); the Slurp-wide price only until it loads (R1-025).
  const viewerPersonaId = useSlpViewerPersonaId();
  const creatorPrices = useSlurpCreatorMessagingSettings(profile.id, viewerPersonaId).data;
  // The guided post (0.3.14): an idea Stir handed over for this page drafts once when the sheet opens.
  const handedGuide = useSlurpUIStore((state) =>
    state.composeGuide?.accountId === profile.id ? state.composeGuide : null,
  );
  const [guided, setGuided] = useState(Boolean(handedGuide));
  const [drafting, setDrafting] = useState(false);
  useEffect(() => {
    if (handedGuide) setGuided(true);
  }, [handedGuide]);
  const setComposeGuide = useSlurpUIStore((state) => state.setComposeGuide);
  const markDealPosted = useSlurpTiesMutations(viewerPersonaId ?? "").markPosted;
  // The owed #ad the current draft was written for; posting it settles the reminder.
  const guideDealId = useRef<string | null>(null);
  const usualUnlockPrice = creatorPrices?.messaging.unlockPrice ?? composerSettings?.walletUnlockCost ?? 25;
  const [postError, setPostError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<SlpCreatorComposerTool | null>(null);
  const [pollEditorValue, setPollEditorValue] = useState<SlpPollInput | null>(null);
  const [mediaPickerTab, setMediaPickerTab] = useState<ConversationMediaPickerTabId>("emoji");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingCreatorImage | null>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const imageFileRef = useRef<HTMLInputElement | null>(null);
  const mediaToolRef = useRef<HTMLButtonElement | null>(null);
  const composerBusyRef = useRef(false);
  const {
    title,
    body,
    access,
    image,
    poll,
    postType,
    linkedPostId,
    unlockPrice,
    generateImage,
    contentIntent,
    contentDelivery,
  } = draft;
  const story = postType === "story";
  const linkablePosts = availablePosts
    .map((entry) => ("managed" in entry ? entry.managed : entry.viewerPost))
    .filter((post): post is SlpCreatorManagedPost | SlpCreatorPostView => Boolean(post) && !isSlurpStory(post));
  // Format is an internal tag for the AI/length policy, not a choice we make the
  // human author pick. Derive it from what they actually did: a title makes it an
  // announcement (long_form when long); otherwise a caption (long_form when long).
  const derivedFormat = (): SlpCreatorContentFormat =>
    title.trim()
      ? body.trim().length > 1000
        ? "long_form"
        : "announcement"
      : body.trim().length > 500
        ? "long_form"
        : "caption";
  const hasDraft = pendingImage !== null || !isEmptyCreatorPostDraft(draft);
  const composerBusy = submitting || manualPending;
  composerBusyRef.current = composerBusy;
  const pollIsValid = poll ? slpPollInputSchema.safeParse(poll).success : false;
  const canPost =
    !composerBusy &&
    !drafting &&
    !pendingImage &&
    (story ? Boolean(image) : Boolean(body.trim() || image || pollIsValid));

  const updateDraft = (patch: Partial<SlpCreatorPostDraft>) => {
    if (composerBusyRef.current) return false;
    onDraftChange(patch);
    return true;
  };
  const resetLocal = () => {
    setPostError(null);
    setAttachmentError(null);
    setPendingImage(null);
    setImageUrlDraft("");
    setPollEditorValue(null);
    setActiveTool(null);
    setAdvancedOpen(false);
    setComposeGuide(null);
    setGuided(false);
  };
  const close = () => {
    if (composerBusyRef.current || drafting) return;
    setComposeGuide(null);
    setGuided(false);
    setActiveTool(null);
    setPendingImage(null);
    onClose();
  };
  const discardDraft = () => {
    if (composerBusyRef.current || drafting) return;
    guideDealId.current = null;
    onDiscardDraft();
    resetLocal();
    onClose();
  };
  // Remove is one tap; the toast offers Undo (design step 7).
  const removeImage = () => {
    if (!image || composerBusyRef.current) return;
    const removed = image;
    onDraftChange({ image: null });
    setPendingImage(null);
    toast(localizeUi("ui.slurp.composer.imageRemoved", { defaultValue: "Picture removed" }), {
      action: {
        label: localizeUi("ui.slurp.wallet.undo", { defaultValue: "Undo" }),
        onClick: () => onDraftChange({ image: removed }),
      },
    });
  };
  const handleImageFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || composerBusyRef.current) return;
    if (!file.type.startsWith("image/")) {
      setAttachmentError("Choose an image file.");
      return;
    }
    setAttachmentError(null);
    setPendingImage(null);
    onDraftChange({ image: { source: file, crop: null }, generateImage: false });
    setActiveTool(null);
  };
  const handleImageUrl = () => {
    const imageUrl = imageUrlDraft.trim();
    if (!imageUrl || composerBusyRef.current) return;
    setAttachmentError(null);
    try {
      const parsed = new URL(imageUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Use an HTTP or HTTPS image URL.");
      setImageUrlDraft("");
      onDraftChange({ image: { source: parsed.toString(), crop: null }, generateImage: false });
      setActiveTool(null);
    } catch (error) {
      setAttachmentError(errorMessage(error, "Enter a valid image URL."));
    }
  };
  // What Write / Improve should know besides the text: the title, and the Purpose & Delivery picked
  // under Advanced (a one-shot choice; it never changes the saved strategy).
  const assistContext =
    [
      title.trim() && `Title: ${title.trim()}`,
      contentIntent && `What this post is for: ${contentIntent.replaceAll("_", " ")}`,
      contentDelivery && `How it is delivered: ${contentDelivery.replaceAll("_", " ")}`,
    ]
      .filter(Boolean)
      .join(". ") || undefined;
  // A drawn picture goes in like an upload, so Crop, Replace and Remove work on it as on any photo.
  // The picture it replaced is kept for the assist's Undo.
  const drawnOver = useRef<SlpCreatorPostDraft["image"]>(null);
  // Decoded here: the Engine's content policy does not let fetch() read a data: URL.
  const takeDrawnPicture = (picture: string) => {
    const [head = "", base64 = ""] = picture.split(",", 2);
    const type = /^data:([^;]+)/u.exec(head)?.[1] ?? "image/png";
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    drawnOver.current = image;
    setPendingImage(null);
    onDraftChange({
      image: { source: new File([bytes], `slurp-${Date.now()}.${type.split("/")[1] ?? "png"}`, { type }), crop: null },
      generateImage: false,
    });
  };
  const applyImageCrop = async (crop: SlpPostImageCrop) => {
    if (composerBusyRef.current) return;
    const pending = pendingImage;
    if (!pending) return;
    setAttachmentError(null);
    onDraftChange({ image: { source: pending.source, crop } });
    setPendingImage(null);
  };

  const toggleTool = (tool: SlpCreatorComposerTool) => {
    if (composerBusyRef.current) return;
    if (story && tool === "poll") return;
    if (activeTool === tool) {
      setActiveTool(null);
      if (tool === "poll") setPollEditorValue(null);
      return;
    }
    setPollEditorValue(
      tool === "poll"
        ? poll
          ? { question: poll.question, options: [...poll.options] }
          : { question: "", options: ["", ""] }
        : null,
    );
    setActiveTool(tool);
  };

  const applyPollDraft = () => {
    const parsed = slpPollInputSchema.safeParse(pollEditorValue);
    if (!parsed.success) return;
    if (updateDraft({ poll: parsed.data })) {
      setPollEditorValue(null);
      setActiveTool(null);
    }
  };

  const submission = (): SlpCreatorPostSubmission => ({
    profileId: profile.id,
    title,
    // A post needs text; an image-only post carries a camera, not an English sentence (R1-043).
    body: body.trim() || (image && !poll ? "📸" : ""),
    access,
    image,
    poll: poll ? { question: poll.question.trim(), options: poll.options.map((option) => option.trim()) } : null,
    format: derivedFormat(),
    postType,
    linkedPostId: linkedPostId ?? null,
    unlockPrice: access === "locked" ? (unlockPrice ?? null) : null,
    generateImage: generateImage && !image,
    contentIntent,
    contentDelivery,
  });

  const publish = async () => {
    if (composerBusyRef.current || drafting) return;
    setPostError(null);
    if (pendingImage) {
      setPostError("Apply or cancel the image crop before posting.");
      return;
    }
    if (story && !image) {
      setPostError(localizeUi("ui.slurp.stories.imageRequired"));
      return;
    }
    if (!body.trim() && !image && !poll) {
      setPostError("Add a body, image, or poll.");
      return;
    }
    if (poll && !pollIsValid) {
      setPostError("Polls need a question and two unique answers.");
      return;
    }
    try {
      composerBusyRef.current = true;
      setSubmitting(true);
      setActiveTool(null);
      await onManualPost(submission());
      if (guideDealId.current && viewerPersonaId) markDealPosted.mutate(guideDealId.current);
      guideDealId.current = null;
      onClearDraft();
      resetLocal();
      onClose();
    } catch (error) {
      setPostError(errorMessage(error, localizeUi("ui.noodle.noodlerpostcomposer.couldNotPublishThisPost")));
    } finally {
      setSubmitting(false);
    }
  };

  const errors = [
    postError && `${localizeUi("ui.noodle.noodlerpostcomposer.post")} ${postError}`,
    attachmentError && `${localizeUi("ui.noodle.noodlerpostcomposer.image")} ${attachmentError}`,
  ].filter(Boolean);
  const fieldClass =
    "w-full border-0 bg-transparent text-[var(--slurp-text)] outline-none placeholder:text-[var(--slurp-muted)] disabled:opacity-60";
  const selectClass =
    "h-11 w-full rounded-xl bg-[var(--slurp-surface-raised)] px-3 text-[13px] text-[var(--slurp-text)] shadow-[var(--slurp-highlight)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]";

  const media = pendingImage ? (
    <PostImageCropEditor
      source={pendingImage.source}
      crop={image?.source === pendingImage.source ? image.crop : null}
      disabled={composerBusy}
      // A Story is shown in one tall frame, so an uploaded one is cropped to the same ratio an
      // automatic one is drawn at rather than offering square and landscape.
      lockedRatio={story ? storyAspectRatio : undefined}
      onCancel={() => setPendingImage(null)}
      onApply={applyImageCrop}
    />
  ) : image ? (
    <div className="space-y-2">
      <SlpCreatorDraftImageFrame image={image} />
      {/* Labelled actions, not a floating icon pill: Crop and Remove never sit one mis-tap apart. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <SlpButton
          variant="quiet"
          disabled={composerBusy}
          onClick={() => setPendingImage({ source: image.source })}
          className="min-h-10 px-4 text-[13px]"
        >
          <Crop size={16} aria-hidden="true" />
          {localizeUi("ui.slurp.composer.crop", { defaultValue: "Crop" })}
        </SlpButton>
        <SlpButton
          variant="quiet"
          disabled={composerBusy}
          onClick={() => imageFileRef.current?.click()}
          className="min-h-10 px-4 text-[13px]"
        >
          <ImagePlus size={16} aria-hidden="true" />
          {localizeUi("ui.slurp.composer.replace", { defaultValue: "Replace" })}
        </SlpButton>
        <SlpButton variant="danger" disabled={composerBusy} onClick={removeImage} className="min-h-10 px-4 text-[13px]">
          <Trash2 size={16} aria-hidden="true" />
          {localizeUi("ui.slurp.composer.remove", { defaultValue: "Remove" })}
        </SlpButton>
      </div>
    </div>
  ) : (
    // Media first: the empty frame is the first thing to tap, in the shape it will be seen in.
    <div
      className={cn(
        "relative flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--noodle-accent)_6%,var(--slurp-surface-raised))] p-4 text-center shadow-[var(--slurp-highlight)] ring-1 ring-inset ring-[var(--noodle-divider)]",
        story ? "mx-auto aspect-[9/16] max-h-[22rem]" : "min-h-44",
      )}
    >
      {generateImage && !story ? (
        <>
          <span className="grid size-12 place-items-center rounded-full bg-[var(--slurp-tint)] text-[var(--slurp-ink)] [&_svg]:!text-current">
            <SlpSparkleGlyph size={22} aria-hidden="true" />
          </span>
          <p className={cn(SLP_TYPE.body, "max-w-60 text-[var(--slurp-muted)]")}>
            {localizeUi("ui.slurp.composer.aiPictureOn", {
              defaultValue: "A picture is drawn from your caption when you post.",
            })}
          </p>
        </>
      ) : (
        <SlpButton
          variant="secondary"
          disabled={composerBusy}
          onClick={() => imageFileRef.current?.click()}
          className="px-5"
        >
          <ImagePlus size={18} aria-hidden="true" />
          {localizeUi("ui.slurp.composer.addPhoto", { defaultValue: "Add a photo" })}
        </SlpButton>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {!generateImage && (
          <SlpChip
            selected={activeTool === "image"}
            disabled={composerBusy}
            onClick={() => toggleTool("image")}
            className="min-h-9"
          >
            <Link2 size={15} aria-hidden="true" />
            {localizeUi("ui.slurp.composer.pasteLink", { defaultValue: "Paste a link" })}
          </SlpChip>
        )}
        <SlpChip
          selected={activeTool === "draw"}
          disabled={composerBusy}
          onClick={() => {
            // The old "draw it when I post" switch folds into drawing it now, with a look first.
            if (generateImage) updateDraft({ generateImage: false });
            toggleTool("draw");
          }}
          className="min-h-9"
        >
          <SlpSparkleGlyph size={14} aria-hidden="true" />
          {localizeUi("ui.slurp.assist.drawPicture", { defaultValue: "Draw a picture" })}
        </SlpChip>
      </div>
      {activeTool === "image" && (
        <div className="w-full max-w-sm text-start">
          <SlpImageComposer
            imageUrl={imageUrlDraft}
            onImageUrlChange={setImageUrlDraft}
            onChooseFile={() => {
              if (!composerBusyRef.current) imageFileRef.current?.click();
            }}
            onUseImageUrl={() => void handleImageUrl()}
            onClose={() => setActiveTool(null)}
            disabled={composerBusy}
            hasImage={false}
            urlActionLabel={localizeUi("ui.noodle.noodlerpostcomposer.importUrl")}
          />
        </div>
      )}
    </div>
  );

  return (
    <SlpSheet
      open={open}
      onClose={close}
      closeDisabled={composerBusy || drafting}
      size="full"
      width="max-w-xl"
      title={
        guided
          ? localizeUi("ui.slurp.stir.stirShort")
          : story
            ? localizeUi("ui.slurp.composer.newStory", { defaultValue: "New Story" })
            : localizeUi("ui.slurp.composer.newPost", { defaultValue: "New post" })
      }
      headerAccessory={
        <SlpSegment
          label={localizeUi("ui.slurp.stories.postType")}
          value={postType}
          onChange={(option) => {
            if (composerBusyRef.current || drafting) return;
            setActiveTool(null);
            updateDraft({
              postType: option,
              ...(option === "story" ? { poll: null, title: "", generateImage: false } : { linkedPostId: null }),
            });
          }}
          options={[
            { value: "post", label: localizeUi("ui.slurp.stories.type.post") },
            { value: "story", label: localizeUi("ui.slurp.stories.type.story") },
          ]}
        />
      }
      footer={
        <div data-component="SlurpHome.NoodlerPostComposer.bar" className="space-y-2">
          {errors.length > 0 && (
            <div role="alert" className="space-y-0.5 text-xs text-[var(--slurp-danger)]">
              {errors.map((error) => (
                <p key={error as string}>{error}</p>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {guided && (
              <SlpButton disabled={composerBusy || drafting} onClick={() => setGuided(false)}>
                <Pencil size={16} aria-hidden="true" />
                {localizeUi("ui.slurp.postGuide.editDraft")}
              </SlpButton>
            )}
            <SlpPrimaryButton onClick={() => void publish()} disabled={!canPost} className="ms-auto px-6">
              {manualPending ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Send size={16} aria-hidden="true" />
              )}
              {manualPending
                ? localizeUi("ui.noodle.noodlerpostcomposer.posting")
                : story
                  ? localizeUi("ui.slurp.composer.shareStory", { defaultValue: "Share Story" })
                  : localizeUi("ui.slurp.composer.post", { defaultValue: "Post" })}
            </SlpPrimaryButton>
          </div>
        </div>
      }
    >
      <div data-component="SlurpHome.NoodlerPostComposer" className="space-y-4 px-2 pb-2 pt-1">
        <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
        <p className={cn(SLP_TYPE.meta, "flex items-center gap-2 text-[var(--slurp-muted)]")}>
          <Avatar
            account={{ displayName: profile.displayName, avatarUrl: profile.avatarUrl, avatarCrop: profile.avatarCrop }}
            size="xs"
          />
          <span className="truncate">
            {localizeUi("ui.noodle.noodlerpostcomposer.postAs")} {profile.displayName}
          </span>
        </p>

        <SlpPostGuide
          key={profile.id}
          accountId={profile.id}
          personaId={viewerPersonaId}
          story={story}
          disabled={composerBusy}
          onPendingChange={setDrafting}
          onUpload={() => imageFileRef.current?.click()}
          initialIdea={handedGuide?.idea ?? ""}
          autoRun={Boolean(handedGuide) && open}
          onDraft={(guided) => {
            if (handedGuide) setComposeGuide(null);
            guideDealId.current = guided.dealId;
            updateDraft({ body: guided.text });
            if (guided.image) takeDrawnPicture(guided.image);
          }}
        />

        {guided ? (
          <div data-slp-guided-preview className="space-y-3">
            {image && <SlpCreatorDraftImageFrame image={image} />}
            {title && <p className={SLP_TYPE.title}>{title}</p>}
            {body && <p className="whitespace-pre-wrap break-words text-base leading-6">{body}</p>}
            {hasDraft && (
              <SlpButton variant="tertiary" onClick={discardDraft} disabled={composerBusy || drafting}>
                {localizeUi("ui.slurp.composer.discardDraft")}
              </SlpButton>
            )}
          </div>
        ) : (
          <>
            {media}
            {activeTool === "draw" && (
              <SlpPictureAssist
                accountId={profile.id}
                target={story ? "story" : "post"}
                context={body.trim() || title.trim() || undefined}
                onUse={takeDrawnPicture}
                onUndo={() => {
                  onDraftChange({ image: drawnOver.current });
                  setPendingImage(null);
                }}
                onDone={() => setActiveTool(null)}
              />
            )}

            <div className="space-y-1">
              {!story && (
                <label className="block">
                  <span className="sr-only">{localizeUi("ui.noodle.noodlerpostcomposer.postTitleOptional")}</span>
                  <input
                    value={title}
                    onChange={(event) => updateDraft({ title: event.target.value })}
                    maxLength={SLP_CREATOR_POST_TITLE_MAX_LENGTH}
                    disabled={composerBusy}
                    placeholder={localizeUi("ui.slurp.composer.titlePlaceholder", { defaultValue: "Title (optional)" })}
                    className={cn(fieldClass, "h-10 text-[15px] font-bold")}
                  />
                </label>
              )}
              <SlpAutoGrowTextarea
                value={body}
                onChange={(event) => updateDraft({ body: event.target.value })}
                maxLength={SLP_CREATOR_POST_CONTENT_MAX_LENGTH}
                disabled={composerBusy}
                aria-label={localizeUi("ui.noodle.noodlerpostcomposer.postBody")}
                placeholder={localizeUi(
                  story ? "ui.slurp.stories.captionPlaceholder" : "ui.noodle.noodlerpostcomposer.whatSSimmering",
                )}
                className={cn(fieldClass, "min-h-20 resize-none py-1 text-base leading-6 sm:text-[15px]")}
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!story && (
                  <SlpChip
                    selected={activeTool === "poll" || Boolean(poll)}
                    disabled={composerBusy}
                    onClick={() => toggleTool("poll")}
                    className="min-h-9"
                  >
                    <ListChecks size={15} aria-hidden="true" />
                    {localizeUi("ui.slurp.composer.poll", { defaultValue: "Poll" })}
                  </SlpChip>
                )}
                <SlpChip
                  ref={mediaToolRef}
                  selected={activeTool === "media"}
                  disabled={composerBusy}
                  onClick={() => toggleTool("media")}
                  className="min-h-9"
                >
                  <Smile size={15} aria-hidden="true" />
                  {localizeUi("ui.slurp.composer.emoji", { defaultValue: "Emoji" })}
                </SlpChip>
                <SlpTextAssist
                  field={story ? "story" : "caption"}
                  value={body}
                  accountId={profile.id}
                  context={assistContext}
                  disabled={composerBusy}
                  onApply={(text) => updateDraft({ body: text })}
                />
              </div>
            </div>

            {activeTool === "poll" && !composerBusy && (
              <SlpPollComposer
                value={pollEditorValue}
                onChange={setPollEditorValue}
                onClose={() => {
                  setPollEditorValue(null);
                  setActiveTool(null);
                }}
                onSubmit={applyPollDraft}
                submitLabel={
                  poll
                    ? localizeUi("ui.noodle.noodlerpostcomposer.updatePoll")
                    : localizeUi("ui.noodle.noodlerpostcomposer.addPoll")
                }
                disabled={composerBusy}
                modalOwned
              />
            )}
            {poll && activeTool !== "poll" && (
              <div className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] p-3 shadow-[var(--slurp-highlight)]">
                <div className="min-w-0 flex-1">
                  <p className={cn(SLP_TYPE.body, "font-semibold")}>{poll.question}</p>
                  <p className={cn(SLP_TYPE.meta, "mt-1 truncate text-[var(--slurp-muted)]")}>
                    {poll.options.join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleTool("poll")}
                    disabled={composerBusy}
                    className="grid size-10 place-items-center rounded-full text-[var(--slurp-ink)] hover:bg-[var(--accent)] disabled:opacity-50 [&_svg]:!text-current"
                    aria-label={localizeUi("ui.noodle.noodlehome.editDraftPoll")}
                    title={localizeUi("ui.noodle.noodlehome.editPoll")}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDraft({ poll: null })}
                    disabled={composerBusy}
                    className="grid size-10 place-items-center rounded-full text-[var(--slurp-danger)] hover:bg-[var(--accent)] disabled:opacity-50 [&_svg]:!text-current"
                    aria-label={localizeUi("ui.noodle.noodlehome.removeDraftPoll")}
                    title={localizeUi("ui.noodle.noodlehome.removePoll")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}

            <SlpComposerAudience
              access={access}
              unlockPrice={unlockPrice ?? null}
              usualUnlockPrice={usualUnlockPrice}
              disabled={composerBusy}
              onChange={(patch) =>
                updateDraft({
                  ...patch,
                  // A purpose that no longer fits the new audience goes back to automatic.
                  ...(contentIntent && !slurpIntentFitsAccess(contentIntent, patch.access ?? access)
                    ? { contentIntent: null, contentDelivery: null }
                    : {}),
                })
              }
            />

            {/* Operator settings stay one tap away, after everything a creator would touch. */}
            <section className="rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-highlight)]">
              <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                aria-expanded={advancedOpen}
                aria-controls="slurp-composer-advanced"
                className="flex min-h-11 w-full items-center gap-2 rounded-2xl px-4 text-start text-[13px] font-semibold text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&_svg]:!text-current"
              >
                <span className="flex-1">{localizeUi("ui.slurp.composer.advanced", { defaultValue: "Advanced" })}</span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={cn("transition-transform motion-reduce:transition-none", advancedOpen && "rotate-180")}
                />
              </button>
              <div id="slurp-composer-advanced" hidden={!advancedOpen} className="space-y-3 px-4 pb-4">
                {!story && (
                  <div className="grid gap-2 sm:grid-cols-2 [&_label]:w-full [&_select]:h-11 [&_select]:w-full [&_select]:max-w-none [&_select]:rounded-xl [&_select]:font-medium">
                    <SlpComposerPurpose
                      access={access}
                      contentIntent={contentIntent}
                      contentDelivery={contentDelivery}
                      disabled={composerBusy}
                      onChange={updateDraft}
                    />
                  </div>
                )}
                {story && (
                  <label className="block space-y-1">
                    <span className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
                      {localizeUi("ui.slurp.stories.linkPost")}
                    </span>
                    <select
                      value={linkedPostId ?? ""}
                      onChange={(event) => updateDraft({ linkedPostId: event.target.value || null })}
                      disabled={composerBusy}
                      className={selectClass}
                    >
                      <option value="">{localizeUi("ui.slurp.stories.noLinkedPost")}</option>
                      {linkablePosts.map((post) => (
                        <option key={post.id} value={post.id}>
                          {post.title || post.content.slice(0, 70) || post.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <SlpOpenContinuityButton
                    creatorAccountId={profile.id}
                    className="inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-semibold text-[var(--slurp-text)] ring-1 ring-inset ring-[var(--noodle-divider)] hover:bg-[var(--accent)]"
                  />
                  {hasDraft && (
                    <SlpButton variant="tertiary" onClick={discardDraft} disabled={composerBusy} className="min-h-10">
                      {localizeUi("ui.slurp.composer.discardDraft", { defaultValue: "Discard draft" })}
                    </SlpButton>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
      {!guided && activeTool === "media" && !composerBusy && (
        <SlpAnchoredPopover anchorRef={mediaToolRef} wide modalOwned>
          <ConversationMediaPickerPanel
            tabs={[{ id: "emoji", label: localizeUi("ui.noodle.media.tabs.emoji") }]}
            activeTab={mediaPickerTab}
            onActiveTabChange={(tab) => {
              if (!composerBusyRef.current) setMediaPickerTab(tab);
            }}
            onClose={() => setActiveTool(null)}
            onEmojiSelect={(emoji) => updateDraft({ body: body + emoji })}
            onGifSelect={() => {}}
            onStickerSelect={(name) => updateDraft({ body: `${body}sticker:${name}:` })}
            className="w-full !border-[var(--marinara-chat-chrome-panel-border)] !bg-[var(--background)] !text-[var(--foreground)] shadow-2xl shadow-black/35"
          />
        </SlpAnchoredPopover>
      )}
    </SlpSheet>
  );
}
