// ──────────────────────────────────────────────
// Noodle: shared shell (left nav, mobile drawer, right rail slot, bottom nav)
// Used by both the public NoodleHome timeline and the SlurpHome hub
// so every Noodle surface keeps the same primary navigation.
//
// Split out of components/slurp/SlurpShell.tsx in Slice 10. It renders a wallet balance through
// modules/coin, so it is a reusable module rather than base/ chrome.
// ──────────────────────────────────────────────
import { AtSign, ChartNoAxesColumn, ChevronDown, Settings2, Wallet } from "lucide-react";
import {
  SlpDiscoverGlyph,
  SlpHubGlyph,
  SlpInboxGlyph,
  SlpMoreGlyph,
  SlpProfileGlyph,
  SlpStirGlyph,
} from "../../base/chrome/SlpGlyphs";
import { motion, useReducedMotion } from "framer-motion";
import {
  type ComponentProps,
  createContext,
  type CSSProperties,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import { closeSlpPulse, openSlpPulse, useSlpTasks } from "../../base/state/slp-task-store";
import { cn } from "../../../lib/utils";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpCoinAmount, slpCoinPlainText } from "../coin/SlpCoin";
import { SlpShimmer, SlpTwinkle } from "../sparkle/SlpSparkle";
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
  SLP_BALANCE_CHIP_CLASS,
  SLP_BAR_GLASS_CLASS,
  SLP_TYPE,
  useHideOnScroll,
} from "../../base/chrome/SlpChrome";
import { SLP_MOTION } from "../../base/chrome/slp-motion";
import { SlpCanvasAmbient } from "./SlpCanvasAmbient";
import { SlpSheet } from "./SlpSheet";
import { PersonaIdentityCard, PersonaList } from "./SlpPersonaSwitcher";
import { SlpPulseCard, SlpPulsePanel } from "./SlpPulse";
import type { SlpShellProps } from "./slp-shell.types";
import { SLP_NO_STORY_RINGS, SlpStoryRingProvider } from "../story/SlpStoryRing";

/** The phone header brand: ramen bowl + "Slurp" with a slow ambient sparkle shimmer behind it. */
export function SlpWordmark() {
  return (
    <span className="relative isolate inline-flex h-10 items-center gap-1 pe-3 ps-0.5">
      {/* Feathered, so the sparkle reads as a glow round the name rather than a pill behind it. */}
      <span className="pointer-events-none absolute -inset-x-2 -inset-y-1 -z-10 [mask-image:radial-gradient(closest-side,#000_40%,transparent)]">
        <SlpShimmer />
      </span>
      <SlpLogo src={NOODLER_LOGO_SRC} className="h-8 w-12" />
      <span className="slp-display text-xl leading-none">{SLURP_NAME}</span>
    </span>
  );
}

/** The balance and the way to the Wallet, provided by the shell so every phone header can show the chip. */
const SlpBalanceContext = createContext<{ coins: number | null; onOpen?: () => void }>({ coins: null });

/** The More sheet (Settings, Wallet, switching account; the own profile's ⋯) and Settings (the Me tab's row). */
const SlpShellActionsContext = createContext<{ openMore?: () => void; openSettings?: () => void }>({});
export const useSlpShellActions = () => useContext(SlpShellActionsContext);

/** The viewer's coin balance inside the shell (null while it loads or outside the shell). */
export const useSlpBalance = () => useContext(SlpBalanceContext).coins;

/**
 * The coin balance chip for phone headers (hub, profile, thread, Discover). It is the coin-fly
 * target, so every spend lands on it; desktop hides it because the sidebar Wallet row shows the
 * balance. Renders nothing outside the shell.
 */
export function SlpBalanceChip({ className }: { className?: string }) {
  const { t: localizeUi } = useUiTranslation();
  const { coins, onOpen } = useContext(SlpBalanceContext);
  if (!onOpen) return null;
  const label =
    coins === null
      ? localizeUi("ui.slurp.navigation.wallet")
      : slpCoinPlainText(localizeUi("ui.slurp.wallet.balance", { amount: coins }));
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex h-11 max-w-full shrink-0 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] @min-[1024px]:hidden",
        className,
      )}
      aria-label={label}
      title={label}
    >
      <span className={cn(SLP_BALANCE_CHIP_CLASS, "h-9 transition-colors hover:bg-[var(--accent)]")}>
        <SlurpCoinAmount amount={coins ?? "…"} watchAmount={coins ?? undefined} />
      </span>
    </button>
  );
}

