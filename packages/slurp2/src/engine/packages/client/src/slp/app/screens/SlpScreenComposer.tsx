import {
  SLP_CREATOR_POST_CONTENT_MAX_LENGTH,
  SLP_CREATOR_POST_GUIDE_MAX_LENGTH,
  SLP_CREATOR_POST_TITLE_MAX_LENGTH,
  slpPollInputSchema,
} from "../../../../../shared/src/slp/slp-social.schema.js";
import {
  SLURP_CONTENT_DELIVERIES,
  SLURP_CONTENT_INTENTS,
  slurpContentDeliveryFits,
  type SlurpContentDelivery,
  type SlurpContentIntent,
} from "../../../../../shared/src/slp/slp-content-axes.js";
import type { SlpPollInput } from "../../../../../shared/src/slp/slp-social-generation.schema.js";
import type {
  SlpCreatorManagedPost,
  SlpCreatorPostView,
  SlpPostImageCrop,
} from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlurpManagedStageProfile } from "../../base/state/slp-state-types";
import type { SlpCreatorContentFormat, SlurpProfilePost } from "../../features/feed/slp-feed-contract";
import { useSlurpSettings } from "../../features/settings/slp-settings-hooks";
import { SlpComposerShell, SlpComposerToolRow } from "../../modules/post/SlpPostCard";
import { SlpAnchoredPopover } from "../../base/chrome/SlpAnchoredPopover";
import { SlpImageComposer } from "../../base/media/SlpImageComposer";
import { SlpPollComposer } from "../../modules/poll/SlpPollComposer";
import { PostImageCropEditor } from "../../base/media/SlpPostImageCropEditor";
import {
  ConversationMediaPickerPanel,
  type ConversationMediaPickerTabId,
} from "../../../components/chat/ConversationMediaPickerPanel";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ProfileInitial, SLURP_TOGGLE_ACTIVE_CLASS } from "../../base/chrome/SlpChrome";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Lock, Loader2, Pencil, Send, Sparkles, Trash2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import {
  errorMessage,
  isEmptyCreatorPostDraft,
  isSlurpStory,
  serializeCreatorPostGuide,
  type SlpCreatorPostDraft,
  type SlpCreatorPostSubmission,
  type PendingCreatorImage,
  SlpCreatorDraftImageFrame,
} from "./SlpHomeHelpers";
export type { PendingCreatorImage } from "./SlpHomeHelpers";

export type SlpCreatorComposerTool = "image" | "poll" | "media" | "access";

