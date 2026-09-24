import { Check, CheckCheck, Heart, Lock, Moon } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import { Avatar } from "../../base/chrome/SlpChrome";
import { formatTime } from "../../base/ui/slp-date-time";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "../../modules/coin/SlpCoin";
import type { SlurpMessage, SlurpThreadRelationship } from "../../features/messages/slp-messages-contract";
import { useReactToSlurpMessage, useUnlockSlurpMessage } from "../../features/messages/slp-message-action-hooks";

// One message in a thread, the away animation and the platform action card.

/** Where a bubble sits in a run of quick messages from one sender. */
export type SlurpBubbleGroup = "single" | "first" | "middle" | "last";

/** Messages this close together from one side read as one burst, like a texting app shows them. */
const SLURP_BUBBLE_GROUP_MS = 3 * 60_000;
const UNGROUPED_KINDS = new Set(["tip", "post_preview", "broadcast", "system"]);

type SlurpTimelineEntryLike = { kind: string; at: string; message?: SlurpMessage };

/**
 * The bubble's place in its burst. A burst breaks on a change of sender, a gap of three minutes,
 * a new day, a card that is not a plain bubble, or the unread line.
 */
export function slurpBubbleGroup(
  entries: readonly SlurpTimelineEntryLike[],
  index: number,
  breakBeforeId: string | null,
): SlurpBubbleGroup {
  const joins = (left: SlurpTimelineEntryLike | undefined, right: SlurpTimelineEntryLike | undefined) => {
    if (left?.kind !== "message" || right?.kind !== "message" || !left.message || !right.message) return false;
    const a = left.message;
    const b = right.message;
    if (
      a.role !== b.role ||
      a.kind !== b.kind ||
      UNGROUPED_KINDS.has(a.kind) ||
      UNGROUPED_KINDS.has(b.kind) ||
      a.metadata.paymentReaction ||
      b.metadata.paymentReaction
    )
      return false;
    if (b.id === breakBeforeId) return false;
    const gap = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return gap >= 0 && gap <= SLURP_BUBBLE_GROUP_MS && a.createdAt.slice(0, 10) === b.createdAt.slice(0, 10);
  };
  const withPrevious = joins(entries[index - 1], entries[index]);
  const withNext = joins(entries[index], entries[index + 1]);
  if (withPrevious && withNext) return "middle";
  if (withPrevious) return "last";
  if (withNext) return "first";
  return "single";
}

/**
 * The motion for the whole conversation, once. A new bubble lands with a squash and a settle, the
 * way a drop of liquid does, and a bubble's corners ease into shape when the next one joins it.
 */
export function SlurpBubbleStyles() {
  return (
    <style>{`
      .slurp-bubble-in { animation: slurp-bubble-in 560ms cubic-bezier(0.2, 0.9, 0.25, 1) both; }
      .slurp-bubble-in[data-side="end"] { transform-origin: 100% 100%; }
      .slurp-bubble-in[data-side="start"] { transform-origin: 0% 100%; }
      @keyframes slurp-bubble-in {
        0% { opacity: 0; transform: translate3d(0, 10px, 0) scale(0.55, 0.45); filter: blur(3px); }
        45% { opacity: 1; transform: translate3d(0, -2px, 0) scale(1.05, 0.96); filter: blur(0); }
        70% { transform: translate3d(0, 0, 0) scale(0.98, 1.02); }
        100% { transform: none; }
      }
      .slurp-sheet-in { animation: slurp-sheet-in 320ms cubic-bezier(0.2, 0.9, 0.25, 1) both; transform-origin: 50% 100%; }
      @keyframes slurp-sheet-in {
        0% { opacity: 0; transform: translate3d(0, 12px, 0) scale(0.96); }
        100% { opacity: 1; transform: none; }
      }
      .slurp-heart-pop { animation: slurp-heart-pop 420ms cubic-bezier(0.3, 1.6, 0.4, 1) both; }
      @keyframes slurp-heart-pop {
        0% { transform: scale(0); }
        60% { transform: scale(1.3); }
        100% { transform: scale(1); }
      }
      .slurp-typing-dot { animation: slurp-typing 1.3s ease-in-out infinite; }
      @keyframes slurp-typing {
        0%, 60%, 100% { transform: translate3d(0, 0, 0); opacity: 0.45; }
        30% { transform: translate3d(0, -4px, 0); opacity: 1; }
      }
      .slurp-bubble-shape { transition: border-radius 320ms cubic-bezier(0.2, 0.9, 0.25, 1); }
      @media (prefers-reduced-motion: reduce) {
        .slurp-bubble-in, .slurp-sheet-in, .slurp-heart-pop { animation: none; }
        .slurp-typing-dot { animation: none; opacity: 0.7; }
        .slurp-bubble-shape { transition: none; }
      }
    `}</style>
  );
}