/** Unread / new counts on a nav entry: a pink pill with a small sparkle on its corner. */
function SlpNavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute start-1/2 top-0.5 ms-1.5 h-[18px] min-w-[18px] rounded-full bg-[var(--noodle-accent)] px-1 text-center text-[11px] font-extrabold leading-[18px] tabular-nums text-[var(--slurp-on-accent)] shadow-[0_0_0_2px_var(--slurp-surface),0_4px_10px_-3px_color-mix(in_srgb,var(--noodle-accent)_80%,transparent)]"
    >
      {count > 99 ? "99+" : count}
      <SlpTwinkle points={[{ x: "calc(100% - 3px)", y: "-6px", size: 8 }]} />
    </span>
  );
}

// One tab of the floating phone nav: icon over a small label, 48 px tall, pink tint + glow when active.
function SlpNavTab({
  active,
  icon,
  label,
  badge = 0,
  className,
  ...props
}: ComponentProps<"button"> & { active: boolean; icon: ReactNode; label: string; badge?: number }) {
  return (
    <button
      type="button"
      // The visible label plus the count ("Inbox, 3"); the avatar in More adds nothing to the name.
      aria-label={badge > 0 ? `${label}, ${badge > 99 ? "99+" : badge}` : label}
      {...props}
      className={cn(
        "relative flex h-12 min-w-11 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[var(--slurp-muted)] transition-[background-color,color,box-shadow,transform] duration-[var(--slurp-motion-fast)] hover:text-[var(--slurp-text)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:!text-current",
        active &&
          "bg-[image:var(--slurp-nav-active)] text-[var(--slurp-ink)] shadow-[0_6px_18px_-8px_color-mix(in_srgb,var(--noodle-accent)_75%,transparent)] ring-1 ring-inset ring-[var(--noodle-accent)]/45 hover:text-[var(--slurp-ink)]",
        className,
      )}
    >
      {icon}
      <span aria-hidden="true" className={cn(SLP_TYPE.caption, "max-w-full truncate", active && "font-bold")}>
        {label}
      </span>
      <SlpNavBadge count={badge} />
    </button>
  );
}

/**
 * The frosted fade under the phone nav (fix phase 1b): a light blur, strongest at the screen edge,
 * that melts away a little above the pill, so posts never pass sharply under or below it. Tall enough
 * for the pill, its 10 px gap and the home indicator, plus 1rem to fade out in.
 */
