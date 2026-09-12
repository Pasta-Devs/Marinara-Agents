// ──────────────────────────────────────────────
// Noodle: shared shell (left nav, mobile drawer, right rail slot, bottom nav)
// Used by both the public NoodleHome timeline and the SlurpHome hub
// so every Noodle surface keeps the same primary navigation.
// ──────────────────────────────────────────────
import { AtSign, Home, MoreHorizontal, Pencil, Search, Settings2, User, UserRound, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  createContext,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { NoodleAccount } from "@marinara-engine/shared";
import type { AvatarCrop } from "@marinara-engine/shared";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { useDialogFocusScope } from "../../hooks/use-dialog-focus-scope";
import { useSlurpMediaSrc } from "../../hooks/use-slurp-media-src";
import { useTranslation as useUiTranslation } from "react-i18next";

export const NOODLE_BLUE = "#7EA7FF";
export const NOODLE_PINK = "#FF7EC1";

// The Engine viewport uses `viewport-fit=cover`, so `env(safe-area-inset-bottom)`
// reports the Android system navigation bar as well. Gecko on Android keeps the
// layout viewport above that bar, so honouring the inset there paints an empty
// strip under the mobile nav. WebKit is the engine that really extends the
// viewport under the home indicator, so reserve the inset only there.
// ponytail: WebKit sniff, swap for a measured overhang if another engine ever
// needs the real inset.
const BOTTOM_SAFE_INSET =
  typeof CSS !== "undefined" && CSS.supports?.("-webkit-touch-callout", "none") === true
    ? "env(safe-area-inset-bottom)"
    : "0px";

// The accent hex that drives `--noodle-accent` for every reused Noodle surface.
// Provided at the shell root so descendants inherit via CSS var, and read here
// so portaled popovers/modals (which escape the shell's CSS scope) can re-apply it.
const NoodleAccentContext = createContext<string>(NOODLE_BLUE);
export const useNoodleAccent = () => useContext(NoodleAccentContext);
export const NOODLE_ICON_SCOPE_CLASS = "[&_:where(svg)]:text-[var(--noodle-accent)]";
// NoodleR's mark. Untranslated on purpose — it is branding, not copy — and a constant so the
// localization audit does not read it as a hardcoded string. Meaning is carried by the adjacent
// label or tooltip, never by the mark alone.
export const NOODLER_MARK = "R";
export const NOODLER_ADD_MARK = "+R";
export const NOODLE_LOGO_SRC = "/api/capability-packages/slurp/assets/slurp-logo.png";
const NOODLER_LOGO_SRC = "/api/capability-packages/slurp/assets/slurp-logo.png";
export const NOODLE_PERSONA_SWITCHER_PAGE_SIZE = 5;

export function getNoodleAccentStyle(accent: string, style: CSSProperties = {}): CSSProperties {
  return {
    "--noodle-accent": accent,
    "--noodle-accent-foreground":
      "light-dark(color-mix(in srgb, var(--noodle-accent) 65%, var(--foreground)), var(--noodle-accent))",
    "--noodle-divider": "var(--marinara-chat-chrome-panel-divider)",
    ...style,
  } as CSSProperties;
}

const labelClass =
  "text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--marinara-chat-chrome-panel-muted)]";

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "N"
  );
}

export function NoodleLogo({ className, src = NOODLE_LOGO_SRC }: { className?: string; src?: string }) {
  return <img src={src} alt="" className={cn("object-contain", className)} />;
}

/** Phone header carried forward from the pre-split NoodleR surface. */
export function SlurpMobileHeader({
  personaAccount,
  onOpenDrawer,
  triggerRef,
}: {
  personaAccount: NoodleAccount | null;
  onOpenDrawer: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div
      className="grid h-14 grid-cols-[3rem_minmax(0,1fr)_3rem] items-center border-b border-[var(--noodle-divider)] bg-[var(--background)]/95 px-3 backdrop-blur @min-[1024px]:hidden"
      data-component="SlurpHome.MobileHeader"
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={onOpenDrawer}
        className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-[var(--accent)]"
        title={localizeUi("ui.slurp.navigation.menu")}
        aria-label={localizeUi("ui.slurp.navigation.menu")}
      >
        {personaAccount ? (
          <Avatar account={personaAccount} size="sm" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 ring-1 ring-[var(--noodle-accent)]/25">
            <AtSign size={18} />
          </span>
        )}
      </button>
      <NoodleLogo className="mx-auto h-9 w-14" />
      <span aria-hidden="true" />
    </div>
  );
}