const BIG = "1.25rem";
const SMALL = "0.4rem";

/** Corners in `border-radius` order. The sender's side tightens where the burst continues. */
function bubbleRadius(group: SlurpBubbleGroup, mine: boolean): string {
  const top = group === "middle" || group === "last" ? SMALL : BIG;
  const bottom = SMALL;
  // top-left, top-right, bottom-right, bottom-left
  return mine ? `${BIG} ${top} ${bottom} ${BIG}` : `${top} ${BIG} ${BIG} ${bottom}`;
}

/** The little curl under the last bubble of a burst. */
export function SlurpBubbleTail({ mine, color }: { mine: boolean; color: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 16"
      className="pointer-events-none absolute bottom-0 h-4 w-3"
      style={mine ? { right: -7 } : { left: -7, transform: "scaleX(-1)" }}
    >
      <path d="M0 0C0 8 4 14 12 16H0Z" fill={color} />
    </svg>
  );
}

/** A plain bubble surface, shared by messages, the pending echo and the typing indicator. */
export function slurpBubbleSurface(mine: boolean): string {
  return mine
    ? "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--noodle-accent)_82%,white),var(--noodle-accent))] text-zinc-950 [&_svg]:!text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.12)]"
    : "bg-[var(--slurp-surface)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-inset ring-[var(--noodle-divider)]";
}
export const SLURP_BUBBLE_TAIL_COLOR = { mine: "var(--noodle-accent)", theirs: "var(--slurp-surface)" };

export function SlurpAwayAnimation({ account }: { account: Parameters<typeof Avatar>[0]["account"] | null }) {
  return (
    <div className="slurp-away relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32" aria-hidden="true">
      <style>{`
        .slurp-away-glow { animation: slurp-away-breathe 3.2s ease-in-out infinite; }
        .slurp-away-mote { animation: slurp-away-rise 3.6s ease-in infinite; opacity: 0; }
        .slurp-away-moon { animation: slurp-away-bob 3.2s ease-in-out infinite; }
        @keyframes slurp-away-breathe {
          0%, 100% { transform: scale(0.86); opacity: 0.35; }
          50% { transform: scale(1.08); opacity: 0.7; }
        }
        @keyframes slurp-away-rise {
          0% { transform: translate3d(0, 0, 0) scale(0.5); opacity: 0; }
          20% { opacity: 0.9; }
          100% { transform: translate3d(14px, -38px, 0) scale(1.1); opacity: 0; }
        }
        @keyframes slurp-away-bob {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-8deg); }
          50% { transform: translate3d(0, -3px, 0) rotate(6deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .slurp-away-glow, .slurp-away-moon { animation: none; }
          .slurp-away-mote { animation: none; opacity: 0.5; }
        }
      `}</style>
      <span className="slurp-away-glow absolute inset-2 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--noodle-accent)_45%,transparent),transparent_70%)]" />
      <span className="relative rounded-full opacity-90 grayscale-[20%] ring-4 ring-[var(--slurp-surface-raised)]">
        {account ? (
          <Avatar account={account} size="lg" />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--slurp-surface-raised)]" />
        )}
      </span>
      <span className="slurp-away-moon absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--slurp-surface-raised)] text-[var(--noodle-accent)] shadow-[var(--slurp-shadow-raised)] ring-1 ring-[var(--noodle-divider)] sm:right-3 sm:top-3">
        <Moon size={14} fill="currentColor" />
      </span>
      {[0, 1.2, 2.4].map((delay, index) => (
        <span
          key={delay}
          className="slurp-away-mote absolute right-5 top-6 rounded-full bg-[var(--noodle-accent)]"
          style={{ animationDelay: `${delay}s`, height: 4 + index * 2, width: 4 + index * 2 }}
        />
      ))}
    </div>
  );
}

