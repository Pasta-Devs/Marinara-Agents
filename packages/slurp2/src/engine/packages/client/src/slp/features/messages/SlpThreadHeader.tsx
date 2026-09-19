import { cn } from "../../../lib/utils";
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
import { Avatar } from "../../base/chrome/SlpChrome";
import {
  SlurpPromptDebugPanel,
  SlurpRapportBadge,
  SlurpRelationshipPanel,
  SlurpTierLadder,
  useDismissablePopover,
} from "./SlpMessageInsights";
import { NoodleAnchoredPopover } from "../../base/chrome/SlpAnchoredPopover";
import { HeaderIconButton, SlurpConnectionSwitcher, SlurpFollowUpItem } from "./SlpThreadChrome";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "../../modules/coin/SlpCoin";
import type { SlurpThreadViewModel } from "./slp-thread-actions";

/** The conversation header, its search bar, the commission ribbon and the request banner. */
export function SlpThreadHeader({ model }: { model: SlurpThreadViewModel }) {
  const {
    activeCommission,
    availability,
    commissionRibbonOpen,
    commissions,
    desktopSplit,
    headerAccount,
    headerMenuOpen,
    headerMenuRef,
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
    resolveRequest,
    searchTriggerRef,
    setCommissionRibbonOpen,
    setDrawerMode,
    setHeaderMenuOpen,
    setMessageSearch,
    setMessageSearchIndex,
    setMessageSearchOpen,
    setTierOpen,
    thread,
    threadId,
    tierOpen,
    tierPopoverRef,
    tierTriggerRef,
  } = model;

  return (
    <>
  <div className="flex min-h-14 min-w-0 shrink-0 items-center gap-1 overflow-hidden border-b border-[var(--noodle-divider)] bg-[var(--slurp-glass)] px-1.5 py-1.5 backdrop-blur-xl sm:gap-2 sm:px-2">
    <button
      type="button"
      onClick={onBack}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100",
        desktopSplit && "md:hidden",
      )}
      aria-label={localizeUi("ui.slurp.messages.backToInbox", { defaultValue: "Back to inbox" })}
    >
      <ArrowLeft size={18} />
    </button>
    <button
      type="button"
      onClick={() => headerProfileId && onOpenProfile(headerProfileId)}
      className="flex min-h-11 min-w-0 max-w-full flex-1 items-center gap-2 overflow-hidden rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-[var(--noodle-accent)]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none sm:gap-2.5 sm:px-2"
    >
      {headerAccount && <Avatar account={headerAccount} size="sm" />}
      <span className="min-w-0 max-w-full overflow-hidden">
        <span className="block truncate text-sm font-bold">{headerAccount?.displayName ?? ""}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="hidden truncate text-[0.7rem] text-[var(--muted-foreground)] sm:inline">
            @{headerAccount?.handle ?? ""}
          </span>
          {relationship && (
            <span className="flex min-w-0 items-center gap-1 truncate text-[0.7rem] text-[var(--muted-foreground)]">
              <span className="hidden sm:inline">·</span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  availability?.online
                    ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]"
                    : availability?.minutesUntilOnline !== null &&
                        (availability?.minutesUntilOnline ?? Infinity) < 120
                      ? "bg-yellow-500 shadow-[0_0_4px_rgba(234,179,8,0.6)]"
                      : "bg-gray-400",
                )}
                aria-hidden="true"
              />
              <span className="truncate">
                {availability?.online
                  ? localizeUi("ui.slurp.messages.availableNow", { defaultValue: "Available now" })
                  : availability?.minutesUntilOnline !== null
                    ? localizeUi(
                        availability.estimated ? "ui.slurp.messages.probablyBackIn" : "ui.slurp.messages.backIn",
                        {
                          value1:
                            availability.minutesUntilOnline < 60
                              ? `${Math.round(availability?.minutesUntilOnline ?? 0)}min`
                              : `${Math.round((availability?.minutesUntilOnline ?? 0) / 60)}hr`,
                        },
                      )
                    : availability?.estimated
                      ? localizeUi("ui.slurp.messages.probablyAway")
                      : localizeUi("ui.slurp.messages.away", { defaultValue: "Away" })}
              </span>
            </span>
          )}
        </span>
      </span>
    </button>
    {thread?.rapport && (
      <button
        ref={tierTriggerRef}
        type="button"
        aria-expanded={tierOpen}
        aria-haspopup="dialog"
        onClick={() => setTierOpen((open) => !open)}
        className={cn(
          "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-1 text-[0.72rem] font-bold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:pe-3",
          tierOpen && "bg-[var(--noodle-accent)]/10",
        )}
        aria-label={localizeUi("ui.slurp.messages.relationshipStatus", {
          defaultValue: "Relationship: {{tier}}",
          tier: localizeUi(`ui.slurp.rapport.tier.${thread.rapport.tier}`),
        })}
      >
        <SlurpRapportBadge rapport={thread.rapport} ownsCreator={ownsCreator} />
        <span className="hidden sm:inline">{localizeUi(`ui.slurp.rapport.tier.${thread.rapport.tier}`)}</span>
      </button>
    )}
    {tierOpen && thread?.rapport && (
      <NoodleAnchoredPopover anchorRef={tierTriggerRef}>
        <div
          ref={tierPopoverRef}
          role="dialog"
          aria-label={localizeUi("ui.slurp.messages.relationshipLevel", { defaultValue: "Relationship level" })}
          className="rounded-2xl bg-[var(--slurp-canvas,var(--background))] p-4 text-[var(--foreground)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]"
        >
          <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.relationshipLevel", { defaultValue: "Relationship level" })}
          </p>
          <p className="mt-0.5 text-base font-black">
            {localizeUi(`ui.slurp.rapport.tier.${thread.rapport.tier}`)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {localizeUi(
              ownsCreator
                ? `ui.slurp.rapport.creatorHint.${thread.rapport.tier}`
                : `ui.slurp.rapport.viewerHint.${thread.rapport.tier}`,
            )}
          </p>
          <SlurpTierLadder tier={thread.rapport.tier} className="mt-4" />
        </div>
      </NoodleAnchoredPopover>
    )}
    {/* Four icons of the same size and weight, because none of them outranks the others. The
        details button was the odd one out as a word, and read as the only real control. */}
    <div className="ml-auto hidden shrink-0 items-center sm:flex">
      {relationship && (
        <HeaderIconButton
          icon={Info}
          label={localizeUi("ui.slurp.messages.relationshipToggle", { defaultValue: "Details" })}
          onClick={() => setDrawerMode("details")}
        />
      )}
      {threadId && (
        <HeaderIconButton
          icon={Brain}
          label={localizeUi("ui.slurp.messages.memories", { defaultValue: "Memories" })}
          onClick={() => setDrawerMode("memories")}
        />
      )}
      {threadId && (
        <HeaderIconButton
          icon={BriefcaseBusiness}
          label={localizeUi("ui.slurp.messages.commissionsTitle", { defaultValue: "Commissions" })}
          badge={commissions.length}
          onClick={() => setDrawerMode("commissions")}
        />
      )}
      {threadId && (
        <button
          ref={searchTriggerRef}
          type="button"
          aria-expanded={messageSearchOpen}
          onClick={() => setMessageSearchOpen((open) => !open)}
          className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          aria-label={localizeUi("ui.slurp.messages.searchConversation", { defaultValue: "Search conversation" })}
          title={localizeUi("ui.slurp.messages.searchConversation", { defaultValue: "Search conversation" })}
        >
          <Search size={15} aria-hidden="true" />
        </button>
      )}
    </div>
    {/* Four header icons do not fit beside a name on a phone, so they fold into one menu there. */}
    {(relationship || threadId) && (
      <button
        ref={headerMenuTriggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={headerMenuOpen}
        onClick={() => setHeaderMenuOpen((open) => !open)}
        aria-label={localizeUi("ui.slurp.messages.moreActions", { defaultValue: "More actions" })}
        title={localizeUi("ui.slurp.messages.moreActions", { defaultValue: "More actions" })}
        className={cn(
          "relative ml-auto flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 sm:hidden",
          headerMenuOpen && "bg-[var(--slurp-surface)] text-[var(--foreground)]",
        )}
      >
        <MoreVertical size={18} aria-hidden="true" />
        {commissions.length > 0 && (
          <span
            className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--noodle-accent)]"
            aria-hidden="true"
          />
        )}
      </button>
    )}
    {headerMenuOpen && (
      <NoodleAnchoredPopover anchorRef={headerMenuTriggerRef}>
        <div
          ref={headerMenuRef}
          role="menu"
          className="ms-auto w-56 rounded-xl bg-[var(--slurp-canvas,var(--background))] p-1 text-[var(--foreground)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--noodle-divider)]"
        >
          {[
            relationship && {
              key: "details",
              icon: Info,
              label: localizeUi("ui.slurp.messages.relationshipToggle", { defaultValue: "Details" }),
              run: () => setDrawerMode("details"),
            },
            threadId && {
              key: "memories",
              icon: Brain,
              label: localizeUi("ui.slurp.messages.memories", { defaultValue: "Memories" }),
              run: () => setDrawerMode("memories"),
            },
            threadId && {
              key: "commissions",
              icon: BriefcaseBusiness,
              label: localizeUi("ui.slurp.messages.commissionsTitle", { defaultValue: "Commissions" }),
              badge: commissions.length,
              run: () => setDrawerMode("commissions"),
            },
            threadId && {
              key: "search",
              icon: Search,
              label: localizeUi("ui.slurp.messages.searchConversation", { defaultValue: "Search conversation" }),
              run: () => setMessageSearchOpen(true),
            },
          ]
            .filter((item): item is Exclude<typeof item, "" | null | undefined | false> => Boolean(item))
            .map(({ key, icon: Icon, label, run, ...item }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setHeaderMenuOpen(false);
                  run();
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors hover:bg-[var(--slurp-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)]"
              >
                <Icon size={16} className="shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {"badge" in item && (item.badge ?? 0) > 0 && (
                  <span className="min-w-5 rounded-full bg-[var(--noodle-accent)] px-1.5 text-center text-[0.65rem] font-black leading-5 text-zinc-950">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
        </div>
      </NoodleAnchoredPopover>
    )}
  </div>

  {messageSearchOpen && (
    <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-[var(--noodle-divider)] bg-[var(--slurp-glass)] px-3 backdrop-blur-xl">
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
          if (event.key !== "Escape") return;
          setMessageSearchOpen(false);
          searchTriggerRef.current?.focus();
        }}
        placeholder={localizeUi("ui.slurp.messages.searchConversationPlaceholder", {
          defaultValue: "Search this conversation…",
        })}
        className="h-10 min-w-0 flex-1 rounded-xl bg-[var(--slurp-surface)] px-3 text-base outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)] sm:text-sm"
      />
      <span role="status" className="shrink-0 text-[0.68rem] tabular-nums text-[var(--muted-foreground)]">
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
      {["previous", "next"].map((direction) => (
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-35 motion-reduce:transition-none motion-reduce:active:scale-100"
          aria-label={localizeUi(`ui.slurp.messages.search.${direction}`, {
            defaultValue: direction === "previous" ? "Previous match" : "Next match",
          })}
        >
          {direction === "previous" ? <ChevronDown size={16} className="rotate-180" /> : <ChevronDown size={16} />}
        </button>
      ))}
      <button
        type="button"
        onClick={() => {
          setMessageSearchOpen(false);
          searchTriggerRef.current?.focus();
        }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
        aria-label={localizeUi("ui.slurp.messages.closeSearch", { defaultValue: "Close search" })}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )}

  {activeCommission && (
    <div className="shrink-0 border-b border-[var(--noodle-divider)] bg-[var(--slurp-surface)]/55 px-3 py-1.5">
      <button
        type="button"
        aria-expanded={commissionRibbonOpen}
        onClick={() => setCommissionRibbonOpen((open) => !open)}
        className="mx-auto flex min-h-11 w-full max-w-2xl items-center gap-2.5 rounded-xl px-2 text-start transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/[0.05] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <BriefcaseBusiness size={17} className="shrink-0 text-[var(--noodle-accent)]" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold capitalize">
            {localizeUi("ui.slurp.messages.commissionRibbon", {
              defaultValue: "Commission · {{state}}",
              state: activeCommission.state,
            })}
          </span>
          <span className="block truncate text-[0.68rem] text-[var(--muted-foreground)]">
            {activeCommission.state === "delivered"
              ? localizeUi("ui.slurp.messages.commissionDeliveredHint", {
                  defaultValue: "The finished commission is in this chat",
                })
              : activeCommission.brief}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={cn(
            "shrink-0 transition-transform motion-reduce:transition-none",
            commissionRibbonOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {commissionRibbonOpen && (
        <div className="mx-auto grid w-full max-w-2xl gap-2 px-2 pb-2 pt-1 text-xs sm:grid-cols-[1fr_auto]">
          <p className="min-w-0 break-words leading-5 text-[var(--muted-foreground)]">{activeCommission.brief}</p>
          <p className="font-bold tabular-nums">
            <SlurpCoinAmount amount={activeCommission.price} />
          </p>
          <ol
            className="flex items-center gap-1.5 sm:col-span-2"
            aria-label={localizeUi("ui.slurp.messages.commissionProgress", { defaultValue: "Commission progress" })}
          >
            {["brief", "quoted", "accepted", "delivered"].map((state, index) => {
              const current = ["brief", "quoted", "accepted", "delivered"].indexOf(activeCommission.state);
              return (
                <li
                  key={state}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    index <= current ? "bg-[var(--noodle-accent)]" : "bg-[var(--accent)]",
                  )}
                >
                  <span className="sr-only">{state}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  )}

  {thread?.state === "request" && (
    <div className="mx-3 mt-3 shrink-0 rounded-2xl bg-amber-500/[0.08] px-4 py-3 ring-1 ring-inset ring-amber-500/25">
      <p className="text-xs leading-5 text-[var(--muted-foreground)]">
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
          <button
            type="button"
            disabled={resolveRequest.isPending}
            onClick={() => resolveRequest.mutate({ threadId: thread.id, personaId, decision: "accept" })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <Check size={14} /> {localizeUi("ui.slurp.messages.accept", { defaultValue: "Accept" })}
          </button>
          <button
            type="button"
            disabled={resolveRequest.isPending}
            onClick={() => resolveRequest.mutate({ threadId: thread.id, personaId, decision: "decline" })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,transform] hover:bg-[var(--slurp-surface)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <X size={14} /> {localizeUi("ui.slurp.messages.decline", { defaultValue: "Decline" })}
          </button>
        </div>
      )}
    </div>
  )}
    </>
  );
}
