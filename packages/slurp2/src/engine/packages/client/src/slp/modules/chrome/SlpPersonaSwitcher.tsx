// Persona identity card and switcher list, split out of components/slurp/SlurpShell.tsx in Slice 10.
import { AtSign, ChevronDown, Sparkles, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { NoodleAccount } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";
import { useSlurpMediaSrc } from "../../base/media/slp-media-src";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpCoinAmount } from "../coin/SlpCoin";
import { Avatar, initials, NOODLE_PERSONA_SWITCHER_PAGE_SIZE, ProfileInitial } from "../../base/chrome/SlpChrome";

/**
 * The active identity as a card rather than a selected row: switching persona changes whose
 * feed, whose fans, and whose balance you are looking at, so it deserves more than a radio dot.
 */
export function PersonaIdentityCard({
  account,
  personaBadge,
  bannerUrl,
  counts,
  balanceLabel,
  walletBalance,
  isCreator,
  onOpenProfile,
  onBecomeCreator,
}: {
  account: NoodleAccount | null;
  /** The persona behind a Creator identity. Null when the two are the same account. */
  personaBadge?: NoodleAccount | null;
  bannerUrl?: string | null;
  counts?: { fans: number; followers: number };
  balanceLabel?: string;
  walletBalance?: number;
  isCreator: boolean;
  onOpenProfile?: () => void;
  onBecomeCreator?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const bannerSrc = useSlurpMediaSrc(bannerUrl ?? null, { width: 640 });
  // A creator reaches their own room through the card itself, so only the invitation stays.
  const action = isCreator ? undefined : onBecomeCreator;
  return (
    <div className="overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised)] ring-1 ring-inset ring-[var(--noodle-divider)]">
      {/* Banners are wide art: a 3:1 frame shows them the way the profile does, instead of a thin
          strip washed out by a full-height fade. */}
      <div className="relative aspect-[3/1] min-h-16 overflow-hidden">
        {bannerSrc ? (
          <img src={bannerSrc} alt="" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="block h-full w-full bg-[var(--slurp-hero)] opacity-80" aria-hidden="true" />
        )}
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[var(--slurp-surface-raised)] to-transparent"
          aria-hidden="true"
        />
      </div>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onOpenProfile}
          disabled={!onOpenProfile}
          className="-mt-6 flex w-full flex-col items-start rounded-lg text-left disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
        >
          {account ? (
            <span className="relative shrink-0 rounded-full ring-[3px] ring-[var(--slurp-surface-raised)]">
              <Avatar account={account} />
              {personaBadge && (
                <span
                  className="absolute -bottom-1 -end-1 rounded-full ring-2 ring-[var(--slurp-surface-raised)]"
                  title={personaBadge.displayName}
                >
                  <Avatar account={personaBadge} size="xs" />
                </span>
              )}
            </span>
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 ring-[3px] ring-[var(--slurp-surface-raised)]">
              <AtSign size={24} className="text-[var(--noodle-accent)]" />
            </span>
          )}
          {/* Name sits below the avatar on the plain card, never over the banner art. */}
          <span className="mt-1.5 block w-full min-w-0">
            <span className="block truncate text-sm font-black leading-5" title={account?.displayName}>
              {account?.displayName ?? localizeUi("ui.noodle.noodleshell.noodleAccount")}
            </span>
            <span className="block truncate text-xs leading-4 text-[var(--muted-foreground)]">
              {account ? `@${account.handle}` : localizeUi("ui.noodle.noodleshell.pickAPersonaBelow")}
            </span>
            {/* Only when it adds something: "Browsing as <the name right above>" repeated the title. */}
            {personaBadge && (
              <span className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.account.managingAs", {
                  defaultValue: "Managing as {{persona}}",
                  persona: personaBadge.displayName,
                })}
              </span>
            )}
          </span>
        </button>
        <div className="mt-2 flex items-center justify-between gap-2">
          <PersonaConnectionCounts counts={counts} />
          {balanceLabel && (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold tabular-nums text-[var(--muted-foreground)]">
              <SlurpCoinAmount amount={balanceLabel} watchAmount={walletBalance} size={16} />
            </span>
          )}
        </div>
        {action && (
          <button
            type="button"
            onClick={action}
            className="mt-3 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--noodle-accent)]/12 text-xs font-bold text-[var(--noodle-accent-foreground)] ring-1 ring-inset ring-[var(--noodle-accent)]/30 transition-colors hover:bg-[var(--noodle-accent)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
          >
            <Sparkles size={14} />
            {localizeUi("ui.slurp.account.becomeCreator", { defaultValue: "Become a creator" })}
          </button>
        )}
      </div>
    </div>
  );
}

/** The full list, shown only when the face pile overflows and the reader asks for it. */
export function PersonaList({
  accounts,
  activeId,
  counts,
  linkedIds,
  wallets,
  onSwitch,
}: {
  accounts: NoodleAccount[];
  activeId?: string | null;
  counts?: Record<string, { fans: number; followers: number }>;
  linkedIds?: ReadonlySet<string>;
  wallets?: Record<string, { coins: number }>;
  onSwitch: (account: NoodleAccount) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (accounts.length === 0) {
    return (
      <p className="px-2 py-3 text-xs text-[var(--muted-foreground)]">
        {localizeUi("ui.noodle.noodleshell.noPersonaAccountsYet")}
      </p>
    );
  }
  return (
    <div className="max-h-[min(60vh,26rem)] space-y-1 overflow-y-auto">
      {accounts.map((account) => {
        const selected = account.id === activeId;
        return (
          <button
            key={account.id}
            data-noodle-persona-id={account.entityId}
            type="button"
            // The active persona was signalled by background colour alone.
            aria-current={selected ? "true" : undefined}
            onClick={() => onSwitch(account)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--accent)]",
              selected && "bg-[var(--noodle-accent)]/10",
            )}
          >
            <Avatar account={account} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{account.displayName}</span>
              <span className="block truncate text-xs text-[var(--muted-foreground)]">@{account.handle}</span>
              <PersonaConnectionCounts counts={counts?.[account.entityId]} />
              {wallets?.[account.entityId] && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-[var(--muted-foreground)]">
                  <SlurpCoinAmount
                    amount={wallets[account.entityId].coins}
                    watchAmount={wallets[account.entityId].coins}
                    size={16}
                  />
                </span>
              )}
              {linkedIds?.has(account.id) && (
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
  );
}

/** "12 Fans | 8 Followers" under a persona row. Renders nothing without a Creator profile. */
export function PersonaConnectionCounts({ counts }: { counts?: { fans: number; followers: number } }) {
  const { t: localizeUi } = useUiTranslation();
  if (!counts) return null;
  return (
    <span className="mt-0.5 flex items-center gap-1.5 text-[0.68rem] text-[var(--muted-foreground)]">
      <span className="tabular-nums">{localizeUi("ui.slurp.account.fans", { amount: counts.fans })}</span>
      <span aria-hidden="true" className="h-3 w-px bg-[var(--noodle-divider)]" />
      <span className="tabular-nums">{localizeUi("ui.slurp.account.followers", { amount: counts.followers })}</span>
    </span>
  );
}
