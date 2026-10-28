import { useEffect, useRef, useState } from "react";
import { formatSlpDollars } from "../../base/ui/slp-number-format";
import { ArrowDown, Crown, Dices, Gift, type LucideIcon, MessageCircle, ReceiptText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { AvatarCrop } from "@marinara-engine/shared";
import { SlpLockGlyph } from "../../base/chrome/SlpGlyphs";
import { Avatar, SLP_EYEBROW_CLASS, SLP_GROUP_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { SlurpCoinAmount, SlpCoinText } from "../../modules/coin/SlpCoin";
import { playSlpBurst, playSlpCoinRain, SlpShimmer } from "../../modules/sparkle/SlpSparkle";
import { cn } from "../../../lib/utils";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import {
  formatClockTime,
  formatDayHeading,
  formatFullTime,
  formatUpcomingDay,
  groupSlpByDay,
  slpDayKey,
} from "../../base/ui/slp-date-time";
import {
  useClaimSlurpDailyRefill,
  useSetSlurpWalletCoinsForDevelopment,
  useSlurpStudio,
  useSlurpWallet,
} from "../../features/economy/slp-economy-hooks";
import { useCreatorAccounts } from "../../features/creators/slp-creators-hooks";
import { useToggleCreatorSubscription } from "../../features/feed/slp-feed-viewer-hooks";
import { SlpButton, SlpSegment } from "../../modules/chrome/SlpButton";
import { SlpEmptyState, SlpErrorState, SlpSkeleton } from "../../modules/chrome/SlpStateKit";
import { showSlpSubscriptionCancelledToast } from "../../modules/chrome/slp-subscription-toast";
import { SlpCreatorFrame } from "./SlpHomeHelpers";
import { SlpCollectCard } from "./SlpCollectCard";

type LedgerEntry = { kind: string; amount: number; at: string; note?: string; binding?: { creatorAccountId: string } };

// Icon tiles in tokens only (design language §2): money warm, spends on Creators pink, locks violet.
const TONE = {
  success: "bg-[color-mix(in_srgb,var(--slurp-success)_14%,transparent)] text-[var(--slurp-success)]",
  pink: "bg-[var(--slurp-tint)] text-[var(--slurp-ink)]",
  violet: "bg-[color-mix(in_srgb,var(--slurp-violet)_14%,transparent)] text-[var(--slurp-violet)]",
  warm: "bg-[color-mix(in_srgb,var(--slurp-warm)_14%,transparent)] text-[var(--slurp-warm)]",
  danger: "bg-[color-mix(in_srgb,var(--slurp-danger)_12%,transparent)] text-[var(--slurp-danger)]",
} as const;

function entryAppearance(kind: string, gamble: boolean): { icon: LucideIcon; tone: string } {
  if (gamble) return { icon: Dices, tone: TONE.warm };
  if (kind === "tip" || kind === "income" || kind === "sponsor") return { icon: Gift, tone: TONE.success };
  if (kind === "unlock" || kind === "ppv") return { icon: SlpLockGlyph, tone: TONE.violet };
  if (kind === "subscribe" || kind === "renew") return { icon: Crown, tone: TONE.pink };
  if (kind === "payout" || kind === "topUp") return { icon: ArrowDown, tone: TONE.warm };
  if (kind === "reversal") return { icon: RotateCcw, tone: TONE.danger };
  if (kind === "commission" || kind === "messageRequest") return { icon: MessageCircle, tone: TONE.pink };
  return { icon: Gift, tone: TONE.warm };
}

export function SlurpWalletView({
  personaId,
  personaName,
  onBack,
}: {
  personaId: string | null;
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
  const toggleSubscription = useToggleCreatorSubscription();
  const [ledgerMode, setLedgerMode] = useState<"spending" | "earnings">("spending");
  const [devCoins, setDevCoins] = useState("");
  // The wallet stores subscriptions by creator id. Rendering the raw id told the player nothing,
  // so join the managed profiles the same way every other Slurp surface names a creator.
  const creatorsQuery = useCreatorAccounts();
  const creatorById = new Map((creatorsQuery.data ?? []).map((profile) => [profile.id, profile]));
  const creatorByHandle = new Map((creatorsQuery.data ?? []).map((profile) => [profile.handle, profile]));
  const wallet = walletQuery.data;
  const creator = studioQuery.data?.creators[0] ?? null;
  const liveCoins = wallet?.coins;

  // Coin rain when the balance goes up (collect, refill); the amount counts up by itself.
  const balanceRef = useRef<HTMLParagraphElement | null>(null);
  const shownCoins = useRef<{ personaId: string | null; coins: number | undefined }>({
    personaId: null,
    coins: undefined,
  });
  useEffect(() => {
    // Switching to a richer persona is not money arriving: the baseline resets per persona (R1-099).
    const previous = shownCoins.current.personaId === personaId ? shownCoins.current.coins : undefined;
    shownCoins.current = { personaId, coins: liveCoins };
    if (previous !== undefined && liveCoins !== undefined && liveCoins > previous && balanceRef.current)
      playSlpCoinRain(balanceRef.current);
  }, [liveCoins, personaId]);

  // The refill line names a calm clock time ("Next refill 5:48 AM"); at that time the wallet is read
  // again, so the refill button turns on by itself.
  const refillReady = wallet?.refillAvailable === true;
  const nextRefillAt = wallet?.nextRefillAt;
  const refetchWallet = walletQuery.refetch;
  useEffect(() => {
    if (!nextRefillAt || refillReady) return;
    // Clamped to the 32-bit timer limit; a later boundary re-arms after the next read.
    const wait = Math.min(Math.max(0, new Date(nextRefillAt).getTime() - Date.now()) + 500, 2_000_000_000);
    const timer = window.setTimeout(() => void refetchWallet(), wait);
    return () => window.clearTimeout(timer);
  }, [nextRefillAt, refillReady, refetchWallet]);

  const creatorName = (entry: LedgerEntry) => {
    const id = entry.binding?.creatorAccountId;
    if (id && creatorById.has(id)) return creatorById.get(id)!;
    if (!entry.note) return null;
    const normalized = entry.note.replace(/^(?:payout|renew|subscribe|tip|gamble|unlock):\s*/u, "");
    return creatorById.get(normalized) ?? creatorByHandle.get(normalized) ?? null;
  };
  const entryNote = (entry: LedgerEntry) => {
    const profile = creatorName(entry);
    if (profile) return profile.displayName;
    if (!entry.note || entry.kind === "unlock" || entry.kind === "ppv" || entry.kind === "topUp") return null;
    const normalized = entry.note.replace(/^(?:payout|renew|subscribe|tip|refund):\s*/u, "");
    return /^[A-Za-z0-9_-]{16,}$/u.test(normalized) ? null : normalized;
  };

  // No balance is shown until the wallet has really loaded: a made-up number reads as real money.
  if (!wallet) {
    return (
      <SlpCreatorFrame onBack={onBack} title={localizeUi("ui.slurp.navigation.wallet")} action={<span />}>
        <div className="mx-auto w-full max-w-[40rem] px-3 py-4 sm:px-5">
          {walletQuery.isError || !personaId ? (
            <SlpErrorState
              title={localizeUi("ui.slurp.wallet.loadError", { defaultValue: "Could not load your wallet" })}
              onRetry={() => void walletQuery.refetch()}
            />
          ) : (
            <SlpSkeleton shape="card" />
          )}
        </div>
      </SlpCreatorFrame>
    );
  }

  const coins = wallet.coins;
  const subscriptions = Object.entries(wallet.subscriptions);
  const weeklyOutgoing = subscriptions.reduce(
    (total, [, subscription]) => total + (subscription.cancelled ? 0 : subscription.price),
    0,
  );
  const day = (iso: string) => formatUpcomingDay(iso, i18n.language);
  const setSubscription = (creatorAccountId: string, cancel: boolean) =>
    personaId
      ? toggleSubscription.mutateAsync({ creatorAccountId, personaId, subscribed: cancel })
      : Promise.reject(new Error("No persona"));
  const resume = (creatorAccountId: string, origin?: DOMRect) =>
    setSubscription(creatorAccountId, false).then(
      () => {
        if (origin) playSlpBurst(origin);
        toast.success(localizeUi("ui.slurp.profile.subscriptionResumed", { defaultValue: "Subscription resumed" }));
      },
      () =>
        toast.error(
          localizeUi("ui.slurp.wallet.resumeFailed", { defaultValue: "Could not resume. Try again in a moment." }),
        ),
    );
  // One tap cancels; the toast offers Undo, which resumes inside the paid week (no charge).
  const cancel = (creatorAccountId: string, paidThroughAt: string) =>
    setSubscription(creatorAccountId, true).then(
      () =>
        showSlpSubscriptionCancelledToast({
          localizeUi,
          endsDay: day(paidThroughAt),
          onUndo: () => resume(creatorAccountId),
        }),
      () =>
        toast.error(
          localizeUi("ui.slurp.wallet.cancelFailed", {
            defaultValue: "Could not cancel. Your subscription is unchanged.",
          }),
        ),
    );

  const activityEntries: LedgerEntry[] = [
    ...(ledgerMode === "earnings" ? (creator?.earnings.ledger ?? []) : wallet.ledger),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const entryLabel = (entry: LedgerEntry) =>
    ledgerMode === "earnings"
      ? localizeUi(`ui.slurp.earnings.entry.${entry.kind}`, { defaultValue: entry.kind })
      : // A refund is money back, not income; a 0-coin renewal is a subscription that ended (R1-088, R1-089).
        entry.kind === "income" && entry.note?.startsWith("refund:")
        ? localizeUi("ui.slurp.wallet.entry.refund", { defaultValue: "Refund" })
        : entry.kind === "renew" && entry.amount === 0
          ? localizeUi("ui.slurp.wallet.entry.subscriptionEnded", { defaultValue: "Subscription ended" })
          : localizeUi(`ui.slurp.wallet.entry.${entry.kind}`, { defaultValue: entry.kind });

  const refillLine = refillReady
    ? localizeUi("ui.slurp.wallet.refillReady", { defaultValue: "Your refill is ready." })
    : nextRefillAt
      ? localizeUi("ui.slurp.wallet.refillCountdown", {
          defaultValue: "Next refill {{time}}",
          // Today: the clock time only; a later day names the weekday first.
          time:
            slpDayKey(nextRefillAt) === slpDayKey(Date.now())
              ? formatClockTime(nextRefillAt, i18n.language)
              : `${formatUpcomingDay(nextRefillAt, i18n.language)} ${formatClockTime(nextRefillAt, i18n.language)}`,
        })
      : null;
  // The page header already says "Wallet", so the card names whose wallet it is.
  const walletTitle = personaName.trim()
    ? localizeUi("ui.slurp.wallet.personaWallet", { defaultValue: "{{name}}'s wallet", name: personaName.trim() })
    : localizeUi("ui.slurp.navigation.wallet");

  return (
    <SlpCreatorFrame onBack={onBack} title={localizeUi("ui.slurp.navigation.wallet")} action={<span />}>
      <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-3 px-3 pb-8 pt-4 sm:px-5 sm:pt-5">
        {/* The one hero-gradient moment on this screen (design language §2): the balance you spend. */}
        <section
          aria-label={localizeUi("ui.slurp.navigation.wallet")}
          className="relative isolate overflow-hidden rounded-[20px] bg-[image:var(--slurp-hero)] px-5 pb-5 pt-4 text-[var(--slurp-on-hero)] shadow-[0_22px_44px_-26px_var(--noodle-accent),inset_0_1px_0_rgb(255_255_255/0.22)] [text-shadow:0_1px_2px_rgb(60_0_30/0.35)]"
          data-slurp-wallet-card
        >
          <SlpShimmer />
          <p className="flex items-center gap-1 text-[13px] font-semibold opacity-90">
            {walletTitle}
            <HelpTooltip
              side="bottom"
              className="[&_svg]:!text-white"
              text={localizeUi("ui.slurp.wallet.fanWalletHelp", {
                defaultValue: "This is your spendable balance for subscriptions, tips, and locked posts.",
              })}
            />
          </p>
          <p ref={balanceRef} className="slp-display mt-1.5 w-fit text-[40px] leading-[44px] tabular-nums">
            <SlurpCoinAmount amount={coins} watchAmount={coins} size={32} />
          </p>
          <p className={cn(SLP_TYPE.meta, "opacity-85")}>
            {localizeUi("ui.slurp.wallet.readyToSpend", { defaultValue: "Ready to spend" })}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            {refillReady && (
              <button
                type="button"
                disabled={!personaId || claimRefill.isPending}
                aria-busy={claimRefill.isPending}
                onClick={() => personaId && claimRefill.mutate({ personaId })}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/20 px-4 text-sm font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] ring-1 ring-inset ring-white/35 backdrop-blur transition-[transform,background-color] duration-[var(--slurp-motion-fast)] hover:bg-white/28 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <Gift size={16} aria-hidden="true" />
                {claimRefill.isPending
                  ? localizeUi("ui.slurp.wallet.refilling", { defaultValue: "Claiming…" })
                  : localizeUi("ui.slurp.wallet.claimRefill", { defaultValue: "Claim daily refill" })}
              </button>
            )}
            {refillLine && (
              <span className={cn(SLP_TYPE.meta, "flex items-center gap-1 opacity-90")}>
                {!refillReady && refillLine}
                <HelpTooltip
                  side="bottom"
                  className="[&_svg]:!text-white"
                  text={
                    <SlpCoinText>
                      {localizeUi("ui.slurp.wallet.refillHelp", {
                        defaultValue: "Once per Slurp day, when your Wallet is below {{amount}} <coin/>.",
                        amount: wallet.refillFloor ?? 0,
                      })}
                    </SlpCoinText>
                  }
                />
              </span>
            )}
          </div>
        </section>

        {creator && personaId ? (
          <SlpCollectCard creator={creator} personaId={personaId} />
        ) : studioQuery.isError ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--slurp-surface-raised)] py-2 pe-2 ps-4 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]">
            <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
              {localizeUi("ui.slurp.wallet.earningsLoadError", { defaultValue: "Could not load your earnings" })}
            </p>
            <SlpButton variant="tertiary" onClick={() => void studioQuery.refetch()}>
              {localizeUi("capabilities.actions.tryAgain")}
            </SlpButton>
          </div>
        ) : null}

        {wallet.cheatsEnabled && personaId && (
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
                  className="min-h-10 rounded-lg bg-amber-400 px-3 text-xs font-black text-[var(--slurp-on-accent)] disabled:opacity-50"
                >
                  {setDevWalletCoins.isPending ? "Setting..." : "Set coins"}
                </button>
              </form>
            </div>
          </section>
        )}

        <section aria-labelledby="slurp-wallet-subscriptions" className="mt-3">
          <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
            <h2 id="slurp-wallet-subscriptions" className={SLP_EYEBROW_CLASS}>
              {localizeUi("ui.slurp.wallet.subscriptions", { defaultValue: "Subscriptions" })}
            </h2>
            {weeklyOutgoing > 0 && (
              <span className={cn(SLP_TYPE.meta, "tabular-nums text-[var(--slurp-muted)]")}>
                <SlurpCoinAmount
                  amount={weeklyOutgoing}
                  suffix={localizeUi("ui.slurp.unlocksheet.perWeek", { defaultValue: "/ week" })}
                />
              </span>
            )}
          </div>
          {subscriptions.length > 0 ? (
            <ul className={SLP_GROUP_CLASS}>
              {subscriptions.map(([creatorId, subscription]) => {
                const profile = creatorById.get(creatorId);
                const name =
                  creatorById.get(creatorId)?.displayName ??
                  localizeUi("ui.slurp.wallet.unknownCreator", { defaultValue: "Unavailable Creator" });
                return (
                  <li key={creatorId} className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                    <Avatar
                      account={{
                        displayName: name,
                        avatarUrl: profile?.avatarUrl ?? null,
                        avatarCrop: profile?.avatarCrop ?? null,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn(SLP_TYPE.body, "block truncate font-semibold")}>{name}</span>
                      <span className={cn(SLP_TYPE.meta, "flex flex-wrap gap-x-1 text-[var(--slurp-muted)]")}>
                        <SlurpCoinAmount
                          amount={subscription.price}
                          suffix={localizeUi("ui.slurp.unlocksheet.perWeek", { defaultValue: "/ week" })}
                        />
                        <span aria-hidden="true">·</span>
                        <span className={cn(subscription.cancelled && "text-[var(--slurp-warning)]")}>
                          {subscription.cancelled
                            ? localizeUi("ui.slurp.profile.endsDay", {
                                defaultValue: "ends {{day}}",
                                day: day(subscription.paidThroughAt),
                              })
                            : localizeUi("ui.slurp.wallet.renewsDay", {
                                defaultValue: "renews {{day}}",
                                day: day(subscription.paidThroughAt),
                              })}
                        </span>
                      </span>
                    </span>
                    {subscription.cancelled ? (
                      <SlpButton
                        variant="secondary"
                        disabled={!personaId || toggleSubscription.isPending}
                        onClick={(event) => void resume(creatorId, event.currentTarget.getBoundingClientRect())}
                        className="shrink-0 px-4"
                      >
                        {localizeUi("ui.slurp.wallet.resume", { defaultValue: "Resume" })}
                      </SlpButton>
                    ) : (
                      <SlpButton
                        variant="tertiary"
                        disabled={!personaId || toggleSubscription.isPending}
                        onClick={() => void cancel(creatorId, subscription.paidThroughAt)}
                        aria-label={`${localizeUi("ui.slurp.wallet.unsubscribe", { defaultValue: "Cancel" })}: ${name}`}
                        className="shrink-0 text-[var(--slurp-muted)]"
                      >
                        {localizeUi("ui.slurp.wallet.unsubscribe", { defaultValue: "Cancel" })}
                      </SlpButton>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={cn(SLP_TYPE.meta, "px-1 text-[var(--slurp-muted)]")}>
              {localizeUi("ui.slurp.wallet.noSubscriptions", {
                defaultValue: "Your active subscriptions will appear here.",
              })}
            </p>
          )}
        </section>

        <section aria-labelledby="slurp-wallet-activity" className="mt-3">
          <div className="flex items-center justify-between gap-3 px-1 pb-2">
            <h2 id="slurp-wallet-activity" className={SLP_EYEBROW_CLASS}>
              {localizeUi("ui.slurp.wallet.activity", { defaultValue: "Recent activity" })}
            </h2>
            {creator && (
              <SlpSegment
                label={localizeUi("ui.slurp.wallet.history", { defaultValue: "Wallet history" })}
                value={ledgerMode}
                onChange={setLedgerMode}
                options={[
                  { value: "spending", label: localizeUi("ui.slurp.wallet.spending", { defaultValue: "Spending" }) },
                  { value: "earnings", label: localizeUi("ui.slurp.wallet.earnings", { defaultValue: "Earnings" }) },
                ]}
              />
            )}
          </div>
          {activityEntries.length > 0 ? (
            <div className="flex flex-col gap-3">
              {groupSlpByDay(activityEntries).map((group) => (
                <section key={group.day} aria-label={formatDayHeading(group.items[0]!.at, i18n.language)}>
                  <h3 className={cn(SLP_TYPE.meta, "px-1 pb-1.5 font-semibold text-[var(--slurp-muted)]")}>
                    {formatDayHeading(group.items[0]!.at, i18n.language)}
                  </h3>
                  <ul className={SLP_GROUP_CLASS}>
                    {group.items.map((entry, index) => {
                      const gamble = entry.kind === "unlock" && entry.note?.startsWith("gamble:") === true;
                      const appearance = entryAppearance(entry.kind, gamble);
                      const EntryIcon = appearance.icon;
                      const profile = creatorName(entry);
                      const note = entryNote(entry);
                      return (
                        <li key={`${entry.at}-${index}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                          {profile && ledgerMode === "spending" ? (
                            <Avatar
                              account={{
                                displayName: profile.displayName,
                                avatarUrl: profile.avatarUrl,
                                avatarCrop: profile.avatarCrop,
                              }}
                              size="sm"
                              className="h-9 w-9"
                            />
                          ) : (
                            <span
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                                appearance.tone,
                              )}
                            >
                              <EntryIcon size={17} strokeWidth={1.75} aria-hidden="true" />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={cn(SLP_TYPE.body, "block font-semibold")}>
                              {gamble
                                ? localizeUi("ui.slurp.wallet.entry.gamble", { defaultValue: "Gamble unlock" })
                                : entryLabel(entry)}
                            </span>
                            <span className={cn(SLP_TYPE.meta, "flex min-w-0 gap-1 text-[var(--slurp-muted)]")}>
                              {note && <span className="truncate">{note}</span>}
                              {note && <span aria-hidden="true">·</span>}
                              {/* The day is the heading, so a row says its clock time (full date on hover). */}
                              <time
                                dateTime={entry.at}
                                title={formatFullTime(entry.at, i18n.language)}
                                className="shrink-0"
                              >
                                {formatClockTime(entry.at, i18n.language)}
                              </time>
                            </span>
                          </span>
                          <span
                            className={cn(
                              "flex shrink-0 items-center text-sm font-bold tabular-nums",
                              entry.amount > 0 || (gamble && entry.amount === 0)
                                ? "text-[var(--slurp-success)]"
                                : "text-[var(--slurp-text)]",
                            )}
                          >
                            {gamble && entry.amount === 0 ? (
                              localizeUi("ui.slurp.wallet.free", { defaultValue: "Free" })
                            ) : entry.kind === "renew" && entry.amount === 0 ? null : ledgerMode === "earnings" ? (
                              // Earnings are platform dollars (0.3.7); only the Wallet counts SlurpCoins.
                              `${entry.amount > 0 ? "+" : ""}${formatSlpDollars(entry.amount, i18n.language)}`
                            ) : (
                              <SlurpCoinAmount
                                amount={entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                                size={15}
                              />
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          ) : ledgerMode === "earnings" ? (
            <SlpEmptyState
              icon={ReceiptText}
              title={localizeUi("ui.slurp.earnings.activityEmpty", {
                defaultValue: "Creator earnings will show up here.",
              })}
            />
          ) : (
            <SlpEmptyState
              icon={ReceiptText}
              title={localizeUi("ui.slurp.wallet.activityEmpty", {
                defaultValue: "Unlocks and subscriptions paid with SlurpCoins will show up here.",
              })}
            />
          )}
        </section>
      </div>
    </SlpCreatorFrame>
  );
}
