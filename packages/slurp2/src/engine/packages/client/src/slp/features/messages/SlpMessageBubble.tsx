import { Camera, Check, CheckCheck, Cloud, Copy, Dumbbell, Moon, Plane, WifiOff } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SlpHeartGlyph } from "../../base/chrome/SlpGlyphs";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_IMG_FRAME_CLASS, slpImgFade } from "../../base/chrome/SlpChrome";
import { SlurpSparkleVeil } from "../../base/chrome/SlpSparkleVeil";
import { formatClockTime } from "../../base/ui/slp-date-time";
import { SlurpCoin, SlurpCoinAmount, SlpCoinText } from "../../modules/coin/SlpCoin";
import { SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpSheet, SlpSheetItem } from "../../modules/chrome/SlpSheet";
import { SlpLockedMediaTile } from "../../modules/post/SlpLockedMedia";
import { playSlpPop, playSlpSpendMoment } from "../../modules/sparkle/SlpSparkle";
import type { SlurpMessage, SlurpThreadRelationship } from "../../features/messages/slp-messages-contract";
import { SlpDeskNoteRow, SlpDeskNoticeRow, SlpDeskStaffLabel } from "./SlpDeskRows";
import { slurpBubbleRadius, type SlurpBubbleGroup } from "./slp-bubble-group";
import type { SlurpAwayKind } from "./slp-away-kind";
import { slpErrorText } from "../../base/ui/slp-error-text";
import { useReactToSlurpMessage, useUnlockSlurpMessage } from "../../features/messages/slp-message-action-hooks";
import { SlpSharedPostCard } from "./SlpSharedPostCard";
import { slurpBubbleSurface } from "../../modules/chrome/SlpChatShell";

