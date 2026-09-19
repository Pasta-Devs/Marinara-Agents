import { requestHintGuidance, TIP_PRESETS } from "./SlpMessages";
import {
  ArrowDown,
  ArrowLeft,
  Brain,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  ChevronDown,
  Heart,
  Image as ImageIcon,
  Info,
  Link,
  Loader2,
  Lock,
  MessageCircle,
  Megaphone,
  Moon,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  CommissionRequest,
  CommissionRow,
  isCommissionRequest,
  SlurpCommissionsPanel,
} from "./commissions/SlpCommissions";
import { BroadcastPanel, CreatorMessageTools, FanImageTool } from "./SlpMessageTools";
import { cn } from "../../../lib/utils";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "../../modules/coin/SlpCoin";
import { HeaderIconButton, SlurpConnectionSwitcher, SlurpFollowUpItem } from "./SlpThreadChrome";
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
    customTipAmount,
    customTipNote,
    draft,
    draftReply,
    holdTyping,
    localizeUi,
    messaging,
    ownsCreator,
    personaId,
    requestHint,
    requestReply,
    scrollToLatest,
    sendTip,
    setCommissionPrefill,
    setComposerTipAmount,
    setComposerTipNote,
    setConnectionPickerOpen,
    setCustomTipAmount,
    setCustomTipNote,
    setDraft,
    setError,
    setPreparingImage,
    setReplyStatus,
    setRequestHint,
    setTipMode,
    setToolTab,
    setToolsOpen,
    settingsQuery,
    submit,
    targetCreatorAccountId,
    thread,
    tipMode,
    toolTab,
    toolTabs,
    toolsOpen,
    typing,
    updateSlurpSettings,
  } = model;

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
            <div className="flex flex-col gap-2 rounded-2xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)] shadow-[var(--slurp-shadow-floating)]">
              <div className="flex flex-col gap-3" aria-label="Message actions">
                <div className="flex items-center justify-between gap-3 px-1">
                  <div>
                    <h2 className="text-sm font-black">Add to your message</h2>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Choose one action to continue.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToolsOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    aria-label="Close message actions"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
                {(["media", "conversation", "payment", "creator"] as const).map((group) => {
                  const items = toolTabs.filter((tab) => tab.group === group);
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
                            className="flex min-h-16 items-center gap-3 rounded-xl bg-[var(--slurp-surface)] px-3 text-left ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.08] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
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
                          setError(cause instanceof Error ? cause.message : "Could not request a reply."),
                        );
                    }}
                    className="min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-50"
                  >
                    {requestReply.isPending ? "Requesting…" : "Request a reply"}
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
                <>
                  {/* Send now, or attach to the message being written. Both were on screen at once
                  with near-identical rows, which is how you tip twice by accident. */}
                  <div
                    role="group"
                    aria-label={localizeUi("ui.slurp.messages.tipMode", { defaultValue: "How to tip" })}
                    className="flex items-center gap-1"
                  >
                    {(["now", "with-message"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={tipMode === mode}
                        disabled={mode === "with-message" && ownsCreator}
                        onClick={() => setTipMode(mode)}
                        className={cn(
                          "min-h-9 rounded-full px-3 text-[0.7rem] font-bold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] disabled:hidden",
                          tipMode === mode &&
                            "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950 ring-[var(--noodle-accent)]",
                        )}
                      >
                        {mode === "now"
                          ? localizeUi("ui.slurp.messages.tipNow", { defaultValue: "Send now" })
                          : localizeUi("ui.slurp.messages.tipWithMessage", { defaultValue: "With my message" })}
                      </button>
                    ))}
                  </div>

                  {tipMode === "now" ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SlurpCoin size={15} />
                      {TIP_PRESETS.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          disabled={busy || !personaId || !targetCreatorAccountId}
                          onClick={() => sendTip(amount)}
                          className="relative min-h-11 overflow-visible rounded-full px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/40 transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                        >
                          <SlurpCoinBurst active={activeTipAmount === amount} />
                          {localizeUi("ui.slurp.messages.tipAmount", { defaultValue: "Tip {{amount}}", amount })}
                        </button>
                      ))}
                      <label className="sr-only" htmlFor="slurp-custom-tip-amount">
                        {localizeUi("ui.slurp.messages.customTipAmount", { defaultValue: "Custom tip amount" })}
                      </label>
                      <input
                        id="slurp-custom-tip-amount"
                        type="number"
                        min={1}
                        max={9999}
                        value={customTipAmount}
                        onChange={(event) => setCustomTipAmount(event.target.value)}
                        placeholder={localizeUi("ui.slurp.messages.customTipPlaceholder", { defaultValue: "Other" })}
                        className="h-11 w-20 rounded-full bg-[var(--slurp-surface)] px-3 text-xs tabular-nums outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)]"
                      />
                      <label className="sr-only" htmlFor="slurp-custom-tip-note">
                        {localizeUi("ui.slurp.messages.customTipNote", { defaultValue: "Tip note" })}
                      </label>
                      <input
                        id="slurp-custom-tip-note"
                        value={customTipNote}
                        maxLength={280}
                        onChange={(event) => setCustomTipNote(event.target.value)}
                        placeholder={localizeUi("ui.slurp.messages.tipNotePlaceholder", { defaultValue: "Note" })}
                        className="h-11 min-w-28 flex-1 rounded-full bg-[var(--slurp-surface)] px-3 text-xs outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)]"
                      />
                      <button
                        type="button"
                        disabled={
                          busy ||
                          !personaId ||
                          !targetCreatorAccountId ||
                          !Number.isInteger(Number(customTipAmount)) ||
                          Number(customTipAmount) < 1 ||
                          Number(customTipAmount) > 9999
                        }
                        onClick={() => {
                          void sendTip(Number(customTipAmount), customTipNote.trim(), {
                            amount: customTipAmount,
                            note: customTipNote,
                          });
                          setCustomTipAmount("");
                          setCustomTipNote("");
                        }}
                        className="min-h-11 rounded-full bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
                      >
                        {localizeUi("ui.slurp.messages.sendCustomTip", { defaultValue: "Send tip" })}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {TIP_PRESETS.map((amount) => (
                        <button
                          key={`composer-tip-${amount}`}
                          type="button"
                          aria-pressed={composerTipAmount === amount}
                          onClick={() => setComposerTipAmount((current) => (current === amount ? 0 : amount))}
                          className={cn(
                            "min-h-9 rounded-full px-2.5 text-xs font-bold ring-1 ring-inset ring-[var(--noodle-accent)]/40",
                            composerTipAmount === amount &&
                              "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950",
                          )}
                        >
                          {amount}
                        </button>
                      ))}
                      {composerTipAmount > 0 && (
                        <input
                          value={composerTipNote}
                          maxLength={280}
                          onChange={(event) => setComposerTipNote(event.target.value)}
                          placeholder={localizeUi("ui.slurp.messages.tipNotePlaceholder", { defaultValue: "Tip note" })}
                          className="h-9 min-w-32 flex-1 rounded-full bg-[var(--slurp-surface)] px-3 text-xs outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)]"
                        />
                      )}
                      <p className="w-full text-[0.65rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.slurp.messages.tipWithMessageHint", {
                          defaultValue: "The tip goes with the next message you send.",
                        })}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <form
            className="flex items-end gap-0.5 rounded-2xl bg-[var(--slurp-surface)] p-1 shadow-sm ring-1 ring-inset ring-[var(--noodle-divider)] transition-shadow focus-within:ring-2 focus-within:ring-[var(--noodle-accent)]/55 motion-reduce:transition-none"
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
                if (event.key === "Enter" && !event.shiftKey) {
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
