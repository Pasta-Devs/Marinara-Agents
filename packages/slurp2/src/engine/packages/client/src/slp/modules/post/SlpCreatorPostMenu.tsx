import { ImageIcon, MoreHorizontal, Pencil, RefreshCw, Share2, Trash2 } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import type { NoodlePostCardCtx, NoodlePostCardModel } from "./SlpPostTypes";
import { api } from "../../../lib/api-client";

/** The post's own action menu: edit, regenerate its image, delete, show its context, share it. */
export function SlpCreatorPostMenu({
  post,
  ctx,
  postMenuOpen,
  editablePost,
  startEditingPost,
  deleteNoodlePost,
  imageGenerationPending,
  hasImageContext,
  imageContextOpen,
  setImageContextOpen,
  setPromptDraft,
}: {
  post: NoodlePostCardModel;
  ctx: NoodlePostCardCtx;
  postMenuOpen: boolean;
  editablePost: NoodlePostCardModel;
  startEditingPost: (post: NoodlePostCardModel) => void;
  deleteNoodlePost: (post: NoodlePostCardModel) => void;
  imageGenerationPending: boolean;
  hasImageContext: boolean;
  imageContextOpen: boolean;
  setImageContextOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPromptDraft: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const { t: localizeUi } = useUiTranslation();

  return (
  <div className="relative shrink-0">
    <button
      type="button"
      onClick={() => ctx.setPostMenuId((current) => (current === post.id ? null : post.id))}
      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
      title={localizeUi("ui.noodle.noodlepostcard.postActions")}
      aria-label={localizeUi("ui.noodle.noodlepostcard.postActions")}
      aria-expanded={postMenuOpen}
    >
      <MoreHorizontal size={18} />
    </button>
    {postMenuOpen && (
      <div className="absolute end-0 top-[calc(100%+0.25rem)] z-30 min-w-40 overflow-hidden rounded-lg border border-[var(--noodle-divider)] bg-[var(--background)] py-1 text-xs shadow-2xl shadow-black/30">
        {ctx.postManagement && (
          <>
            <button
              type="button"
              onClick={() => {
                ctx.setPostMenuId(null);
                startEditingPost(editablePost);
              }}
              className="flex min-h-10 w-full items-center gap-2 px-3 text-start transition-colors hover:bg-[var(--accent)]"
            >
              <Pencil size={14} />
              {localizeUi("ui.noodle.noodlepostcard.edit")}
            </button>
            {ctx.generatePostImage && (
              <button
                type="button"
                onClick={() => {
                  ctx.setPostMenuId(null);
                  setPromptDraft(post.imagePrompt ?? "");
                }}
                disabled={imageGenerationPending}
                className="flex min-h-10 w-full items-center gap-2 px-3 text-start transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={imageGenerationPending ? "animate-spin motion-reduce:animate-none" : ""}
                />
                {post.imageUrl
                  ? localizeUi("ui.slurp.image.regenerate", { defaultValue: "Regenerate image" })
                  : localizeUi("ui.slurp.image.generate")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                ctx.setPostMenuId(null);
                deleteNoodlePost(post);
              }}
              className="flex min-h-10 w-full items-center gap-2 px-3 text-start text-[var(--slurp-danger)] transition-colors hover:bg-[var(--slurp-danger)]/10 [&_svg]:!text-[var(--slurp-danger)]"
            >
              <Trash2 size={14} />
              {localizeUi("lorebook.editor.batch.delete")}
            </button>
          </>
        )}
        {hasImageContext && (
          <button
            type="button"
            onClick={() => {
              ctx.setPostMenuId(null);
              setImageContextOpen((open) => !open);
            }}
            className="flex min-h-10 w-full items-center gap-2 px-3 text-start transition-colors hover:bg-[var(--accent)]"
          >
            <ImageIcon size={14} />
            {imageContextOpen
              ? localizeUi("ui.slurp.post.hideImageContext", { defaultValue: "Hide image context" })
              : localizeUi("ui.slurp.post.showImageContext", { defaultValue: "Show image context" })}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            ctx.setPostMenuId(null);
            const persona = ctx.personaAccount?.entityId;
            void api
              .download(
                `/slurp2/noodler/posts/${encodeURIComponent(post.id)}/share-card${persona ? `?personaId=${encodeURIComponent(persona)}` : ""}`,
                `slurp-${post.id}.png`,
              )
              .catch((error: unknown) =>
                toast.error(
                  error instanceof Error
                    ? error.message
                    : localizeUi("ui.slurp.post.shareFailed", {
                        defaultValue: "Could not build the share image.",
                      }),
                ),
              );
          }}
          className="flex min-h-10 w-full items-center gap-2 px-3 text-start transition-colors hover:bg-[var(--accent)]"
        >
          <Share2 size={14} />
          {localizeUi("ui.slurp.post.share", { defaultValue: "Share as image" })}
        </button>
      </div>
    )}
  </div>
  );
}
