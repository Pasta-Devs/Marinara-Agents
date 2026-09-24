import { requestHintGuidance } from "./SlpMessages";
import { ArrowDown, ChevronLeft, Plus, Send, X } from "lucide-react";
import { CommissionRequest } from "./commissions/SlpCommissions";
import { CreatorMessageTools, FanImageTool, SlurpTipPanel } from "./SlpMessageTools";
import { cn } from "../../../lib/utils";
import { SlurpCoin } from "../../modules/coin/SlpCoin";
import { SlurpConnectionSwitcher } from "./SlpThreadChrome";
import type { SlurpThreadViewModel } from "./slp-thread-actions";

/** The message composer: the draft, the tools it opens and the tip it can carry. */
export function SlpThreadComposer({ model }: { model: SlurpThreadViewModel }) {
  const {
    activeTipAmount,
    awayFromBottom,
    busy,
    commissionPrefill,
    composerRef,
    composerTipAmount,
    composerTipNote,
    connectionPickerOpen,
    connectionsQuery,
    createCommission,
    draft,
    draftReply,
    holdTyping,
    localizeUi,
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
    setToolTab,
    setToolsOpen,
    settingsQuery,
    submit,
    targetCreatorAccountId,
    thread,
    toolTab,
    toolTabs,
    toolsOpen,
    typing,
    updateSlurpSettings,
  } = model;
  // These tools act on a conversation that exists. In a new chat they opened an empty panel.
  const availableTabs = toolTabs.filter(
    (tab) =>
      thread || (tab.id !== "photo" && tab.id !== "generated-photo" && tab.id !== "request" && tab.id !== "creator"),
  );
  const activeTab = availableTabs.find((tab) => tab.id === toolTab) ?? null;

  return (
    <>
      <div className="relative shrink-0 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {awayFromBottom && (
          <button
            type="button"
            onClick={scrollToLatest}
            aria-label={localizeUi("ui.slurp.messages.scrollToLatest", { defaultValue: "Scroll to latest message" })}
            title={localizeUi("ui.slurp.messages.scrollToLatest", { defaultValue: "Scroll to latest message" })}
            className="absolute bottom-full left-1/2 z-10 mb-2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--slurp-surface-raised)] text-[var(--foreground)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <ArrowDown size={18} aria-hidden="true" />
            {typing && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--noodle-accent)] ring-2 ring-[var(--slurp-surface-raised)]"
                aria-hidden="true"
              />
            )}
          </button>
        )}
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {toolsOpen && (
            <div className="slurp-sheet-in flex max-h-[min(70dvh,34rem)] flex-col gap-2 overflow-y-auto overscroll-contain rounded-3xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)] shadow-[var(--slurp-shadow-floating)]">
              <div
                role="group"
                aria-label={localizeUi("ui.slurp.messages.messageActions", { defaultValue: "Message actions" })}
                className="flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2 px-1">
                  {activeTab ? (
                    <button
                      type="button"
                      onClick={() => setToolTab(null)}
                      className="-ml-1 flex min-h-9 items-center gap-1 rounded-lg pr-2 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    >
                      <ChevronLeft size={18} aria-hidden="true" />
                      <span className="sr-only">
                        {localizeUi("ui.slurp.messages.backToActions", { defaultValue: "Back to actions" })}:
                      </span>
                      {activeTab.label}
                    </button>
                  ) : (
                    <div>
                      <h2 className="text-sm font-black">
                        {localizeUi("ui.slurp.messages.addToMessage", { defaultValue: "Add to your message" })}
                      </h2>
                      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                        {localizeUi("ui.slurp.messages.chooseAction", {
                          defaultValue: "Choose one action to continue.",
                        })}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setToolsOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    aria-label={localizeUi("ui.slurp.messages.closeActions", { defaultValue: "Close message actions" })}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                {!activeTab &&
                  (["media", "conversation", "payment", "creator"] as const).map((group) => {
                    const items = availableTabs.filter((tab) => tab.group === group);
                    if (items.length === 0) return null;
                    const heading =
                      group === "media"
                        ? localizeUi("ui.slurp.messages.mediaActions", { defaultValue: "Media" })
                        : group === "conversation"
                          ? localizeUi("ui.slurp.messages.conversationActions", { defaultValue: "Conversation" })
                          : group === "payment"
                            ? localizeUi("ui.slurp.messages.paymentActions", { defaultValue: "Payments" })
                            : localizeUi("ui.slurp.messages.creatorActions", { defaultValue: "Creator tools" });
                    return (
                      <section key={group} className="flex flex-col gap-1.5">
                        <h3 className="px-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                          {heading}
                        </h3>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {items.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setToolTab(tab.id)}
                              className="flex min-h-16 items-center gap-3 rounded-2xl bg-[var(--slurp-surface)] px-3 text-left ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.08] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--noodle-accent)]/12 text-[var(--noodle-accent)]">
                                <tab.icon size={18} aria-hidden="true" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-bold">{tab.label}</span>
                                <span className="mt-0.5 block text-[0.68rem] leading-4 text-[var(--muted-foreground)]">
                                  {tab.detail}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
              </div>

              {toolTab === "commission" && (
                <CommissionRequest
                  disabled={busy || !personaId || !targetCreatorAccountId}
                  pending={createCommission.isPending}
                  initialBrief={commissionPrefill}
                  onSendAsMessage={
                    commissionPrefill
                      ? () => {
                          setCommissionPrefill("");
                          setToolsOpen(false);
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
                        setToolsOpen(false);
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
                />
              )}

              {/* The Creator's side of the same tool: ask the fan to write back. */}
              {toolTab === "request" && ownsCreator && thread && personaId && targetCreatorAccountId && (
                <div className="flex flex-col gap-2 rounded-xl bg-[var(--slurp-surface)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)]">
                  <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                    {localizeUi("ui.slurp.messages.requestFanReplyDetail", {
                      defaultValue: "Ask the fan to write back. They answer in their own voice.",
                    })}
                  </p>
                  <button
                    type="button"
                    disabled={busy || requestFanReply.isPending}
                    onClick={() => {
                      setError(null);
                      requestFanReply
                        .mutateAsync({
                          creatorAccountId: targetCreatorAccountId,
                          personaId,
                          threadId: thread.id,
                        })
                        .then(() => {
                          setToolsOpen(false);
                          setToolTab(null);
                        })
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
                    className="min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-50"
                  >
                    {requestFanReply.isPending
                      ? localizeUi("ui.slurp.messages.requesting", { defaultValue: "Requesting…" })
                      : localizeUi("ui.slurp.messages.requestFanReply", { defaultValue: "Request a reply" })}
                  </button>
                </div>
              )}

              {toolTab === "request" && !ownsCreator && thread && personaId && (
                <div className="flex flex-col gap-2 rounded-xl bg-[var(--slurp-surface)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)]">
                  <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                    {localizeUi("ui.slurp.messages.requestReplyDetail", {
                      defaultValue: "Ask for a reply. This does not bypass availability or conversation rules.",
                    })}
                  </p>
                  <div
                    className="grid gap-1.5 sm:grid-cols-3"
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
                      <button
                        key={value}
                        type="button"
                        aria-pressed={requestHint === value}
                        onClick={() => setRequestHint(value)}
                        className={cn(
                          "min-h-10 rounded-lg px-2 text-xs font-semibold ring-1 ring-inset ring-[var(--noodle-divider)]",
                          requestHint === value &&
                            "bg-[var(--noodle-accent)] text-zinc-950 ring-[var(--noodle-accent)]",
                        )}
                      >
                        {localizeUi(`ui.slurp.messages.requestHint.${value}`, { defaultValue: label })}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={busy || requestReply.isPending}
                    onClick={() => {
                      setError(null);
                      requestReply
                        .mutateAsync({ threadId: thread.id, personaId, guidance: requestHintGuidance(requestHint) })
                        .then((result) => {
                          setReplyStatus(result.replyStatus);
                          holdTyping(result.reply ? (result.typingMs ?? 0) : 0, result.reply?.id);
                          setToolsOpen(false);
                          setToolTab(null);
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
                    className="min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-50"
                  >
                    {requestReply.isPending
                      ? localizeUi("ui.slurp.messages.requesting", { defaultValue: "Requesting…" })
                      : localizeUi("ui.slurp.messages.requestReply", { defaultValue: "Request a reply" })}
                  </button>
                </div>
              )}

              {toolTab === "generated-photo" && !ownsCreator && thread && personaId && targetCreatorAccountId && (
                <FanImageTool
                  threadId={thread.id}
                  creatorAccountId={targetCreatorAccountId}
                  personaId={personaId}
                  mode="generate"
                />
              )}

              {toolTab === "creator" && ownsCreator && personaId && thread && (
                <div className="flex flex-col gap-2">
                  <CreatorMessageTools
                    creatorAccountId={thread.creatorAccountId}
                    viewerAccountId={thread.viewerAccountId}
                    personaId={personaId}
                    defaultPpvPrice={messaging?.ppvPrice ?? 0}
                    threadId={thread.id}
                    onPreparingImage={setPreparingImage}
                    mode="locked"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      draftReply
                        .mutateAsync({ creatorAccountId: thread.creatorAccountId, personaId, threadId: thread.id })
                        .catch((cause: unknown) =>
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : localizeUi("ui.slurp.messages.draftFailed", {
                                  defaultValue: "Could not draft a reply.",
                                }),
                          ),
                        );
                    }}
                    className="min-h-11 self-start rounded-xl px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/40 transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    {draftReply.isPending
                      ? localizeUi("ui.slurp.messages.drafting", { defaultValue: "Writing…" })
                      : localizeUi("ui.slurp.messages.draftReply", { defaultValue: "Let them answer" })}
                  </button>
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

              {toolTab === "tip" && (
                <SlurpTipPanel
                  personaId={personaId}
                  busy={busy || !targetCreatorAccountId}
                  sendingAmount={activeTipAmount}
                  allowAttach={!ownsCreator}
                  onSendNow={(amount, note) => void sendTip(amount, note)}
                  onAttach={(amount, note) => {
                    setComposerTipAmount(amount);
                    setComposerTipNote(note);
                    setToolsOpen(false);
                    setToolTab(null);
                    composerRef.current?.focus();
                  }}
                />
              )}
            </div>
          )}
          {composerTipAmount > 0 && (
            <div className="slurp-bubble-in flex items-center gap-2 self-start rounded-full bg-[var(--noodle-accent)]/12 py-1 pl-3 pr-1 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/30">
              <SlurpCoin size={14} />
              {localizeUi("ui.slurp.messages.tipAttached", {
                defaultValue: "{{amount}} coin tip goes with this message",
                amount: composerTipAmount,
              })}
              {composerTipNote && (
                <span className="max-w-40 truncate font-normal text-[var(--muted-foreground)]">
                  “{composerTipNote}”
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setComposerTipAmount(0);
                  setComposerTipNote("");
                }}
                aria-label={localizeUi("ui.slurp.messages.removeTip", { defaultValue: "Remove tip" })}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
              >
                <X size={13} aria-hidden="true" />
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
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-[background-color,color,transform] hover:bg-[var(--noodle-accent)]/10 hover:text-[var(--noodle-accent)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100",
                toolsOpen && "bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)]",
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
              placeholder={localizeUi("ui.slurp.messages.composerPlaceholder", { defaultValue: "Write a message…" })}
              className="max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-base leading-6 outline-none placeholder:text-[var(--muted-foreground)] sm:text-sm sm:leading-6"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim() || !personaId || !targetCreatorAccountId}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-[background-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none",
                draft.trim()
                  ? "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950 active:scale-90 motion-reduce:active:scale-100 disabled:opacity-50"
                  : "text-[var(--muted-foreground)] opacity-50",
              )}
              aria-label={localizeUi("ui.slurp.messages.send", { defaultValue: "Send" })}
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
