import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_IMG_FRAME_CLASS, slpImgFade } from "../../base/chrome/SlpChrome";
import { useNearViewportSlurpMediaSrc } from "../../base/media/slp-media-src";
import { slpErrorText } from "../../base/ui/slp-error-text";
import { SlurpCoinAmount } from "../../modules/coin/SlpCoin";
import { SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpLockedMediaTile } from "../../modules/post/SlpLockedMedia";
import { slpShowPostInPlace, slpShowPostWhenRendered } from "../../modules/post/SlpPostPurposeNote";
import { playSlpSpendMoment } from "../../modules/sparkle/SlpSparkle";
import { useUnlockCreatorPost } from "../feed/slp-feed-contract";
import type { SlurpMessage } from "./slp-messages-contract";
import { slpPostMediaRatio } from "../../modules/post/slp-post-ratio";

const text = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * A post sent into a chat, by anyone (the Creator, the player, a fan, Slurp Support), as a small
 * post card: the picture fading in, whose post it is, the caption, and a locked post's blurred
 * teaser with its Unlock. Tapping it opens the author's page at that post.
 *
 * The picture comes from the post itself, not from the message, so a locked share still shows its
 * teaser (the media route serves a locked reader only the blurred copy) and a share made before the
 * message carried a picture gets one too.
 */
