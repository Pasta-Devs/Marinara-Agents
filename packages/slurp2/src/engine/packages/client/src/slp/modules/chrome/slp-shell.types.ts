import type { SlpPulseBudgetNote, SlpPulsePanel } from "./SlpPulse";
import type { SlpPulseTarget } from "../../base/state/slp-task-store";
// Shell contract, split out of components/slurp/SlurpShell.tsx in Slice 10.
import type { ComponentProps, ReactNode, RefObject } from "react";
import type { SlpAccount } from "../../../../../shared/src/slp/slp-social.types.js";
import type { SlpStoryRings } from "../story/SlpStoryRing";

export type SlpShellView =
  "home" | "noodler" | "search" | "profile" | "messages" | "notifications" | "stir" | "wallet" | "settings" | null;
type SlpShellMode = "noodle" | "noodler" | "slurp";
export type SlpShellContextualRail = "populated" | "blank" | "spanning";

export interface SlpShellProps {
  activeView: SlpShellView;
  /** App identity is independent from the selected vertical-nav destination. */
  appMode?: SlpShellMode;
  /** Overrides whether the Home/Hub destination is selected when app mode and subview are separate. */
  homeActive?: boolean;
  /** Posts published since this viewer persona last had the NoodleR or Slurp feed shown to it. */
  noodlerUnseenCount?: number;
  personaAccount: SlpAccount | null;
  /**
   * The active persona's Creator identity, when it runs one. Shown as the main identity on the
   * switcher card, with the persona kept beside it as a small circle, because a persona that has
   * become a Creator is known to the feed by the Creator's name and face, not its own.
   *
   * Deliberately not folded into `personaAccount`: that account's id drives the switcher list
   * filter and the isCreator check, and this one carries the Creator's id instead.
   */
  creatorIdentity?: SlpAccount | null;
  sortedPersonaAccounts: SlpAccount[];
  visiblePersonaAccounts: SlpAccount[];
  linkedNoodleAccountIds?: ReadonlySet<string>;
  /** Fan and follower totals keyed by persona id. Personas without a Creator profile are absent. */
  personaConnectionCounts?: Record<string, { fans: number; followers: number }>;
  /** Wallet balances keyed by persona id. */
  personaWallets?: Record<string, { coins: number }>;
  onLoadMorePersonaAccounts: () => void;
  onSwitchPersona: (account: SlpAccount, mobile: boolean) => void;
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
  /** The own page's Dashboard, a row under the identity card in More; absent without a Creator page. */
  onOpenDashboard?: () => void;
  onOpenSettings: () => void;
  /** Omit on surfaces with no scoped equivalent. */
  onOpenMessages?: () => void;
  /** Omit on surfaces with no scoped equivalent. */
  onOpenWallet?: () => void;
  /** The Stir tab (W): the centre of the phone nav, a row in the desktop sidebar. */
  onOpenStir?: () => void;
  /** One-time Pulse note after the AI budget defaults went up (task F); absent once seen. */
  budgetNote?: SlpPulseBudgetNote;
  /** Pulse's tap-through (task C): a task's post, chat or Creator. */
  onOpenPulseTarget?: (target: SlpPulseTarget) => void;
  /** Pulse's "AI budget" link. */
  onOpenBudget?: () => void;
  /** Pulse's quick "Generate posts" chip and "Start it again from …" on restored failed tasks. */
  pulseStarts?: Pick<ComponentProps<typeof SlpPulsePanel>, "onGeneratePosts" | "onStartAgain">;
  /** Unseen activity, shown on the unified Inbox entry. */
  notificationCount?: number;
  /** Shown on the desktop Wallet row and the identity card, so the balance is not mobile-only. */
  walletBalanceLabel?: string;
  /** Loaded numeric balance used for spend feedback; omitted while a placeholder is shown. */
  walletBalance?: number;
  /** Creator banner of the active persona, backing the identity card. Falls back to the accent gradient. */
  personaBannerUrl?: string | null;
  /** Offered on the identity card when the active persona runs no Creator profile. */
  onBecomeCreator?: () => void;
  /** Replaces the desktop nav below the mark — used by Settings, which takes the column over. */
  desktopSidebar?: ReactNode;
  /** Optional right-hand rail (search box, suggestions, etc). Omitted entirely on surfaces that don't need one. */
  rightRail?: ReactNode;
  /** Wide-screen Slurp geometry: show a populated rail, reserve an empty rail, or let content span both columns. */
  contextualRail?: SlpShellContextualRail;
  /** Theme-dependent overlays (lightboxes and modals) that must render inside the token scope. */
  overlays?: ReactNode;
  /** Accent hex driving `--noodle-accent` for every reused surface. NoodleR passes SLP_PINK; defaults to Noodle blue. */
  accent?: string;
  /** Who has a live Story and how to open it: every avatar under the shell wears the ring (T). */
  storyRings?: SlpStoryRings;
  children: ReactNode;
}
