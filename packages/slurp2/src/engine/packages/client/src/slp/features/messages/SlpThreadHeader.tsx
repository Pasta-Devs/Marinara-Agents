import { useSlurpUIStore } from "../../base/state/slp-package-store";
import { cn } from "../../../lib/utils";
import { SlpStoryRingAvatar } from "../../modules/story/SlpStoryRing";
import {
  ArrowLeft,
  BookHeart,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronUp,
  Headset,
  MoreVertical,
  Search,
  Trash2,
  Clapperboard,
  UserRound,
  X,
} from "lucide-react";
import { Avatar, SLP_BAR_GLASS_CLASS } from "../../base/chrome/SlpChrome";
import { SlpHeartGlyph } from "../../base/chrome/SlpGlyphs";
import { SlurpRapportBadge, SlurpTierLadder } from "./SlpMessageInsights";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpSheet, SlpSheetGroup, SlpSheetItem } from "../../modules/chrome/SlpSheet";
import { CommissionRow } from "./commissions/SlpCommissions";
import type { SlurpThreadViewModel } from "./slp-thread-actions";
import { SlpDeskTrustChip } from "../../modules/desk/SlpDeskCaseFile";
import { SlpDeskTicketBar } from "./SlpDeskTicketBar";

const ICON_BUTTON =
  "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--slurp-muted)] transition-[background-color,transform] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:!text-current";

