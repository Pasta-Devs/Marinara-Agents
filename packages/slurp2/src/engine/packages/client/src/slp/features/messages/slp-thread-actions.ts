import { useDismissablePopover } from "./SlpMessageInsights";
import { useLayoutEffect } from "react";
import { toast } from "sonner";
import { isCommissionRequest } from "./commissions/SlpCommissions";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { useSlurpThreadViewState, type SlurpThreadViewProps, type SlurpThreadViewState } from "./slp-thread-view-model";

/** `crypto.randomUUID` exists only in a secure context; a plain-HTTP LAN Engine does not have one. */
const newRequestId = () =>
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
    availability,
    bottomRef,
    busy,
    cheat,
    composerRef,
    composerTipAmount,
    composerTipNote,
    creatorReply,
    draft,
    headerMenuOpen,
    headerMenuRef,
    headerMenuTriggerRef,
    localizeUi,
    messaging,
    ownsCreator,
    personaId,
    send,
    sendRequest,
    setActiveTipAmount,
    setCommissionPrefill,
    setComposerTipAmount,
    setComposerTipNote,
    setCustomTipAmount,
    setCustomTipNote,
    setDraft,
    setError,
    setHeaderMenuOpen,
    setHiddenReplyIds,
    setPending,
    setReplyStatus,
    setSendRequest,
    setStandaloneTip,
    setTierOpen,
    setToolTab,
    setToolsOpen,
    setTyping,
    subscribed,
    targetCreatorAccountId,
    thread,
    tierOpen,
    tierPopoverRef,
    tierTriggerRef,
    tip,
    typing,
    typingTimeoutRef,
  } = state;

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

  useDismissablePopover(headerMenuOpen, setHeaderMenuOpen, headerMenuRef, headerMenuTriggerRef);
  useDismissablePopover(tierOpen, setTierOpen, tierPopoverRef, tierTriggerRef);

  const scrollToLatest = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({ block: "end", behavior: reduceMotion ? "auto" : "smooth" });
  };

  const submit = async (force = false) => {
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
            ? localizeUi("ui.slurp.messages.cheatCoinsAccepted", {
                defaultValue: "Development wallet set to {{coins}} coins.",
                coins: result.coins,
              })
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
    if (!force && !ownsCreator && isCommissionRequest(content)) {
      setCommissionPrefill(content);
      setToolsOpen(true);
      setToolTab("commission");
      return;
    }
    const feeDue = !thread || thread.requestFeePaid <= 0;
    if (!force && !ownsCreator && feeDue && messaging?.dmPolicy === "paid" && !subscribed && messaging.requestFee > 0) {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.slurp.messages.sendRequestTitle", { defaultValue: "Send message request?" }),
        message: localizeUi("ui.slurp.messages.sendRequestDetail", {
          defaultValue: "This costs {{fee}} coins. It opens the conversation but does not guarantee a reply.",
          fee: messaging.requestFee,
        }),
        confirmLabel: localizeUi("ui.slurp.messages.sendRequestConfirm", { defaultValue: "Send request" }),
      });
      if (!confirmed) return;
    }
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
        tip: composerTipAmount > 0 ? { amount: composerTipAmount, note: composerTipNote.trim() } : null,
      });
      setSendRequest(null);
      setPending({ content, id: result.message.id, startedAt: optimisticStartedAt });
      setReplyStatus(result.replyStatus ?? null);
      if (result.tipError) setError(result.tipError);
      setComposerTipAmount(0);
      setComposerTipNote("");
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

  const sendTip = async (amount: number, note = "", restore?: { amount: string; note: string }) => {
    if (!personaId || !targetCreatorAccountId || busy) return;
    const restoreCustomTip = () => {
      if (!restore) return;
      setCustomTipAmount(restore.amount);
      setCustomTipNote(restore.note);
    };
    setError(null);
    setActiveTipAmount(amount);
    try {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.slurp.messages.sendTipTitle", {
          defaultValue: "Send {{amount}} coins as a tip?",
          amount,
        }),
        message: localizeUi("ui.slurp.messages.sendTipDetail", {
          defaultValue: "A tip is a gift. It does not guarantee a reply.",
        }),
        confirmLabel: localizeUi("ui.slurp.messages.sendTipConfirm", { defaultValue: "Send tip" }),
      });
      if (!confirmed) {
        restoreCustomTip();
        return;
      }
      const result = await tip.mutateAsync({
        personaId,
        creatorAccountId: targetCreatorAccountId,
        amount,
        note,
        requestId: newRequestId(),
      });
      setStandaloneTip(result.message);
      if (result.reply) holdTyping(result.typingMs ?? 0, result.reply.id);
    } catch (cause) {
      restoreCustomTip();
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