const SLP_NAV_FADE_STYLE: CSSProperties = {
  height: "calc(3.5rem + 10px + 1rem + var(--slurp-bottom-safe-inset))",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  background: "linear-gradient(to top, color-mix(in srgb, var(--slurp-canvas) 45%, transparent), transparent)",
  maskImage: "linear-gradient(to top, #000 45%, transparent)",
  WebkitMaskImage: "linear-gradient(to top, #000 45%, transparent)",
};

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
  onOpenDashboard,
  onOpenSettings,
  onOpenMessages,
  onOpenWallet,
  onOpenStir,
  budgetNote,
  onOpenPulseTarget,
  onOpenBudget,
  pulseStarts,
  notificationCount = 0,
  walletBalanceLabel,
  walletBalance,
  personaBannerUrl,
  onBecomeCreator,
  desktopSidebar,
  rightRail,
  contextualRail,
  overlays,
  accent = SLP_BLUE,
  storyRings = SLP_NO_STORY_RINGS,
  children,
}: SlpShellProps) {
  const { t: localizeUi } = useUiTranslation();
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const navFadeRef = useRef<HTMLDivElement>(null);
  // The floating phone nav slides away while the reader scrolls down and comes back on the way up.
  const setMobileNav = useHideOnScroll(scrollRoot, {
    hiddenTransform: "translate3d(0, calc(100% + 1.5rem + var(--slurp-bottom-safe-inset)), 0)",
    resetKey: activeView,
    onHiddenChange: (hidden) => {
      // While the pill is away, bars pinned to the bottom (the thread composer) drop to the edge (`--slp-nav-live`).
      scrollRoot?.toggleAttribute("data-slp-nav-hidden", hidden);
      const fade = navFadeRef.current;
      if (!fade) return;
      fade.style.transition = `transform ${SLP_MOTION.bar}ms ${SLP_MOTION.barEase}`;
      fade.style.transform = hidden ? "translate3d(0, 100%, 0)" : "";
    },
  });
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
  // Pulse is a SlpSheet: opening it closes the More sheet (one overlay at a time, B8), and the
  // sheet's focus scope hands focus back to whatever opened it.
  // In the task store, so Stir's "See all" and a toast's "See in Pulse" (task B) open it too.
  const pulseOpen = useSlpTasks((state) => state.pulseOpen);
  const walletChip = (className: string) =>
    walletBalanceLabel && (
      <span className={cn(SLP_BALANCE_CHIP_CLASS, className)}>
        <SlurpCoinAmount amount={walletBalanceLabel} watchAmount={walletBalance} size={16} />
      </span>
    );

  return (
    <SlpShellProviders accent={accent} storyRings={storyRings}>
      <div
        className={cn(
          // `overflow-x-clip`, not `overflow-x-hidden`: the drawer starts at x:100%, so while it
          // slides in it sits past the right edge and widens the page, which is the flicker and
          // the push. Clipping stops that. `clip` is used because `hidden` would turn this into a
          // scroll container and break every sticky header inside it.
          "mari-chrome-token-scope relative flex h-full min-h-0 flex-col overflow-x-clip bg-[var(--background)] text-[var(--foreground)] antialiased",
          slurpActive &&
            cn(
              "bg-[var(--slurp-canvas)] @min-[1024px]:bg-[var(--slurp-outer)]",
              // Room the floating nav needs at the end of a list: the pill (48 px tab + 4 px padding
              // each side, in rem so it follows the Engine's font size) + 10 px above the edge + 12 px
              // air, plus the home indicator. `--slp-nav-live` is the same room for bottom bars, but 0
              // while the nav is away. Desktop has no floating nav.
              "[--slp-nav-space:calc(3.5rem+22px+var(--slurp-bottom-safe-inset))] [--slp-nav-live:var(--slp-nav-space)] @min-[1024px]:[--slp-nav-space:0px]",
            ),
          NOODLE_ICON_SCOPE_CLASS,
        )}
        data-component="NoodleView"
        style={getSlpAccentStyle(accent, { "--slurp-bottom-safe-inset": BOTTOM_SAFE_INSET } as CSSProperties)}
      >
        {overlays}
        {/* More: a glass sheet on phones, a centred modal on tablets (the sidebar replaces it on desktop). */}
        <SlpSheet
          open={mobileDrawerOpen}
          onClose={() => onMobileDrawerOpenChange(false)}
          title={localizeUi("ui.slurp.navigation.more", { defaultValue: "More" })}
        >
          <aside
            data-component="NoodleView.MobileDrawer"
            aria-label={
              slurpActive
                ? localizeUi("ui.slurp.navigation.menu")
                : localizeUi("ui.noodle.noodleshell.noodleAccountMenu")
            }
            className="space-y-2 px-1 pb-1"
          >
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
            <nav
              className="space-y-1"
              aria-label={
                slurpActive
                  ? localizeUi("ui.slurp.navigation.menuNavigation")
                  : localizeUi("ui.noodle.noodleshell.noodleAccountNavigation")
              }
            >
              {onOpenDashboard && (
                <button type="button" onClick={onOpenDashboard} className={SLURP_ROW_CLASS}>
                  <ChartNoAxesColumn size={20} />
                  {localizeUi("ui.slurp.dashboard.open")}
                </button>
              )}
              {onOpenWallet && (
                <button
                  type="button"
                  onClick={onOpenWallet}
                  aria-current={activeView === "wallet" ? "page" : undefined}
                  className={cn(SLURP_ROW_CLASS, activeView === "wallet" && SLURP_ROW_ACTIVE_CLASS)}
                >
                  <Wallet size={20} />
                  <span className="min-w-0 flex-1">
                    {localizeUi("ui.slurp.navigation.wallet", { defaultValue: "Wallet" })}
                  </span>
                  {walletChip("h-7 px-2.5 text-xs")}
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSettings}
                aria-current={activeView === "settings" ? "page" : undefined}
                className={cn(SLURP_ROW_CLASS, activeView === "settings" && SLURP_ROW_ACTIVE_CLASS)}
              >
                <Settings2 size={20} />
                {localizeUi("navigation.topbar.settings")}
              </button>
            </nav>
            {slurpActive && <SlpPulseCard open={pulseOpen} onOpen={openSlpPulse} note={Boolean(budgetNote)} />}
            {/* `<details>`, closed: the whole persona list open pushed the identity card off-screen. */}
            <details className="group mt-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 text-left [&::-webkit-details-marker]:hidden">
                <span className={labelClass}>{localizeUi("ui.noodle.noodleshell.switchAccount")}</span>
                <ChevronDown
                  size={18}
                  className="shrink-0 !text-[var(--noodle-accent-foreground)] transition-transform group-open:rotate-180"
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
                  className="mt-1 h-9 w-full rounded-lg text-xs font-semibold text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10"
                >
                  {localizeUi("ui.noodle.noodlehome.loadMore", {
                    visible: visiblePersonaAccounts.length,
                    total: sortedPersonaAccounts.length,
                  })}
                </button>
              )}
            </details>
          </aside>
        </SlpSheet>
        {/* `clip`, not `overflow-hidden`: a hidden box is still a scroll container, and when the
            phone keyboard shrinks the screen, revealing a focused field scrolled this box and
            lifted the whole page (7c M-006). Inline because `overflow-clip` is not in the Engine CSS. */}
        <div className="flex min-h-0 flex-1 justify-center" style={{ overflow: "clip" }}>
          <div
            className={cn(
              "relative isolate flex min-h-0 w-full justify-center",
              slurpActive
                ? "max-w-[1680px] @min-[1024px]:bg-[var(--slurp-canvas)] @min-[1024px]:[background-image:var(--slurp-canvas-art)]"
                : "max-w-[1360px]",
            )}
            data-slurp-desktop-frame={slurpActive ? resolvedContextualRail : undefined}
          >
            {slurpActive && <SlpCanvasAmbient />}
            {/* `relative z-20`: the blur makes the rail its own layer, and the main column painted over
                the persona menu where it reaches past the rail. Above it, the menu shows whole. */}
            <aside className="relative z-20 hidden w-[14rem] shrink-0 border-r border-[var(--noodle-divider)] bg-[radial-gradient(circle_at_12%_6%,color-mix(in_srgb,var(--noodle-accent)_13%,transparent),transparent_16rem),linear-gradient(180deg,color-mix(in_srgb,var(--slurp-glass)_92%,transparent),color-mix(in_srgb,var(--slurp-glass)_70%,transparent))] shadow-[var(--slurp-highlight)] backdrop-blur-xl @min-[1024px]:flex @min-[1024px]:flex-col">
              <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
                <div className="mb-5 flex h-12 items-center gap-3 px-2">
                  <SlpLogo
                    src={slpCreatorActive || slurpActive ? NOODLER_LOGO_SRC : SLP_LOGO_SRC}
                    className="h-10 w-16"
                  />
                  {slurpActive && <span className="slp-display text-lg">{SLURP_NAME}</span>}
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
                      <SlpHubGlyph size={22} filled={homeActive} className="!text-[var(--noodle-accent-foreground)]" />
                      {desktopHomeLabel}
                    </button>
                    {onOpenSearch && (
                      <button
                        type="button"
                        onClick={onOpenSearch}
                        aria-current={activeView === "search" ? "page" : undefined}
                        className={cn(SLURP_ROW_CLASS, activeView === "search" && SLURP_ROW_ACTIVE_CLASS)}
                      >
                        <SlpDiscoverGlyph
                          size={22}
                          filled={activeView === "search"}
                          className="!text-[var(--noodle-accent-foreground)]"
                        />
                        {slpCreatorActive
                          ? localizeUi("ui.noodle.noodleshell.discover")
                          : slurpActive
                            ? localizeUi("ui.slurp.navigation.search", { defaultValue: "Discover" })
                            : localizeUi("ui.noodle.noodlehome.searchNoodle")}
                      </button>
                    )}
                    {onOpenStir && (
                      <button
                        type="button"
                        onClick={onOpenStir}
                        aria-current={activeView === "stir" ? "page" : undefined}
                        className={cn(SLURP_ROW_CLASS, activeView === "stir" && SLURP_ROW_ACTIVE_CLASS)}
                      >
                        <SlpStirGlyph
                          size={22}
                          filled={activeView === "stir"}
                          className="!text-[var(--noodle-accent-foreground)]"
                        />
                        {localizeUi("ui.slurp.navigation.stir")}
                      </button>
                    )}
                    {onOpenMessages && (
                      <button
                        type="button"
                        onClick={onOpenMessages}
                        aria-current={activeView === "messages" ? "page" : undefined}
                        className={cn(SLURP_ROW_CLASS, activeView === "messages" && SLURP_ROW_ACTIVE_CLASS)}
                      >
                        <SlpInboxGlyph
                          size={22}
                          filled={activeView === "messages"}
                          className="!text-[var(--noodle-accent-foreground)]"
                        />
                        <span className="min-w-0 flex-1">
                          {localizeUi("ui.slurp.navigation.messages", { defaultValue: "Inbox" })}
                        </span>
                        {notificationCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--noodle-accent)] px-1.5 text-[11px] font-black tabular-nums text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)]">
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
                        <SlpProfileGlyph
                          size={22}
                          filled={activeView === "profile"}
                          className="!text-[var(--noodle-accent-foreground)]"
                        />
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
                        <Wallet size={22} className="!text-[var(--noodle-accent-foreground)]" />
                        <span className="min-w-0 flex-1">
                          {localizeUi("ui.slurp.navigation.wallet", { defaultValue: "Wallet" })}
                        </span>
                        {walletChip("h-7 px-2.5 text-xs")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      aria-current={activeView === "settings" ? "page" : undefined}
                      className={cn(SLURP_ROW_CLASS, activeView === "settings" && SLURP_ROW_ACTIVE_CLASS)}
                    >
                      <Settings2 size={22} className="!text-[var(--noodle-accent-foreground)]" />
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
                          className="mt-1 h-9 w-full rounded-lg text-xs font-semibold text-[var(--noodle-accent-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/10"
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
                      <SlpPulseCard rail open={pulseOpen} onOpen={openSlpPulse} note={Boolean(budgetNote)} />
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
                      <AtSign size={28} className="!text-[var(--noodle-accent-foreground)]" />
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
                        <p className="truncate text-xs text-[var(--muted-foreground)]">
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
                        "shrink-0 !text-[var(--noodle-accent-foreground)] transition-transform",
                        accountSwitcherOpen && "rotate-180",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </aside>

            <main
              ref={setScrollRoot}
              className={cn(
                // `min-w-0`: a flex item defaults to `min-width: auto`, so one wide post or story
                // grew this column and shoved both sidebars out of the viewport.
                "flex min-h-0 w-full min-w-0 flex-1 flex-col @min-[1024px]:pb-0",
                slurpActive
                  ? cn(
                      // No bottom padding: every screen scrolls behind the glass nav, and only the end of
                      // each list keeps room for it (`SLP_PAGE_SCROLL_CLASS`).
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
                <SlpBalanceContext.Provider value={{ coins: walletBalance ?? null, onOpen: onOpenWallet }}>
                  <SlpShellActionsContext.Provider
                    value={{ openMore: () => onMobileDrawerOpenChange(true), openSettings: onOpenSettings }}
                  >
                    {children}
                  </SlpShellActionsContext.Provider>
                </SlpBalanceContext.Provider>
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
          onClose={closeSlpPulse}
          budgetNote={budgetNote}
          accounts={sortedPersonaAccounts}
          onOpenTarget={onOpenPulseTarget}
          onOpenBudget={onOpenBudget}
          {...pulseStarts}
        />

        {/* The frosted fade under the phone nav, down to the bottom edge. A sibling, not a backdrop on
            a wrapper: a backdrop or mask around the pill would become its backdrop root and the pill
            would stop seeing the feed through its glass. It slides with the pill (`onHiddenChange`). */}
        <div
          ref={navFadeRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-40 @min-[1024px]:hidden"
          style={SLP_NAV_FADE_STYLE}
        />
        {/* Phone nav: a floating frosted pink-glass pill. It slides away on scroll down, comes back
            on the way up, and sits above the home indicator on iOS. */}
        <nav
          ref={setMobileNav}
          className={cn(
            "absolute inset-x-3 bottom-[calc(10px+var(--slurp-bottom-safe-inset))] z-50 mx-auto max-w-md rounded-full p-1 shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] ring-1 ring-inset ring-[var(--noodle-divider)] will-change-transform @min-[1024px]:hidden",
            SLP_BAR_GLASS_CLASS,
          )}
          aria-label={
            slurpActive
              ? localizeUi("ui.slurp.navigation.mobileNav")
              : localizeUi("ui.noodle.noodleshell.noodleMobileNavigation")
          }
          data-component="NoodleView.MobileBottomNav"
        >
          {/* Hub · Discover · Stir · Inbox · More (own page + Dashboard, Wallet, Settings, Pulse, accounts). */}
          <div className="grid grid-flow-col auto-cols-fr gap-0.5">
            <SlpNavTab
              onClick={onMobileHomeTap}
              active={homeActive}
              aria-current={homeActive ? "page" : undefined}
              label={slurpActive ? desktopHomeLabel : homeLabel}
              badge={noodlerUnseenCount}
              icon={<SlpHubGlyph size={20} filled={homeActive} />}
            />
            {onOpenSearch && (
              <SlpNavTab
                onClick={onOpenSearch}
                active={activeView === "search"}
                aria-current={activeView === "search" ? "page" : undefined}
                label={
                  slpCreatorActive
                    ? localizeUi("ui.noodle.noodleshell.discoverCreators")
                    : slurpActive
                      ? localizeUi("ui.slurp.navigation.search", { defaultValue: "Discover" })
                      : localizeUi("ui.noodle.noodlehome.searchNoodle")
                }
                icon={<SlpDiscoverGlyph size={20} filled={activeView === "search"} />}
              />
            )}
            {onOpenStir && (
              <SlpNavTab
                data-slp-stir-tab=""
                onClick={onOpenStir}
                active={activeView === "stir"}
                aria-current={activeView === "stir" ? "page" : undefined}
                label={localizeUi("ui.slurp.navigation.stir")}
                icon={<SlpStirGlyph size={20} filled={activeView === "stir"} />}
              />
            )}
            {onOpenMessages && (
              <SlpNavTab
                onClick={onOpenMessages}
                active={activeView === "messages"}
                aria-current={activeView === "messages" ? "page" : undefined}
                label={localizeUi("ui.slurp.navigation.messages", { defaultValue: "Inbox" })}
                badge={notificationCount}
                icon={<SlpInboxGlyph size={20} filled={activeView === "messages"} />}
              />
            )}
            <SlpNavTab
              ref={mobileDrawerTriggerRef}
              data-component="NoodleView.MobileAccountSwitcher"
              onClick={() => onMobileDrawerOpenChange(true)}
              aria-expanded={mobileDrawerOpen}
              aria-haspopup="dialog"
              active={mobileDrawerOpen}
              label={
                slurpActive
                  ? localizeUi("ui.slurp.navigation.more", { defaultValue: "More" })
                  : localizeUi("ui.noodle.noodleshell.noodleAccountMenu")
              }
              icon={
                personaAccount ? (
                  <Avatar account={personaAccount} size="xs" />
                ) : (
                  <SlpMoreGlyph size={20} filled={mobileDrawerOpen} />
                )
              }
            />
          </div>
        </nav>
      </div>
    </SlpShellProviders>
  );
}

/** What every screen under the shell reads: the accent and the Story rings (T). */
function SlpShellProviders({
  accent,
  storyRings,
  children,
}: {
  accent: string;
  storyRings: NonNullable<SlpShellProps["storyRings"]>;
  children: ReactNode;
}) {
  return (
    <SlpAccentContext.Provider value={accent}>
      <SlpStoryRingProvider value={storyRings}>{children}</SlpStoryRingProvider>
    </SlpAccentContext.Provider>
  );
}