export function MessageBubble({
  message,
  locale,
  personaId,
  ownsCreator,
  group = "single",
  fresh = false,
}: {
  message: SlurpMessage;
  locale: string;
  personaId?: string | null;
  ownsCreator: boolean;
  group?: SlurpBubbleGroup;
  /** Arrived while the conversation was open, so it lands with the entrance motion. */
  fresh?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const unlock = useUnlockSlurpMessage();
  const react = useReactToSlurpMessage();
  const messageImage = useSlurpMediaSrc(
    message.imageUrl
      ? `${message.imageUrl}${message.imageUrl.includes("?") ? "&" : "?"}personaId=${encodeURIComponent(personaId ?? "")}`
      : null,
  );
  const mine = ownsCreator ? message.role === "creator" : message.role === "viewer";
  if (message.kind === "tip") {
    return (
      <div
        className={cn(
          "flex w-full max-w-sm self-center items-center justify-center gap-2 rounded-2xl bg-[var(--noodle-accent)]/12 px-4 py-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/20",
        )}
      >
        <SlurpCoin size={16} aria-hidden="true" />
        {localizeUi("ui.slurp.messages.tipSent", { defaultValue: "Tip sent" })}{" "}
        <SlurpCoinAmount amount={message.price} />
      </div>
    );
  }
  // A payment marker is bookkeeping, not something the player typed: a small centred note.
  if (message.metadata?.paymentReaction) {
    return (
      <p className="self-center rounded-full bg-[var(--slurp-surface)] px-3 py-1 text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)]">
        {message.content.replace(/^\[|\]$/gu, "")}
      </p>
    );
  }
  if (message.kind === "post_preview") {
    const preview = message.metadata;
    const previewTitle = typeof preview.title === "string" ? preview.title : message.content;
    const previewContent = typeof preview.content === "string" ? preview.content : "";
    // `previewLocked` is decided per viewer on the server; a post the fan already bought is shown
    // open. Older cards without it fall back to the post's access.
    const locked = typeof preview.previewLocked === "boolean" ? preview.previewLocked : preview.access === "locked";
    return (
      <div
        className={cn(
          "flex max-w-[88%] flex-col gap-1 sm:max-w-[78%]",
          mine ? "self-end items-end" : "self-start items-start",
        )}
      >
        <div className="overflow-hidden rounded-2xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
          {messageImage && !locked && (
            <img
              src={messageImage}
              alt={localizeUi("ui.slurp.messages.postPreview", { defaultValue: "Post preview" })}
              className="max-h-72 w-full object-cover"
            />
          )}
          <div className="px-3.5 py-3">
            <p className="text-xs font-bold text-[var(--noodle-accent)]">
              {localizeUi("ui.slurp.messages.postPreview", { defaultValue: "Shared post" })}
            </p>
            {/* A post can now be shared into any chat, so the card names its author. */}
            {typeof preview.authorName === "string" && preview.authorName && (
              <p className="mt-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                {typeof preview.authorAvatarUrl === "string" && preview.authorAvatarUrl && (
                  <img src={preview.authorAvatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                )}
                <span className="truncate font-semibold text-[var(--foreground)]">{preview.authorName}</span>
                {typeof preview.authorHandle === "string" && preview.authorHandle && (
                  <span className="truncate">@{preview.authorHandle}</span>
                )}
              </p>
            )}
            <p className="mt-1 text-sm font-semibold">{previewTitle}</p>
            {!locked && previewContent && (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{previewContent}</p>
            )}
            {locked && (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.messages.lockedPostPreview", { defaultValue: "Paid post preview" })}
              </p>
            )}
          </div>
        </div>
        <time dateTime={message.createdAt} className="px-1 text-xs text-[var(--muted-foreground)]">
          {formatTime(message.createdAt, locale)}
        </time>
      </div>
    );
  }
  if (message.kind === "broadcast") {
    return (
      <div className="self-start max-w-[88%] rounded-2xl rounded-bl-md bg-[var(--slurp-surface)] px-3.5 py-2.5 ring-1 ring-inset ring-[var(--noodle-divider)]">
        <p className="mb-1 text-[0.65rem] font-black uppercase tracking-[0.08em] text-[var(--noodle-accent)]">
          {localizeUi("ui.slurp.messages.broadcastLabel", { defaultValue: "Broadcast" })}
        </p>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
        <time dateTime={message.createdAt} className="mt-1 block text-xs text-[var(--muted-foreground)]">
          {formatTime(message.createdAt, locale)}
        </time>
      </div>
    );
  }
  const hearted = message.metadata.reaction === "heart";
  const canHeart = message.role === "creator" && !ownsCreator && Boolean(personaId);
  const toggleHeart = () => {
    if (!canHeart || !personaId) return;
    react.mutate({ personaId, messageId: message.id, reaction: hearted ? null : "heart" });
  };
  const closesGroup = group === "single" || group === "last";
  const locked = message.kind === "ppv" && !message.unlockedAt;
  return (
    <div
      data-side={mine ? "end" : "start"}
      className={cn(
        "group/bubble flex max-w-[82%] flex-col gap-1 sm:max-w-[72%]",
        mine ? "self-end items-end" : "self-start items-start",
        // A burst sits close together: three pixels between bubbles instead of the list's gap.
        (group === "middle" || group === "last") && "-mt-[9px]",
        fresh && "slurp-bubble-in",
      )}
    >
      <div className={cn("relative flex items-center gap-1.5", mine && "flex-row-reverse")}>
        <div
          onDoubleClick={toggleHeart}
          style={{ borderRadius: bubbleRadius(group, mine) }}
          className={cn(
            "slurp-bubble-shape relative whitespace-pre-wrap break-words px-3.5 py-2 text-[0.95rem] leading-snug sm:text-sm sm:leading-relaxed",
            slurpBubbleSurface(mine),
          )}
        >
          {locked ? (
            <button
              type="button"
              disabled={!personaId || unlock.isPending}
              onDoubleClick={(event) => event.stopPropagation()}
              onClick={async () => {
                if (!personaId) return;
                const confirmed = await showConfirmDialog({
                  title: localizeUi("ui.slurp.messages.unlockTitle", { defaultValue: "Unlock this photo?" }),
                  message: localizeUi("ui.slurp.messages.unlockDetail", {
                    defaultValue: "This costs {{amount}} coins.",
                    amount: message.price,
                  }),
                  confirmLabel: localizeUi("ui.slurp.messages.unlockConfirm", { defaultValue: "Unlock photo" }),
                });
                if (confirmed) unlock.mutate({ personaId, messageId: message.id });
              }}
              className="relative inline-flex min-h-11 items-center gap-1.5 overflow-visible rounded-full bg-[var(--noodle-accent)]/12 px-3 text-left font-semibold text-[var(--noodle-accent)] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-60 motion-reduce:active:scale-100"
            >
              <SlurpCoinBurst active={unlock.isPending} />
              <Lock size={13} aria-hidden="true" />
              {localizeUi("ui.slurp.messages.unlock", {
                defaultValue: "Unlock for",
              })}
              <SlurpCoinAmount amount={message.price} />
            </button>
          ) : (
            message.content
          )}
          {closesGroup && (
            <SlurpBubbleTail mine={mine} color={mine ? SLURP_BUBBLE_TAIL_COLOR.mine : SLURP_BUBBLE_TAIL_COLOR.theirs} />
          )}
          {hearted && (
            <span
              aria-hidden="true"
              className={cn(
                "slurp-heart-pop absolute -top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--slurp-surface-raised)] text-red-500 shadow-[var(--slurp-shadow-raised)] ring-2 ring-[var(--slurp-surface-raised)]",
                mine ? "-left-2.5" : "-right-2.5",
              )}
            >
              <Heart size={12} fill="currentColor" />
            </span>
          )}
        </div>
        {canHeart && (
          <button
            type="button"
            aria-pressed={hearted}
            aria-label={localizeUi("ui.slurp.messages.heart", { defaultValue: "Heart message" })}
            onClick={toggleHeart}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-[opacity,transform,color] active:scale-90 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:active:scale-100",
              hearted
                ? "text-red-500"
                : "text-[var(--muted-foreground)] opacity-0 group-hover/bubble:opacity-100 [@media(hover:none)]:opacity-50",
            )}
          >
            <Heart size={15} fill={hearted ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        )}
      </div>
      {/* Paid messages are usually a picture. The column existed; nothing ever rendered it. */}
      {messageImage && (
        <img
          src={messageImage}
          alt={localizeUi("ui.slurp.messages.attachedImage", { defaultValue: "Attached image" })}
          className="mt-0.5 max-h-72 w-auto max-w-full rounded-[1.25rem] object-contain shadow-[0_1px_2px_rgba(0,0,0,0.12)] ring-1 ring-inset ring-[var(--noodle-divider)]"
        />
      )}
      {unlock.isError && (
        <p role="alert" className="px-1 text-[0.65rem] text-red-600 dark:text-red-400">
          {unlock.error instanceof Error
            ? unlock.error.message
            : localizeUi("ui.slurp.messages.unlockFailed", { defaultValue: "Unlock failed." })}
        </p>
      )}
      {closesGroup && (
        <time dateTime={message.createdAt} className="px-2 text-[0.68rem] text-[var(--muted-foreground)]">
          {formatTime(message.createdAt, locale)}
          {/* Every sent message carries its own receipt: one check delivered, two checks seen. */}
          {mine && (
            <span
              className={cn(
                "ml-1.5 inline-flex items-center gap-1 font-semibold",
                message.readAt && "text-[var(--noodle-accent)]",
              )}
              title={localizeUi(message.readAt ? "ui.slurp.messages.seen" : "ui.slurp.messages.delivered", {
                defaultValue: message.readAt ? "Seen" : "Delivered",
              })}
            >
              {message.readAt ? <CheckCheck size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
              <span className="sr-only">
                {message.readAt
                  ? localizeUi("ui.slurp.messages.seenAt", {
                      defaultValue: "Seen {{time}}",
                      time: formatTime(message.readAt, locale),
                    })
                  : localizeUi("ui.slurp.messages.delivered", { defaultValue: "Delivered" })}
              </span>
            </span>
          )}
        </time>
      )}
    </div>
  );
}