export function SlpSharedPostCard({
  message,
  personaId,
  ownsCreator,
  mine,
  onOpenProfile,
}: {
  message: SlurpMessage;
  personaId?: string | null;
  ownsCreator: boolean;
  mine: boolean;
  onOpenProfile?: (accountId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const unlock = useUnlockCreatorPost();
  const meta = message.metadata ?? {};
  const postId = text(meta.postId);
  const title = text(meta.title) || message.content;
  const content = text(meta.content);
  const authorName = text(meta.authorName);
  const authorId = text(meta.authorAccountId) || (message.role === "creator" ? message.senderAccountId : "");
  const price = typeof meta.price === "number" ? meta.price : null;
  // V: the card keeps the post's own picture ratio (4:5 to 1.91:1); older shares use Slurp's 4:5.
  const frameRatio = slpPostMediaRatio({
    width: typeof meta.imageWidth === "number" ? meta.imageWidth : null,
    height: typeof meta.imageHeight === "number" ? meta.imageHeight : null,
  });
  // `previewLocked` is decided per reader on the server; older cards fall back to the post's access.
  const [unlocked, setUnlocked] = useState(false);
  const locked =
    !ownsCreator &&
    !unlocked &&
    (typeof meta.previewLocked === "boolean" ? meta.previewLocked : meta.access === "locked");
  // The owner's side reads its own post without a persona; a reader's side is access-checked.
  const mediaUrl = postId
    ? `/api/slurp2/noodler/posts/${encodeURIComponent(postId)}/media${
        !ownsCreator && personaId ? `?personaId=${encodeURIComponent(personaId)}${unlocked ? "&open=1" : ""}` : ""
      }`
    : null;
  const { src, observe, failed } = useNearViewportSlurpMediaSrc(locked ? null : mediaUrl, { width: 480 });
  const openPost = () => {
    if (!postId) return;
    if (slpShowPostInPlace(postId)) return;
    if (!authorId || !onOpenProfile) return;
    onOpenProfile(authorId);
    window.setTimeout(() => slpShowPostWhenRendered(postId), 250);
  };
  const unlockNow = async (button: HTMLElement) => {
    if (!personaId || !postId || unlock.isPending) return;
    const origin = button.getBoundingClientRect();
    try {
      await unlock.mutateAsync({ personaId, postId });
    } catch {
      return; // The error line under the card says what went wrong.
    }
    playSlpSpendMoment(origin);
    setUnlocked(true);
  };
  const openLabel = localizeUi("ui.slurp.messages.openSharedPost", {
    defaultValue: "Open {{name}}'s post",
    name: authorName || localizeUi("ui.slurp.messages.postPreview", { defaultValue: "Shared post" }),
  });
  return (
    <div className={cn("flex w-[min(16rem,70vw)] flex-col gap-1", mine ? "items-end" : "items-start")}>
      <div className="w-full overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--slurp-surface-raised)_95%,transparent)] shadow-[var(--slurp-highlight),var(--slurp-shadow-raised)] ring-1 ring-inset ring-[var(--noodle-divider)]">
        {locked ? (
          <div className="relative">
            <SlpLockedMediaTile
              imageUrl={mediaUrl}
              // The price is on the Unlock button, like a paid message.
              unlockPrice={null}
              label={localizeUi("ui.slurp.messages.lockedPostPreview", { defaultValue: "Locked post preview" })}
              className="w-full"
              style={{ aspectRatio: frameRatio }}
            />
            {meta.access === "locked" && personaId && !ownsCreator ? (
              <SlpPrimaryButton
                disabled={unlock.isPending}
                onClick={(event) => void unlockNow(event.currentTarget)}
                className="absolute inset-x-4 bottom-4 shadow-[0_0_0_1px_color-mix(in_srgb,white_30%,transparent),0_10px_34px_-6px_var(--noodle-accent),var(--slurp-highlight)]"
              >
                {localizeUi("ui.noodle.lockednoodlerpostcard.unlock", { defaultValue: "Unlock" })}
                {price !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <SlurpCoinAmount amount={price} className="font-extrabold tabular-nums" />
                  </>
                )}
              </SlpPrimaryButton>
            ) : (
              // Subscribers only: unlocking is not the way in, the Creator's page is.
              postId && (
                <SlpPrimaryButton
                  onClick={openPost}
                  className="absolute inset-x-4 bottom-4 shadow-[0_0_0_1px_color-mix(in_srgb,white_30%,transparent),0_10px_34px_-6px_var(--noodle-accent),var(--slurp-highlight)]"
                >
                  {localizeUi("ui.slurp.messages.seeSharedPost", { defaultValue: "See post" })}
                </SlpPrimaryButton>
              )
            )}
          </div>
        ) : (
          mediaUrl &&
          !failed && (
            <button
              ref={observe}
              type="button"
              onClick={openPost}
              aria-label={openLabel}
              className={cn(
                SLP_IMG_FRAME_CLASS,
                "relative block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]",
              )}
              style={{ aspectRatio: frameRatio }}
            >
              {src && (
                <img
                  key={src}
                  src={src}
                  alt=""
                  decoding="async"
                  {...slpImgFade}
                  className="slp-crop h-full w-full object-cover"
                />
              )}
            </button>
          )
        )}
        <button
          type="button"
          onClick={openPost}
          aria-label={openLabel}
          className="block w-full px-3.5 pb-3 pt-2.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]"
        >
          <span className="flex min-w-0 items-center gap-2 text-xs text-[var(--slurp-muted)]">
            {authorName ? (
              <>
                <Avatar
                  account={{ displayName: authorName, avatarUrl: text(meta.authorAvatarUrl) || null }}
                  size="xs"
                />
                <span className="truncate font-semibold text-[var(--slurp-text)]">{authorName}</span>
                {text(meta.authorHandle) && <span className="truncate">@{text(meta.authorHandle)}</span>}
              </>
            ) : (
              <span className="font-semibold text-[var(--slurp-ink)]">
                {localizeUi("ui.slurp.messages.postPreview", { defaultValue: "Shared post" })}
              </span>
            )}
          </span>
          {title && (
            <span className="mt-1.5 block text-[13px] font-bold leading-5 [overflow-wrap:anywhere]">{title}</span>
          )}
          {!locked && content && content !== title && (
            <span className="mt-0.5 line-clamp-2 block whitespace-pre-wrap text-[13px] leading-[19px] text-[var(--slurp-muted)] [overflow-wrap:anywhere]">
              {content}
            </span>
          )}
        </button>
      </div>
      {unlock.isError && (
        <p role="alert" className="px-2 text-xs text-[var(--slurp-danger)]">
          {slpErrorText(
            unlock.error,
            localizeUi("ui.slurp.messages.unlockFailed", { defaultValue: "Unlock failed." }),
            localizeUi("ui.slurp.wallet.notEnoughCoins", { defaultValue: "Not enough coins." }),
          )}
        </p>
      )}
    </div>
  );
}