// One message in a thread, the away animation and the platform action card.

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
        .slurp-bubble-in, .slurp-heart-pop { animation: none; }
        .slurp-typing-dot { animation: none; opacity: 0.7; }
        .slurp-bubble-shape { transition: none; }
      }
    `}</style>
  );
}

/** Per kind: the badge glyph, its motion, and what drifts off it. "away" is the original card. */
const SLURP_AWAY_ART: Record<
  SlurpAwayKind,
  { Icon: typeof Moon; motion: string; mote: "dot" | "z" | "spark" | "drop" | "trail" | null }
> = {
  away: { Icon: Moon, motion: "bob", mote: "dot" },
  asleep: { Icon: Moon, motion: "sway", mote: "z" },
  busy: { Icon: Camera, motion: "snap", mote: "spark" },
  gym: { Icon: Dumbbell, motion: "lift", mote: "drop" },
  trip: { Icon: Plane, motion: "glide", mote: "trail" },
  cooling: { Icon: Cloud, motion: "drift", mote: "drop" },
  quiet: { Icon: WifiOff, motion: "fade", mote: null },
};

export function SlurpAwayAnimation({
  account,
  kind = "away",
}: {
  account: Parameters<typeof Avatar>[0]["account"] | null;
  kind?: SlurpAwayKind;
}) {
  const art = SLURP_AWAY_ART[kind];
  return (
    <div
      className="slurp-away relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32"
      data-away-kind={kind}
      aria-hidden="true"
    >
      <style>{`
        .slurp-away-glow { animation: slurp-away-breathe 3.2s ease-in-out infinite; }
        .slurp-away-mote { animation: slurp-away-rise 3.6s ease-in infinite; opacity: 0; }
        .slurp-away-moon { animation: slurp-away-bob 3.2s ease-in-out infinite; }
        .slurp-away-moon[data-motion="sway"] { animation: slurp-away-sway 4.4s ease-in-out infinite; }
        .slurp-away-moon[data-motion="snap"] { animation: slurp-away-snap 3.6s ease-in-out infinite; }
        .slurp-away-moon[data-motion="lift"] { animation: slurp-away-lift 1.8s ease-in-out infinite; }
        .slurp-away-moon[data-motion="glide"] { animation: slurp-away-glide 3.8s ease-in-out infinite; }
        .slurp-away-moon[data-motion="drift"] { animation: slurp-away-drift 5s ease-in-out infinite; }
        .slurp-away-moon[data-motion="fade"] { animation: slurp-away-fade 3.4s ease-in-out infinite; }
        .slurp-away-mote[data-mote="z"] { animation: slurp-away-z 4.2s ease-out infinite; }
        .slurp-away-mote[data-mote="spark"] { animation: slurp-away-spark 3.6s ease-out infinite; }
        .slurp-away-mote[data-mote="drop"] { animation: slurp-away-drop 2.6s ease-in infinite; }
        .slurp-away-mote[data-mote="trail"] { animation: slurp-away-trail 3.8s linear infinite; }
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
        @keyframes slurp-away-sway {
          0%, 100% { transform: rotate(-14deg); }
          50% { transform: translate3d(0, 2px, 0) rotate(4deg); }
        }
        @keyframes slurp-away-snap {
          0%, 70%, 100% { transform: rotate(-6deg) scale(1); box-shadow: var(--slurp-shadow-raised); }
          76% { transform: rotate(-2deg) scale(1.1); box-shadow: 0 0 0 6px color-mix(in srgb, var(--noodle-accent) 30%, transparent); }
          84% { transform: rotate(-6deg) scale(1); }
        }
        @keyframes slurp-away-lift {
          0%, 100% { transform: translate3d(0, 1px, 0) rotate(-10deg); }
          50% { transform: translate3d(0, -4px, 0) rotate(-10deg); }
        }
        @keyframes slurp-away-glide {
          0%, 100% { transform: translate3d(-2px, 1px, 0) rotate(-12deg); }
          50% { transform: translate3d(3px, -3px, 0) rotate(-4deg); }
        }
        @keyframes slurp-away-drift {
          0%, 100% { transform: translate3d(-2px, 0, 0); }
          50% { transform: translate3d(2px, -1px, 0); }
        }
        @keyframes slurp-away-fade {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes slurp-away-z {
          0% { transform: translate3d(0, 0, 0) scale(0.6) rotate(-10deg); opacity: 0; }
          25% { opacity: 0.95; }
          100% { transform: translate3d(16px, -34px, 0) scale(1.15) rotate(8deg); opacity: 0; }
        }
        @keyframes slurp-away-spark {
          0%, 60%, 100% { transform: scale(0); opacity: 0; }
          72% { transform: scale(1.2); opacity: 1; }
          86% { transform: scale(0.6); opacity: 0; }
        }
        @keyframes slurp-away-drop {
          0% { transform: translate3d(0, 0, 0) scale(0.7); opacity: 0; }
          25% { opacity: 0.85; }
          100% { transform: translate3d(-4px, 26px, 0) scale(1); opacity: 0; }
        }
        @keyframes slurp-away-trail {
          0% { transform: translate3d(0, 0, 0); opacity: 0; }
          20% { opacity: 0.8; }
          100% { transform: translate3d(-30px, 14px, 0); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .slurp-away-glow, .slurp-away-moon, .slurp-away-moon[data-motion] { animation: none; }
          .slurp-away-mote, .slurp-away-mote[data-mote] { animation: none; opacity: 0.5; }
        }
      `}</style>
      <span className="slurp-away-glow absolute inset-2 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--noodle-accent)_45%,transparent),transparent_70%)]" />
      <span
        className={cn(
          "relative rounded-full opacity-90 ring-4 ring-[var(--slurp-surface-raised)]",
          kind === "quiet" ? "grayscale-[60%]" : "grayscale-[20%]",
        )}
      >
        {account ? (
          <Avatar account={account} size="lg" />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--slurp-surface-raised)]" />
        )}
      </span>
      <span
        className="slurp-away-moon absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--slurp-surface-raised)] text-[var(--noodle-accent)] shadow-[var(--slurp-shadow-raised)] ring-1 ring-[var(--noodle-divider)] sm:right-3 sm:top-3"
        data-motion={art.motion === "bob" ? undefined : art.motion}
      >
        <art.Icon size={14} fill={kind === "away" || kind === "asleep" ? "currentColor" : "none"} />
      </span>
      {art.mote === "dot" &&
        [0, 1.2, 2.4].map((delay, index) => (
          <span
            key={delay}
            className="slurp-away-mote absolute right-5 top-6 rounded-full bg-[var(--noodle-accent)]"
            style={{ animationDelay: `${delay}s`, height: 4 + index * 2, width: 4 + index * 2 }}
          />
        ))}
      {art.mote === "z" &&
        [0, 1.4, 2.8].map((delay, index) => (
          <span
            key={delay}
            data-mote="z"
            className="slurp-away-mote absolute right-4 top-4 font-bold leading-none text-[var(--noodle-accent)]"
            style={{ animationDelay: `${delay}s`, fontSize: 9 + index * 3 }}
          >
            z
          </span>
        ))}
      {art.mote === "spark" &&
        [
          { delay: 0, right: 1, top: 1 },
          { delay: 0.12, right: 11, top: -1 },
          { delay: 0.24, right: -1, top: 11 },
        ].map((spark) => (
          <span
            key={spark.delay}
            data-mote="spark"
            className="slurp-away-mote absolute h-1.5 w-1.5 rotate-45 bg-[var(--noodle-accent)]"
            style={{ animationDelay: `${spark.delay}s`, right: spark.right, top: spark.top }}
          />
        ))}
      {art.mote === "drop" &&
        [0, 0.9, 1.8].map((delay, index) => (
          <span
            key={delay}
            data-mote="drop"
            className="slurp-away-mote absolute top-10 w-1 rounded-full bg-[color-mix(in_srgb,var(--noodle-accent)_70%,white)] sm:top-11"
            style={{ animationDelay: `${delay}s`, height: 5 + index, right: 12 + index * 6 }}
          />
        ))}
      {art.mote === "trail" &&
        [0, 1.3, 2.6].map((delay) => (
          <span
            key={delay}
            data-mote="trail"
            className="slurp-away-mote absolute right-6 top-5 h-1 w-2.5 rounded-full bg-[var(--noodle-accent)]"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
    </div>
  );
}

/** Hold this long for the reaction sheet; two taps this close are a heart. */
const SLURP_LONG_PRESS_MS = 480;
const SLURP_DOUBLE_TAP_MS = 320;

export function MessageBubble({
  message,
  locale,
  personaId,
  ownsCreator,
  group = "single",
  fresh = false,
  onOpenProfile,
}: {
  message: SlurpMessage;
  locale: string;
  personaId?: string | null;
  ownsCreator: boolean;
  group?: SlurpBubbleGroup;
  /** Arrived while the conversation was open, so it lands with the entrance motion. */
  fresh?: boolean;
  /** A shared post opens its author's page. */
  onOpenProfile?: (accountId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const unlock = useUnlockSlurpMessage();
  const react = useReactToSlurpMessage();
  const mine = ownsCreator ? message.role === "creator" : message.role === "viewer";
  const locked = message.kind === "ppv" && !message.unlockedAt;
  const messageImage = useSlurpMediaSrc(
    message.imageUrl
      ? `${message.imageUrl}${message.imageUrl.includes("?") ? "&" : "?"}personaId=${encodeURIComponent(personaId ?? "")}`
      : null,
  );
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // The veil dissolves over the picture once, right after this reader bought it.
  const [dissolving, setDissolving] = useState(false);
  useEffect(() => {
    if (!dissolving || locked) return;
    const timer = window.setTimeout(() => setDissolving(false), 1300);
    return () => window.clearTimeout(timer);
  }, [dissolving, locked]);
  // A heart shows at once; the server answer (or its failure) settles it.
  const serverHearted = message.metadata.reaction === "heart";
  const [heartOverride, setHeartOverride] = useState<boolean | null>(null);
  useEffect(() => setHeartOverride(null), [serverHearted]);
  const hearted = heartOverride ?? serverHearted;
  const canHeart = message.role === "creator" && !ownsCreator && Boolean(personaId);
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  const lastTap = useRef(0);
  const lastPointer = useRef("mouse");
  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => endPress, []);

  // The Support desk's own rows (docs/SUPPORT-DESK.md): a note only the player sees, Slurp's notices.
  if (message.metadata?.deskNote === true) return <SlpDeskNoteRow message={message} />;
  if (message.metadata?.deskNotice === true) return <SlpDeskNoticeRow message={message} />;
  if (message.kind === "tip") {
    // A system line, not a button-like pill: the coin, what happened, the amount.
    return (
      <p className="flex items-center gap-1.5 self-center rounded-full bg-[color-mix(in_srgb,var(--slurp-warm)_12%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--slurp-text)]">
        <SlurpCoin size={14} />
        {localizeUi("ui.slurp.messages.tipSent", { defaultValue: "Tip sent" })}
        <span aria-hidden="true">·</span>
        <SlurpCoinAmount amount={message.price} className="tabular-nums text-[var(--slurp-warm)]" />
        <span aria-hidden="true" className="text-[var(--slurp-muted)]">
          · {formatClockTime(message.createdAt, locale)}
        </span>
      </p>
    );
  }
  // A payment marker is bookkeeping, not something the player typed: a small centred note.
  if (message.metadata?.paymentReaction) {
    return (
      <p className="self-center px-3 py-1 text-xs text-[var(--slurp-muted)]">
        {message.content.replace(/^\[|\]$/gu, "")}
      </p>
    );
  }
  if (message.kind === "post_preview") {
    return (
      <div
        className={cn(
          "flex max-w-[82%] flex-col gap-1 sm:max-w-[72%]",
          mine ? "self-end items-end" : "self-start items-start",
        )}
      >
        <SlpSharedPostCard
          message={message}
          personaId={personaId}
          ownsCreator={ownsCreator}
          mine={mine}
          onOpenProfile={onOpenProfile}
        />
        <time dateTime={message.createdAt} className="px-2 text-xs text-[var(--slurp-muted)]">
          {formatClockTime(message.createdAt, locale)}
        </time>
      </div>
    );
  }
  if (message.kind === "broadcast") {
    return (
      <div className="flex max-w-[82%] flex-col items-start gap-1 self-start sm:max-w-[72%]">
        <div className={cn("rounded-[1.25rem] px-3.5 py-2.5", slurpBubbleSurface(false))}>
          <p className="mb-0.5 text-xs font-semibold text-[var(--slurp-ink)]">
            {localizeUi("ui.slurp.messages.broadcastLabel", { defaultValue: "Broadcast" })}
          </p>
          <p className="whitespace-pre-wrap break-words text-[0.95rem] leading-snug sm:text-sm sm:leading-relaxed">
            {message.content}
          </p>
        </div>
        <time dateTime={message.createdAt} className="px-2 text-xs text-[var(--slurp-muted)]">
          {formatClockTime(message.createdAt, locale)}
        </time>
      </div>
    );
  }

  const toggleHeart = () => {
    if (!canHeart || !personaId) return;
    const next = !hearted;
    setHeartOverride(next);
    // The Pop plays on the badge, which exists from the next frame.
    if (next) window.requestAnimationFrame(() => badgeRef.current && playSlpPop(badgeRef.current));
    react.mutate(
      { personaId, messageId: message.id, reaction: next ? "heart" : null },
      { onError: () => setHeartOverride(null) },
    );
  };
  // Double-tap hearts, a long press (or right click, or Enter) opens the reaction sheet. There is no
  // heart button on each bubble any more: three or four of them per screen were noise.
  const gestures = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      lastPointer.current = event.pointerType;
      if (event.button !== 0) return;
      endPress();
      const { clientX: x, clientY: y } = event;
      press.current = {
        x,
        y,
        timer: window.setTimeout(() => {
          press.current = null;
          lastTap.current = 0;
          setMenuOpen(true);
        }, SLURP_LONG_PRESS_MS),
      };
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const start = press.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) endPress();
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      const tapped = press.current !== null;
      endPress();
      if (!tapped || event.pointerType === "mouse") return;
      if (event.timeStamp - lastTap.current < SLURP_DOUBLE_TAP_MS) {
        lastTap.current = 0;
        toggleHeart();
      } else lastTap.current = event.timeStamp;
    },
    onPointerCancel: endPress,
    onPointerLeave: endPress,
    onDoubleClick: () => {
      if (lastPointer.current !== "mouse") return;
      window.getSelection()?.removeAllRanges();
      toggleHeart();
    },
    onContextMenu: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      endPress();
      setMenuOpen(true);
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ContextMenu" ||
        (event.shiftKey && event.key === "F10")
      ) {
        event.preventDefault();
        setMenuOpen(true);
      }
    },
  };
  const joinsAbove = group === "middle" || group === "last";
  const closesGroup = group === "single" || group === "last";
  const text = locked ? "" : message.content;
  const unlockNow = async (button: HTMLElement) => {
    if (!personaId || unlock.isPending) return;
    // Measured now: the button is gone once the picture is open.
    const origin = button.getBoundingClientRect();
    try {
      await unlock.mutateAsync({ personaId, messageId: message.id });
    } catch {
      return; // The error line below says what went wrong; the tile stays locked.
    }
    playSlpSpendMoment(origin);
    setDissolving(true);
  };
  return (
    <div
      data-side={mine ? "end" : "start"}
      className={cn(
        "flex max-w-[82%] flex-col gap-1 sm:max-w-[72%]",
        mine ? "self-end items-end" : "self-start items-start",
        // A burst sits close together: three pixels between bubbles instead of the list's gap.
        joinsAbove && "-mt-[9px]",
        fresh && "slurp-bubble-in",
      )}
    >
      {/* A kept sign-up chat says who spoke when it was not the player (Slurp Support, a helper). */}
      {typeof message.metadata?.sceneSpeaker === "string" &&
        !joinsAbove &&
        (message.metadata.supportVoice === true || message.metadata.signUpScene === "support" ? (
          // Slurp's staff: a headset and "Staff", the same label the sign-up scene gives Support.
          <SlpDeskStaffLabel name={String(message.metadata.sceneSpeaker)} />
        ) : (
          <p className="px-2 text-xs font-semibold text-[var(--slurp-muted)]">
            {String(message.metadata.sceneSpeaker)}
          </p>
        ))}
      {message.kind === "ppv" && (locked || message.imageUrl) && (
        // The shared locked media tile: blurred stage, Sparkle Veil, lock and price. Bought, it is the
        // picture in the same frame, and the veil dissolves off it once.
        <div className="relative w-[min(15rem,68vw)] overflow-hidden rounded-xl shadow-[var(--slurp-shadow-raised)]">
          {locked ? (
            <>
              <SlpLockedMediaTile
                imageUrl={null}
                label={localizeUi("ui.slurp.messages.lockedContentDetail", {
                  defaultValue: "Unlock this message to view its content.",
                })}
                className="aspect-[4/5] w-full"
              />
              {/* The price is on the button before the tap, on the veil like a locked post. */}
              <SlpPrimaryButton
                disabled={!personaId || unlock.isPending}
                onClick={(event) => void unlockNow(event.currentTarget)}
                className="absolute inset-x-4 bottom-4 shadow-[0_0_0_1px_color-mix(in_srgb,white_30%,transparent),0_10px_34px_-6px_var(--noodle-accent),var(--slurp-highlight)]"
              >
                {localizeUi("ui.noodle.lockednoodlerpostcard.unlock", { defaultValue: "Unlock" })}
                <span aria-hidden="true">·</span>
                <SlurpCoinAmount amount={message.price} className="font-extrabold tabular-nums" />
              </SlpPrimaryButton>
            </>
          ) : (
            <span className={cn(SLP_IMG_FRAME_CLASS, "relative block aspect-[4/5] w-full")}>
              {messageImage && (
                <img
                  key={messageImage}
                  src={messageImage}
                  alt={localizeUi("ui.slurp.messages.attachedImage", { defaultValue: "Attached image" })}
                  {...slpImgFade}
                  className="slp-crop h-full w-full object-cover"
                />
              )}
              {dissolving && <SlurpSparkleVeil className="slp-veil-dissolve z-10" />}
            </span>
          )}
        </div>
      )}
      {text && (
        <div className={cn("relative", hearted && closesGroup && "mb-1.5")}>
          <div
            ref={bubbleRef}
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            {...gestures}
            style={{ borderRadius: slurpBubbleRadius(group, mine) }}
            className={cn(
              "slurp-bubble-shape relative cursor-default whitespace-pre-wrap break-words px-3.5 py-2 text-[0.95rem] leading-snug outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm sm:leading-relaxed [@media(hover:none)]:select-none",
              slurpBubbleSurface(mine),
            )}
          >
            {text}
          </div>
          {hearted && (
            <span
              ref={badgeRef}
              className={cn(
                "slurp-heart-pop absolute -bottom-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--noodle-accent)] shadow-[var(--slurp-shadow-raised)] ring-2 ring-[var(--slurp-canvas)]",
                mine ? "-start-3" : "-end-3",
              )}
            >
              <SlpHeartGlyph size={12} filled className="!text-[var(--slurp-on-accent)]" aria-hidden="true" />
              <span className="sr-only">
                {localizeUi("ui.slurp.messages.hearted", { defaultValue: "You hearted this" })}
              </span>
            </span>
          )}
        </div>
      )}
      {/* Paid messages are usually a picture; a plain picture message sits under its words. */}
      {messageImage && message.kind !== "ppv" && (
        <span className={cn(SLP_IMG_FRAME_CLASS, "relative block w-[min(15rem,68vw)] overflow-hidden rounded-xl")}>
          <img
            key={messageImage}
            src={messageImage}
            alt={localizeUi("ui.slurp.messages.attachedImage", { defaultValue: "Attached image" })}
            {...slpImgFade}
            className="slp-crop block max-h-80 w-full object-cover"
          />
        </span>
      )}
      {unlock.isError && (
        <p role="alert" className="px-2 text-xs text-[var(--slurp-danger)]">
          {/* A 402 says "Not enough coins" (R1-017), like every other spend. */}
          {slpErrorText(
            unlock.error,
            localizeUi("ui.slurp.messages.unlockFailed", { defaultValue: "Unlock failed." }),
            localizeUi("ui.slurp.wallet.notEnoughCoins", { defaultValue: "Not enough coins." }),
          )}
        </p>
      )}
      {closesGroup && (
        <time dateTime={message.createdAt} className="px-2 text-xs text-[var(--slurp-muted)]">
          {formatClockTime(message.createdAt, locale)}
          {/* Every sent message carries its own receipt: one check delivered, two checks seen. */}
          {mine && (
            <span
              className={cn(
                "ms-1.5 inline-flex items-center gap-1 font-semibold",
                message.readAt && "text-[var(--slurp-ink)]",
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
                      time: formatClockTime(message.readAt, locale),
                    })
                  : localizeUi("ui.slurp.messages.delivered", { defaultValue: "Delivered" })}
              </span>
            </span>
          )}
        </time>
      )}
      <SlpSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={localizeUi("ui.slurp.messages.messageMenu", { defaultValue: "Message" })}
        kind="menu"
        anchorRef={bubbleRef}
      >
        {canHeart && (
          <SlpSheetItem
            onSelect={() => {
              setMenuOpen(false);
              toggleHeart();
            }}
          >
            <SlpHeartGlyph filled={hearted} className="!text-[var(--slurp-ink)]" aria-hidden="true" />
            {hearted
              ? localizeUi("ui.slurp.messages.removeHeart", { defaultValue: "Remove heart" })
              : localizeUi("ui.slurp.messages.heart", { defaultValue: "Heart message" })}
          </SlpSheetItem>
        )}
        <SlpSheetItem
          onSelect={() => {
            setMenuOpen(false);
            void navigator.clipboard?.writeText(text);
          }}
        >
          <Copy aria-hidden="true" />
          {localizeUi("ui.slurp.messages.copyText", { defaultValue: "Copy text" })}
        </SlpSheetItem>
      </SlpSheet>
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
    <article className="mx-auto flex w-full max-w-md items-center gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] px-4 py-3 shadow-[var(--slurp-highlight),var(--slurp-shadow-raised)]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--slurp-warm)_14%,transparent)]">
        <SlurpCoin size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold">
          {localizeUi("ui.slurp.messages.tipFeatureTitle", { defaultValue: "Tip sent" })}
        </span>
        <span className="mt-0.5 block text-xs leading-4 text-[var(--slurp-muted)]">
          <SlpCoinText>
            {localizeUi("ui.slurp.messages.tipFeatureDetail", {
              defaultValue: "{{amount}} <coin/> sent as a gift. They reply if they feel like it.",
              amount: message.price,
            })}
          </SlpCoinText>
        </span>
        {relationship && !relationship.desk && (
          <span className="mt-1 block text-xs font-semibold text-[var(--slurp-ink)]">
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
