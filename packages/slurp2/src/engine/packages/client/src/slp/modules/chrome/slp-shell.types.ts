// Shell contract, split out of components/slurp/SlurpShell.tsx in Slice 10.
import type { ReactNode, RefObject } from "react";
import type { NoodleAccount } from "@marinara-engine/shared";


export type NoodleShellView =
  "home" | "noodler" | "search" | "profile" | "messages" | "notifications" | "studio" | "wallet" | "settings" | null;
type NoodleShellMode = "noodle" | "noodler" | "slurp";
export type NoodleShellContextualRail = "populated" | "blank" | "spanning";

export interface NoodleShellProps {
  activeView: NoodleShellView;
  /** App identity is independent from the selected vertical-nav destination. */
  appMode?: NoodleShellMode;
  /** Overrides whether the Home/Hub destination is selected when app mode and subview are separate. */
  homeActive?: boolean;
  /** Posts published since this viewer persona last had the NoodleR or Slurp feed shown to it. */
  noodlerUnseenCount?: number;
  personaAccount: NoodleAccount | null;
  /**
   * The active persona's Creator identity, when it runs one. Shown as the main identity on the
   * switcher card, with the persona kept beside it as a small circle, because a persona that has
   * become a Creator is known to the feed by the Creator's name and face, not its own.
   *
   * Deliberately not folded into `personaAccount`: that account's id drives the switcher list
   * filter and the isCreator check, and this one carries the Creator's id instead.
   */
  creatorIdentity?: NoodleAccount | null;
  sortedPersonaAccounts: NoodleAccount[];
  visiblePersonaAccounts: NoodleAccount[];
  linkedNoodleAccountIds?: ReadonlySet<string>;
  /** Fan and follower totals keyed by persona id. Personas without a Creator profile are absent. */
  personaConnectionCounts?: Record<string, { fans: number; followers: number }>;
  /** Wallet balances keyed by persona id. */
  personaWallets?: Record<string, { coins: number }>;
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
  onOpenMessages?: () => void;
  /** Omit on surfaces with no scoped equivalent. */
  onOpenWallet?: () => void;
  onOpenStudio?: () => void;
  /** Unseen activity, shown on the unified Inbox entry. */
  notificationCount?: number;
  /** The studio only exists for a persona that operates a Creator. */
  hasOperatedCreator?: boolean;
  /** Shown on the desktop Wallet row and the identity card, so the balance is not mobile-only. */
  walletBalanceLabel?: string;
  /** Loaded numeric balance used for spend feedback; omitted while a placeholder is shown. */
  walletBalance?: number;
  /** Creator banner of the active persona, backing the identity card. Falls back to the accent gradient. */
  personaBannerUrl?: string | null;
  /** Offered on the identity card when the active persona runs no Creator profile. */
  onBecomeCreator?: () => void;
  /** Omit on surfaces with no scoped equivalent. */
  onCompose?: (opener: HTMLElement) => void;
  /** Replaces the desktop nav below the mark — used by Settings, which takes the column over. */
  desktopSidebar?: ReactNode;
  /** Optional right-hand rail (search box, suggestions, etc). Omitted entirely on surfaces that don't need one. */
  rightRail?: ReactNode;
  /** Wide-screen Slurp geometry: show a populated rail, reserve an empty rail, or let content span both columns. */
  contextualRail?: NoodleShellContextualRail;
  /** Theme-dependent overlays (lightboxes and modals) that must render inside the token scope. */
  overlays?: ReactNode;
  /** Accent hex driving `--noodle-accent` for every reused surface. NoodleR passes NOODLE_PINK; defaults to Noodle blue. */
  accent?: string;
  children: ReactNode;
}