/** The conversation header, its search bar, the commission strip and the request banner. */
export function SlpThreadHeader({ model }: { model: SlurpThreadViewModel }) {
  const {
    activeCommission,
    asSupport,
    availability,
    commissionRibbonOpen,
    commissions,
    desktopSplit,
    headerAccount,
    headerMenuOpen,
    headerMenuTriggerRef,
    headerProfileId,
    localizeUi,
    messageSearch,
    messageSearchIndex,
    messageSearchInputRef,
    messageSearchMatches,
    messageSearchOpen,
    onBack,
    onOpenProfile,
    ownsCreator,
    personaId,
    relationship,
    resetThread,
    resolveRequest,
    searchTriggerRef,
    setCommissionRibbonOpen,
    setDrawerMode,
    setError,
    setHeaderMenuOpen,
    setLoadedOlderMessages,
    setMessageSearch,
    setMessageSearchIndex,
    setMessageSearchOpen,
    setOlderCursor,
    setSupportChoice,
    supportName,
    targetCreatorAccountId,
    setTierOpen,
    thread,
    threadId: threadIdProp,
    threadQuery,
    tierOpen,
    tierTriggerRef,
  } = model;
  // A chat opened from a profile is addressed by its Creator; once it loads it has a thread like any
  // other, so Search, Memories, Commissions and Clear show there too (R1-008).
  const threadId = thread?.id ?? threadIdProp;
  // Roleplay scenes (docs/SCENES.md): this Engine runs them, this thread may, and it is not in one.
  const sceneHost = useSlurpUIStore((state) => state.sceneHost);
  const setSceneSheet = useSlurpUIStore((state) => state.setSceneSheet);
  const canStartScene = Boolean(sceneHost && threadQuery.data?.scenes && thread && !thread.sceneChatId);
  const tierLabel = thread?.rapport ? localizeUi(`ui.slurp.rapport.tier.${thread.rapport.tier}`) : "";
  // Her partner (or crush) is no fan tier: the header says where the two of them are, and opens You two.
  const partnerStage = relationship?.couple && relationship.couple.stage !== "split" ? relationship.couple.stage : null;
  const closeSearch = () => {
    setMessageSearchOpen(false);
    (searchTriggerRef.current?.offsetParent ? searchTriggerRef.current : headerMenuTriggerRef.current)?.focus();
  };
  // Destructive, so it keeps its confirm and sits last in the ⋮ menu, never next to read-only details.
  const clearConversation =
    threadId && personaId
      ? () => {
          setError(null);
          void showConfirmDialog({
            title: localizeUi("ui.slurp.messages.resetTitle", { defaultValue: "Clear this conversation?" }),
            message: localizeUi("ui.slurp.messages.resetDetail", {
              defaultValue:
                "Every message here is deleted, and any unfinished commission is closed. What they remember of you is kept, and so are coins, unlocks and finished commissions. This cannot be undone.",
            }),
            confirmLabel: localizeUi("ui.slurp.messages.resetConfirm", { defaultValue: "Clear it" }),
          })
            .then((confirmed) => {
              if (confirmed) return resetThread.mutateAsync({ threadId, personaId });
            })
            .then((cleared) => {
              // Older pages live outside the query cache, so the refetch alone left the deleted
              // messages on screen.
              if (!cleared) return;
              setLoadedOlderMessages([]);
              setOlderCursor(undefined);
            })
            .catch((cause: unknown) =>
              setError(
                cause instanceof Error
                  ? cause.message
                  : localizeUi("ui.slurp.messages.resetFailed", { defaultValue: "Could not clear this conversation." }),
              ),
            );
        }
      : null;
  // The player may speak as Slurp Support (Slurp's staff) in any chat with a Creator they do not run.
  // Support's own thread is a staff console: it has no way back to the persona's voice.
  const canSwitchVoice = Boolean(personaId && targetCreatorAccountId && !ownsCreator && !asSupport);
  const menuAction = (run: () => void) => () => {
    setHeaderMenuOpen(false);
    run();
  };
  const presence = availability?.online
    ? localizeUi("ui.slurp.messages.availableNow", { defaultValue: "Available now" })
    : availability?.minutesUntilOnline !== null && availability?.minutesUntilOnline !== undefined
      ? localizeUi(availability.estimated ? "ui.slurp.messages.probablyBackIn" : "ui.slurp.messages.backIn", {
          value1:
            availability.minutesUntilOnline < 60
              ? `${Math.round(availability.minutesUntilOnline)}min`
              : `${Math.round(availability.minutesUntilOnline / 60)}hr`,
        })
      : availability?.estimated
        ? localizeUi("ui.slurp.messages.probablyAway")
        : localizeUi("ui.slurp.messages.away", { defaultValue: "Away" });

  return (
    <>
      {/* Glass over the conversation: no hard rule, the bubbles scroll up under it. */}
      <div
        className={cn(
          "relative z-10 flex min-h-14 min-w-0 shrink-0 items-center gap-0.5 overflow-hidden px-1.5 py-1.5 shadow-[var(--slurp-highlight),var(--slurp-shadow-raised)] sm:gap-1 sm:px-2",
          SLP_BAR_GLASS_CLASS,
        )}
      >
        <button
          type="button"
          onClick={onBack}
          className={cn(ICON_BUTTON, "text-[var(--slurp-ink)]", desktopSplit && "md:hidden")}
          aria-label={localizeUi("ui.slurp.messages.backToInbox", { defaultValue: "Back to inbox" })}
        >
          <ArrowLeft size={20} className="rtl:-scale-x-100" />
        </button>
        <button
          type="button"
          onClick={() => headerProfileId && onOpenProfile(headerProfileId)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-full py-1 pe-1 ps-0.5 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
        >
          {headerAccount && (
            <SlpStoryRingAvatar creatorId={headerProfileId} name={headerAccount.displayName} outset={3}>
              <Avatar account={headerAccount} size="sm" />
            </SlpStoryRingAvatar>
          )}
          <span className="min-w-0 overflow-hidden">
            <span className="block truncate text-[15px] font-bold leading-5">{headerAccount?.displayName ?? ""}</span>
            {relationship && (
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--slurp-muted)]">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    availability?.online
                      ? "bg-[var(--slurp-success)]"
                      : (availability?.minutesUntilOnline ?? Infinity) < 120
                        ? "bg-[var(--slurp-warning)]"
                        : "bg-[var(--slurp-muted)]/60",
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{presence}</span>
              </span>
            )}
          </span>
        </button>
        {relationship?.desk && (
          // Slurp Support's thread: where the Creator stands with Slurp, and the open ticket.
          <span className="flex shrink-0 items-center gap-1 pe-1">
            <SlpDeskTrustChip desk={relationship.desk} />
            {relationship.desk.ticket && relationship.desk.ticket.status !== "resolved" && (
              <span className="hidden rounded-full bg-[var(--slurp-tint)] px-2 text-[11px] font-bold leading-6 text-[var(--slurp-text)] sm:inline">
                {localizeUi(`ui.slurp.desk.ticketStatus.${relationship.desk.ticket.status}`, {
                  defaultValue: relationship.desk.ticket.status === "open" ? "Open ticket" : "Waiting on them",
                })}
              </span>
            )}
          </span>
        )}
        {partnerStage && !asSupport && (
          <button
            type="button"
            onClick={() => setDrawerMode("details")}
            className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-2 text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:pe-3"
            aria-label={localizeUi("ui.slurp.youTwo.headerLabel", {
              stage: localizeUi(`ui.slurp.youTwo.stage.${partnerStage}`),
            })}
          >
            <SlpHeartGlyph size={18} filled aria-hidden="true" />
            <span className="hidden text-[0.72rem] font-bold sm:inline">
              {localizeUi(`ui.slurp.youTwo.stage.${partnerStage}`)}
            </span>
          </button>
        )}
        {thread?.rapport && !asSupport && !relationship?.desk && !partnerStage && (
          // The tier icon (the word too on wider screens) in a 44 px target. Slurp's staff are no fan tier.
          <button
            ref={tierTriggerRef}
            type="button"
            aria-expanded={tierOpen}
            aria-haspopup="dialog"
            onClick={() => setTierOpen((open) => !open)}
            className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-1 transition-colors hover:bg-[var(--accent)] focus-visible:outline-none sm:pe-3 focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            aria-label={localizeUi("ui.slurp.messages.relationshipStatus", {
              defaultValue: "Relationship: {{tier}}",
              tier: tierLabel,
            })}
          >
            <SlurpRapportBadge rapport={thread.rapport} ownsCreator={ownsCreator} />
            <span className="hidden text-[0.72rem] font-bold text-[var(--noodle-accent-foreground)] sm:inline">
              {tierLabel}
            </span>
          </button>
        )}
        {threadId && (
          <button
            ref={searchTriggerRef}
            type="button"
            aria-expanded={messageSearchOpen}
            onClick={() => setMessageSearchOpen((open) => !open)}
            className={cn(ICON_BUTTON, "hidden sm:flex")}
            aria-label={localizeUi("ui.slurp.messages.searchConversation", { defaultValue: "Search conversation" })}
            title={localizeUi("ui.slurp.messages.searchConversation", { defaultValue: "Search conversation" })}
          >
            <Search size={18} aria-hidden="true" />
          </button>
        )}
        {(relationship || threadId || canSwitchVoice) && (
          <button
            ref={headerMenuTriggerRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={headerMenuOpen}
            onClick={() => setHeaderMenuOpen((open) => !open)}
            aria-label={localizeUi("ui.slurp.messages.moreActions", { defaultValue: "More actions" })}
            title={localizeUi("ui.slurp.messages.moreActions", { defaultValue: "More actions" })}
            className={cn(ICON_BUTTON, headerMenuOpen && "bg-[var(--accent)] text-[var(--slurp-text)]")}
          >
            <MoreVertical size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <SlpSheet
        open={tierOpen && Boolean(thread?.rapport)}
        onClose={() => setTierOpen(false)}
        title={localizeUi("ui.slurp.messages.relationshipLevel", { defaultValue: "Relationship level" })}
        anchorRef={tierTriggerRef}
      >
        {thread?.rapport && (
          <div className="px-3 pb-2 pt-1">
            <p className="text-xl font-extrabold leading-[26px]">{tierLabel}</p>
            <p className="mt-0.5 text-xs leading-4 text-[var(--slurp-muted)]">
              {localizeUi(
                ownsCreator
                  ? `ui.slurp.rapport.creatorHint.${thread.rapport.tier}`
                  : `ui.slurp.rapport.viewerHint.${thread.rapport.tier}`,
              )}
            </p>
            <SlurpTierLadder tier={thread.rapport.tier} className="mt-4" />
          </div>
        )}
      </SlpSheet>

      <SlpSheet
        open={headerMenuOpen}
        onClose={() => setHeaderMenuOpen(false)}
        title={
          headerAccount?.displayName ?? localizeUi("ui.slurp.messages.moreActions", { defaultValue: "More actions" })
        }
        kind="menu"
        anchorRef={headerMenuTriggerRef}
      >
        <SlpSheetGroup>
          {threadId && (
            <SlpSheetItem onSelect={menuAction(() => setMessageSearchOpen(true))}>
              <Search aria-hidden="true" />
              {localizeUi("ui.slurp.messages.searchConversation", { defaultValue: "Search conversation" })}
            </SlpSheetItem>
          )}
          {relationship && (
            <SlpSheetItem onSelect={menuAction(() => setDrawerMode("details"))}>
              <UserRound aria-hidden="true" />
              {localizeUi("ui.slurp.messages.relationshipToggle", { defaultValue: "Details" })}
            </SlpSheetItem>
          )}
          {threadId && (
            <SlpSheetItem onSelect={menuAction(() => setDrawerMode("memories"))}>
              <BookHeart aria-hidden="true" />
              {localizeUi("ui.slurp.messages.memories", { defaultValue: "Memories" })}
            </SlpSheetItem>
          )}
          {canStartScene && thread && (
            <SlpSheetItem onSelect={menuAction(() => setSceneSheet({ threadId: thread.id }))}>
              <Clapperboard aria-hidden="true" />
              {localizeUi("ui.slurp.rpScene.menuStart")}
            </SlpSheetItem>
          )}
          {/* Slurp's staff do not commission pictures: Support has its own photo tools (0.3.6). */}
          {threadId && !asSupport && (
            <SlpSheetItem onSelect={menuAction(() => setDrawerMode("commissions"))}>
              <BriefcaseBusiness aria-hidden="true" />
              <span className="min-w-0 flex-1">
                {localizeUi("ui.slurp.messages.commissionsTitle", { defaultValue: "Commissions" })}
              </span>
              {commissions.length > 0 && (
                <span className="min-w-5 rounded-full bg-[var(--noodle-accent)] px-1.5 text-center text-[11px] font-bold leading-5 tabular-nums text-[var(--slurp-on-accent)]">
                  {commissions.length}
                </span>
              )}
            </SlpSheetItem>
          )}
        </SlpSheetGroup>
        {canSwitchVoice && (
          <SlpSheetGroup>
            <SlpSheetItem onSelect={menuAction(() => setSupportChoice(true))}>
              <Headset aria-hidden="true" />
              {localizeUi("ui.slurp.messages.supportVoiceOn", {
                defaultValue: "Switch to {{name}}",
                name: supportName,
              })}
            </SlpSheetItem>
          </SlpSheetGroup>
        )}
        {clearConversation && (
          <SlpSheetGroup>
            <SlpSheetItem tone="danger" disabled={resetThread.isPending} onSelect={menuAction(clearConversation)}>
              <Trash2 aria-hidden="true" />
              {localizeUi("ui.slurp.messages.clearConversation", { defaultValue: "Clear conversation" })}
            </SlpSheetItem>
          </SlpSheetGroup>
        )}
      </SlpSheet>

      {messageSearchOpen && (
        <div
          className={cn(
            "relative z-[9] flex min-h-14 shrink-0 items-center gap-1 px-3 shadow-[var(--slurp-shadow-raised)]",
            SLP_BAR_GLASS_CLASS,
          )}
        >
          <label className="sr-only" htmlFor="slurp-conversation-search">
            {localizeUi("ui.slurp.messages.searchConversation", { defaultValue: "Search conversation" })}
          </label>
          <input
            ref={messageSearchInputRef}
            id="slurp-conversation-search"
            type="search"
            value={messageSearch}
            onChange={(event) => setMessageSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") closeSearch();
            }}
            placeholder={localizeUi("ui.slurp.messages.searchConversationPlaceholder", {
              defaultValue: "Search this conversation…",
            })}
            className="h-10 min-w-0 flex-1 rounded-full bg-[var(--slurp-surface)] px-4 text-base outline-none placeholder:text-[var(--slurp-muted)] focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
          />
          <span role="status" className="shrink-0 px-1 text-xs tabular-nums text-[var(--slurp-muted)]">
            {messageSearch.trim()
              ? messageSearchMatches.length > 0
                ? localizeUi("ui.slurp.messages.searchPosition", {
                    defaultValue: "{{position}} of {{count}}",
                    position: messageSearchIndex + 1,
                    count: messageSearchMatches.length,
                  })
                : localizeUi("ui.slurp.messages.noMatches", { defaultValue: "No matches" })
              : ""}
          </span>
          {(["previous", "next"] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              disabled={messageSearchMatches.length === 0}
              onClick={() =>
                setMessageSearchIndex((current) =>
                  direction === "previous"
                    ? (current - 1 + messageSearchMatches.length) % messageSearchMatches.length
                    : (current + 1) % messageSearchMatches.length,
                )
              }
              className={cn(ICON_BUTTON, "h-10 w-10 disabled:opacity-35")}
              aria-label={localizeUi(`ui.slurp.messages.search.${direction}`, {
                defaultValue: direction === "previous" ? "Previous match" : "Next match",
              })}
            >
              {direction === "previous" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          ))}
          {/* A word, not a second ✕: the field's own clear button already looks like one. */}
          <SlpButton variant="tertiary" onClick={closeSearch} className="px-2.5 text-[13px]">
            {localizeUi("ui.slurp.messages.searchDone", { defaultValue: "Done" })}
          </SlpButton>
        </div>
      )}

      {activeCommission && personaId && !asSupport && (
        // The same commission component as the chat and the drawer, as one line with its next step.
        <div
          className={cn("relative z-[8] shrink-0 px-3 py-2 shadow-[var(--slurp-shadow-raised)]", SLP_BAR_GLASS_CLASS)}
        >
          <div className="mx-auto flex w-full max-w-[45rem] items-start gap-1">
            <div className="min-w-0 flex-1">
              <CommissionRow
                commission={activeCommission}
                deliveryMessage={null}
                personaId={personaId}
                ownsCreator={ownsCreator}
                compact={!commissionRibbonOpen}
              />
            </div>
            <button
              type="button"
              aria-expanded={commissionRibbonOpen}
              onClick={() => setCommissionRibbonOpen((open) => !open)}
              className={cn(ICON_BUTTON, "h-10 w-10")}
              aria-label={localizeUi("ui.slurp.messages.commissionProgress", { defaultValue: "Commission progress" })}
            >
              <ChevronDown
                size={18}
                className={cn(
                  "transition-transform motion-reduce:transition-none",
                  commissionRibbonOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      )}

      {relationship?.desk && asSupport && <SlpDeskTicketBar model={model} desk={relationship.desk} />}

      {thread?.state === "request" && (
        <div className="mx-auto mt-3 w-full max-w-[45rem] shrink-0 px-3">
          <div className="rounded-2xl bg-[var(--slurp-tint)] px-4 py-3 shadow-[var(--slurp-highlight)]">
            <p className="text-xs leading-4 text-[var(--slurp-text)]">
              {ownsCreator
                ? localizeUi("ui.slurp.messages.requestForYou", {
                    defaultValue: "Accept, decline, or reply to open this conversation.",
                  })
                : localizeUi("ui.slurp.messages.requestPending", {
                    defaultValue: "This request stays pending until the Creator accepts or replies.",
                  })}
            </p>
            {ownsCreator && personaId && thread && (
              <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                <SlpPrimaryButton
                  disabled={resolveRequest.isPending}
                  onClick={() => resolveRequest.mutate({ threadId: thread.id, personaId, decision: "accept" })}
                >
                  <Check size={16} /> {localizeUi("ui.slurp.messages.accept", { defaultValue: "Accept" })}
                </SlpPrimaryButton>
                <SlpButton
                  variant="tertiary"
                  disabled={resolveRequest.isPending}
                  onClick={() => resolveRequest.mutate({ threadId: thread.id, personaId, decision: "decline" })}
                >
                  <X size={16} /> {localizeUi("ui.slurp.messages.decline", { defaultValue: "Decline" })}
                </SlpButton>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