/**
 * Ties a sticky header to the scroll position: it travels with the content instead of
 * snapping between shown and hidden at a threshold, which reads as a jump. The bar
 * moves pixel for pixel with the scroll, so it feels attached to the reader's finger,
 * and once scrolling stops it settles to whichever edge it is nearest — biased open,
 * so any upward movement finishes with the controls on screen.
 *
 * Writes the transform straight to the node rather than through state: a re-render per
 * scroll event is exactly the stutter this is meant to remove. Overscroll past the top
 * always shows the bar, or a rubber-band bounce leaves it stranded half-way.
 *
 * Takes the scrolling element as state, not a ref: surfaces that swap their scroller
 * for another view (NoodleR discovery) would otherwise keep listening to a detached node.
 *
 * Takes the sticky element the same way, through a callback ref: NoodleHome keeps its
 * scroller mounted while swapping the bar out with the view, so a plain ref would leave
 * this driving a detached node and the new bar would never move.
 *
 * @returns a callback ref for the sticky element itself.
 */
export function useHideOnScroll(scroller: HTMLElement | null) {
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!scroller || !bar) return;
    // Reduced motion asks for no travel at all, not a faster version of it.
    if (reduceMotion) return;
    const SETTLE_MS = 140;
    const EASE = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
    let tucked = 0;
    let previousTop = scroller.scrollTop;
    let rising = false;
    let frame = 0;
    let settleTimer = 0;

    const move = (next: number, eased: boolean) => {
      tucked = next;
      bar.style.transition = eased ? EASE : "none";
      bar.style.transform = `translate3d(0, ${-tucked}px, 0)`;
    };

    const settle = () => {
      const height = bar.offsetHeight;
      if (!height || tucked <= 0 || tucked >= height) return;
      // A part-hidden bar is nobody's intent, so finish the movement the reader
      // started: open if they were coming back up, closed if they were still going.
      move(rising ? 0 : height, true);
    };

    const read = () => {
      frame = 0;
      const height = bar.offsetHeight;
      if (!height) return;
      const top = scroller.scrollTop;
      const delta = top - previousTop;
      previousTop = top;
      if (delta !== 0) rising = delta < 0;
      const next = top <= 0 ? 0 : Math.min(height, Math.max(0, tucked + delta));
      if (next !== tucked) move(next, false);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, SETTLE_MS);
    };

    const onScroll = () => {
      // One read per frame: scroll fires far more often than the screen redraws.
      if (!frame) frame = window.requestAnimationFrame(read);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      bar.style.transition = "";
      bar.style.transform = "";
    };
  }, [scroller, bar, reduceMotion]);
  return setBar;
}

/** Base classes for a sticky bar driven by {@link useHideOnScroll}. */
export const HIDE_ON_SCROLL_CLASS = "will-change-transform";

/** Boundary marker between posts arrived since the last visit and everything already read. */
export function NewSinceLastVisitDivider() {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="flex items-center gap-3 border-b border-[var(--noodle-divider)] px-4 py-2">
      <span className="h-px flex-1 bg-[var(--noodle-accent)]/30" />
      <span className="text-[0.68rem] font-bold uppercase tracking-wide text-[var(--noodle-accent)]">
        {localizeUi("ui.noodle.viewerhub.newSinceYourLastVisit")}
      </span>
      <span className="h-px flex-1 bg-[var(--noodle-accent)]/30" />
    </div>
  );
}

