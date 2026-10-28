import { slpIsOwnActor } from "../../../../../shared/src/slp/slp-interactions.js";
import {
  Download,
  Flag,
  ImageDown,
  Info,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  ScanSearch,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { SlpSheet, SlpSheetGroup, SlpSheetItem } from "../chrome/SlpSheet";
import { SlpStirGlyph } from "../../base/chrome/SlpGlyphs";
import type { SlpPostCardCtx, SlpPostCardModel } from "./SlpPostTypes";
import { slpPostImagePrompt } from "./SlpPostHelpers";
import { api } from "../../../lib/api-client";
import { downloadSlpShareCard, toSlpShareCardInput } from "./slp-share-card";
import { SlpDeepDetailsModal } from "./SlpDeepDetailsModal";
import { SlpReportModal } from "./SlpReportModal";

/** The canonical post action menu. Items stay ordered from common to destructive actions. */
export function SlpPostMenu({
  post,
  ctx,
  menuKey = post.id,
  postMenuOpen,
  editablePost,
  startEditingPost,
  deleteNoodlePost,
  imageGenerationPending,
  hasImageContext,
  imageContextOpen,
  setImageContextOpen,
  setPromptDraft,
  openCreator,
  onReport,
  onShare,
}: {
  post: SlpPostCardModel;
  ctx: SlpPostCardCtx;
  /** Which card the ⋯ menu belongs to; the post dialog uses its own (R1-029). */
  menuKey?: string;
  postMenuOpen: boolean;
  editablePost: SlpPostCardModel;
  startEditingPost: (post: SlpPostCardModel) => void;
  deleteNoodlePost: (post: SlpPostCardModel) => void;
  imageGenerationPending: boolean;
  hasImageContext: boolean;
  imageContextOpen: boolean;
  setImageContextOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPromptDraft: React.Dispatch<React.SetStateAction<string | null>>;
  openCreator?: () => void;
  onReport?: () => void;
  onShare?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [deepDetailsOpen, setDeepDetailsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const downloadShareCard = (filename: string) => {
    // Its own words, not the share sheet's (R1-044), and never a raw canvas error.
    void downloadSlpShareCard(toSlpShareCardInput(post), filename).catch(() =>
      toast.error(
        localizeUi("ui.slurp.post.saveImageFailed", { defaultValue: "Could not save the post as an image." }),
      ),
    );
  };
  const downloadImage = () => {
    void api
      .download(`/slurp2/noodler/posts/${encodeURIComponent(post.id)}/media`, `slurp-${post.id}-image`)
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error
            ? error.message
            : localizeUi("ui.slurp.post.shareFailed", {
                defaultValue: "Could not download the image.",
              }),
        ),
      );
  };

  const close = () => ctx.setPostMenuId(null);
  const run = (action: () => void) => () => {
    close();
    action();
  };

  return (
    <div className="relative shrink-0">
      {ctx.postManagement && (
        <SlpDeepDetailsModal postId={post.id} open={deepDetailsOpen} onClose={() => setDeepDetailsOpen(false)} />
      )}
      <SlpReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        personaId={ctx.personaAccount?.entityId ?? ""}
        postId={post.id}
        targetType="post"
        targetId={post.id}
      />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => ctx.setPostMenuId((current) => (current === menuKey ? null : menuKey))}
        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
        title={localizeUi("ui.noodle.noodlepostcard.postActions")}
        aria-label={localizeUi("ui.noodle.noodlepostcard.postActions")}
        aria-haspopup="menu"
        aria-expanded={postMenuOpen}
      >
        <MoreHorizontal size={18} />
      </button>
      <SlpSheet
        kind="menu"
        open={postMenuOpen}
        onClose={close}
        anchorRef={triggerRef}
        title={localizeUi("ui.noodle.noodlepostcard.postActions")}
      >
        <SlpSheetGroup>
          {/* Two rows with one outcome each: sending needs a persona, saving never does (04 §8). */}
          <SlpSheetItem
            disabled={!onShare}
            hint={
              onShare
                ? undefined
                : localizeUi("ui.slurp.post.sendInChatNeedsPersona", {
                    defaultValue: "Choose a persona first to send posts in chats.",
                  })
            }
            onSelect={run(() => onShare?.())}
          >
            <Send size={14} />
            {localizeUi("ui.slurp.post.sendInChat", { defaultValue: "Send in a chat" })}
          </SlpSheetItem>
          <SlpSheetItem onSelect={run(() => downloadShareCard(`slurp-${post.id}.png`))}>
            <ImageDown size={14} />
            {localizeUi("ui.slurp.post.saveImage", { defaultValue: "Save as image" })}
          </SlpSheetItem>
          {post.imageUrl && (
            <SlpSheetItem onSelect={run(downloadImage)}>
              <Download size={14} />
              {localizeUi("ui.slurp.post.downloadImage", { defaultValue: "Download image" })}
            </SlpSheetItem>
          )}
          {openCreator && (
            <SlpSheetItem onSelect={run(openCreator)}>
              <UserRound size={14} />
              {localizeUi("ui.slurp.post.openCreator", { defaultValue: "Open creator" })}
            </SlpSheetItem>
          )}
          {/* Your own Creator's post cannot be reported (the server refuses with 403, R1-033). */}
          {onReport || (ctx.personaAccount && !slpIsOwnActor(ctx.personaAccount, post.authorAccountId)) ? (
            <SlpSheetItem onSelect={run(() => (onReport ? onReport() : setReportOpen(true)))}>
              <Flag size={14} />
              {localizeUi("ui.slurp.post.report", { defaultValue: "Report post" })}
            </SlpSheetItem>
          ) : null}
        </SlpSheetGroup>
        {(ctx.postManagement || hasImageContext || ctx.stir) && (
          // Operator actions stay inline but come last and quieter than fan actions (design language §8).
          <SlpSheetGroup label={localizeUi("ui.slurp.post.creatorTools", { defaultValue: "Creator tools" })}>
            {ctx.stir && !slpIsOwnActor(ctx.personaAccount, post.authorAccountId) && (
              // W: make something happen from this post (a follow-up, a reply from someone, drama).
              <SlpSheetItem onSelect={run(() => ctx.stir?.({ id: post.id, authorAccountId: post.authorAccountId }))}>
                <SlpStirGlyph size={14} />
                {localizeUi("ui.slurp.stir.fromPost")}
              </SlpSheetItem>
            )}
            {ctx.postManagement && (
              <SlpSheetItem tone="muted" onSelect={run(() => startEditingPost(editablePost))}>
                <Pencil size={14} />
                {localizeUi("ui.noodle.noodlepostcard.edit")}
              </SlpSheetItem>
            )}
            {ctx.postManagement && ctx.generatePostImage && (
              <SlpSheetItem
                tone="muted"
                disabled={imageGenerationPending}
                onSelect={run(() => setPromptDraft(slpPostImagePrompt(post) ?? ""))}
              >
                <RefreshCw
                  size={14}
                  className={imageGenerationPending ? "animate-spin motion-reduce:animate-none" : ""}
                />
                {post.imageUrl
                  ? localizeUi("ui.slurp.image.regenerate", { defaultValue: "Regenerate image" })
                  : localizeUi("ui.slurp.image.generate")}
              </SlpSheetItem>
            )}
            {hasImageContext && (
              <SlpSheetItem tone="muted" onSelect={run(() => setImageContextOpen((open) => !open))}>
                <Info size={14} />
                {imageContextOpen
                  ? localizeUi("ui.slurp.post.hideImageContext", { defaultValue: "Hide how this picture was made" })
                  : localizeUi("ui.slurp.post.showImageContext", { defaultValue: "How this picture was made" })}
              </SlpSheetItem>
            )}
            {ctx.postManagement && (
              <SlpSheetItem tone="muted" onSelect={run(() => setDeepDetailsOpen(true))}>
                <ScanSearch size={14} />
                {localizeUi("ui.slurp.deepDetails.title", { defaultValue: "Deep details" })}
              </SlpSheetItem>
            )}
            {ctx.postManagement && (
              <SlpSheetItem tone="danger" onSelect={run(() => deleteNoodlePost(post))}>
                <Trash2 size={14} />
                {localizeUi("lorebook.editor.batch.delete")}
              </SlpSheetItem>
            )}
          </SlpSheetGroup>
        )}
      </SlpSheet>
    </div>
  );
}

