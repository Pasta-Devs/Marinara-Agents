import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import { slpCoinPlainText } from "../../modules/coin/SlpCoin";
import { useLayoutEffect, useRef } from "react";
import { toast } from "sonner";
import { isCommissionRequest } from "./commissions/SlpCommissions";
import { playSlpSpendMoment } from "../../modules/sparkle/SlpSparkle";
import { useSlurpThreadViewState, type SlurpThreadViewProps, type SlurpThreadViewState } from "./slp-thread-view-model";

/** `crypto.randomUUID` exists only in a secure context; a plain-HTTP LAN Engine does not have one. */
export const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/**
 * What a conversation does: hold the typing indicator, send a message, send a tip, scroll home.
 *
 * They read and write the same state the view draws from, so they take it whole rather than a
 * dozen setters, and the model below is the two halves joined.
 */
function useSlurpThreadActions(state: SlurpThreadViewState) {
  const {
    activeConversationRef,
    asSupport,
    availability,
    bottomRef,
    busy,
    cheat,
    composerRef,
    composerDesk,
    photoDemand,
    setPhotoDemand,
    composerTipAmount,
    composerTipNote,
    creatorReply,
    draft,
    localizeUi,
    messaging,
    ownsCreator,
    personaId,
    send,
    sendRequest,
    setActiveTipAmount,
    setCommissionPrefill,
    setComposerDesk,
    setComposerTipAmount,
    setComposerTipNote,
    setDraft,
    setError,
    setHiddenReplyIds,
    setPending,
    setReplyStatus,
    setSendRequest,
    setStandaloneTip,
    setToolTab,
    setToolsOpen,
    setTyping,
    subscribed,
    targetCreatorAccountId,
    thread,
    tip,
    typing,
    typingTimeoutRef,
  } = state;

  // A retried tip reuses its id until it succeeds, like a retried message. A new id on each tap
  // charged twice when the first request had landed before it timed out.
  const tipRequestRef = useRef<{ id: string; key: string } | null>(null);

  const holdTyping = (ms: number, replyId?: string) => {
    const conversation = activeConversationRef.current;
    const isCurrent = () =>
      activeConversationRef.current.personaId === conversation.personaId &&
      activeConversationRef.current.threadId === conversation.threadId;
    if (ms <= 0) {
      if (!isCurrent()) return;
      setTyping(false);
      if (replyId) {
        setHiddenReplyIds((prev) => {
          const next = new Set(prev);
          next.delete(replyId);
          return next;
        });
      }
      return;
    }
    setTyping(true);
    // Hide the reply message until typing delay finishes
    if (replyId) {
      setHiddenReplyIds((prev) => new Set(prev).add(replyId));
    }
    // Clear any existing typing timeout
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      if (!isCurrent()) return;
      setTyping(false);
      if (replyId) {
        setHiddenReplyIds((prev) => {
          const next = new Set(prev);
          next.delete(replyId);
          return next;
        });
      }
      typingTimeoutRef.current = null;
    }, ms);
  };

  /**
   * Cancel typing animation and reveal any hidden messages immediately.
   * Used when the fan interrupts by sending another message.
   */
  const cancelTyping = () => {
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    setTyping(false);
    setHiddenReplyIds(new Set());
  };

  // The composer grows with its text up to a cap, and shrinks back once the draft is sent.
  useLayoutEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);

  const scrollToLatest = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: reduceMotion ? "auto" : "smooth" });
  };

  /** `skipCommissionCheck`: the fan chose "Send as message" in the commission sheet. Fees still apply. */
  const submit = async (skipCommissionCheck = false) => {
    const content = draft.trim();
    if (!content || !personaId || !targetCreatorAccountId || busy) return;
    const cheatMatch = /^\/cheat(?:\s+([\s\S]*))?$/iu.exec(content);
    if (cheatMatch) {
      setDraft("");
      try {
        const result = await cheat.mutateAsync({
          personaId,
          creatorAccountId: targetCreatorAccountId,
          directive: cheatMatch[1] ?? "",
        });
        toast.success(
          result.kind === "coins"
            ? slpCoinPlainText(
                localizeUi("ui.slurp.messages.cheatCoinsAccepted", {
                  defaultValue: "Development wallet set to {{coins}} <coin/>.",
                  coins: result.coins,
                }),
              )
            : result.kind === "force_creator_photo"
              ? "Creator photo generation started."
              : result.kind === "force_ppv"
                ? "Paid unlock message sent. Normal price and access rules remain active."
                : result.kind === "follow_up"
                  ? "Follow-up test scheduled. The normal scheduler and availability rules still apply."
                  : result.kind === "mood"
                    ? `Conversation mood adjusted by ${result.amount}.`
                    : result.kind === "rapport"
                      ? `Conversation rapport adjusted by ${result.amount}.`
                      : result.kind === "availability"
                        ? `Creator availability extended for ${result.minutes} minutes.`
                        : result.kind === "help"
                          ? (result.help?.join("\n") ?? "No cheat commands are available.")
                          : localizeUi("ui.slurp.messages.cheatAccepted", {
                              defaultValue: "Cheat directive accepted.",
                            }),
        );
      } catch {
        toast.error(localizeUi("ui.slurp.messages.cheatRejected", { defaultValue: "Cheat directive rejected." }));
      }
      return;
    }
    const optimisticStartedAt = Date.now();
    if (!skipCommissionCheck && !ownsCreator && !asSupport && isCommissionRequest(content)) {
      setCommissionPrefill(content);
      setToolsOpen(true);
      setToolTab("commission");
      return;
    }
    // The server charges the request fee only when it creates the thread.
    const feeDue = !thread;
    // A paid first message is one tap (design step 6): the price sits in the Send button before the
    // tap, and the spend moment plays from that button once the message is through.
    const paidRequest =
      !ownsCreator && !asSupport && feeDue && messaging?.dmPolicy === "paid" && !subscribed && messaging.requestFee > 0;
    const sendOrigin = paidRequest
      ? composerRef.current?.form?.querySelector('button[type="submit"]')?.getBoundingClientRect()
      : undefined;
    // Cancel any active typing animation when fan interrupts
    if (typing) {
      cancelTyping();
    }
    setError(null);
    setDraft("");
    // Show the message and the typing indicator at once. The send route waits for the model
    // before it answers, so the chat used to sit empty for the whole generation.
    setPending({ content, id: null, startedAt: optimisticStartedAt });
    // Sending always lands on your own message, even when you had scrolled up to reread.
    requestAnimationFrame(scrollToLatest);
    setReplyStatus(null);
    // An away Creator is not typing. Showing dots first and then the away block read as a reply
    // that was started and abandoned.
    if (!ownsCreator && availability?.online !== false) setTyping(true);
    try {
      // On a Creator-side thread the player is the Creator, so the message goes the other way.
      // Sending through the viewer route here opened a second conversation from the persona to
      // their own Creator instead of answering the fan.
      if (ownsCreator && thread) {
        const written = await creatorReply.mutateAsync({
          creatorAccountId: thread.creatorAccountId,
          personaId,
          viewerAccountId: thread.viewerAccountId,
          content,
        });
        setPending({ content, id: written.message.id, startedAt: optimisticStartedAt });
        return;
      }
      // A retry of the same text reuses its id so a send that landed before a timeout is not doubled.
      // Edited text is a new message; reusing the id made the server return the old one instead.
      const requestId = sendRequest?.content === content ? sendRequest.id : newRequestId();
      setSendRequest({ id: requestId, content });
      const result = await send.mutateAsync({
        personaId,
        creatorAccountId: targetCreatorAccountId,
        content,
        requestId,
        // Slurp Support never tips; an attached tip waits in the composer for the persona.
        tip: !asSupport && composerTipAmount > 0 ? { amount: composerTipAmount, note: composerTipNote.trim() } : null,
        ...(asSupport ? { asSupport: true } : {}),
        // A desk step left attached after the Support desk was switched off is not sent.
        ...(asSupport &&
        composerDesk &&
        (!state.settingsQuery.data || slpExtensionOn(state.settingsQuery.data, "supportDesk"))
          ? {
              desk: {
                mode: composerDesk.mode,
                step: { action: composerDesk.card.action, input: composerDesk.card.input },
              },
            }
          : {}),
        ...(asSupport && photoDemand ? { photoDemand: true } : {}),
      });
      if (asSupport) {
        setComposerDesk(null);
        setPhotoDemand(false);
      }
      setSendRequest(null);
      if (sendOrigin) playSlpSpendMoment(sendOrigin);
      setPending({ content, id: result.message.id, startedAt: optimisticStartedAt });
      setReplyStatus(result.replyStatus ?? null);
      if (result.tipError) setError(result.tipError);
      if (!asSupport) {
        setComposerTipAmount(0);
        setComposerTipNote("");
      }
      holdTyping(result.reply ? (result.typingMs ?? 0) : 0, result.reply?.id);
    } catch (cause) {
      // Put the words back in the box. Losing a typed message to a failed request is the one
      // thing a chat surface must never do.
      setPending(null);
      setTyping(false);
      setDraft(content);
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.sendFailed", { defaultValue: "Could not send that message." }),
      );
    }
  };

  /** One tap (design step 6): the price is on the button, the spend moment is the feedback. */
  const sendTip = async (amount: number, note = "", origin?: DOMRect) => {
    if (!personaId || !targetCreatorAccountId || busy) return;
    setError(null);
    setActiveTipAmount(amount);
    try {
      const tipKey = `${personaId}:${targetCreatorAccountId}:${amount}:${note}`;
      if (tipRequestRef.current?.key !== tipKey) tipRequestRef.current = { id: newRequestId(), key: tipKey };
      const result = await tip.mutateAsync({
        personaId,
        creatorAccountId: targetCreatorAccountId,
        amount,
        note,
        requestId: tipRequestRef.current.id,
      });
      tipRequestRef.current = null;
      setStandaloneTip(result.message);
      setToolsOpen(false);
      if (origin) playSlpSpendMoment(origin);
      setToolTab(null);
      if (result.reply) holdTyping(result.typingMs ?? 0, result.reply.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : localizeUi("ui.slurp.messages.tipFailed", { defaultValue: "Could not send that tip." }),
      );
    } finally {
      setActiveTipAmount(null);
    }
  };

  return { holdTyping, cancelTyping, scrollToLatest, submit, sendTip };
}

export function useSlurpThreadViewModel(props: SlurpThreadViewProps) {
  const state = useSlurpThreadViewState(props);
  return { ...state, ...useSlurpThreadActions(state) };
}

export type SlurpThreadViewModel = ReturnType<typeof useSlurpThreadViewModel>;
