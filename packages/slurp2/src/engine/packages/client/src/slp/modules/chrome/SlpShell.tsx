// ──────────────────────────────────────────────
// Noodle: shared shell (left nav, mobile drawer, right rail slot, bottom nav)
// Used by both the public NoodleHome timeline and the SlurpHome hub
// so every Noodle surface keeps the same primary navigation.
//
// Split out of components/slurp/SlurpShell.tsx in Slice 10. It renders a wallet balance through
// modules/coin, so it is a reusable module rather than base/ chrome.
// ──────────────────────────────────────────────
import {
  AtSign,
  ChartNoAxesColumn,
  ChevronDown,
  Home,
  MessageCircle,
  Search,
  Settings2,
  User,
  Wallet,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { useDialogFocusScope } from "../../../hooks/use-dialog-focus-scope";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpCoinAmount } from "../coin/SlpCoin";
import {
  Avatar,
  BOTTOM_SAFE_INSET,
  getSlpAccentStyle,
  SLP_BLUE,
  labelClass,
  NOODLE_ICON_SCOPE_CLASS,
  SLP_LOGO_SRC,
  SlpAccentContext,
  SlpLogo,
  NOODLER_LOGO_SRC,
  SLURP_NAME,
  SLURP_ROW_ACTIVE_CLASS,
  SLURP_ROW_CLASS,
} from "../../base/chrome/SlpChrome";
import { PersonaIdentityCard, PersonaList } from "./SlpPersonaSwitcher";
import { SlpPulseCard, SlpPulsePanel } from "./SlpPulse";
import type { SlpShellProps } from "./slp-shell.types";

