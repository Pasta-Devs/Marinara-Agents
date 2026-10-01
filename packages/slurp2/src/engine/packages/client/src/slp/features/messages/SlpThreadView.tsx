import { SlpCoinText } from "../../modules/coin/SlpCoin";
import {
  SLURP_AWAY_KIND_FALLBACKS,
  SLURP_AWAY_STATUSES,
  SLURP_AWAY_TITLE_FALLBACKS,
  SLURP_MESSAGE_PAGE,
  SLURP_REPLY_STATUS_FALLBACKS,
} from "./SlpMessages";
import { CommissionRow } from "./commissions/SlpCommissions";
import { Info, Loader2 } from "lucide-react";
import { useContext, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../lib/utils";
import { ModalPortalContext } from "../../../components/ui/Modal";
import {
  Avatar,
  getSlpAccentStyle,
  NOODLE_ICON_SCOPE_CLASS,
  useSlpAccent,
  useSlpMediaQuery,
} from "../../base/chrome/SlpChrome";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { noteSlpAiUseOnce, SlpUsesAiMark } from "../../modules/chrome/SlpAiMark";
import { SlpCanvasAmbient } from "../../modules/chrome/SlpCanvasAmbient";
import { getApiErrorMessage } from "../../../lib/api-client";
import { useSlurpThreadViewModel } from "./slp-thread-actions";
import { SLP_THREAD_COLUMN_CLASS, type SlurpThreadViewProps } from "./slp-thread-view-model";
import { SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { SlpThreadHeader } from "./SlpThreadHeader";
import { SlpThreadComposer } from "./SlpThreadComposer";
import { SlpThreadDrawer } from "./SlpThreadDrawer";
import {
  MessageBubble,
  SlurpAwayAnimation,
  SlurpBubbleStyles,
  SlurpPlatformActionCard,
} from "./SlpMessageBubble";
import { slurpBubbleGroup } from "./slp-bubble-group";
import { slurpBubbleSurface } from "../../modules/chrome/SlpChatShell";
import { readSlpStirProposal, SlpStirSupportCards } from "../stir/slp-stir-contract";
import { readSlpDeskOffer, SlpDeskOfferCard } from "./SlpDeskRows";
import { readSlpDramaChoice, SlpDramaChoiceCard } from "./SlpDramaChoiceCard";
import { slurpAwayKind } from "./slp-away-kind";
import { formatClockTime } from "../../base/ui/slp-date-time";

/**
 * A conversation is a full-screen task on phones (design language §8): it leaves the page for a
 * layer over the whole app, so the Slurp nav and the Engine bars are out of the way and the composer
 * owns the bottom edge. Wide screens keep it in place (split view).
 */
function SlpThreadTaskLayer({ children }: { children: ReactNode }) {
  const phone = !useSlpMediaQuery("(min-width: 768px)");
  const portal = useContext(ModalPortalContext);
  const accent = useSlpAccent();
  if (!phone || typeof document === "undefined") return <>{children}</>;
  return createPortal(
    <div
      data-slp-task-layer=""
      // Below the sheets and Engine dialogs (z 10000), above the nav and the Engine bars. The portal
      // root lets taps through (pointer-events: none), so the layer takes them back.
      className={cn(
        "mari-chrome-token-scope slp-task-in pointer-events-auto fixed inset-0 isolate z-[9000] flex flex-col bg-[var(--slurp-canvas)] pt-[env(safe-area-inset-top)] text-[var(--slurp-text)] antialiased [background-image:var(--slurp-canvas-art)]",
        NOODLE_ICON_SCOPE_CLASS,
      )}
      style={getSlpAccentStyle(accent)}
    >
      <SlpCanvasAmbient />
      {children}
    </div>,
    portal ?? document.body,
  );
}

/**
 * One conversation, addressed either by its thread or by the creator it is with.
 *
 * The second form is what a profile links to: there may be no thread yet, and the whole point is
 * that arriving does not create one.
 */
export function SlurpThreadView(props: SlurpThreadViewProps) {
  const model = useSlurpThreadViewModel(props);
  const {
    personaId,
    localizeUi,
    i18n,
    olderMessages,
    forceReply,
    error,
    setError,
    typing,
    setTyping,
    standaloneTip,
    pending,
    setReplyStatus,
    preparingImage,
    bottomRef,
    setAwayFromBottom,
    thread,
    activeConversationRef,
    messages,
    creator,
    ownsCreator,
    messaging,
    relationship,
    firstUnreadMessageId,
    visibleTimeline,
    olderCount,
    subscribed,
    headerAccount,
    messageScrollRef,
    nextOlderCursor,
    showOlder,
    waitingNote,
    canForceReply,
    availability,
    holdTyping,
    threadQuery,
  } = model;
  // Until the conversation has loaded there is nothing to read and no policy to send under, so the
  // composer stays away instead of offering a live input on a blank screen.
  const notLoaded = !threadQuery.data;
  // "Not now" gets the away card: a reply status that means it, or (after a reload, when only the
  // owed reply is left) a Creator who is not online or is cooling off.
  const away = slurpAwayKind({ status: waitingNote, availability, coolUntil: relationship?.coolUntil });
  const awayCard =
    (waitingNote ? SLURP_AWAY_STATUSES.has(waitingNote) : Boolean(availability && !availability.online)) ||
    (!waitingNote && away.kind === "cooling")
      ? { ...away, status: waitingNote ?? "owed" }
      : null;
  const awayTag =
    away.kind === "away"
      ? localizeUi("ui.slurp.messages.away", { defaultValue: "Away" })
      : localizeUi(`ui.slurp.messages.awayKind.${away.kind}.tag`, {
          defaultValue: SLURP_AWAY_KIND_FALLBACKS[away.kind]?.tag ?? "Away",
        });
  // Bubbles that arrive while the chat is open land with the entrance motion; the ones it opened with do not.
  const openedWith = useRef<Set<string> | null>(null);
  if (openedWith.current === null && threadQuery.data) openedWith.current = new Set(messages.map((m) => m.id));
  const policyNotice =
    messaging &&
    (messaging.dmPolicy === "closed" ? (
      localizeUi("ui.slurp.messages.policyClosed", {
        defaultValue: "{{name}} has direct messages turned off.",
        name: creator?.displayName ?? "",
      })
    ) : messaging.dmPolicy === "paid" && !subscribed ? (
      <SlpCoinText>
        {localizeUi("ui.slurp.messages.policyPaid", {
          defaultValue: "Your first message costs {{fee}} <coin/> unless you subscribe.",
          fee: messaging.requestFee,
        }) +
          " " +
          localizeUi("ui.slurp.messages.requestFeeHint", {
            defaultValue: "The fee opens the chat. They reply if they feel like it.",
          })}
      </SlpCoinText>
    ) : messaging.dmPolicy === "subscribers" && !subscribed ? (
      localizeUi("ui.slurp.messages.policySubscribers", {
        defaultValue: "You are not subscribed, so your first message goes to their requests.",
      })
    ) : (
      localizeUi("ui.slurp.messages.policyOpen", {
        defaultValue: "Say hello.",
      })
    ));
  return (
    <SlpThreadTaskLayer>
      {/* `overflow: clip` (not hidden) on both boxes: focus must never scroll them (7c M-006). */}
      <div data-slp-task="" className="flex min-h-0 min-w-0 max-w-full flex-1" style={{ overflow: "clip" }}>
        <SlurpBubbleStyles />
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            // Slurp Support's thread reads as a staff console, header to composer (docs/SUPPORT-DESK.md).
            relationship?.desk && "bg-[color-mix(in_srgb,var(--slurp-canvas)_90%,var(--slurp-muted))]",
          )}
          style={{ overflow: "clip" }}
          data-slp-desk-thread={relationship?.desk ? "" : undefined}
        >
          <SlpThreadHeader model={model} />

          <div
            ref={messageScrollRef}
            onScroll={(event) => {
              const container = event.currentTarget;
              setAwayFromBottom(container.scrollHeight - container.scrollTop - container.clientHeight > 240);
              // Reaching the top is the same request as pressing the button, so it does the same thing.
              if ((olderCount > 0 || nextOlderCursor) && container.scrollTop < 64) void showOlder();
            }}
            className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4"
          >
            <div className={cn(SLP_THREAD_COLUMN_CLASS, "flex min-h-full min-w-0 flex-col gap-3")}>
              {notLoaded &&
                (threadQuery.isError ? (
                  <SlpErrorState
                    title={localizeUi("ui.slurp.messages.threadLoadError", {
                      defaultValue: "Could not load this conversation",
                    })}
                    onRetry={() => void threadQuery.refetch()}
                  />
                ) : (
                  <SlpSkeleton shape="thread" count={5} />
                ))}
              {(olderCount > 0 || nextOlderCursor) && (
                <SlpButton
                  variant="quiet"
                  disabled={olderMessages.isPending}
                  onClick={() => void showOlder()}
                  className="mx-auto shrink-0 text-xs"
                >
                  {localizeUi("ui.slurp.messages.loadOlder", {
                    defaultValue: "Show earlier messages ({{count}})",
                    count: olderCount || SLURP_MESSAGE_PAGE,
                  })}
                </SlpButton>
              )}
              {messages.length === 0 && messaging && (
                // An empty chat: who you are writing to and the house rules, just above the composer.
                <div className="my-auto flex flex-col items-center gap-2 px-4 py-8 text-center">
                  {headerAccount && <Avatar account={headerAccount} size="lg" />}
                  <p className="mt-1 text-[15px] font-bold leading-5">{headerAccount?.displayName ?? ""}</p>
                  <p className="max-w-xs text-[13px] leading-[19px] text-[var(--slurp-muted)]">{policyNotice}</p>
                </div>
              )}
              {visibleTimeline.map((entry, index) => {
                const date = new Date(entry.at).toLocaleDateString(i18n.language, { dateStyle: "medium" });
                const previousDate =
                  index > 0
                    ? new Date(visibleTimeline[index - 1]!.at).toLocaleDateString(i18n.language, {
                        dateStyle: "medium",
                      })
                    : null;
                return (
                  <div
                    key={entry.kind === "message" ? entry.message.id : entry.commission.id}
                    id={entry.kind === "message" ? `slurp-message-${entry.message.id}` : undefined}
                    className="contents scroll-mt-28"
                  >
                    {date !== previousDate && (
                      <div className="self-center py-2 text-xs font-semibold text-[var(--slurp-muted)]">{date}</div>
                    )}
                    {entry.kind === "message" && entry.message.id === firstUnreadMessageId && (
                      <div
                        id="slurp-unread-marker"
                        role="separator"
                        className="flex scroll-mt-16 items-center gap-3 py-1 text-xs font-semibold text-[var(--slurp-ink)]"
                      >
                        <span className="h-px flex-1 bg-[var(--noodle-accent)]/40" aria-hidden="true" />
                        {localizeUi("ui.slurp.messages.newMessages", { defaultValue: "New messages" })}
                        <span className="h-px flex-1 bg-[var(--noodle-accent)]/40" aria-hidden="true" />
                      </div>
                    )}
                    {entry.kind === "message" ? (
                      standaloneTip?.id === entry.message.id ? (
                        <SlurpPlatformActionCard message={entry.message} relationship={relationship} />
                      ) : (
                        <>
                          <MessageBubble
                            message={entry.message}
                            locale={i18n.language}
                            personaId={personaId}
                            ownsCreator={ownsCreator}
                            group={slurpBubbleGroup(visibleTimeline, index, firstUnreadMessageId)}
                            fresh={Boolean(openedWith.current && !openedWith.current.has(entry.message.id))}
                            onOpenProfile={model.onOpenProfile}
                          />
                          {/* The Support desk: an Offer sits under the line that made it (docs/SUPPORT-DESK.md). */}
                          {readSlpDeskOffer(entry.message) && (
                            <SlpDeskOfferCard message={entry.message} ownsCreator={ownsCreator} personaId={personaId} />
                          )}
                          {/* Drama: a Creator's question with its answers (docs/DRAMA.md). */}
                          {readSlpDramaChoice(entry.message) && (
                            <SlpDramaChoiceCard message={entry.message} personaId={personaId} />
                          )}
                          {/* W: a talk with Slurp Support proposes Stir cards under the Creator's reply. */}
                          {readSlpStirProposal(entry.message.metadata) && (
                            <SlpStirSupportCards
                              messageId={entry.message.id}
                              proposal={readSlpStirProposal(entry.message.metadata)!}
                            />
                          )}
                        </>
                      )
                    ) : personaId ? (
                      <CommissionRow
                        commission={entry.commission}
                        deliveryMessage={entry.deliveryMessage}
                        personaId={personaId}
                        ownsCreator={ownsCreator}
                      />
                    ) : null}
                  </div>
                );
              })}
              {pending &&
                !messages.some(
                  (message) =>
                    (pending.id !== null && message.id === pending.id) ||
                    (message.role === "viewer" &&
                      message.content === pending.content &&
                      Date.parse(message.createdAt) >= pending.startedAt),
                ) && (
                  <div className="flex max-w-[82%] flex-col items-end gap-1 self-end opacity-60 sm:max-w-[72%]">
                    <div
                      className={cn(
                        "whitespace-pre-wrap break-words rounded-[1.25rem] px-3.5 py-2 text-[0.95rem] leading-snug sm:text-sm sm:leading-relaxed",
                        slurpBubbleSurface(true),
                      )}
                    >
                      {pending.content}
                    </div>
                  </div>
                )}
              {!typing && (waitingNote || canForceReply) && (
                <section
                  aria-live="polite"
                  aria-labelledby={awayCard ? "slurp-away-title" : undefined}
                  aria-describedby="slurp-away-detail"
                  className="relative mx-auto flex w-full max-w-md flex-col items-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--noodle-accent)_12%,transparent),transparent_48%),linear-gradient(160deg,var(--slurp-surface-raised),var(--slurp-surface))] px-5 pb-5 pt-4 text-center shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-[var(--noodle-divider)] sm:px-8 sm:pb-6 sm:pt-5"
                >
                  {/* A status card, like a platform's own notice: the sleeping avatar for "not now",
                      a plain icon for problems the fan has to act on (busy, no connection, failed).
                      The card of 649a7024 (user correction, fix phase 1), with one picture per away kind. */}
                  {awayCard ? (
                    <>
                      <SlurpAwayAnimation account={headerAccount ?? null} kind={awayCard.kind} />
                      <p className="-mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--noodle-accent)]/12 px-3 py-1 text-[0.62rem] font-bold uppercase text-[var(--noodle-accent)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--noodle-accent)]" aria-hidden="true" />
                        {awayTag}
                      </p>
                      <h3 id="slurp-away-title" className="mt-1 text-base font-bold">
                        {!SLURP_AWAY_KIND_FALLBACKS[awayCard.kind]?.title
                          ? localizeUi(`ui.slurp.messages.awayTitle.${awayCard.status}`, {
                              defaultValue: SLURP_AWAY_TITLE_FALLBACKS[awayCard.status] ?? "{{name}} is away",
                              name: creator?.displayName ?? "",
                            })
                          : localizeUi(`ui.slurp.messages.awayKind.${awayCard.kind}.title`, {
                              defaultValue: SLURP_AWAY_KIND_FALLBACKS[awayCard.kind]?.title,
                              name: creator?.displayName ?? "",
                            })}
                      </h3>
                    </>
                  ) : (
                    <Info size={17} className="mt-2 text-[var(--noodle-accent)]" aria-hidden="true" />
                  )}
                  <p
                    id="slurp-away-detail"
                    className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--muted-foreground)]"
                  >
                    {waitingNote
                      ? localizeUi(`ui.slurp.messages.replyStatus.${waitingNote}`, {
                          defaultValue: SLURP_REPLY_STATUS_FALLBACKS[waitingNote] ?? "No answer yet.",
                          name: creator?.displayName ?? "",
                        })
                      : localizeUi("ui.slurp.messages.replyStatus.owed", {
                          defaultValue: "Your message is delivered. They have not answered yet.",
                          name: creator?.displayName ?? "",
                        })}
                    {awayCard?.backAt ? (
                      <span className="block font-semibold text-[var(--slurp-text)]">
                        {localizeUi(
                          awayCard.kind === "cooling"
                            ? "ui.slurp.messages.awayBackToChat"
                            : "ui.slurp.messages.awayBackAround",
                          {
                            defaultValue:
                              awayCard.kind === "cooling" ? "Back to chatting around {{time}}" : "Back around {{time}}",
                            time: formatClockTime(new Date(awayCard.backAt).toISOString(), i18n.language),
                          },
                        )}
                      </span>
                    ) : null}
                  </p>
                  {canForceReply && thread && personaId && (
                    <SlpButton
                      variant="tertiary"
                      disabled={forceReply.isPending}
                      onClick={async () => {
                        const forcedPersonaId = personaId;
                        const forcedThreadId = thread.id;
                        setError(null);
                        setTyping(true);
                        noteSlpAiUseOnce(localizeUi);
                        try {
                          const result = await forceReply.mutateAsync({
                            personaId: forcedPersonaId,
                            threadId: forcedThreadId,
                          });
                          if (
                            activeConversationRef.current.personaId !== forcedPersonaId ||
                            activeConversationRef.current.threadId !== forcedThreadId
                          )
                            return;
                          setReplyStatus(result.replyStatus);
                          // "Now" means now: the pacing delay is the thing this button exists to skip.
                          holdTyping(0, result.reply?.id);
                        } catch (cause) {
                          if (
                            activeConversationRef.current.personaId !== forcedPersonaId ||
                            activeConversationRef.current.threadId !== forcedThreadId
                          )
                            return;
                          setTyping(false);
                          setError(getApiErrorMessage(cause, "The reply could not be written."));
                        }
                      }}
                      className="mt-1 text-xs"
                    >
                      {localizeUi("ui.slurp.messages.forceReply", { defaultValue: "Get reply now" })}
                      <SlpUsesAiMark />
                    </SlpButton>
                  )}
                </section>
              )}
              {typing && (
                <div
                  aria-live="polite"
                  className="flex items-center gap-2 self-start text-xs text-[var(--slurp-muted)]"
                >
                  <span
                    className={cn("flex h-9 items-center gap-1 rounded-[1.25rem] px-3.5", slurpBubbleSurface(false))}
                  >
                    {[0, 160, 320].map((delay) => (
                      <span
                        key={delay}
                        className="slurp-typing-dot h-1.5 w-1.5 rounded-full bg-[var(--slurp-muted)]"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </span>
                  {localizeUi("ui.slurp.messages.typing", {
                    defaultValue: "{{name}} is typing…",
                    name: creator?.displayName ?? "",
                  })}
                </div>
              )}
              {preparingImage && (
                <p
                  aria-live="polite"
                  className="flex max-w-[82%] items-center gap-2 self-end rounded-[1.25rem] bg-[var(--slurp-tint)] px-3.5 py-2.5 text-xs text-[var(--slurp-muted)]"
                >
                  <Loader2 size={14} className="animate-spin text-[var(--slurp-ink)]" aria-hidden="true" />
                  {localizeUi("ui.slurp.messages.preparingImage", {
                    defaultValue: "{{name}} is preparing an image…",
                    name: creator?.displayName ?? "The Creator",
                  })}
                </p>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className={cn(SLP_THREAD_COLUMN_CLASS, "shrink-0 px-4 pb-1 text-xs text-[var(--slurp-danger)]")}
            >
              {error}
            </p>
          )}

          {!notLoaded && <SlpThreadComposer model={model} />}
        </div>

        <SlpThreadDrawer model={model} />
      </div>
    </SlpThreadTaskLayer>
  );
}