export function SlurpPlatformActionCard({
  message,
  relationship,
}: {
  message: SlurpMessage;
  relationship?: SlurpThreadRelationship;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <article className="mx-auto flex w-full max-w-md items-center gap-3 rounded-lg bg-[var(--slurp-surface-raised)] px-4 py-3 shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-[var(--noodle-divider)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent)]">
        <SlurpCoin size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black">
          {localizeUi("ui.slurp.messages.tipFeatureTitle", { defaultValue: "Tip sent" })}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.messages.tipFeatureDetail", {
            defaultValue: "{{amount}} coins were sent as a gift. It does not guarantee a reply.",
            amount: message.price,
          })}
        </span>
        {relationship && (
          <span className="mt-1 block text-[0.68rem] font-semibold text-[var(--noodle-accent)]">
            {localizeUi("ui.slurp.messages.relationshipAfterTip", {
              defaultValue: "Relationship: {{tier}}",
              tier: localizeUi(`ui.slurp.rapport.tier.${relationship.tier}`),
            })}
          </span>
        )}
      </span>
    </article>
  );
}

/**
 * Send one paid broadcast to every active subscriber.
 *
 * Collapsed until asked for: it is a creator-side tool sitting on top of a fan-side inbox, and an
 * always-open textarea there reads like the place you write to whoever you last spoke to.
 */
