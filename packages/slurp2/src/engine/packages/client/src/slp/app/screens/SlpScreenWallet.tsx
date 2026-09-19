import { WalletCards } from "lucide-react";
import { ArrowDown, Crown, Gift, Lock, type LucideIcon, MessageCircle, RotateCcw } from "lucide-react";
import { Avatar } from "../../base/chrome/SlpChrome";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { SlurpCoin, SlurpCoinBurst } from "../../modules/coin/SlpCoin";
import { cn } from "../../../lib/utils";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { formatTime } from "../../base/ui/slp-date-time";
import { toast } from "sonner";
import {
  useClaimSlurpDailyRefill,
  useSetSlurpWalletCoinsForDevelopment,
  useSlurpPayout,
  useSlurpStudio,
  useSlurpWallet,
} from "../../features/economy/slp-economy-hooks";
import { useEffect, useState } from "react";
import { useNoodlerAccounts } from "../../features/creators/slp-creators-hooks";
import { useToggleNoodlerSubscription } from "../../features/feed/slp-feed-viewer-hooks";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { AvatarCrop } from "@marinara-engine/shared";
import { SlurpCoinAmount } from "../../modules/coin/SlpCoin";
import { NoodlerFrame } from "./SlpHomeHelpers";

export function SlurpWalletView({
  personaId,
  fallbackCoins,
  personaName,
  personaAvatarUrl,
  personaAvatarCrop,
  creatorAvatarCrop,
  onBack,
}: {
  personaId: string | null;
  /** Shown until the wallet loads, so the balance never flashes zero. */
  fallbackCoins: number;
  personaName: string;
  personaAvatarUrl: string | null;
  personaAvatarCrop: AvatarCrop | null;
  creatorAvatarCrop: AvatarCrop | null;
  onBack: () => void;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const walletQuery = useSlurpWallet(personaId);
  const studioQuery = useSlurpStudio(personaId);
  const claimRefill = useClaimSlurpDailyRefill();
  const setDevWalletCoins = useSetSlurpWalletCoinsForDevelopment();
  const payout = useSlurpPayout();
  const toggleSubscription = useToggleNoodlerSubscription();
  const [ledgerMode, setLedgerMode] = useState<"spending" | "earnings">("spending");
  const [countdownNow, setCountdownNow] = useState(() => Date.now());
  const [devCoins, setDevCoins] = useState("");
  // The wallet stores subscriptions by creator id. Rendering the raw id told the player nothing,
  // so join the managed profiles the same way every other Slurp surface names a creator.
  const creatorsQuery = useNoodlerAccounts();
  const creatorById = new Map((creatorsQuery.data ?? []).map((profile) => [profile.id, profile]));
  const creatorByHandle = new Map((creatorsQuery.data ?? []).map((profile) => [profile.handle, profile]));
  const wallet = walletQuery.data;
  const creator = studioQuery.data?.creators[0] ?? null;
  const coins = wallet?.coins ?? fallbackCoins;
  const subscriptions = wallet ? Object.entries(wallet.subscriptions) : [];
  // A spend/earn split is the one number the ledger cannot show at a glance.
  const spent = (wallet?.ledger ?? []).reduce((total, entry) => total + (entry.amount < 0 ? -entry.amount : 0), 0);
  const earned = (wallet?.ledger ?? []).reduce((total, entry) => total + (entry.amount > 0 ? entry.amount : 0), 0);
  const weeklyOutgoing = subscriptions.reduce((total, [, subscription]) => total + subscription.price, 0);
  const refillReady = wallet?.refillAvailable === true;
  useEffect(() => {
    if (!wallet?.nextRefillAt || refillReady) return;
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [refillReady, wallet?.nextRefillAt]);
  const refillRemaining = wallet?.nextRefillAt
    ? Math.max(0, new Date(wallet.nextRefillAt).getTime() - countdownNow)
    : null;
  const refillCountdown =
    refillRemaining === null
      ? null
      : `${String(Math.floor(refillRemaining / 3_600_000)).padStart(2, "0")}:${String(
          Math.floor((refillRemaining % 3_600_000) / 60_000),
        ).padStart(2, "0")}:${String(Math.floor((refillRemaining % 60_000) / 1_000)).padStart(2, "0")}`;
  const entryLabel = (kind: string) =>
    ledgerMode === "earnings"
      ? localizeUi(`ui.slurp.earnings.entry.${kind}`, { defaultValue: kind })
      : localizeUi(`ui.slurp.wallet.entry.${kind}`, { defaultValue: kind });
  const activityEntries = ledgerMode === "earnings" ? (creator?.earnings.ledger ?? []) : (wallet?.ledger ?? []);
  const entryNote = (kind: string, note?: string) => {
    if (!note) return null;
    const normalized = note.replace(/^(?:payout|renew|subscribe|tip):\s*/u, "");
    const profile = creatorById.get(normalized) ?? creatorByHandle.get(normalized);
    if (profile) return profile.displayName;
    if (kind === "unlock" || kind === "ppv" || /^[A-Za-z0-9_-]{16,}$/u.test(normalized)) return null;
    return normalized;
  };
  const entryAppearance = (kind: string): { icon: LucideIcon; tone: string } => {
    if (kind === "tip" || kind === "income") return { icon: Gift, tone: "bg-emerald-500/14 text-emerald-300" };
    if (kind === "unlock" || kind === "ppv") return { icon: Lock, tone: "bg-violet-500/14 text-violet-300" };
    if (kind === "subscribe" || kind === "renew") return { icon: Crown, tone: "bg-fuchsia-500/14 text-fuchsia-300" };
    if (kind === "payout" || kind === "topUp")
      return { icon: ArrowDown, tone: "bg-[var(--noodle-accent)]/14 text-[var(--noodle-accent)]" };
    if (kind === "reversal") return { icon: RotateCcw, tone: "bg-rose-500/14 text-rose-300" };
    if (kind === "commission" || kind === "messageRequest")
      return { icon: MessageCircle, tone: "bg-sky-500/14 text-sky-300" };
    return { icon: Gift, tone: "bg-amber-500/14 text-amber-300" };
  };
  return (
    <NoodlerFrame onBack={onBack} title={localizeUi("ui.slurp.navigation.wallet")} action={<span />}>
      <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-5 px-3 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center gap-3 px-1">
          <Avatar
            account={{
              displayName: creator?.displayName ?? personaName,
              avatarUrl: creator?.avatarUrl ?? personaAvatarUrl,
              avatarCrop: creator ? creatorAvatarCrop : personaAvatarCrop,
            }}
            size="md"
          />
          <div className="min-w-0">
            <p className="break-words text-lg font-black leading-tight">{localizeUi("ui.slurp.navigation.wallet")}</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              {creator
                ? localizeUi("ui.slurp.wallet.creatorIdentity", { defaultValue: "Creator · Fan" })
                : localizeUi("ui.slurp.wallet.fanIdentity", { defaultValue: "Fan wallet" })}
            </p>
          </div>
        </div>

        <section className="relative isolate overflow-hidden rounded-2xl bg-[var(--slurp-surface)] shadow-[0_1px_0_rgba(255,255,255,0.06),0_24px_52px_-40px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-white/[0.055]">
          {creator && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--noodle-accent)_8%,var(--slurp-surface)),color-mix(in_srgb,var(--slurp-surface)_97%,black))] px-4 pb-8 pt-5 sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--muted-foreground)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-500/12 text-fuchsia-300">
                    <SlurpCoin size={18} />
                  </span>
                  <span>{localizeUi("ui.slurp.wallet.creatorEarnings", { defaultValue: "Creator earnings" })}</span>
                  <HelpTooltip
                    side="bottom"
                    text={localizeUi("ui.slurp.wallet.creatorEarningsHelp", {
                      defaultValue:
                        "Coins earned through your creator page stay here until you move them into your Fan wallet.",
                    })}
                  />
                </div>
                <SlurpCoinAmount
                  amount={creator.earnings.coins.toLocaleString()}
                  watchAmount={creator.earnings.coins}
                  className="mt-2 text-4xl font-black leading-none tabular-nums"
                  size={28}
                />
                <p className="mt-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.wallet.creatorEarningsSource", { defaultValue: "From your creator page" })}
                </p>
              </div>
              <span className="rounded-full bg-black/12 px-3 py-2 text-xs font-black tabular-nums text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/25">
                {localizeUi("ui.slurp.wallet.availableAmount", {
                  defaultValue: "{{amount}} available",
                  amount: creator.payoutAllowance.toLocaleString(),
                })}
              </span>
            </div>
          )}
          {creator && (
            <div className="absolute inset-x-0 z-10 flex -translate-y-1/2 justify-center">
              <button
                type="button"
                disabled={!personaId || payout.isPending || creator.payoutAllowance <= 0}
                onClick={() =>
                  personaId &&
                  payout.mutate(
                    { creatorAccountId: creator.id, personaId, amount: creator.payoutAllowance },
                    { onError: (error) => toast.error(errorMessage(error)) },
                  )
                }
                className="relative inline-flex min-h-11 items-center justify-center gap-2 overflow-visible rounded-full bg-[var(--noodle-accent)] px-6 text-xs font-black text-zinc-950 [&_svg]:!text-zinc-950 shadow-[0_12px_28px_-16px_var(--noodle-accent)] transition-[opacity,transform] hover:opacity-90 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--slurp-surface)] disabled:opacity-45 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <SlurpCoinBurst active={payout.isPending} direction="earn" />
                <ArrowDown size={16} strokeWidth={2.5} aria-hidden="true" />
                {payout.isPending
                  ? localizeUi("ui.slurp.wallet.moving", { defaultValue: "Moving…" })
                  : localizeUi("ui.slurp.wallet.moveToWallet", { defaultValue: "Move to Wallet" })}
              </button>
            </div>
          )}
          <div
            className={cn(
              "flex items-center justify-between gap-4 bg-[linear-gradient(120deg,color-mix(in_srgb,var(--slurp-violet)_7%,var(--slurp-surface)),var(--slurp-surface))] px-4 pb-5 sm:px-6 sm:pb-6",
              creator ? "pt-8" : "pt-5",
            )}
          >
            <div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--muted-foreground)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/14 text-sky-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                  <WalletCards size={16} strokeWidth={2} aria-hidden="true" />
                </span>
                <span>{localizeUi("ui.slurp.wallet.fanWallet", { defaultValue: "Fan wallet" })}</span>
                <HelpTooltip
                  side="bottom"
                  text={localizeUi("ui.slurp.wallet.fanWalletHelp", {
                    defaultValue: "This is your spendable balance for subscriptions, tips, and locked posts.",
                  })}
                />
              </div>
              <p className="mt-2 flex items-center gap-2 text-4xl font-black leading-none tabular-nums">
                <SlurpCoinAmount amount={coins.toLocaleString()} watchAmount={coins} size={26} />
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.wallet.readyToSpend", { defaultValue: "Ready to spend" })}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <button
                type="button"
                disabled={!refillReady || !personaId || claimRefill.isPending}
                onClick={() => personaId && claimRefill.mutate({ personaId })}
                className="relative flex min-h-11 items-center gap-2 overflow-visible rounded-full border border-[var(--slurp-violet)]/45 px-4 text-xs font-bold text-[var(--slurp-violet)] transition-[background-color,transform] hover:bg-[var(--slurp-violet)]/10 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-65 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <SlurpCoinBurst active={claimRefill.isPending} direction="earn" />
                <Gift size={16} aria-hidden="true" />
                {claimRefill.isPending
                  ? localizeUi("ui.slurp.wallet.refilling", { defaultValue: "Claiming…" })
                  : localizeUi("ui.slurp.wallet.dailyRefill", { defaultValue: "Daily refill" })}
              </button>
              <span className="flex items-center gap-1 text-xs tabular-nums text-[var(--muted-foreground)]">
                {refillReady
                  ? localizeUi("ui.slurp.wallet.refillReady", { defaultValue: "Ready now" })
                  : localizeUi("ui.slurp.wallet.refillCountdown", {
                      defaultValue: "Next check in {{countdown}}",
                      countdown: refillCountdown ?? "—",
                    })}
                <HelpTooltip
                  side="left"
                  text={localizeUi("ui.slurp.wallet.refillHelp", {
                    defaultValue:
                      "Once per Slurp day, you can refill when your Fan wallet is below {{amount}} coins. The countdown shows the next eligibility check.",
                    amount: wallet?.refillFloor ?? 0,
                  })}
                />
              </span>
            </div>
          </div>
        </section>

        {wallet?.cheatsEnabled && personaId && (
          <section className="rounded-lg border border-amber-500/35 bg-amber-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-300">Development wallet</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Set the active Fan balance for testing.</p>
              </div>
              <form
                className="flex min-w-0 items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const coinsValue = Number(devCoins);
                  if (!Number.isSafeInteger(coinsValue) || coinsValue < 0) return;
                  setDevWalletCoins.mutate(
                    { personaId, coins: coinsValue },
                    {
                      onSuccess: () => {
                        setDevCoins("");
                      },
                      onError: (error) => toast.error(errorMessage(error)),
                    },
                  );
                }}
              >
                <label className="sr-only" htmlFor="slurp-dev-coins">
                  Fan balance
                </label>
                <input
                  id="slurp-dev-coins"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={devCoins}
                  onChange={(event) => setDevCoins(event.target.value)}
                  placeholder={String(coins)}
                  className="h-10 w-28 rounded-lg border border-amber-500/35 bg-[var(--background)] px-3 text-sm tabular-nums"
                />
                <button
                  type="submit"
                  disabled={setDevWalletCoins.isPending || devCoins.trim() === ""}
                  className="min-h-10 rounded-lg bg-amber-400 px-3 text-xs font-black text-zinc-950 disabled:opacity-50"
                >
                  {setDevWalletCoins.isPending ? "Setting..." : "Set coins"}
                </button>
              </form>
            </div>
          </section>
        )}

        {creator && (
          <div
            className="mx-auto grid w-full max-w-xs grid-cols-2 rounded-full bg-[var(--slurp-surface-raised)] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)]"
            role="tablist"
            aria-label={localizeUi("ui.slurp.wallet.history", { defaultValue: "Wallet history" })}
          >
            {(["spending", "earnings"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                id={`slurp-wallet-history-${mode}-tab`}
                aria-selected={ledgerMode === mode}
                aria-controls="slurp-wallet-history-panel"
                tabIndex={ledgerMode === mode ? 0 : -1}
                onClick={() => setLedgerMode(mode)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  const next = mode === "spending" ? "earnings" : "spending";
                  setLedgerMode(next);
                  event.currentTarget.parentElement
                    ?.querySelector<HTMLButtonElement>(`button[data-wallet-history="${next}"]`)
                    ?.focus();
                }}
                data-wallet-history={mode}
                className={cn(
                  "min-h-10 rounded-full px-3 text-sm font-semibold text-[var(--muted-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]",
                  ledgerMode === mode &&
                    "bg-[var(--slurp-surface)] text-[var(--noodle-accent)] shadow-[var(--slurp-shadow-raised)]",
                )}
              >
                {mode === "spending"
                  ? localizeUi("ui.slurp.wallet.spending", { defaultValue: "Spending" })
                  : localizeUi("ui.slurp.wallet.earnings", { defaultValue: "Earnings" })}
              </button>
            ))}
          </div>
        )}

        {ledgerMode === "spending" && (
          <section aria-labelledby="slurp-wallet-subscriptions" className="px-1">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="slurp-wallet-subscriptions" className="text-sm font-bold">
                {localizeUi("ui.slurp.wallet.subscriptions", { defaultValue: "Subscriptions" })}
              </h2>
              {weeklyOutgoing > 0 && (
                <span className="text-xs font-bold tabular-nums text-[var(--muted-foreground)]">
                  {localizeUi("ui.slurp.wallet.weeklyOutgoing", {
                    defaultValue: "{{amount}} / week",
                    amount: weeklyOutgoing,
                  })}
                </span>
              )}
            </div>
            {subscriptions.length > 0 ? (
              <ul className="mt-2 flex snap-x gap-2.5 overflow-x-auto pb-2 pe-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {subscriptions.map(([creatorId, subscription]) => (
                  <li
                    key={creatorId}
                    className="flex min-w-[13.5rem] max-w-[16rem] flex-1 snap-start items-center gap-2.5 rounded-full bg-[var(--slurp-surface)]/55 py-2 ps-2 pe-3 ring-1 ring-inset ring-white/[0.055]"
                  >
                    <Avatar
                      account={{
                        displayName:
                          creatorById.get(creatorId)?.displayName ??
                          localizeUi("ui.slurp.wallet.unknownCreator", { defaultValue: "Unavailable Creator" }),
                        avatarUrl: creatorById.get(creatorId)?.avatarUrl ?? null,
                        avatarCrop: creatorById.get(creatorId)?.avatarCrop ?? null,
                      }}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-xs font-semibold">
                        {creatorById.get(creatorId)?.displayName ??
                          localizeUi("ui.slurp.wallet.unknownCreator", { defaultValue: "Unavailable Creator" })}
                      </span>
                      <span className="text-[0.7rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.slurp.wallet.renewsOn", {
                          defaultValue: "Renews {{date}}",
                          date: formatTime(subscription.paidThroughAt, i18n.language),
                        })}
                      </span>
                    </span>
                    <span className="ms-auto flex shrink-0 flex-col items-end">
                      <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                        <SlurpCoinAmount amount={`${subscription.price} / week`} />
                      </span>
                      <button
                        type="button"
                        disabled={!personaId || toggleSubscription.isPending}
                        onClick={() =>
                          personaId &&
                          toggleSubscription.mutate({ creatorAccountId: creatorId, personaId, subscribed: true })
                        }
                        className="min-h-6 px-1 text-[0.65rem] font-semibold text-[var(--muted-foreground)] transition-[color,transform] hover:text-[var(--foreground)] active:scale-[0.96] focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:active:scale-100"
                      >
                        {localizeUi("ui.slurp.wallet.unsubscribe", { defaultValue: "Cancel" })}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.wallet.noSubscriptions", {
                  defaultValue: "Your active subscriptions will appear here.",
                })}
              </p>
            )}
          </section>
        )}

        <section
          id="slurp-wallet-history-panel"
          aria-labelledby={`slurp-wallet-history-${ledgerMode}-tab`}
          role="tabpanel"
          className="px-1 pb-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="slurp-wallet-activity" className="text-sm font-bold">
              {localizeUi("ui.slurp.wallet.activity", { defaultValue: "Recent activity" })}
            </h2>
            {ledgerMode === "spending" && (spent > 0 || earned > 0) && (
              <span className="text-xs font-bold tabular-nums text-[var(--muted-foreground)]">
                {localizeUi("ui.slurp.wallet.spentEarned", {
                  defaultValue: "-{{spent}} / +{{earned}}",
                  spent,
                  earned,
                })}
              </span>
            )}
          </div>
          {activityEntries.length > 0 ? (
            <ul className="mt-2 flex flex-col divide-y divide-white/[0.045]">
              {activityEntries.map((entry, index) => {
                const appearance = entryAppearance(entry.kind);
                const EntryIcon = appearance.icon;
                return (
                  <li key={`${entry.at}-${index}`} className="flex min-h-[4.25rem] items-center gap-3 py-2.5">
                    <span
                      className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", appearance.tone)}
                    >
                      <EntryIcon size={17} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">
                        {entry.kind === "topUp" && entry.note?.startsWith("payout:")
                          ? localizeUi("ui.slurp.wallet.entry.payout", {
                              defaultValue: "Moved from Creator earnings",
                            })
                          : entryLabel(entry.kind)}
                      </span>
                      <span className="block truncate text-xs text-[var(--muted-foreground)]">
                        {[entryNote(entry.kind, entry.note), formatTime(entry.at, i18n.language)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 text-sm font-black tabular-nums",
                        entry.amount > 0 && ledgerMode === "earnings"
                          ? "text-[var(--slurp-success)]"
                          : "text-[var(--foreground)]",
                      )}
                    >
                      <SlurpCoinAmount amount={entry.amount > 0 ? `+${entry.amount}` : entry.amount} size={16} />
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
              {ledgerMode === "earnings"
                ? localizeUi("ui.slurp.earnings.activityEmpty", {
                    defaultValue: "Creator earnings will show up here.",
                  })
                : localizeUi("ui.slurp.wallet.activityEmpty", {
                    defaultValue: "Unlocks and subscriptions paid with coins will show up here.",
                  })}
            </p>
          )}
        </section>
      </div>
    </NoodlerFrame>
  );
}