/** Small presentation-only menu for image tiles and Story surfaces. */
export function SlpPostSurfaceMenu({
  onDownload,
  onShare,
  onOpenCreator,
  deepDetailsPostId,
}: {
  onDownload?: () => void;
  onShare?: () => void;
  onOpenCreator?: () => void;
  /** The post whose Deep details this menu opens; omit on surfaces that are not the player's to manage. */
  deepDetailsPostId?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const [deepDetailsOpen, setDeepDetailsOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="relative">
      {deepDetailsPostId && (
        <SlpDeepDetailsModal
          postId={deepDetailsPostId}
          open={deepDetailsOpen}
          onClose={() => setDeepDetailsOpen(false)}
        />
      )}
      <button
        type="button"
        aria-label={localizeUi("ui.noodle.noodlepostcard.postActions")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-sm hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-[calc(100%+0.25rem)] z-40 min-w-40 overflow-hidden rounded-lg border border-white/15 bg-black/85 py-1 text-xs text-white shadow-2xl backdrop-blur-md"
        >
          {onDownload && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onDownload();
              }}
              className="flex min-h-10 w-full items-center gap-2 px-3 text-start hover:bg-white/10"
            >
              <Download size={14} /> {localizeUi("ui.slurp.post.downloadImage", { defaultValue: "Download image" })}
            </button>
          )}
          {onShare && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onShare();
              }}
              className="flex min-h-10 w-full items-center gap-2 px-3 text-start hover:bg-white/10"
            >
              <ImageDown size={14} /> {localizeUi("ui.slurp.post.saveImage", { defaultValue: "Save as image" })}
            </button>
          )}
          {deepDetailsPostId && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                setDeepDetailsOpen(true);
              }}
              className="flex min-h-10 w-full items-center gap-2 px-3 text-start hover:bg-white/10"
            >
              <ScanSearch size={14} /> {localizeUi("ui.slurp.deepDetails.title", { defaultValue: "Deep details" })}
            </button>
          )}
          {onOpenCreator && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onOpenCreator();
              }}
              className="flex min-h-10 w-full items-center gap-2 px-3 text-start hover:bg-white/10"
            >
              <UserRound size={14} /> {localizeUi("ui.slurp.post.openCreator", { defaultValue: "Open creator" })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
