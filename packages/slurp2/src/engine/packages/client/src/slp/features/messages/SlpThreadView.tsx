import {
  SLURP_AWAY_STATUSES,
  SLURP_AWAY_TITLE_FALLBACKS,
  SLURP_MESSAGE_PAGE,
  SLURP_REPLY_STATUS_FALLBACKS,
} from "./SlpMessages";
import { CommissionRow } from "./commissions/SlpCommissions";
import { Info, Loader2 } from "lucide-react";
import { getApiErrorMessage } from "../../../lib/api-client";
import { useSlurpThreadViewModel } from "./slp-thread-actions";
import type { SlurpThreadViewProps } from "./slp-thread-view-model";
import { SlpThreadHeader } from "./SlpThreadHeader";
import { SlpThreadComposer } from "./SlpThreadComposer";
import { SlpThreadDrawer } from "./SlpThreadDrawer";
import { SlurpAwayAnimation, MessageBubble, SlurpPlatformActionCard } from "./SlpMessageBubble";

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
    holdTyping,
  } = model;
  return (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-[color-mix(in_srgb,var(--slurp-surface)_45%,transparent)]">
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
        <div className="mx-auto flex min-w-0 w-full max-w-2xl flex-col gap-3">
          {(olderCount > 0 || nextOlderCursor) && (
            <button
              type="button"
              disabled={olderMessages.isPending}
              onClick={() => void showOlder()}
              className="mx-auto min-h-9 shrink-0 rounded-full bg-[var(--slurp-surface)] px-4 text-xs font-bold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              {localizeUi("ui.slurp.messages.loadOlder", {
                defaultValue: "Show earlier messages ({{count}})",
                count: olderCount || SLURP_MESSAGE_PAGE,
              })}
            </button>
          )}
          {messages.length === 0 && messaging && (
            <p className="mx-auto max-w-sm rounded-xl bg-[var(--slurp-surface)] px-4 py-3 text-center text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)]">
              {messaging.dmPolicy === "closed"
                ? localizeUi("ui.slurp.messages.policyClosed", {
                    defaultValue: "{{name}} has direct messages turned off.",
                    name: creator?.displayName ?? "",
                  })
                : messaging.dmPolicy === "paid" && !subscribed
                  ? localizeUi("ui.slurp.messages.policyPaid", {
                      defaultValue: "Your first message costs {{fee}} coins unless you subscribe.",
                      fee: messaging.requestFee,
                    }) +
                    " " +
                    localizeUi("ui.slurp.messages.requestFeeHint", {
                      defaultValue: "The fee opens the thread. It does not guarantee a reply.",
                    })
                  : messaging.dmPolicy === "subscribers" && !subscribed
                    ? localizeUi("ui.slurp.messages.policySubscribers", {
                        defaultValue: "You are not subscribed, so your first message goes to their requests.",
                      })
                    : localizeUi("ui.slurp.messages.policyOpen", {
                        defaultValue: "Say hello.",
                      })}
            </p>
          )}
          {visibleTimeline.map((entry, index) => {
            const date = new Date(entry.at).toLocaleDateString(i18n.language, { dateStyle: "medium" });
            const previousDate =
              index > 0
                ? new Date(visibleTimeline[index - 1]!.at).toLocaleDateString(i18n.language, { dateStyle: "medium" })
                : null;
            return (
              <div
                key={entry.kind === "message" ? entry.message.id : entry.commission.id}
                id={entry.kind === "message" ? `slurp-message-${entry.message.id}` : undefined}
                className="contents scroll-mt-28"
              >
                {date !== previousDate && (
                  <div className="self-center py-2 text-[0.65rem] font-bold text-[var(--muted-foreground)]">{date}</div>
                )}
                {entry.kind === "message" && entry.message.id === firstUnreadMessageId && (
                  <div
                    id="slurp-unread-marker"
                    role="separator"
                    className="flex scroll-mt-16 items-center gap-3 py-1 text-[0.68rem] font-bold text-[var(--noodle-accent)]"
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
                    <MessageBubble
                      message={entry.message}
                      locale={i18n.language}
                      personaId={personaId}
                      ownsCreator={ownsCreator}
                    />
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
              <div className="flex max-w-[88%] flex-col items-end gap-1 self-end opacity-60 sm:max-w-[78%]">
                <div className="whitespace-pre-wrap break-words rounded-[1.15rem] rounded-br-[0.35rem] bg-[var(--noodle-accent)] px-3.5 py-2.5 text-sm leading-relaxed text-zinc-950 [&_svg]:!text-zinc-950 shadow-[var(--slurp-shadow-raised)]">
                  {pending.content}
                </div>
              </div>
            )}
          {!typing && (waitingNote || canForceReply) && (
            <section
              aria-live="polite"
              aria-labelledby={waitingNote && SLURP_AWAY_STATUSES.has(waitingNote) ? "slurp-away-title" : undefined}
              aria-describedby="slurp-away-detail"
              className="relative mx-auto flex w-full max-w-md flex-col items-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--noodle-accent)_12%,transparent),transparent_48%),linear-gradient(160deg,var(--slurp-surface-raised),var(--slurp-surface))] px-5 pb-5 pt-4 text-center shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-[var(--noodle-divider)] sm:px-8 sm:pb-6 sm:pt-5"
            >
              {/* A status card, like a platform's own notice: the sleeping avatar for "not now",
                  a plain icon for problems the fan has to act on (busy, no connection, failed). */}
              {waitingNote && SLURP_AWAY_STATUSES.has(waitingNote) ? (
                <>
                  <SlurpAwayAnimation account={headerAccount ?? null} />
                  <p className="-mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--noodle-accent)]/12 px-3 py-1 text-[0.62rem] font-bold uppercase text-[var(--noodle-accent)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--noodle-accent)]" aria-hidden="true" />
                    {localizeUi("ui.slurp.messages.away", { defaultValue: "Away" })}
                  </p>
                  <h3 id="slurp-away-title" className="mt-1 text-base font-bold">
                    {localizeUi(`ui.slurp.messages.awayTitle.${waitingNote ?? "owed"}`, {
                      defaultValue: SLURP_AWAY_TITLE_FALLBACKS[waitingNote ?? "owed"] ?? "{{name}} is away",
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
              </p>
              {canForceReply && thread && personaId && (
                <button
                  type="button"
                  disabled={forceReply.isPending}
                  onClick={async () => {
                    const forcedPersonaId = personaId;
                    const forcedThreadId = thread.id;
                    setError(null);
                    setTyping(true);
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
                  className="min-h-9 rounded-full px-3 text-[0.7rem] font-semibold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 transition-[background-color,opacity] hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40"
                >
                  {localizeUi("ui.slurp.messages.forceReply", { defaultValue: "Get reply now" })}
                </button>
              )}
            </section>
          )}
          {typing && (
            <div
              aria-live="polite"
              className="self-start flex items-center gap-2 rounded-2xl rounded-bl-md bg-[var(--slurp-surface)] px-4 py-3 text-xs ring-1 ring-inset ring-[var(--noodle-divider)]"
            >
              <div className="flex gap-1">
                <span
                  className="h-2 w-2 rounded-full bg-[var(--muted-foreground)] animate-[bounce_1.4s_ease-in-out_infinite]"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="h-2 w-2 rounded-full bg-[var(--muted-foreground)] animate-[bounce_1.4s_ease-in-out_infinite]"
                  style={{ animationDelay: "160ms" }}
                />
                <span
                  className="h-2 w-2 rounded-full bg-[var(--muted-foreground)] animate-[bounce_1.4s_ease-in-out_infinite]"
                  style={{ animationDelay: "320ms" }}
                />
              </div>
              <span className="text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.messages.typing", {
                  defaultValue: "{{name}} is typing…",
                  name: creator?.displayName ?? "",
                })}
              </span>
            </div>
          )}
          {preparingImage && (
            <p
              aria-live="polite"
              className="flex max-w-[88%] items-center gap-2 self-end rounded-2xl rounded-br-md bg-[var(--noodle-accent)]/15 px-3.5 py-2.5 text-xs text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-accent)]/25"
            >
              <Loader2 size={14} className="animate-spin text-[var(--noodle-accent)]" aria-hidden="true" />
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
        <p role="alert" className="shrink-0 px-4 pb-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <SlpThreadComposer model={model} />

      <SlpThreadDrawer model={model} />
    </div>
  );
}