export function Avatar({
  account,
  size = "md",
  solid = false,
}: {
  account: Pick<NoodleAccount, "displayName" | "avatarUrl"> & {
    avatarCrop?: AvatarCrop | null;
  };
  size?: "sm" | "md" | "lg" | "xl";
  solid?: boolean;
}) {
  const dimension =
    size === "sm" ? "h-8 w-8" : size === "xl" ? "h-32 w-32 sm:h-36 sm:w-36" : size === "lg" ? "h-24 w-24" : "h-11 w-11";
  // NoodleR avatars are served by the package's own route, which a bare <img> cannot
  // authenticate against; the hook swaps those for a fetched object URL and passes the rest through.
  const avatarSrc = useSlurpMediaSrc(account.avatarUrl);
  if (avatarSrc) {
    return (
      <div
        className={cn(
          dimension,
          "relative aspect-square flex-none overflow-hidden rounded-full border border-[var(--noodle-accent)]/30",
        )}
      >
        {avatarSrc && (
          <img
            src={avatarSrc}
            alt=""
            className="h-full w-full object-cover"
            style={getAvatarCropStyle(account.avatarCrop)}
          />
        )}
      </div>
    );
  }
  return (
    <div
      data-noodle-avatar-fallback
      className={cn(
        dimension,
        "flex aspect-square flex-none items-center justify-center rounded-full text-xs font-bold !text-[var(--noodle-accent-foreground)] ring-1 ring-[var(--noodle-accent)]/25",
        solid ? "bg-[color-mix(in_srgb,var(--noodle-accent)_15%,var(--background))]" : "bg-[var(--noodle-accent)]/15",
      )}
    >
      {initials(account.displayName)}
    </div>
  );
}

/** Avatar for stage profiles: their picture when they have one, their initial when they do not. */
export function ProfileInitial({
  profile,
  large = false,
}: {
  profile: {
    displayName: string;
    avatarUrl?: string | null;
    avatarCrop?: AvatarCrop | null;
  };
  large?: boolean;
}) {
  if (profile.avatarUrl)
    return (
      <Avatar
        account={{
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          avatarCrop: profile.avatarCrop,
        }}
        size={large ? "lg" : "md"}
      />
    );
  return (
    <span
      data-noodle-avatar-fallback
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 font-black !text-[var(--noodle-accent-foreground)] ring-1 ring-[var(--noodle-accent)]/25",
        large ? "h-24 w-24 text-3xl" : "h-11 w-11",
      )}
    >
      {Array.from(profile.displayName)[0]?.toUpperCase() || <UserRound size={20} />}
    </span>
  );
}

export type NoodleShellView = "home" | "noodler" | "search" | "profile" | "settings" | null;
type NoodleShellMode = "noodle" | "noodler" | "slurp";

export interface NoodleShellProps {
  activeView: NoodleShellView;
  /** App identity is independent from the selected vertical-nav destination. */
  appMode?: NoodleShellMode;
  /** Overrides whether the Home/Hub destination is selected when app mode and subview are separate. */
  homeActive?: boolean;
  /** Posts published since this viewer persona last had the NoodleR feed shown to it. */
  noodlerUnseenCount?: number;
  /** The same for the public Noodle timeline. */
  noodleUnseenCount?: number;
  personaAccount: NoodleAccount | null;
  sortedPersonaAccounts: NoodleAccount[];
  visiblePersonaAccounts: NoodleAccount[];
  linkedNoodleAccountIds?: ReadonlySet<string>;
  onLoadMorePersonaAccounts: () => void;
  onSwitchPersona: (account: NoodleAccount, mobile: boolean) => void;
  accountSwitcherOpen: boolean;
  onAccountSwitcherOpenChange: (open: boolean) => void;
  accountSwitcherRef: RefObject<HTMLDivElement | null>;
  mobileDrawerOpen: boolean;
  onMobileDrawerOpenChange: (open: boolean) => void;
  /** The bottom-nav account button, so pages can return focus to what opened the drawer. */
  mobileDrawerTriggerRef?: RefObject<HTMLButtonElement | null>;
  mobileAccountSwitcherOpen: boolean;
  onMobileAccountSwitcherOpenChange: (open: boolean) => void;
  onOpenHome: () => void;
  /** Mobile bottom-nav home/hub tap — distinct from onOpenHome because it also clears any active post search. */
  onOpenMobileHome: () => void;
  /** "NoodleR" nav item — a peer to Home, not a sub-page reached through Home. */
  onOpenNoodler: () => void;
  /** Omit on surfaces with no scoped equivalent. */
  onOpenSearch?: () => void;
  /** Omit on surfaces with no scoped equivalent. */
  /** Omit on surfaces with no scoped equivalent. */
  onOpenProfile?: () => void;
  onOpenSettings: () => void;
  /** Omit on surfaces with no scoped equivalent. */
  onCompose?: (opener: HTMLElement) => void;
  /** Optional right-hand rail (search box, suggestions, etc). Omitted entirely on surfaces that don't need one. */
  rightRail?: ReactNode;
  /** Theme-dependent overlays (lightboxes and modals) that must render inside the token scope. */
  overlays?: ReactNode;
  /** Accent hex driving `--noodle-accent` for every reused surface. NoodleR passes NOODLE_PINK; defaults to Noodle blue. */
  accent?: string;
  children: ReactNode;
}

