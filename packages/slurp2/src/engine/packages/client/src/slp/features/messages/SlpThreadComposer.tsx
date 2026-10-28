import { requestHintGuidance } from "./SlpMessages";
import { SlpDeskQuickReplies } from "./SlpDeskQuickReplies";
import { SlpTextAssist } from "../assist/slp-assist-contract";
import { slurpAssistChatContext } from "./slp-assist-chat-context";
import { ArrowDown, ChevronLeft, Plus, Send, X } from "lucide-react";
import { CommissionRequest } from "./commissions/SlpCommissions";
import { CreatorMessageTools, FanImageTool, SlurpTipPanel } from "./SlpMessageTools";
import type { SlurpPhotoSendResult } from "./slp-message-action-hooks";
import { cn } from "../../../lib/utils";
import { SlurpCoinAmount } from "../../modules/coin/SlpCoin";
import { SLP_MOTION } from "../../base/chrome/slp-motion";
import { SlpButton, SlpChip, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpSheet, SlpSheetGroup } from "../../modules/chrome/SlpSheet";
import { SlurpConnectionSwitcher } from "./SlpThreadChrome";
import { SLP_THREAD_COLUMN_CLASS } from "./slp-thread-view-model";
import { slpExtensionOn } from "../../../../../shared/src/slp/slp-extensions.js";
import type { SlurpThreadViewModel } from "./slp-thread-actions";
import {
  SlpDeskComposerChip,
  SlpDeskPlayHost,
  SlpDeskToolPanel,
  SlpPhotoDemandChip,
  SlpPhotoDemandTool,
  SlpSupportPostPicker,
} from "./SlpDeskComposer";

