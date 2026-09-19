import { Check, CheckCheck, Heart, Lock, Moon } from "lucide-react";
import { useOpenSlurpCreatorThread, useSlurpComposeTargets } from "../../features/messages/slp-messages-hooks";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import {
  CommissionRequest,
  CommissionRow,
  isCommissionRequest,
  SlurpCommissionsPanel,
} from "./commissions/SlpCommissions";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { cn } from "../../../lib/utils";
import { Avatar } from "../../base/chrome/SlpChrome";
import { formatTime } from "../../base/ui/slp-date-time";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "../../modules/coin/SlpCoin";
import type { SlurpMessage, SlurpThread, SlurpThreadRelationship } from "../../features/messages/slp-messages-contract";
import { useReactToSlurpMessage, useUnlockSlurpMessage } from "../../features/messages/slp-message-action-hooks";
import {
  useSlurpCompose,
  useSlurpMessagePrompt,
  useSlurpOlderMessages,
  useSlurpThread,
  useSlurpThreads,
} from "../../features/messages/slp-messages-hooks";
import { useSlurpSettings, useUpdateSlurpSettings } from "../../features/settings/slp-settings-contract";
import {
  SlurpPromptDebugPanel,
  SlurpRapportBadge,
  SlurpRelationshipPanel,
  SlurpTierLadder,
  useDismissablePopover,
} from "./SlpMessageInsights";

// One message in a thread, the away animation and the platform action card.

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
}: {
  message: SlurpMessage;
  locale: string;
  personaId?: string | null;
  ownsCreator: boolean;
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
  if (message.kind === "post_preview") {
    const preview = message.metadata;
    const previewTitle = typeof preview.title === "string" ? preview.title : message.content;
    const previewContent = typeof preview.content === "string" ? preview.content : "";
    const locked = preview.access === "locked" || preview.previewLocked === true;
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
  return (
    <div
      className={cn(
        "flex max-w-[88%] flex-col gap-1 sm:max-w-[78%]",
        mine ? "self-end items-end" : "self-start items-start",
      )}
    >
      <div
        className={cn(
          "whitespace-pre-wrap break-words rounded-[1.15rem] px-3.5 py-2.5 text-sm leading-relaxed shadow-[var(--slurp-shadow-raised)]",
          mine
            ? "rounded-br-[0.35rem] bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950"
            : "rounded-bl-[0.35rem] bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]",
        )}
      >
        {message.kind === "ppv" && !message.unlockedAt ? (
          <button
            type="button"
            disabled={!personaId || unlock.isPending}
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
            className="relative inline-flex min-h-11 items-center gap-1.5 overflow-visible rounded-lg px-1 text-left text-[var(--muted-foreground)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-60"
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
      </div>
      {/* Paid messages are usually a picture. The column existed; nothing ever rendered it. */}
      {messageImage && (
        <img
          src={messageImage}
          alt={localizeUi("ui.slurp.messages.attachedImage", { defaultValue: "Attached image" })}
          className="mt-1 max-h-72 w-auto max-w-full rounded-2xl object-contain ring-1 ring-inset ring-[var(--noodle-divider)]"
        />
      )}
      {unlock.isError && (
        <p role="alert" className="px-1 text-[0.65rem] text-red-600 dark:text-red-400">
          {unlock.error instanceof Error
            ? unlock.error.message
            : localizeUi("ui.slurp.messages.unlockFailed", { defaultValue: "Unlock failed." })}
        </p>
      )}
      <time dateTime={message.createdAt} className="px-1 text-xs text-[var(--muted-foreground)]">
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
            {message.readAt ? <CheckCheck size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
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
      {message.role === "creator" && !ownsCreator && personaId && (
        <button
          type="button"
          aria-label={localizeUi("ui.slurp.messages.heart", { defaultValue: "Heart message" })}
          onClick={() =>
            react.mutate({
              personaId,
              messageId: message.id,
              reaction: message.metadata.reaction === "heart" ? null : "heart",
            })
          }
          className={cn(
            "self-start px-1 text-xs",
            message.metadata.reaction === "heart" ? "text-red-500" : "text-[var(--muted-foreground)]",
          )}
        >
          <Heart size={14} fill={message.metadata.reaction === "heart" ? "currentColor" : "none"} />
        </button>
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