export function NoodlerPostComposer({
  profile,
  availablePosts,
  collapsible = true,
  openSignal = 0,
  draft,
  onDraftChange,
  onClearDraft,
  onDiscardDraft,
  onManualPost,
  onGuidedPost,
  manualPending,
  guidePending,
}: {
  profile: SlurpManagedStageProfile;
  availablePosts: SlurpProfilePost[];
  collapsible?: boolean;
  /** Increments when something outside asks for the composer, so a collapsed one reopens. */
  openSignal?: number;
  draft: SlpCreatorPostDraft;
  onDraftChange: (patch: Partial<SlpCreatorPostDraft>) => void;
  onClearDraft: () => void;
  onDiscardDraft: () => void;
  onManualPost: (input: SlpCreatorPostSubmission) => Promise<void>;
  onGuidedPost: (input: SlpCreatorPostSubmission) => Promise<void>;
  manualPending: boolean;
  guidePending: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  // The configured Story size, as a ratio, so an uploaded Story is cropped to the same shape an
  // automatic one is drawn at. Falls back to 4:5 before the settings query resolves.
  const composerSettings = useSlurpSettings().data;
  const storyAspectRatio =
    composerSettings && composerSettings.storyImageHeight > 0
      ? composerSettings.storyImageWidth / composerSettings.storyImageHeight
      : 4 / 5;
  // Posting is the reason a creator opens their own profile, so the composer starts ready.
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    if (openSignal > 0) setExpanded(true);
  }, [openSignal]);
  const [postError, setPostError] = useState<string | null>(null);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<SlpCreatorComposerTool | null>(null);
  const [pollEditorValue, setPollEditorValue] = useState<SlpPollInput | null>(null);
  const [mediaPickerTab, setMediaPickerTab] = useState<ConversationMediaPickerTabId>("emoji");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingCreatorImage | null>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const imageFileRef = useRef<HTMLInputElement | null>(null);
  const imageToolRef = useRef<HTMLDivElement | null>(null);
  const pollToolRef = useRef<HTMLDivElement | null>(null);
  const mediaToolRef = useRef<HTMLDivElement | null>(null);
  const accessToolRef = useRef<HTMLDivElement | null>(null);
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
  const composerBusy = submitting || manualPending || guidePending;
  composerBusyRef.current = composerBusy;
  const guide = serializeCreatorPostGuide(title, body);
  const pollIsValid = poll ? slpPollInputSchema.safeParse(poll).success : false;

  useEffect(() => {
    if (composerBusy) {
      setActiveTool(null);
    }
  }, [composerBusy]);

  const updateDraft = (patch: Partial<SlpCreatorPostDraft>) => {
    if (composerBusyRef.current) return false;
    onDraftChange(patch);
    return true;
  };
  const discardPendingImage = () => {
    setPendingImage(null);
  };

  const clearDraft = () => {
    onClearDraft();
    setPostError(null);
    setGuideError(null);
    setAttachmentError(null);
    discardPendingImage();
    setImageUrlDraft("");
    setPollEditorValue(null);
    setActiveTool(null);
    setExpanded(false);
  };
  const discardDraft = () => {
    if (composerBusyRef.current) return;
    onDiscardDraft();
    setPostError(null);
    setGuideError(null);
    setAttachmentError(null);
    discardPendingImage();
    setImageUrlDraft("");
    setPollEditorValue(null);
    setActiveTool(null);
    setExpanded(false);
  };
  const removeImage = () => {
    if (!image || composerBusyRef.current) return;
    onDraftChange({ image: null });
    setPendingImage(null);
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
    discardPendingImage();
    onDraftChange({ image: { source: file, crop: null } });
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
      onDraftChange({ image: { source: parsed.toString(), crop: null } });
      setActiveTool(null);
    } catch (error) {
      setAttachmentError(errorMessage(error, "Enter a valid image URL."));
    }
  };
  const applyImageCrop = async (crop: SlpPostImageCrop) => {
    if (composerBusyRef.current) return;
    const pending = pendingImage;
    if (!pending) return;
    setAttachmentError(null);
    onDraftChange({ image: { source: pending.source, crop } });
    setPendingImage(null);
    setActiveTool(null);
  };

  const toggleTool = (tool: SlpCreatorComposerTool) => {
    if (composerBusyRef.current) return;
    if (postType === "story" && tool === "poll") return;
    if (activeTool === tool) {
      setActiveTool(null);
      if (tool === "poll") setPollEditorValue(null);
      return;
    }
    if (tool === "poll") {
      setPollEditorValue(
        poll ? { question: poll.question, options: [...poll.options] } : { question: "", options: ["", ""] },
      );
    } else {
      setPollEditorValue(null);
    }
    setActiveTool(tool);
  };

  const applyPollDraft = () => {
    const parsed = slpPollInputSchema.safeParse(pollEditorValue);
    if (!parsed.success) return;
    if (
      updateDraft({
        poll: parsed.data,
      })
    ) {
      setPollEditorValue(null);
      setActiveTool(null);
    }
  };

  const submission = (): SlpCreatorPostSubmission => ({
    profileId: profile.id,
    title,
    body: body.trim() || (image && !poll ? "Shared an image." : ""),
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
    if (composerBusyRef.current) return;
    setPostError(null);
    if (pendingImage) {
      setPostError("Apply or cancel the image crop before posting.");
      return;
    }
    if (postType === "story" && !image) {
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
      clearDraft();
    } catch (error) {
      setPostError(errorMessage(error, localizeUi("ui.noodle.noodlerpostcomposer.couldNotPublishThisPost")));
    } finally {
      setSubmitting(false);
    }
  };

  const guidePost = async () => {
    if (composerBusyRef.current) return;
    setGuideError(null);
    if (pendingImage) {
      setGuideError(localizeUi("ui.noodle.noodlerpostcomposer.finishImageCrop"));
      return;
    }
    if (!body.trim() && !image && !poll) {
      setGuideError(localizeUi("ui.noodle.noodlerpostcomposer.guidedPostNeedsContent"));
      return;
    }
    if (poll && !pollIsValid) {
      setGuideError(localizeUi("ui.noodle.noodlerpostcomposer.pollNeedsQuestionAndOptions"));
      return;
    }
    if (guide.length > SLP_CREATOR_POST_GUIDE_MAX_LENGTH) {
      setGuideError(localizeUi("ui.slurp.composer.guideTooLong", { count: SLP_CREATOR_POST_GUIDE_MAX_LENGTH }));
      return;
    }
    try {
      composerBusyRef.current = true;
      setSubmitting(true);
      setActiveTool(null);
      await onGuidedPost(submission());
      clearDraft();
    } catch (error) {
      setGuideError(errorMessage(error, localizeUi("ui.noodle.noodlerpostcomposer.couldNotGenerateThisPost")));
    } finally {
      setSubmitting(false);
    }
  };

  if (collapsible && !expanded) {
    return (
      <div className="border-b border-[var(--noodle-divider)] px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          disabled={composerBusy}
          className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[var(--noodle-divider)] px-3 text-left transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
          aria-expanded="false"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {localizeUi("ui.noodle.noodlerpostcomposer.postAs")} {profile.displayName}
            </span>
            <span className="block text-xs text-[var(--muted-foreground)]">
              {hasDraft
                ? localizeUi("ui.noodle.noodlerpostcomposer.draftSaved")
                : localizeUi("ui.noodle.noodlerpostcomposer.writeDirectlyOrGuideTheAi")}
            </span>
          </span>
          <Pencil size={16} />
        </button>
      </div>
    );
  }

  return (
    <SlpComposerShell
      dataComponent="SlurpHome.NoodlerPostComposer"
      header={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
          {collapsible ? (
            <button
              type="button"
              onClick={() => {
                setActiveTool(null);
                setExpanded(false);
              }}
              disabled={composerBusy}
              aria-expanded="true"
              className="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-lg px-1 text-xs font-bold text-[var(--noodle-accent)] hover:bg-[var(--accent)] disabled:opacity-50"
            >
              <ChevronDown size={14} />
              <span className="truncate">
                {localizeUi("ui.noodle.noodlerpostcomposer.postAs")} {profile.displayName}
              </span>
            </button>
          ) : (
            <span />
          )}
          <div
            className="grid grid-cols-2 rounded-lg bg-[var(--accent)] p-1 ring-1 ring-inset ring-[var(--noodle-divider)]"
            aria-label={localizeUi("ui.slurp.stories.postType")}
          >
            {(["post", "story"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={postType === option}
                disabled={composerBusy}
                onClick={() => {
                  setActiveTool(null);
                  updateDraft({
                    postType: option,
                    ...(option === "story" ? { poll: null, title: "" } : { linkedPostId: null }),
                  });
                }}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50",
                  postType === option
                    ? SLURP_TOGGLE_ACTIVE_CLASS
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                )}
              >
                {localizeUi(`ui.slurp.stories.type.${option}`)}
              </button>
            ))}
          </div>
        </div>
      }
      avatar={<ProfileInitial profile={profile} />}
      tools={
        <SlpComposerToolRow
          image={{
            ref: imageToolRef,
            active: activeTool === "image" || Boolean(image),
            disabled: composerBusy,
            onClick: () => toggleTool("image"),
          }}
          poll={{
            ref: pollToolRef,
            active: activeTool === "poll" || Boolean(poll),
            disabled: composerBusy || postType === "story",
            onClick: () => toggleTool("poll"),
          }}
          media={{
            ref: mediaToolRef,
            active: activeTool === "media",
            disabled: composerBusy,
            onClick: () => toggleTool("media"),
          }}
          trailing={
            <>
              <button
                type="button"
                onClick={() => updateDraft({ generateImage: !generateImage })}
                disabled={composerBusy || Boolean(image)}
                aria-pressed={generateImage}
                title={localizeUi("ui.slurp.composer.aiImageHint", {
                  defaultValue: "Let the AI create an image for this post from your text.",
                })}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold disabled:opacity-50",
                  generateImage
                    ? "bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                )}
              >
                <Sparkles size={13} />
                {localizeUi("ui.slurp.composer.aiImage", { defaultValue: "AI image" })}
              </button>
              <div ref={accessToolRef} className="relative">
                <button
                  type="button"
                  onClick={() => toggleTool("access")}
                  disabled={composerBusy}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
                  aria-label={localizeUi("ui.noodle.noodlerpostcomposer.postVisibilityValue", {
                    value: localizeUi(`ui.noodle.postaccess.${access}`),
                  })}
                  title={localizeUi(`ui.noodle.postaccess.${access}.hint`)}
                >
                  <Lock size={13} />
                  {localizeUi(`ui.noodle.postaccess.${access}`)}
                </button>
              </div>
            </>
          }
        />
      }
      action={
        <>
          <label className="inline-flex h-9 items-center gap-1.5 text-xs font-bold">
            <span className="sr-only">{localizeUi("ui.slurp.composer.purpose")}</span>
            <select
              value={contentIntent ?? ""}
              disabled={composerBusy || postType === "story"}
              title={localizeUi(`ui.slurp.composer.purposeHint.${contentIntent ?? "auto"}`)}
              onChange={(event) => {
                const next = (event.target.value || null) as SlurpContentIntent | null;
                updateDraft({
                  contentIntent: next,
                  contentDelivery:
                    next && contentDelivery && slurpContentDeliveryFits(next, contentDelivery) ? contentDelivery : null,
                });
              }}
              className="h-9 rounded-lg border border-[var(--noodle-divider)] bg-transparent px-2 text-xs font-bold disabled:opacity-50"
            >
              {(["", ...SLURP_CONTENT_INTENTS] as const).map((intent) => (
                <option key={intent || "auto"} value={intent}>
                  {localizeUi(`ui.slurp.composer.intent.${intent || "auto"}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex h-9 items-center gap-1.5 text-xs font-bold">
            <span className="sr-only">{localizeUi("ui.slurp.composer.delivery")}</span>
            <select
              value={contentDelivery ?? ""}
              disabled={composerBusy || postType === "story" || !contentIntent}
              title={localizeUi(`ui.slurp.composer.deliveryHint.${contentDelivery ?? "auto"}`)}
              onChange={(event) =>
                updateDraft({ contentDelivery: (event.target.value || null) as SlurpContentDelivery | null })
              }
              className="h-9 max-w-40 rounded-lg border border-[var(--noodle-divider)] bg-transparent px-2 text-xs font-bold disabled:opacity-50"
            >
              <option value="">{localizeUi("ui.slurp.composer.delivery.auto")}</option>
              {SLURP_CONTENT_DELIVERIES.filter(
                (delivery) => contentIntent && slurpContentDeliveryFits(contentIntent, delivery),
              ).map((delivery) => (
                <option key={delivery} value={delivery}>
                  {localizeUi(`ui.slurp.composer.delivery.${delivery}`)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void guidePost()}
            disabled={composerBusy || Boolean(pendingImage) || postType === "story"}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--noodle-divider)] px-3 text-xs font-bold hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guidePending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {guidePending
              ? localizeUi("ui.noodle.noodlerpostcomposer.guiding")
              : localizeUi("ui.noodle.noodlerpostcomposer.guide_bf073fa")}
          </button>
          {hasDraft && (
            <button
              type="button"
              onClick={discardDraft}
              disabled={composerBusy}
              className="inline-flex h-9 items-center rounded-lg px-3 text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {localizeUi("ui.agents.agenteditor.discard")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={composerBusy || Boolean(pendingImage) || (!body.trim() && !image && !pollIsValid)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 transition-[opacity,scale] hover:opacity-90 active:scale-[0.96] [&_svg]:!text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {manualPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {manualPending
              ? localizeUi("ui.noodle.noodlerpostcomposer.posting")
              : postType === "story"
                ? localizeUi("ui.slurp.stories.publish")
                : localizeUi("ui.noodle.noodlerpostcomposer.publishPost")}
          </button>
        </>
      }
      popovers={
        <>
          {activeTool === "media" && !composerBusy && (
            <SlpAnchoredPopover anchorRef={mediaToolRef} wide>
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
          {activeTool === "image" && !composerBusy && (
            <SlpAnchoredPopover anchorRef={imageToolRef} wide>
              <SlpImageComposer
                imageUrl={imageUrlDraft}
                onImageUrlChange={setImageUrlDraft}
                onChooseFile={() => {
                  if (!composerBusyRef.current) imageFileRef.current?.click();
                }}
                onUseImageUrl={() => void handleImageUrl()}
                onClose={() => setActiveTool(null)}
                disabled={composerBusy}
                hasImage={Boolean(image)}
                urlActionLabel={localizeUi("ui.noodle.noodlerpostcomposer.importUrl")}
              />
            </SlpAnchoredPopover>
          )}
          {activeTool === "poll" && !composerBusy && (
            <SlpAnchoredPopover anchorRef={pollToolRef} wide>
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
              />
            </SlpAnchoredPopover>
          )}
          {activeTool === "access" && !composerBusy && (
            <SlpAnchoredPopover anchorRef={accessToolRef}>
              <div className="marinara-chat-popover space-y-3 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--background)] p-3 text-[var(--foreground)] shadow-2xl shadow-black/35">
                <p className="text-xs font-bold">{localizeUi("ui.noodle.noodlerpostcomposer.whoCanSeeThisPost")}</p>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--accent)] p-1">
                  {(["public", "locked"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={access === option}
                      disabled={composerBusy}
                      onClick={() => updateDraft({ access: option })}
                      title={localizeUi(`ui.noodle.postaccess.${option}.hint`)}
                      className={cn(
                        "min-h-8 rounded px-2 text-xs font-bold capitalize",
                        access === option
                          ? SLURP_TOGGLE_ACTIVE_CLASS
                          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                      )}
                    >
                      {localizeUi(`ui.noodle.postaccess.${option}`)}
                    </button>
                  ))}
                </div>
                {access === "locked" && (
                  <label className="flex items-center justify-between gap-2 text-xs font-semibold">
                    {localizeUi("ui.noodle.noodlerpostcomposer.unlockPrice", { defaultValue: "Price" })}
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      value={unlockPrice ?? ""}
                      placeholder={localizeUi("ui.noodle.noodlerpostcomposer.unlockPriceDefault", {
                        defaultValue: "Creator default",
                      })}
                      onChange={(event) =>
                        updateDraft({
                          unlockPrice:
                            event.target.value === ""
                              ? null
                              : Math.min(9999, Math.max(0, Math.floor(Number(event.target.value) || 0))),
                        })
                      }
                      className="h-9 w-28 rounded-lg bg-[var(--accent)] px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                    />
                  </label>
                )}
              </div>
            </SlpAnchoredPopover>
          )}
        </>
      }
      footer={
        (postError || guideError || attachmentError) && (
          <div className="mt-2 space-y-1 text-xs text-[var(--destructive)] @min-[480px]:pl-14" role="alert">
            {postError && (
              <p>
                {localizeUi("ui.noodle.noodlerpostcomposer.post")} {postError}
              </p>
            )}
            {guideError && (
              <p>
                {localizeUi("ui.noodle.noodlerpostcomposer.guide")} {guideError}
              </p>
            )}
            {attachmentError && (
              <p>
                {localizeUi("ui.noodle.noodlerpostcomposer.image")} {attachmentError}
              </p>
            )}
          </div>
        )
      }
    >
      <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
      {postType === "post" && (
        <label className="block space-y-1">
          <span className="sr-only">{localizeUi("ui.noodle.noodlerpostcomposer.postTitleOptional")}</span>
          <input
            value={title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            maxLength={SLP_CREATOR_POST_TITLE_MAX_LENGTH}
            disabled={composerBusy}
            placeholder={localizeUi("ui.noodle.noodlerpostcomposer.postTitleOptional")}
            className="h-9 w-full border-0 bg-transparent text-base font-bold text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
          />
        </label>
      )}
      <textarea
        value={body}
        onChange={(event) => updateDraft({ body: event.target.value })}
        maxLength={SLP_CREATOR_POST_CONTENT_MAX_LENGTH}
        disabled={composerBusy}
        aria-label={localizeUi("ui.noodle.noodlerpostcomposer.postBody")}
        placeholder={localizeUi(
          postType === "story" ? "ui.slurp.stories.captionPlaceholder" : "ui.noodle.noodlerpostcomposer.whatSSimmering",
        )}
        className="min-h-20 w-full resize-none border-0 bg-transparent py-2 text-[1rem] leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
      />
      {postType === "story" && (
        <label className="mb-3 block space-y-1">
          <span className="text-xs font-bold text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.stories.linkPost")}
          </span>
          <select
            value={linkedPostId ?? ""}
            onChange={(event) => updateDraft({ linkedPostId: event.target.value || null })}
            disabled={composerBusy}
            className="h-10 w-full rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
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
      {pendingImage && (
        <PostImageCropEditor
          source={pendingImage.source}
          crop={image?.source === pendingImage.source ? image.crop : null}
          disabled={composerBusy}
          // A Story is shown in one tall frame, so an uploaded one is cropped to the same ratio an
          // automatic one is drawn at rather than offering square and landscape.
          lockedRatio={postType === "story" ? storyAspectRatio : undefined}
          onCancel={discardPendingImage}
          onApply={applyImageCrop}
        />
      )}
      {image && !pendingImage && (
        <div className="mb-3 overflow-hidden rounded-xl border border-[var(--noodle-divider)] bg-[var(--noodle-accent)]/10">
          <SlpCreatorDraftImageFrame image={image} />
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--noodle-accent)]">
            <span>{localizeUi("ui.noodle.noodlehome.attachedImage")}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPendingImage({ source: image.source })}
                disabled={composerBusy}
                className="min-h-8 px-2 font-bold disabled:opacity-50"
              >
                {localizeUi("ui.noodle.noodlerpostcomposer.adjust")}
              </button>
              <button
                type="button"
                onClick={removeImage}
                disabled={composerBusy}
                className="min-h-8 px-2 font-bold disabled:opacity-50"
              >
                {localizeUi("ui.noodle.noodlehome.removeAttachedImage")}
              </button>
            </div>
          </div>
        </div>
      )}
      {poll && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-[var(--noodle-divider)] p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{poll.question}</p>
            <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">{poll.options.join(" · ")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => toggleTool("poll")}
              disabled={composerBusy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
              aria-label={localizeUi("ui.noodle.noodlehome.editDraftPoll")}
              title={localizeUi("ui.noodle.noodlehome.editPoll")}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => updateDraft({ poll: null })}
              disabled={composerBusy}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-50"
              aria-label={localizeUi("ui.noodle.noodlehome.removeDraftPoll")}
              title={localizeUi("ui.noodle.noodlehome.removePoll")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}
    </SlpComposerShell>
  );
}