/** The message composer: a glass bar with add, the draft and send; the tools open in a sheet. */
export function SlpThreadComposer({ model }: { model: SlurpThreadViewModel }) {
  const {
    asSupport,
    awayFromBottom,
    busy,
    commissionPrefill,
    composerRef,
    counterpart,
    creator,
    composerTipAmount,
    composerTipNote,
    connectionPickerOpen,
    connectionsQuery,
    createCommission,
    draft,
    draftReply,
    holdTyping,
    localizeUi,
    messages,
    messaging,
    ownsCreator,
    personaId,
    requestHint,
    requestReply,
    requestFanReply,
    scrollToLatest,
    sendTip,
    setCommissionPrefill,
    setComposerTipAmount,
    setComposerTipNote,
    setConnectionPickerOpen,
    setDraft,
    setError,
    setPreparingImage,
    setReplyStatus,
    setRequestHint,
    supportName,
    setToolTab,
    setToolsOpen,
    settingsQuery,
    submit,
    subscribed,
    targetCreatorAccountId,
    thread,
    toolTab,
    toolTabs,
    toolsOpen,
    typing,
    updateSlurpSettings,
  } = model;
  // Support desk off: Support still talks, sends pictures and asks for a photo, but plays no desk game.
  const desk = asSupport && (!settingsQuery.data || slpExtensionOn(settingsQuery.data, "supportDesk"));
  // These tools act on a conversation that exists. In a new chat they opened an empty panel.
  const availableTabs = toolTabs.filter(
    (tab) =>
      (desk || (tab.id !== "offer" && tab.id !== "move" && tab.id !== "note")) &&
      (thread ||
        (tab.id !== "photo" &&
          tab.id !== "generated-photo" &&
          tab.id !== "request" &&
          tab.id !== "creator" &&
          tab.id !== "show-post")),
  );
  const activeTab = availableTabs.find((tab) => tab.id === toolTab) ?? null;
  // A paid first message says its price where it is spent: on the Send button. The server charges it
  // only when no thread exists yet (a thread the Creator opened costs nothing), so neither does this.
  const sendFee =
    !ownsCreator && !thread && !asSupport && messaging?.dmPolicy === "paid" && !subscribed && messaging.requestFee > 0
      ? messaging.requestFee
      : 0;
  const closeTools = () => {
    setToolsOpen(false);
    setToolTab(null);
  };
  // A photo is answered like a text: typing first, then the reply, and the sheet closes (R1-019).
  const answerPhoto = (result: SlurpPhotoSendResult) => {
    setReplyStatus(result.replyStatus);
    holdTyping(result.reply ? (result.typingMs ?? 0) : 0, result.reply?.id);
    closeTools();
  };
  const toolRow = (tab: (typeof availableTabs)[number]) => (
    <button
      key={tab.id}
      type="button"
      onClick={() => setToolTab(tab.id)}
      className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          tab.group === "creator"
            ? "bg-[var(--accent)] text-[var(--slurp-muted)]"
            : "bg-[var(--slurp-tint)] text-[var(--slurp-ink)]",
        )}
      >
        <tab.icon size={20} className="!text-current" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-[15px] font-bold leading-5",
            tab.group === "creator" && "text-[var(--slurp-muted)]",
          )}
        >
          {tab.label}
        </span>
        <span className="block text-xs leading-4 text-[var(--slurp-muted)]">{tab.detail}</span>
      </span>
    </button>
  );

  return (
    <>
      {/* Pinned above the floating nav; glides to the edge with the nav while it is away. */}
      <div
        className="slp-nav-live relative mb-[var(--slp-nav-live,0px)] shrink-0 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5"
        style={{ transition: `margin-bottom ${SLP_MOTION.bar}ms ${SLP_MOTION.barEase}` }}
      >
        {awayFromBottom && (
          // Its own row just above the composer, at the end edge: the chat ends above it, so the
          // button never sits on a bubble or a tip line (B32).
          <div className={cn(SLP_THREAD_COLUMN_CLASS, "flex justify-end pb-2")}>
            <button
              type="button"
              onClick={scrollToLatest}
              aria-label={localizeUi("ui.slurp.messages.scrollToLatest", { defaultValue: "Scroll to latest message" })}
              title={localizeUi("ui.slurp.messages.scrollToLatest", { defaultValue: "Scroll to latest message" })}
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-[var(--slurp-surface-raised)] text-[var(--foreground)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <ArrowDown size={18} aria-hidden="true" />
              {typing && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--noodle-accent)] ring-2 ring-[var(--slurp-surface-raised)]"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        )}
        <div className={cn(SLP_THREAD_COLUMN_CLASS, "flex flex-col gap-2")}>
          {desk && <SlpDeskQuickReplies model={model} />}
          {desk && <SlpDeskComposerChip model={model} />}
          {asSupport && <SlpPhotoDemandChip model={model} />}
          {composerTipAmount > 0 && !asSupport && (
            <div className="slurp-bubble-in flex h-9 items-center gap-2 self-start rounded-full bg-[var(--slurp-tint)] ps-3 pe-1 text-xs font-semibold text-[var(--slurp-text)]">
              {localizeUi("ui.slurp.messages.tipAttached", { defaultValue: "Tip attached" })}
              <SlurpCoinAmount amount={composerTipAmount} className="tabular-nums" />
              {composerTipNote && (
                <span className="max-w-40 truncate font-normal text-[var(--slurp-muted)]">“{composerTipNote}”</span>
              )}
              <button
                type="button"
                onClick={() => {
                  setComposerTipAmount(0);
                  setComposerTipNote("");
                }}
                aria-label={localizeUi("ui.slurp.messages.removeTip", { defaultValue: "Remove tip" })}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          <form
            className="flex items-end gap-0.5 rounded-[1.4rem] bg-[var(--slurp-surface)] p-1 shadow-sm ring-1 ring-inset ring-[var(--noodle-divider)] transition-shadow focus-within:ring-2 focus-within:ring-[var(--noodle-accent)]/55 motion-reduce:transition-none"
            onClick={(event) => {
              // A tap on the bar's padding means "write here", as in the Engine chat box.
              if (event.target === event.currentTarget) composerRef.current?.focus();
            }}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <button
              type="button"
              onClick={() => {
                setToolsOpen((value) => {
                  const next = !value;
                  if (next) setToolTab(null);
                  return next;
                });
              }}
              aria-expanded={toolsOpen}
              aria-label={localizeUi("ui.slurp.messages.toggleTools", { defaultValue: "Message tools" })}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-[background-color,color,transform] hover:bg-[var(--noodle-accent)]/10 hover:text-[var(--noodle-accent-foreground)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100",
                toolsOpen && "bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent-foreground)]",
              )}
            >
              <Plus
                size={18}
                className={cn("transition-transform motion-reduce:transition-none", toolsOpen && "rotate-45")}
                aria-hidden="true"
              />
            </button>
            <SlurpConnectionSwitcher
              connections={(connectionsQuery.data ?? []).filter(
                (connection) => connection.provider !== "image_generation",
              )}
              activeConnectionId={settingsQuery.data?.generationConnectionId ?? null}
              open={connectionPickerOpen}
              onOpenChange={setConnectionPickerOpen}
              pending={updateSlurpSettings.isPending}
              onChange={(generationConnectionId) => updateSlurpSettings.mutate({ generationConnectionId })}
            />
            <label className="sr-only" htmlFor="slurp-message-draft">
              {localizeUi("ui.slurp.messages.composerLabel", { defaultValue: "Write a message" })}
            </label>
            <textarea
              ref={composerRef}
              id="slurp-message-draft"
              value={draft}
              rows={1}
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter breaks the line: the convention every chat box uses.
                // An IME uses Enter to confirm a word; that press must not send the half-written message.
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder={
                asSupport
                  ? localizeUi("ui.slurp.messages.supportVoicePlaceholder", {
                      defaultValue: "Message as {{name}}…",
                      name: supportName,
                    })
                  : localizeUi("ui.slurp.messages.composerPlaceholder", { defaultValue: "Write a message…" })
              }
              className="max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-base leading-6 outline-none placeholder:text-[var(--muted-foreground)] sm:text-sm sm:leading-6"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim() || !personaId || !targetCreatorAccountId}
              className={cn(
                "flex h-10 shrink-0 items-center justify-center rounded-xl transition-[background-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
                // A paid first message shows its price in the same button.
                sendFee > 0 ? "gap-1 px-3" : "w-10",
                draft.trim()
                  ? "bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)] active:scale-90 motion-reduce:active:scale-100 disabled:opacity-50"
                  : "text-[var(--muted-foreground)] opacity-50",
              )}
              aria-label={localizeUi("ui.slurp.messages.send", { defaultValue: "Send" })}
            >
              <Send size={16} aria-hidden="true" />
              {sendFee > 0 && <SlurpCoinAmount amount={sendFee} className="text-xs font-bold tabular-nums" />}
            </button>
          </form>
        </div>
      </div>

      <SlpSheet
        open={toolsOpen}
        onClose={closeTools}
        title={
          activeTab?.label ?? localizeUi("ui.slurp.messages.addToMessage", { defaultValue: "Add to your message" })
        }
        width="max-w-lg"
      >
        {activeTab ? (
          <SlpButton variant="tertiary" onClick={() => setToolTab(null)} className="mb-1 ms-1 text-[13px]">
            <ChevronLeft size={18} className="rtl:-scale-x-100" aria-hidden="true" />
            {localizeUi("ui.slurp.messages.backToActions", { defaultValue: "Back to actions" })}
          </SlpButton>
        ) : (
          <>
            {/* The fan's tools as one flat list; the Creator's own tools come last, quiet. */}
            <SlpSheetGroup>{availableTabs.filter((tab) => tab.group !== "creator").map(toolRow)}</SlpSheetGroup>
            {availableTabs.some((tab) => tab.group === "creator") && (
              <SlpSheetGroup label={localizeUi("ui.slurp.messages.creatorActions", { defaultValue: "Creator tools" })}>
                {availableTabs.filter((tab) => tab.group === "creator").map(toolRow)}
              </SlpSheetGroup>
            )}
          </>
        )}

        {toolTab === "write" && (
          // The message box stays as it is; the writing help lives here and writes into it.
          <div className="flex flex-col gap-2 px-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <p className="text-[13px] font-bold">
                {localizeUi("ui.slurp.messages.helpWriteYours", { defaultValue: "Your message" })}
              </p>
              <SlpTextAssist
                // The chat and the seat (7c M-004): Support writes as Slurp's staff, never as a fan.
                field={ownsCreator ? "reply" : asSupport ? "support" : "dm"}
                value={draft}
                accountId={targetCreatorAccountId ?? undefined}
                context={slurpAssistChatContext({
                  messages,
                  seat: ownsCreator ? "creator" : asSupport ? "support" : "persona",
                  creatorName: creator?.displayName ?? "the Creator",
                  viewerName: ownsCreator
                    ? (counterpart?.displayName ?? null)
                    : (messages
                        .filter((message) => message.role === "viewer" && message.metadata.supportVoice !== true)
                        .map((message) => message.senderSnapshot.displayName)
                        .findLast((name): name is string => typeof name === "string") ?? null),
                  supportName,
                })}
                disabled={busy}
                onApply={setDraft}
              />
            </div>
            <p className="min-h-10 whitespace-pre-wrap rounded-xl bg-[var(--slurp-surface)] px-3 py-2.5 text-sm ring-1 ring-inset ring-[var(--noodle-divider)] [overflow-wrap:anywhere]">
              {draft.trim() ||
                localizeUi("ui.slurp.messages.helpWriteEmpty", {
                  defaultValue: "Nothing yet. Tap Write and say what it should be about.",
                })}
            </p>
            <SlpButton
              disabled={!draft.trim()}
              onClick={() => {
                closeTools();
                composerRef.current?.focus();
              }}
              className="self-end"
            >
              {localizeUi("ui.slurp.messages.helpWriteUse", { defaultValue: "Back to the chat" })}
            </SlpButton>
          </div>
        )}

        {toolTab === "commission" && (
          <CommissionRequest
            creatorId={targetCreatorAccountId ?? undefined}
            disabled={busy || !personaId || !targetCreatorAccountId}
            pending={createCommission.isPending}
            initialBrief={commissionPrefill}
            onSendAsMessage={
              commissionPrefill
                ? () => {
                    setCommissionPrefill("");
                    closeTools();
                    void submit(true);
                  }
                : null
            }
            onSubmit={(brief) => {
              if (!personaId || !targetCreatorAccountId) return;
              setError(null);
              createCommission
                .mutateAsync({ personaId, creatorAccountId: targetCreatorAccountId, brief })
                .then(() => {
                  setDraft("");
                  setCommissionPrefill("");
                  closeTools();
                })
                .catch((cause: unknown) =>
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : localizeUi("ui.slurp.messages.commissionFailed", {
                          defaultValue: "Could not send that request.",
                        }),
                  ),
                );
            }}
          />
        )}

        {toolTab === "photo" && !ownsCreator && thread && personaId && targetCreatorAccountId && (
          <FanImageTool
            threadId={thread.id}
            creatorAccountId={targetCreatorAccountId}
            personaId={personaId}
            mode="choose"
            onSent={answerPhoto}
            asSupport={asSupport}
          />
        )}

        {/* The Creator's side of the same tool: ask the fan to write back. */}
        {toolTab === "request" && ownsCreator && thread && personaId && targetCreatorAccountId && (
          <div className="flex flex-col gap-3 px-1">
            <p className="text-xs leading-4 text-[var(--slurp-muted)]">
              {localizeUi("ui.slurp.messages.requestFanReplyDetail", {
                defaultValue: "Ask the fan to write back. They answer in their own voice.",
              })}
            </p>
            <SlpPrimaryButton
              disabled={busy || requestFanReply.isPending}
              onClick={() => {
                setError(null);
                requestFanReply
                  .mutateAsync({ creatorAccountId: targetCreatorAccountId, personaId, threadId: thread.id })
                  .then(closeTools)
                  .catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : localizeUi("ui.slurp.messages.requestFanReplyFailed", {
                            defaultValue: "Could not ask for a reply.",
                          }),
                    ),
                  );
              }}
            >
              {requestFanReply.isPending
                ? localizeUi("ui.slurp.messages.requesting", { defaultValue: "Requesting…" })
                : localizeUi("ui.slurp.messages.requestFanReply", { defaultValue: "Request a reply" })}
            </SlpPrimaryButton>
          </div>
        )}

        {toolTab === "request" && !ownsCreator && thread && personaId && (
          <div className="flex flex-col gap-3 px-1">
            <p className="text-xs leading-4 text-[var(--slurp-muted)]">
              {localizeUi("ui.slurp.messages.requestReplyDetail", {
                defaultValue: "Ask for a reply. This does not bypass availability or conversation rules.",
              })}
            </p>
            {/* A hint is a choice (tinted chip), the request is the action (the one primary). */}
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={localizeUi("ui.slurp.messages.requestHintLabel", { defaultValue: "Request hint" })}
            >
              {(
                [
                  ["photo", "Ask for a photo"],
                  ["paid-unlock", "Ask about paid content"],
                  ["follow-up", "Ask for a follow-up"],
                ] as const
              ).map(([value, label]) => (
                <SlpChip key={value} selected={requestHint === value} onClick={() => setRequestHint(value)}>
                  {localizeUi(`ui.slurp.messages.requestHint.${value}`, { defaultValue: label })}
                </SlpChip>
              ))}
            </div>
            <SlpPrimaryButton
              disabled={busy || requestReply.isPending}
              onClick={() => {
                setError(null);
                requestReply
                  .mutateAsync({ threadId: thread.id, personaId, guidance: requestHintGuidance(requestHint) })
                  .then((result) => {
                    setReplyStatus(result.replyStatus);
                    holdTyping(result.reply ? (result.typingMs ?? 0) : 0, result.reply?.id);
                    closeTools();
                  })
                  .catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : localizeUi("ui.slurp.messages.requestReplyFailed", {
                            defaultValue: "Could not request a reply.",
                          }),
                    ),
                  );
              }}
            >
              {requestReply.isPending
                ? localizeUi("ui.slurp.messages.requesting", { defaultValue: "Requesting…" })
                : localizeUi("ui.slurp.messages.requestReply", { defaultValue: "Request a reply" })}
            </SlpPrimaryButton>
          </div>
        )}

        {toolTab === "generated-photo" && !ownsCreator && thread && personaId && targetCreatorAccountId && (
          <FanImageTool
            threadId={thread.id}
            creatorAccountId={targetCreatorAccountId}
            personaId={personaId}
            mode="generate"
            onSent={answerPhoto}
            asSupport={asSupport}
          />
        )}

        {toolTab === "creator" && ownsCreator && personaId && thread && (
          <div className="flex flex-col gap-2 px-1">
            <CreatorMessageTools
              creatorAccountId={thread.creatorAccountId}
              viewerAccountId={thread.viewerAccountId}
              personaId={personaId}
              defaultPpvPrice={messaging?.ppvPrice ?? 0}
              threadId={thread.id}
              onPreparingImage={setPreparingImage}
              mode="locked"
            />
            <SlpButton
              variant="quiet"
              disabled={busy}
              onClick={() => {
                setError(null);
                draftReply
                  .mutateAsync({ creatorAccountId: thread.creatorAccountId, personaId, threadId: thread.id })
                  .catch((cause: unknown) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : localizeUi("ui.slurp.messages.draftFailed", { defaultValue: "Could not draft a reply." }),
                    ),
                  );
              }}
              className="self-start"
            >
              {draftReply.isPending
                ? localizeUi("ui.slurp.messages.drafting", { defaultValue: "Writing…" })
                : localizeUi("ui.slurp.messages.draftReply", { defaultValue: "Let them answer" })}
            </SlpButton>
          </div>
        )}

        {toolTab === "generated-photo" && ownsCreator && personaId && thread && (
          <CreatorMessageTools
            creatorAccountId={thread.creatorAccountId}
            viewerAccountId={thread.viewerAccountId}
            personaId={personaId}
            defaultPpvPrice={messaging?.ppvPrice ?? 0}
            threadId={thread.id}
            onPreparingImage={setPreparingImage}
            mode="generate"
          />
        )}

        {toolTab === "show-post" && asSupport && thread && <SlpSupportPostPicker model={model} onDone={closeTools} />}
        {toolTab === "demand" && asSupport && <SlpPhotoDemandTool model={model} onDone={closeTools} />}
        {(toolTab === "offer" || toolTab === "move" || toolTab === "note") && desk && (
          <SlpDeskToolPanel model={model} onPicked={closeTools} />
        )}

        {toolTab === "tip" && (
          <SlurpTipPanel
            personaId={personaId}
            busy={busy || !targetCreatorAccountId}
            allowAttach={!ownsCreator}
            onSendNow={(amount, note, origin) => void sendTip(amount, note, origin)}
            onAttach={(amount, note) => {
              setComposerTipAmount(amount);
              setComposerTipNote(note);
              closeTools();
              composerRef.current?.focus();
            }}
          />
        )}
      </SlpSheet>
      {desk && <SlpDeskPlayHost model={model} />}
    </>
  );
}