export function NoodleShell({
  activeView,
  appMode,
  homeActive: homeActiveOverride,
  noodlerUnseenCount = 0,
  noodleUnseenCount = 0,
  personaAccount,
  sortedPersonaAccounts,
  visiblePersonaAccounts,
  linkedNoodleAccountIds,
  onLoadMorePersonaAccounts,
  onSwitchPersona,
  accountSwitcherOpen,
  onAccountSwitcherOpenChange,
  accountSwitcherRef,
  mobileDrawerOpen,
  onMobileDrawerOpenChange,
  mobileDrawerTriggerRef,
  mobileAccountSwitcherOpen,
  onMobileAccountSwitcherOpenChange,
  onOpenHome,
  onOpenMobileHome,
  onOpenNoodler,
  onOpenSearch,
  onOpenProfile,
  onOpenSettings,
  onCompose,
  rightRail,
  overlays,
  accent = NOODLE_BLUE,
  children,
}: NoodleShellProps) {
  const { t: localizeUi } = useUiTranslation();
  const mobileDrawerRef = useRef<HTMLElement | null>(null);
  const mobileDrawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const prefersReducedMotion = Boolean(useReducedMotion());
  const hasMorePersonaAccounts = visiblePersonaAccounts.length < sortedPersonaAccounts.length;
  const resolvedAppMode = appMode ?? (activeView === "noodler" ? "noodler" : "noodle");
  const noodlerActive = resolvedAppMode === "noodler";
  const slurpActive = resolvedAppMode === "slurp";
  const homeLabel = noodlerActive
    ? localizeUi("ui.noodle.noodleshell.hub")
    : slurpActive
      ? localizeUi("ui.slurp.navigation.home", { defaultValue: "Slurp" })
      : localizeUi("ui.noodle.noodleshell.home");
  const homeActive = homeActiveOverride ?? (activeView === "home" || activeView === "noodler");
  const onOpenHomeDestination = noodlerActive ? onOpenNoodler : onOpenHome;
  const onOpenMobileHomeDestination = noodlerActive ? onOpenNoodler : onOpenMobileHome;
  const onMobileHomeTap = () => {
    onOpenMobileHomeDestination();
  };
  useDialogFocusScope(mobileDrawerOpen, mobileDrawerRef, mobileDrawerCloseRef);

  return (
    <NoodleAccentContext.Provider value={accent}>
      <div
        className={cn(
          "mari-chrome-token-scope relative flex h-full min-h-0 flex-col bg-[var(--background)] text-[var(--foreground)]",
          NOODLE_ICON_SCOPE_CLASS,
        )}
        data-component="NoodleView"
        style={getNoodleAccentStyle(accent, { "--slurp-bottom-safe-inset": BOTTOM_SAFE_INSET } as CSSProperties)}
      >
        {overlays}
        <AnimatePresence>
          {mobileDrawerOpen && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { x: "-100%" }}
              animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: "-100%" }}
              transition={prefersReducedMotion ? { duration: 0.1 } : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-[80] h-full w-full bg-[var(--background)] @min-[1024px]:hidden"
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
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {personaAccount ? (
                      <Avatar account={personaAccount} />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 ring-1 ring-[var(--noodle-accent)]/25">
                        <AtSign size={24} className="text-[var(--noodle-accent)]" />
                      </span>
                    )}
                    <p className="mt-3 truncate text-lg font-bold">
                      {personaAccount?.displayName ?? localizeUi("ui.noodle.noodleshell.noodleAccount")}
                    </p>
                    <p className="truncate text-sm text-[var(--muted-foreground)]">
                      {personaAccount
                        ? localizeUi("ui.noodle.noodlehome.value1_0a5edda", {
                            value1: personaAccount.handle,
                          })
                        : localizeUi("ui.noodle.noodleshell.pickAPersonaBelow")}
                    </p>
                  </div>
                  <button
                    ref={mobileDrawerCloseRef}
                    type="button"
                    onClick={() => onMobileDrawerOpenChange(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--noodle-accent)] transition-colors hover:bg-[var(--noodle-accent)]/10"
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
                  <button
                    type="button"
                    onClick={onOpenHomeDestination}
                    aria-current={homeActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-4 rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)]",
                      homeActive && "bg-[var(--noodle-accent)]/10",
                    )}
                  >
                    <Home size={23} />
                    <span className="min-w-0 flex-1">{homeLabel}</span>
                    {noodlerActive && noodlerUnseenCount > 0 && (
                      <span className="min-w-5 rounded-full bg-[var(--noodle-accent)] px-1.5 text-center text-[0.65rem] font-black text-zinc-950">
                        {noodlerUnseenCount > 99 ? "99+" : noodlerUnseenCount}
                      </span>
                    )}
                  </button>
                  {onOpenSearch && (
                    <button
                      type="button"
                      onClick={onOpenSearch}
                      aria-current={activeView === "search" ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-4 rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]",
                        activeView === "search" && "bg-[var(--noodle-accent)]/10",
                      )}
                    >
                      <Search size={23} />
                      {noodlerActive
                        ? localizeUi("ui.noodle.noodleshell.discover")
                        : slurpActive
                          ? localizeUi("ui.slurp.navigation.search", { defaultValue: "Discover" })
                          : localizeUi("ui.noodle.noodlehome.searchNoodle")}
                    </button>
                  )}
                  {onOpenProfile && (
                    <button
                      type="button"
                      onClick={onOpenProfile}
                      aria-current={activeView === "profile" ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-4 rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]",
                        activeView === "profile" && "bg-[var(--noodle-accent)]/10",
                      )}
                    >
                      <User size={23} />
                      {slurpActive
                        ? localizeUi("ui.slurp.navigation.profile", { defaultValue: "Creator profile" })
                        : localizeUi("ui.noodle.noodlehome.profile")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    aria-current={activeView === "settings" ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-4 rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)]",
                      activeView === "settings" && "bg-[var(--noodle-accent)]/10",
                    )}
                  >
                    <Settings2 size={23} />
                    {localizeUi("navigation.topbar.settings")}
                  </button>
                  {onCompose && (
                    <button
                      type="button"
                      onClick={(event) => onCompose(event.currentTarget)}
                      className="flex min-h-12 w-full items-center gap-4 rounded-xl px-2 text-left text-base font-bold transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                    >
                      <Pencil size={23} />
                      {localizeUi("ui.noodle.noodlehome.post")}
                    </button>
                  )}
                </nav>

                <div className="relative mt-auto border-t border-[var(--noodle-divider)] pt-3">
                  {mobileAccountSwitcherOpen && (
                    <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 max-h-64 overflow-y-auto rounded-2xl border border-[var(--noodle-divider)] bg-[var(--background)] p-2 shadow-2xl shadow-black/35">
                      <p className={cn(labelClass, "px-2 pb-2")}>{localizeUi("ui.noodle.noodleshell.switchAccount")}</p>
                      {sortedPersonaAccounts.length > 0 ? (
                        <div className="space-y-1">
                          {sortedPersonaAccounts.map((account) => {
                            const selected = account.id === personaAccount?.id;
                            return (
                              <button
                                key={account.id}
                                data-noodle-persona-id={account.entityId}
                                type="button"
                                onClick={() => onSwitchPersona(account, true)}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--accent)]",
                                  selected && "bg-[var(--noodle-accent)]/10",
                                )}
                              >
                                <Avatar account={account} size="sm" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold">{account.displayName}</span>
                                  <span className="block truncate text-xs text-[var(--muted-foreground)]">
                                    @{account.handle}
                                  </span>
                                  {linkedNoodleAccountIds?.has(account.id) && (
                                    <span
                                      className="mt-0.5 block text-[0.65rem] font-semibold text-[var(--noodle-accent)]"
                                      aria-label={localizeUi("ui.noodle.noodleshell.noodlerProfileLinked")}
                                    >
                                      {localizeUi("ui.noodle.noodleshell.noodlerLinked")}
                                    </span>
                                  )}
                                </span>
                                {selected && <span className="h-2 w-2 rounded-full bg-[var(--noodle-accent)]" />}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="px-2 py-3 text-xs text-[var(--muted-foreground)]">
                          {localizeUi("ui.noodle.noodleshell.noPersonaAccountsYet")}
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    data-component="NoodleView.MobileAccountSwitcher"
                    type="button"
                    onClick={() => onMobileAccountSwitcherOpenChange(!mobileAccountSwitcherOpen)}
                    aria-expanded={mobileAccountSwitcherOpen}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-[var(--accent)]"
                  >
                    {personaAccount ? (
                      <Avatar account={personaAccount} size="sm" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15">
                        <AtSign size={18} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {localizeUi("ui.noodle.noodleshell.switchAccount")}
                      </span>
                      <span className="block truncate text-xs text-[var(--muted-foreground)]">
                        {personaAccount
                          ? localizeUi("ui.noodle.noodlehome.value1_0a5edda", {
                              value1: personaAccount.handle,
                            })
                          : localizeUi("ui.noodle.noodleshell.chooseAPersona")}
                      </span>
                    </span>
                    <MoreHorizontal size={19} />
                  </button>
                </div>
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex min-h-0 flex-1 justify-center overflow-hidden">
          <div className="flex min-h-0 w-full max-w-[1264px] justify-center">
            <aside className="hidden w-[17rem] shrink-0 border-r border-[var(--noodle-divider)] bg-[var(--background)] @min-[1024px]:flex @min-[1024px]:flex-col">
              <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
                <div className="mb-5 flex h-12 items-center">
                  <NoodleLogo
                    src={noodlerActive || slurpActive ? NOODLER_LOGO_SRC : NOODLE_LOGO_SRC}
                    className="h-10 w-16"
                  />
                </div>
                <nav className="space-y-1">
                  <button
                    type="button"
                    onClick={onOpenHomeDestination}
                    aria-current={homeActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-4 rounded-full px-3 text-left text-[0.95rem] font-semibold hover:bg-[var(--accent)]",
                      homeActive && "bg-[var(--noodle-accent)]/10",
                    )}
                  >
                    <Home size={22} className="!text-[var(--noodle-accent)]" />
                    {homeLabel}
                  </button>
                  {onOpenSearch && (
                    <button
                      type="button"
                      onClick={onOpenSearch}
                      aria-current={activeView === "search" ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-4 rounded-full px-3 text-left text-[0.95rem] font-semibold hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]",
                        activeView === "search" && "bg-[var(--noodle-accent)]/10",
                      )}
                    >
                      <Search size={22} className="!text-[var(--noodle-accent)]" />
                      {noodlerActive
                        ? localizeUi("ui.noodle.noodleshell.discover")
                        : slurpActive
                          ? localizeUi("ui.slurp.navigation.search", { defaultValue: "Discover" })
                          : localizeUi("ui.noodle.noodlehome.searchNoodle")}
                    </button>
                  )}
                  {onOpenProfile && (
                    <button
                      type="button"
                      onClick={onOpenProfile}
                      aria-current={activeView === "profile" ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-4 rounded-full px-3 text-left text-[0.95rem] font-semibold hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]",
                        activeView === "profile" && "bg-[var(--noodle-accent)]/10",
                      )}
                    >
                      <User size={22} className="!text-[var(--noodle-accent)]" />
                      {slurpActive
                        ? localizeUi("ui.slurp.navigation.profile", { defaultValue: "Creator profile" })
                        : localizeUi("ui.noodle.noodlehome.profile")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    aria-current={activeView === "settings" ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-4 rounded-full px-3 text-left text-[0.95rem] font-semibold hover:bg-[var(--accent)]",
                      activeView === "settings" && "bg-[var(--noodle-accent)]/10",
                    )}
                  >
                    <Settings2 size={22} className="!text-[var(--noodle-accent)]" />
                    {localizeUi("navigation.topbar.settings")}
                  </button>
                </nav>
                {onCompose && (
                  <button
                    type="button"
                    onClick={(event) => onCompose(event.currentTarget)}
                    className="mt-5 h-12 rounded-full bg-[var(--noodle-accent)] px-6 text-sm font-bold text-zinc-950 transition-[opacity,scale] hover:opacity-90 active:scale-[0.96]"
                  >
                    {localizeUi("ui.noodle.noodlehome.post")}
                  </button>
                )}
                <div ref={accountSwitcherRef} className="relative mt-auto">
                  {accountSwitcherOpen && (
                    <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-30 overflow-hidden rounded-xl border border-[var(--noodle-divider)] bg-[var(--background)] p-2 shadow-2xl shadow-black/30">
                      <p className={cn(labelClass, "px-2 pb-2")}>{localizeUi("ui.noodle.noodleshell.switchAccount")}</p>
                      {sortedPersonaAccounts.length > 0 ? (
                        <div className="max-h-72 space-y-1 overflow-y-auto">
                          {visiblePersonaAccounts.map((account) => {
                            const selected = account.id === personaAccount?.id;
                            return (
                              <button
                                key={account.id}
                                data-noodle-persona-id={account.entityId}
                                type="button"
                                onClick={() => onSwitchPersona(account, false)}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--accent)]",
                                  selected && "bg-[var(--noodle-accent)]/10",
                                )}
                              >
                                <Avatar account={account} size="sm" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-semibold">{account.displayName}</span>
                                  <span className="block truncate text-[0.68rem] text-[var(--muted-foreground)]">
                                    @{account.handle}
                                  </span>
                                  {linkedNoodleAccountIds?.has(account.id) && (
                                    <span
                                      className="mt-0.5 block text-[0.62rem] font-semibold text-[var(--noodle-accent)]"
                                      aria-label={localizeUi("ui.noodle.noodleshell.noodlerProfileLinked")}
                                    >
                                      {localizeUi("ui.noodle.noodleshell.noodlerLinked")}
                                    </span>
                                  )}
                                </span>
                                {selected && <span className="h-2 w-2 rounded-full bg-[var(--noodle-accent)]" />}
                              </button>
                            );
                          })}
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
                      ) : (
                        <p className="px-2 py-3 text-xs text-[var(--muted-foreground)]">
                          {localizeUi("ui.noodle.noodleshell.noPersonaAccountsYet")}
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    data-component="NoodleView.AccountSwitcher"
                    type="button"
                    onClick={() => onAccountSwitcherOpenChange(!accountSwitcherOpen)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-full px-3 text-left transition-colors hover:bg-[var(--accent)]"
                    title={localizeUi("ui.noodle.noodleshell.switchAccount")}
                  >
                    {personaAccount ? (
                      <Avatar account={personaAccount} />
                    ) : (
                      <AtSign size={28} className="!text-[var(--noodle-accent)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {personaAccount?.displayName ?? localizeUi("ui.noodle.noodleshell.noodleAccount")}
                      </p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {personaAccount
                          ? localizeUi("ui.noodle.noodlehome.value1_0a5edda", {
                              value1: personaAccount.handle,
                            })
                          : localizeUi("ui.noodle.noodleshell.pickAPersona")}
                      </p>
                    </div>
                    <MoreHorizontal size={18} className="!text-[var(--noodle-accent)] opacity-70" />
                  </button>
                </div>
              </div>
            </aside>

            <main className="flex min-h-0 w-full flex-1 flex-col pb-[calc(56px+var(--slurp-bottom-safe-inset))] @min-[1024px]:max-w-[640px] @min-[1024px]:border-r @min-[1024px]:border-[var(--noodle-divider)] @min-[1024px]:pb-0">
              {children}
            </main>
            {rightRail}
          </div>
        </div>

        <nav
          className="absolute inset-x-0 bottom-0 z-50 border-t border-[var(--noodle-divider)] bg-[var(--background)]/95 backdrop-blur @min-[1024px]:hidden"
          style={{ paddingBottom: BOTTOM_SAFE_INSET }}
          aria-label={
            slurpActive
              ? localizeUi("ui.slurp.navigation.mobileNav")
              : localizeUi("ui.noodle.noodleshell.noodleMobileNavigation")
          }
          data-component="NoodleView.MobileBottomNav"
        >
          <div className="relative grid h-[56px] grid-flow-col auto-cols-fr">
            <button
              type="button"
              ref={mobileDrawerTriggerRef}
              onClick={() => onMobileDrawerOpenChange(true)}
              aria-label={
                slurpActive
                  ? localizeUi("ui.slurp.navigation.menu", { defaultValue: "Open Slurp menu" })
                  : localizeUi("ui.noodle.noodleshell.noodleAccountMenu")
              }
              className="flex items-center justify-center transition-colors hover:bg-[var(--noodle-accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
            >
              {personaAccount ? (
                <Avatar account={personaAccount} size="sm" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 ring-1 ring-[var(--noodle-accent)]/25">
                  <AtSign size={18} />
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onMobileHomeTap}
              aria-label={localizeUi("ui.noodle.noodleshell.noodleValue1", { value1: homeLabel })}
              aria-current={homeActive ? "page" : undefined}
              className="relative flex items-center justify-center transition-colors hover:bg-[var(--noodle-accent)]/10 active:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
            >
              <span className="relative flex h-8 w-12 items-center justify-center">
                <img
                  src={noodlerActive || slurpActive ? NOODLER_LOGO_SRC : NOODLE_LOGO_SRC}
                  alt=""
                  className="h-6 w-9 object-contain"
                />
              </span>
              {homeActive && <span className="absolute top-1 h-1 w-1 rounded-full bg-[var(--noodle-accent)]" />}
            </button>
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                aria-label={
                  slurpActive
                    ? localizeUi("ui.slurp.navigation.profile", { defaultValue: "Creator profile" })
                    : localizeUi("ui.noodle.noodlehome.profile")
                }
                aria-current={activeView === "profile" ? "page" : undefined}
                className="relative flex items-center justify-center transition-colors hover:bg-[var(--noodle-accent)]/10 active:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
              >
                <User size={22} strokeWidth={activeView === "profile" ? 2.8 : 2} />
                {activeView === "profile" && (
                  <span className="absolute top-1 h-1 w-1 rounded-full bg-[var(--noodle-accent)]" />
                )}
              </button>
            )}
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                aria-label={
                  noodlerActive
                    ? localizeUi("ui.noodle.noodleshell.discoverCreators")
                    : slurpActive
                      ? localizeUi("ui.slurp.navigation.search", { defaultValue: "Discover" })
                      : localizeUi("ui.noodle.noodlehome.searchNoodle")
                }
                aria-current={activeView === "search" ? "page" : undefined}
                className="relative flex items-center justify-center transition-colors hover:bg-[var(--noodle-accent)]/10 active:bg-[var(--noodle-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)]"
              >
                <Search size={22} strokeWidth={activeView === "search" ? 2.8 : 2} />
                {activeView === "search" && (
                  <span className="absolute top-1 h-1 w-1 rounded-full bg-[var(--noodle-accent)]" />
                )}
              </button>
            )}
          </div>
        </nav>
      </div>
    </NoodleAccentContext.Provider>
  );
}