export function SlpShell({
  activeView,
  appMode,
  homeActive: homeActiveOverride,
  noodlerUnseenCount = 0,
  personaAccount,
  creatorIdentity,
  sortedPersonaAccounts,
  visiblePersonaAccounts,
  linkedNoodleAccountIds,
  personaConnectionCounts,
  personaWallets,
  onLoadMorePersonaAccounts,
  onSwitchPersona,
  accountSwitcherOpen,
  onAccountSwitcherOpenChange,
  accountSwitcherRef,
  mobileDrawerOpen,
  onMobileDrawerOpenChange,
  mobileDrawerTriggerRef,
  onOpenHome,
  onOpenMobileHome,
  onOpenNoodler,
  onOpenSearch,
  onOpenProfile,
  onOpenSettings,
  onOpenMessages,
  onOpenWallet,
  onOpenStudio,
  onGeneratePosts,
  onRunAudience,
  onCompose,
  notificationCount = 0,
  hasOperatedCreator = false,
  walletBalanceLabel,
  walletBalance,
  personaBannerUrl,
  onBecomeCreator,
  desktopSidebar,
  rightRail,
  contextualRail,
  overlays,
  accent = SLP_BLUE,
  children,
}: SlpShellProps) {
  const { t: localizeUi } = useUiTranslation();
  const mobileDrawerRef = useRef<HTMLElement | null>(null);
  const mobileDrawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const pulsePanelRef = useRef<HTMLElement | null>(null);
  const pulseCloseRef = useRef<HTMLButtonElement | null>(null);
  const pulseTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [pulseOpen, setPulseOpen] = useState(false);
  const prefersReducedMotion = Boolean(useReducedMotion());
  const hasMorePersonaAccounts = visiblePersonaAccounts.length < sortedPersonaAccounts.length;
  const resolvedAppMode = appMode ?? (activeView === "noodler" ? "noodler" : "noodle");
  const slpCreatorActive = resolvedAppMode === "noodler";
  const slurpActive = resolvedAppMode === "slurp";
  const resolvedContextualRail = contextualRail ?? (rightRail ? "populated" : "spanning");
  const reserveContextualRail = slurpActive && resolvedContextualRail !== "spanning";
  const switcherIdentity = creatorIdentity ?? personaAccount;
  const homeLabel = slpCreatorActive
    ? localizeUi("ui.noodle.noodleshell.hub")
    : slurpActive
      ? localizeUi("ui.slurp.navigation.home", { defaultValue: "Slurp" })
      : localizeUi("ui.noodle.noodleshell.home");
  const desktopHomeLabel = slurpActive ? localizeUi("ui.slurp.navigation.hub", { defaultValue: "Hub" }) : homeLabel;
  const homeActive = homeActiveOverride ?? (activeView === "home" || activeView === "noodler");
  const onOpenHomeDestination = slpCreatorActive ? onOpenNoodler : onOpenHome;
  const onOpenMobileHomeDestination = slpCreatorActive ? onOpenNoodler : onOpenMobileHome;
  const onMobileHomeTap = () => {
    onOpenMobileHomeDestination();
  };
  useDialogFocusScope(mobileDrawerOpen, mobileDrawerRef, mobileDrawerCloseRef);
  useDialogFocusScope(pulseOpen, pulsePanelRef, pulseCloseRef, pulseTriggerRef);
  useEffect(() => {
    if (!pulseOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPulseOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [pulseOpen]);

  const openPulse = () => {
    pulseTriggerRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    setPulseOpen(true);
  };

  return (
    <SlpAccentContext.Provider value={accent}>
      <div
        className={cn(
          // `overflow-x-clip`, not `overflow-x-hidden`: the drawer starts at x:100%, so while it
          // slides in it sits past the right edge and widens the page, which is the flicker and
          // the push. Clipping stops that. `clip` is used because `hidden` would turn this into a
          // scroll container and break every sticky header inside it.
          "mari-chrome-token-scope relative flex h-full min-h-0 flex-col overflow-x-clip bg-[var(--background)] text-[var(--foreground)] antialiased",
          slurpActive && "bg-[var(--slurp-canvas)] @min-[1024px]:bg-[var(--slurp-outer)]",
          NOODLE_ICON_SCOPE_CLASS,
        )}
        data-component="NoodleView"
        style={getSlpAccentStyle(accent, { "--slurp-bottom-safe-inset": BOTTOM_SAFE_INSET } as CSSProperties)}
      >
        {overlays}
        <AnimatePresence>
          {mobileDrawerOpen && (
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onMobileDrawerOpenChange(false)}
              className="absolute inset-0 z-[79] bg-black/40 @min-[1024px]:hidden"
              aria-hidden="true"
            />
          )}
          {mobileDrawerOpen && (
            <motion.div
              key="drawer-panel"
              initial={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
              animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: "100%" }}
              transition={prefersReducedMotion ? { duration: 0.1 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 end-0 z-[80] h-full w-[75%] border-s border-[var(--noodle-divider)] bg-[var(--background)] shadow-2xl shadow-black/40 @min-[1024px]:hidden"
              data-component="NoodleView.MobileDrawer"
              data-motion="slide-x"
            >
              <aside
                ref={mobileDrawerRef}
                role="dialog"
                aria-modal="true"
                aria-label={
                  slurpActive
                    ? localizeUi("ui.slurp.navigation.menu")
                    : localizeUi("ui.noodle.noodleshell.noodleAccountMenu")
                }
                tabIndex={-1}
                className="mari-chrome-token-scope flex h-full w-full flex-col overflow-y-auto bg-[var(--background)] px-5 pt-5 text-[var(--foreground)]"
                style={{ paddingBottom: `max(1rem, ${BOTTOM_SAFE_INSET})` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <SlpLogo src={NOODLER_LOGO_SRC} className="h-9 w-14" />
                    <span className="truncate text-lg font-black">{SLURP_NAME}</span>
                  </div>
                  <button
                    ref={mobileDrawerCloseRef}
                    type="button"
                    onClick={() => onMobileDrawerOpenChange(false)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                    title={localizeUi("capabilities.actions.close")}
                    aria-label={
                      slurpActive
                        ? localizeUi("ui.slurp.navigation.closeMenu")
                        : localizeUi("ui.noodle.noodleshell.closeNoodleAccountMenu")
                    }
                  >
                    <X size={20} />
                  </button>
                </div>

                <nav
                  className="mt-3 space-y-1"
                  aria-label={
                    slurpActive
                      ? localizeUi("ui.slurp.navigation.menuNavigation")
                      : localizeUi("ui.noodle.noodleshell.noodleAccountNavigation")
                  }
                >
                  {onOpenStudio && hasOperatedCreator && (
                    <button
                      type="button"
                      onClick={onOpenStudio}
                      aria-current={activeView === "studio" ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-12 w-full items-center gap-4 overflow-hidden rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]",
                        activeView === "studio" && SLURP_ROW_ACTIVE_CLASS,
                      )}
                    >
                      <ChartNoAxesColumn size={23} />
                      {localizeUi("ui.slurp.navigation.studio", { defaultValue: "Studio" })}
                    </button>
                  )}
                  {onOpenWallet && (
                    <button
                      type="button"
                      onClick={onOpenWallet}
                      aria-current={activeView === "wallet" ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-12 w-full items-center gap-4 overflow-hidden rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]",
                        activeView === "wallet" && SLURP_ROW_ACTIVE_CLASS,
                      )}
                    >
                      <Wallet size={23} />
                      {localizeUi("ui.slurp.navigation.wallet", { defaultValue: "Wallet" })}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    aria-current={activeView === "settings" ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-12 w-full items-center gap-4 overflow-hidden rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]",
                      activeView === "settings" && SLURP_ROW_ACTIVE_CLASS,
                    )}
                  >
                    <Settings2 size={23} />
                    {localizeUi("navigation.topbar.settings")}
                  </button>
                </nav>

                <div className="mt-auto pt-4">
                  {slurpActive && <SlpPulseCard open={pulseOpen} onOpen={openPulse} />}
                  <PersonaIdentityCard
                    account={creatorIdentity ?? personaAccount}
                    personaBadge={creatorIdentity ? personaAccount : null}
                    bannerUrl={personaBannerUrl}
                    counts={personaAccount ? personaConnectionCounts?.[personaAccount.entityId] : undefined}
                    balanceLabel={walletBalanceLabel}
                    walletBalance={walletBalance}
                    isCreator={Boolean(personaAccount && linkedNoodleAccountIds?.has(personaAccount.id))}
                    onOpenProfile={onOpenProfile}
                    onBecomeCreator={onBecomeCreator}
                  />
                  {/*
                    The drawer used to render the whole persona list open, so the identity card
                    was pushed off-screen on any install with more than a couple of personas.
                    `<details>` gives the same disclosure as the desktop rail with no state to
                    hold and no outside-click handler to get wrong.
                  */}
                  <details className="group mt-3">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-2 text-left [&::-webkit-details-marker]:hidden">
                      <span className={labelClass}>{localizeUi("ui.noodle.noodleshell.switchAccount")}</span>
                      <ChevronDown
                        size={18}
                        className="shrink-0 !text-[var(--noodle-accent)] transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <PersonaList
                      accounts={visiblePersonaAccounts.filter((account) => account.id !== personaAccount?.id)}
                      activeId={personaAccount?.id}
                      counts={personaConnectionCounts}
                      linkedIds={linkedNoodleAccountIds}
                      wallets={personaWallets}
                      onSwitch={(account) => onSwitchPersona(account, true)}
                    />
                    {hasMorePersonaAccounts && (
                      <button
                        type="button"
                        onClick={onLoadMorePersonaAccounts}
                        className="mt-1 h-9 w-full rounded-lg text-xs font-semibold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10"
                      >
                        {localizeUi("ui.noodle.noodlehome.loadMore", {
                          visible: visiblePersonaAccounts.length,
                          total: sortedPersonaAccounts.length,
                        })}
                      </button>
                    )}
                  </details>
                </div>
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex min-h-0 flex-1 justify-center overflow-hidden">
          <div
            className={cn(
              "flex min-h-0 w-full justify-center",
              slurpActive
                ? "max-w-[1680px] @min-[1024px]:bg-[var(--slurp-canvas)] @min-[1024px]:[background-image:var(--slurp-canvas-art)]"
                : "max-w-[1360px]",
            )}
            data-slurp-desktop-frame={slurpActive ? resolvedContextualRail : undefined}
          >
            <aside className="hidden w-[14rem] shrink-0 border-r border-[var(--noodle-divider)] bg-[radial-gradient(circle_at_12%_6%,color-mix(in_srgb,var(--noodle-accent)_13%,transparent),transparent_16rem),linear-gradient(180deg,color-mix(in_srgb,var(--slurp-surface-raised,var(--background))_96%,transparent),var(--background)_42%)] @min-[1024px]:flex @min-[1024px]:flex-col">
              <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
                <div className="mb-5 flex h-12 items-center gap-3 px-2">
                  <SlpLogo
                    src={slpCreatorActive || slurpActive ? NOODLER_LOGO_SRC : SLP_LOGO_SRC}
                    className="h-10 w-16"
                  />
                  {slurpActive && <span className="text-lg font-black">{SLURP_NAME}</span>}
                </div>
                {desktopSidebar ?? (
                  <nav
                    className="space-y-1"
                    aria-label={slurpActive ? localizeUi("ui.slurp.navigation.menuNavigation") : undefined}
                  >
                    <button
                      type="button"
                      onClick={onOpenHomeDestination}
                      aria-current={homeActive ? "page" : undefined}
                      className={cn(SLURP_ROW_CLASS, homeActive && SLURP_ROW_ACTIVE_CLASS)}
                    >
                      <Home size={22} className="!text-[var(--noodle-accent)]" />
                      {desktopHomeLabel}
                    </button>
                    {onOpenSearch && (
                      <button
                        type="button"
                        onClick={onOpenSearch}
                        aria-current={activeView === "search" ? "page" : undefined}
                        className={cn(SLURP_ROW_CLASS, activeView === "search" && SLURP_ROW_ACTIVE_CLASS)}
                      >
                        <Search size={22} className="!text-[var(--noodle-accent)]" />
                        {slpCreatorActive
                          ? localizeUi("ui.noodle.noodleshell.discover")
                          : slurpActive
                            ? localizeUi("ui.slurp.navigation.search", { defaultValue: "Discover" })
                            : localizeUi("ui.noodle.noodlehome.searchNoodle")}
                      </button>
                    )}
                    {onOpenMessages && (
                      <button
                        type="button"
                        onClick={onOpenMessages}
                        aria-current={activeView === "messages" ? "page" : undefined}
                        className={cn(SLURP_ROW_CLASS, activeView === "messages" && SLURP_ROW_ACTIVE_CLASS)}
                      >
                        <MessageCircle size={22} className="!text-[var(--noodle-accent)]" />
                        <span className="min-w-0 flex-1">
                          {localizeUi("ui.slurp.navigation.messages", { defaultValue: "Inbox" })}
                        </span>
                        {notificationCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--noodle-accent)] px-1.5 text-[0.65rem] font-black tabular-nums text-zinc-950 [&_svg]:!text-zinc-950">
                            {notificationCount}
                          </span>
                        )}
                      </button>
                    )}
                    {onOpenProfile && (
                      <button
                        type="button"
                        onClick={onOpenProfile}
                        aria-current={activeView === "profile" ? "page" : undefined}
                        className={cn(SLURP_ROW_CLASS, activeView === "profile" && SLURP_ROW_ACTIVE_CLASS)}
                      >
                        <User size={22} className="!text-[var(--noodle-accent)]" />
                        {slurpActive
                          ? localizeUi("ui.slurp.navigation.profile")
                          : localizeUi("ui.noodle.noodlehome.profile")}
                      </button>
                    )}
                    {onOpenWallet && (
                      <button
                        type="button"
                        onClick={onOpenWallet}
                        aria-current={activeView === "wallet" ? "page" : undefined}
                        className={cn(SLURP_ROW_CLASS, activeView === "wallet" && SLURP_ROW_ACTIVE_CLASS)}
                      >
                        <Wallet size={22} className="!text-[var(--noodle-accent)]" />
                        <span className="min-w-0 flex-1">
                          {localizeUi("ui.slurp.navigation.wallet", { defaultValue: "Wallet" })}
                        </span>
                        {walletBalanceLabel && (
                          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold tabular-nums text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)]">
                            <SlurpCoinAmount amount={walletBalanceLabel} watchAmount={walletBalance} size={16} />
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      aria-current={activeView === "settings" ? "page" : undefined}
                      className={cn(SLURP_ROW_CLASS, activeView === "settings" && SLURP_ROW_ACTIVE_CLASS)}
                    >
                      <Settings2 size={22} className="!text-[var(--noodle-accent)]" />
                      {localizeUi("navigation.topbar.settings")}
                    </button>
                  </nav>
                )}
                <div ref={accountSwitcherRef} className="relative mt-auto">
                  {accountSwitcherOpen && (
                    // Sized to its own content rather than to the rail. It used to be pinned
                    // `left-0 right-0`, so every persona row was squeezed into the sidebar's
                    // width; it overflows the rail to the end side now, which is what the extra
                    // z-index is for.
                    <div className="absolute bottom-[calc(100%+0.5rem)] start-0 z-30 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--noodle-divider)] bg-[var(--background)] p-2 shadow-[var(--slurp-shadow-modal)]">
                      <PersonaIdentityCard
                        account={creatorIdentity ?? personaAccount}
                        personaBadge={creatorIdentity ? personaAccount : null}
                        bannerUrl={personaBannerUrl}
                        counts={personaAccount ? personaConnectionCounts?.[personaAccount.entityId] : undefined}
                        balanceLabel={walletBalanceLabel}
                        isCreator={Boolean(personaAccount && linkedNoodleAccountIds?.has(personaAccount.id))}
                        onOpenProfile={onOpenProfile}
                        onBecomeCreator={onBecomeCreator}
                      />
                      <p className={cn(labelClass, "px-2 pb-1 pt-3")}>
                        {localizeUi("ui.noodle.noodleshell.switchAccount")}
                      </p>
                      <PersonaList
                        accounts={visiblePersonaAccounts.filter((account) => account.id !== personaAccount?.id)}
                        activeId={personaAccount?.id}
                        counts={personaConnectionCounts}
                        linkedIds={linkedNoodleAccountIds}
                        wallets={personaWallets}
                        onSwitch={(account) => onSwitchPersona(account, false)}
                      />
                      {hasMorePersonaAccounts && (
                        <button
                          type="button"
                          onClick={onLoadMorePersonaAccounts}
                          className="mt-1 h-9 w-full rounded-lg text-xs font-semibold text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10"
                        >
                          {localizeUi("ui.noodle.noodlehome.loadMore", {
                            visible: visiblePersonaAccounts.length,
                            total: sortedPersonaAccounts.length,
                          })}
                        </button>
                      )}
                    </div>
                  )}
                  {slurpActive && (
                    <div className="mb-3">
                      <SlpPulseCard open={pulseOpen} onOpen={openPulse} />
                    </div>
                  )}
                  <button
                    data-component="NoodleView.AccountSwitcher"
                    type="button"
                    onClick={() => onAccountSwitcherOpenChange(!accountSwitcherOpen)}
                    aria-expanded={accountSwitcherOpen}
                    className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-[var(--noodle-divider)] bg-[var(--slurp-surface-raised,var(--accent))] px-3 text-left shadow-sm transition-[background-color,border-color] hover:border-[var(--noodle-accent)]/45 hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                    title={localizeUi("ui.noodle.noodleshell.switchAccount")}
                  >
                    {switcherIdentity ? (
                      <span className="relative shrink-0">
                        <Avatar account={switcherIdentity} />
                        {creatorIdentity && personaAccount && (
                          <span
                            className="absolute -bottom-1 -end-1 rounded-full ring-2 ring-[var(--slurp-surface-raised,var(--accent))]"
                            title={personaAccount.displayName}
                          >
                            <Avatar account={personaAccount} size="xs" />
                          </span>
                        )}
                      </span>
                    ) : (
                      <AtSign size={28} className="!text-[var(--noodle-accent)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {switcherIdentity?.displayName ??
                          localizeUi(slurpActive ? "ui.slurp.account.title" : "ui.noodle.noodleshell.noodleAccount")}
                      </p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {switcherIdentity
                          ? localizeUi("ui.noodle.noodlehome.value1_0a5edda", {
                              value1: switcherIdentity.handle,
                            })
                          : localizeUi("ui.noodle.noodleshell.pickAPersona")}
                      </p>
                      {creatorIdentity && personaAccount && (
                        <p className="truncate text-[0.68rem] text-[var(--muted-foreground)]">
                          {localizeUi("ui.slurp.account.asPersona", {
                            defaultValue: "as {{persona}}",
                            persona: personaAccount.displayName,
                          })}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      size={18}
                      className={cn(
                        "shrink-0 !text-[var(--noodle-accent)] transition-transform",
                        accountSwitcherOpen && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </aside>

            <main
              className={cn(
                // `min-w-0`: a flex item defaults to `min-width: auto`, so one wide post or story
                // grew this column and shoved both sidebars out of the viewport.
                "flex min-h-0 w-full min-w-0 flex-1 flex-col @min-[1024px]:pb-0",
                slurpActive
                  ? cn(
                      "pb-[calc(48px+var(--slurp-bottom-safe-inset))] @min-[1024px]:pb-0",
                      reserveContextualRail && "@min-[1280px]:border-r @min-[1280px]:border-[var(--noodle-divider)]",
                    )
                  : "pb-[calc(48px+var(--slurp-bottom-safe-inset))] @min-[1024px]:max-w-[680px] @min-[1024px]:border-r @min-[1024px]:border-[var(--noodle-divider)]",
              )}
            >
              {/* A page swap with no motion reads as a glitch. One short fade, keyed by the
                  destination, says "this is a different room" without slowing anyone down.
                  No AnimatePresence: an exiting child that never finishes its exit stays mounted at
                  opacity 0 and blanks the whole column, so the key alone drives the remount. */}
              <motion.div
                key={activeView}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: prefersReducedMotion ? 0.12 : 0.18, ease: "easeOut" }}
                className="flex min-h-0 w-full flex-1 flex-col"
              >
                {children}
              </motion.div>
            </main>
            {slurpActive && resolvedContextualRail === "blank" ? (
              <aside
                className="relative hidden w-[20rem] shrink-0 overflow-hidden bg-[linear-gradient(180deg,color-mix(in_srgb,var(--slurp-surface,var(--background))_42%,transparent),transparent_30rem)] @min-[1280px]:block"
                aria-hidden="true"
                data-slurp-contextual-rail="blank"
              ></aside>
            ) : resolvedContextualRail === "populated" ? (
              rightRail
            ) : null}
          </div>
        </div>

        <SlpPulsePanel
          open={pulseOpen}
          panelRef={pulsePanelRef}
          closeRef={pulseCloseRef}
          onClose={() => setPulseOpen(false)}
          onCompose={onCompose}
          onOpenMessages={onOpenMessages}
          onOpenSettings={onOpenSettings}
          onGeneratePosts={onGeneratePosts}
          onRunAudience={onRunAudience}
          accounts={sortedPersonaAccounts}
        />

        <nav
          className="absolute inset-x-0 bottom-0 z-50 border-t border-[var(--noodle-divider)] bg-[var(--background)]/92 shadow-[0_-12px_30px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl @min-[1024px]:hidden"
          style={{ paddingBottom: BOTTOM_SAFE_INSET }}
          aria-label={
            slurpActive
              ? localizeUi("ui.slurp.navigation.mobileNav")
              : localizeUi("ui.noodle.noodleshell.noodleMobileNavigation")
          }
          data-component="NoodleView.MobileBottomNav"
        >
          <div className="relative grid h-12 grid-flow-col auto-cols-fr">
            <button
              type="button"
              onClick={onMobileHomeTap}
              aria-label={
                slurpActive ? homeLabel : localizeUi("ui.noodle.noodleshell.noodleValue1", { value1: homeLabel })
              }
              aria-current={homeActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] active:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100",
                homeActive ? "bg-[var(--noodle-accent)]/[0.07]" : undefined,
              )}
            >
              <Home size={20} strokeWidth={homeActive ? 2.6 : 2} className="!text-[var(--noodle-accent)]" />
              {/* The drawer used to carry this badge; the bottom bar is the only Home entry now. */}
              {noodlerUnseenCount > 0 && (
                <span className="absolute end-[22%] top-1 min-w-4 rounded-full bg-[var(--noodle-accent)] px-1 text-center text-[0.6rem] font-black leading-4 text-zinc-950 [&_svg]:!text-zinc-950">
                  {noodlerUnseenCount > 99 ? "99+" : noodlerUnseenCount}
                </span>
              )}
            </button>
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                aria-label={
                  slurpActive ? localizeUi("ui.slurp.navigation.profile") : localizeUi("ui.noodle.noodlehome.profile")
                }
                aria-current={activeView === "profile" ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] active:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100",
                  activeView === "profile" && "bg-[var(--noodle-accent)]/[0.07]",
                )}
              >
                <User
                  size={20}
                  strokeWidth={activeView === "profile" ? 2.6 : 2}
                  className={"!text-[var(--noodle-accent)]"}
                />
              </button>
            )}
            {onOpenMessages && (
              <button
                type="button"
                onClick={onOpenMessages}
                aria-label={localizeUi("ui.slurp.navigation.messages", { defaultValue: "Inbox" })}
                aria-current={activeView === "messages" ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] active:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100",
                  activeView === "messages" && "bg-[var(--noodle-accent)]/[0.07]",
                )}
              >
                <MessageCircle
                  size={20}
                  strokeWidth={activeView === "messages" ? 2.6 : 2}
                  className={"!text-[var(--noodle-accent)]"}
                />
                {notificationCount > 0 && (
                  <span className="absolute end-[22%] top-1 min-w-4 rounded-full bg-[var(--noodle-accent)] px-1 text-center text-[0.6rem] font-black leading-4 text-zinc-950 [&_svg]:!text-zinc-950">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                )}
              </button>
            )}
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                aria-label={
                  slpCreatorActive
                    ? localizeUi("ui.noodle.noodleshell.discoverCreators")
                    : slurpActive
                      ? localizeUi("ui.slurp.navigation.search", { defaultValue: "Discover" })
                      : localizeUi("ui.noodle.noodlehome.searchNoodle")
                }
                aria-current={activeView === "search" ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] active:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100",
                  activeView === "search" && "bg-[var(--noodle-accent)]/[0.07]",
                )}
              >
                <Search
                  size={20}
                  strokeWidth={activeView === "search" ? 2.6 : 2}
                  className={"!text-[var(--noodle-accent)]"}
                />
              </button>
            )}
            <button
              type="button"
              ref={mobileDrawerTriggerRef}
              data-component="NoodleView.MobileAccountSwitcher"
              onClick={() => onMobileDrawerOpenChange(true)}
              aria-expanded={mobileDrawerOpen}
              aria-label={
                slurpActive
                  ? localizeUi("ui.slurp.navigation.more", { defaultValue: "More" })
                  : localizeUi("ui.noodle.noodleshell.noodleAccountMenu")
              }
              className={cn(
                "relative flex flex-col items-center justify-center text-[var(--noodle-accent)] transition-[background-color,transform] hover:bg-[var(--noodle-accent)]/10 active:scale-[0.96] active:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100",
                mobileDrawerOpen && "bg-[var(--noodle-accent)]/[0.07]",
              )}
            >
              {personaAccount ? (
                <Avatar account={personaAccount} size="sm" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 ring-1 ring-[var(--noodle-accent)]/25">
                  <AtSign size={18} className="!text-[var(--noodle-accent)]" />
                </span>
              )}
            </button>
          </div>
        </nav>
      </div>
    </SlpAccentContext.Provider>
  );
}
