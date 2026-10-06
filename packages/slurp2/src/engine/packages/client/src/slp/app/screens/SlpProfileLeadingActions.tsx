import { ChartNoAxesColumn, Check, ChevronRight, Pencil, Plus, Settings2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { SlpStirGlyph } from "../../base/chrome/SlpGlyphs";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { formatUpcomingDay } from "../../base/ui/slp-date-time";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst, SlpCoinText, slpCoinPlainText } from "../../modules/coin/SlpCoin";
import { SlpButton, SlpPrimaryButton, slpButtonClass } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import { showSlpSubscriptionCancelledToast } from "../../modules/chrome/slp-subscription-toast";
import { useSlpBalance } from "../../modules/chrome/SlpShell";
import { playSlpBurst, playSlpPop, playSlpSpendMoment } from "../../modules/sparkle/SlpSparkle";
import { slurpSubscriptionPriceOf } from "./SlpHomeHelpers";
import type { StageProfileViewModel } from "./slp-profile-view-model";

const TIP_AMOUNTS = [5, 10, 25, 50];

/**
 * The profile's action row (design step 3). Another Creator: full-width Subscribe (or Resume
 * subscription while a cancelled one is still paid), then Follow · Message · Tip; subscribed:
 * ✓ Subscribed · Message · Tip. The own Creator: New post · Edit profile · Dashboard (W: the old
 * Studio's own-page half), then a Settings row on phones (the Me tab; desktop has it in the sidebar).
 */
export function SlpProfileLeadingActions({
  model,
  onOpenDashboard,
  onOpenGuide,
  onOpenSettings,
}: {
  model: StageProfileViewModel;
  onOpenDashboard?: () => void;
  onOpenGuide?: () => void;
  onOpenSettings?: () => void;
}) {
  const {
    editing,
    followPending,
    i18n,
    localizeUi,
    offerMessaging,
    onEdit,
    onOpenMessages,
    onToggleFollow,
    onToggleSubscription,
    openComposer,
    profile,
    subscriptionPending,
    subscriptionState,
    viewerCreator,
    viewingOwnCreator,
  } = model;
  if (editing) return null;
  if (viewingOwnCreator) {
    return (
      <div className="space-y-2">
        <div className={cn("grid gap-2", onOpenDashboard ? "grid-cols-3" : "grid-cols-2")}>
          <SlpButton
            variant="quiet"
            onClick={() => (onOpenGuide ? onOpenGuide() : openComposer())}
            className="min-w-0 gap-1.5 whitespace-nowrap px-2 text-[13px]"
          >
            {onOpenGuide ? <SlpStirGlyph size={16} filled aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {onOpenGuide
              ? localizeUi("ui.slurp.stir.stirShort")
              : localizeUi("ui.slurp.profile.newPost", { defaultValue: "New post" })}
          </SlpButton>
          <SlpButton variant="quiet" onClick={onEdit} className="min-w-0 gap-1.5 whitespace-nowrap px-2 text-[13px]">
            <Pencil size={15} aria-hidden="true" />
            {localizeUi("ui.slurp.profile.editProfile", { defaultValue: "Edit profile" })}
          </SlpButton>
          {onOpenDashboard && (
            <SlpButton
              variant="secondary"
              onClick={onOpenDashboard}
              data-slp-dashboard-open=""
              className="min-w-0 gap-1.5 whitespace-nowrap px-2 text-[13px]"
            >
              <ChartNoAxesColumn size={15} aria-hidden="true" />
              {localizeUi("ui.slurp.dashboard.open")}
            </SlpButton>
          )}
        </div>
        {/* Pulse + E (user): Settings was only behind ⋯ on the Me tab; a plain row finds it. */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            data-slp-me-settings=""
            className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-[var(--slurp-surface-raised)] px-3 text-start ring-1 ring-inset ring-[var(--noodle-divider)] transition-[background-color,transform] hover:bg-[var(--accent)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none motion-reduce:active:scale-100 @min-[1024px]:hidden"
          >
            <Settings2 size={20} className="shrink-0 text-[var(--noodle-accent-foreground)]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                {localizeUi("ui.slurp.profile.settingsRow", { defaultValue: "Settings" })}
              </span>
              <span className={cn(SLP_TYPE.meta, "block truncate text-[var(--slurp-muted)]")}>
                {localizeUi("ui.slurp.profile.settingsRowDetail", {
                  defaultValue: "Posting, AI budget, Creators and your account",
                })}
              </span>
            </span>
            <ChevronRight
              size={18}
              className="shrink-0 text-[var(--slurp-muted)] rtl:-scale-x-100"
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    );
  }
  if (!viewerCreator) return null;

  const subscribed = viewerCreator.subscribed;
  // Cancelled (or run out before the wallet caught up) reads as not subscribed: the pink button
  // leads again, as Resume while the paid period lasts, as Resubscribe after it.
  const resumable = subscriptionState.kind === "cancelled";
  const renewing = subscribed && !resumable && subscriptionState.kind !== "ended";
  const messaging =
    offerMessaging?.dmPolicy === "closed"
      ? ("closed" as const)
      : offerMessaging?.dmPolicy === "paid" && !subscribed && offerMessaging.requestFee > 0
        ? ("paid" as const)
        : ("open" as const);
  const requestFee = offerMessaging?.requestFee ?? 0;
  const day = (iso: string) => formatUpcomingDay(iso, i18n.language);

  const subscribeButton = resumable ? (
    // Resuming charges nothing now (the server keeps the paid period), so no price and no coin flight.
    <SlpPrimaryButton
      disabled={subscriptionPending}
      className="w-full whitespace-nowrap"
      onClickCapture={(event) => playSlpPop(event.currentTarget)}
      onClick={(event) => {
        const origin = event.currentTarget.getBoundingClientRect();
        void Promise.resolve(onToggleSubscription(profile.id, false)).then(
          () => {
            playSlpBurst(origin);
            toast.success(localizeUi("ui.slurp.profile.subscriptionResumed", { defaultValue: "Subscription resumed" }));
          },
          () => undefined,
        );
      }}
    >
      {localizeUi("ui.slurp.profile.resumeSubscription", { defaultValue: "Resume subscription" })}
    </SlpPrimaryButton>
  ) : (
    <SlpPrimaryButton
      disabled={subscriptionPending}
      className="w-full whitespace-nowrap"
      onClick={(event) => {
        // One tap, no confirmation: the spend moment is the feedback (design language §7).
        const origin = event.currentTarget.getBoundingClientRect();
        void Promise.resolve(onToggleSubscription(profile.id, false)).then(
          // Nothing is spent when SlurpCoins are off (price 0), so no coin moment (R1-077).
          () => (slurpSubscriptionPriceOf(viewerCreator) > 0 ? playSlpSpendMoment(origin) : undefined),
          () => undefined,
        );
      }}
    >
      <SlurpCoinBurst active={subscriptionPending} />
      {subscriptionState.kind === "ended"
        ? localizeUi("ui.slurp.profile.resubscribe", { defaultValue: "Resubscribe" })
        : localizeUi("ui.slurp.profile.subscribe")}
      {slurpSubscriptionPriceOf(viewerCreator) > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <SlurpCoinAmount
            amount={slurpSubscriptionPriceOf(viewerCreator)}
            suffix={localizeUi("ui.slurp.unlocksheet.perWeek", { defaultValue: "/ week" })}
          />
        </>
      )}
    </SlpPrimaryButton>
  );

  // One tap cancels (design step 6); the toast offers Undo, which resumes inside the paid week.
  const cancelSubscription = () => {
    const until = subscriptionState.kind === "active" ? subscriptionState.until : null;
    void Promise.resolve(onToggleSubscription(profile.id, true)).then(
      () =>
        showSlpSubscriptionCancelledToast({
          localizeUi,
          endsDay: until ? day(until) : null,
          onUndo: () =>
            Promise.resolve(onToggleSubscription(profile.id, false)).then(
              () =>
                toast.success(
                  localizeUi("ui.slurp.profile.subscriptionResumed", { defaultValue: "Subscription resumed" }),
                ),
              () => undefined,
            ),
        }),
      () => undefined,
    );
  };
  const subscribedButton = (
    <SlpButton
      disabled={subscriptionPending}
      onClick={cancelSubscription}
      className="gap-1.5 whitespace-nowrap px-3 text-[13px]"
    >
      <Check size={16} strokeWidth={2.5} aria-hidden="true" />
      {localizeUi("ui.slurp.profile.subscribed")}
    </SlpButton>
  );

  // Cancelled but still paid: a static chip in the Follow slot says so until the end date.
  const endingChip = subscriptionState.kind === "cancelled" && (
    // Two lines, so the end day never truncates in the narrow first column.
    <span
      className={cn(slpButtonClass("secondary"), "min-w-0 cursor-default gap-1.5 whitespace-nowrap px-3 text-[13px]")}
    >
      <Check size={16} strokeWidth={2.5} aria-hidden="true" />
      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span className="max-w-full truncate">{localizeUi("ui.slurp.profile.subscribed")}</span>
        <span className={cn(SLP_TYPE.caption, "max-w-full truncate text-[var(--slurp-muted)]")}>
          {localizeUi("ui.slurp.profile.endsDay", { defaultValue: "ends {{day}}", day: day(subscriptionState.until) })}
        </span>
      </span>
    </span>
  );

  const followLabel = viewerCreator.followed
    ? localizeUi("ui.noodle.connections.tabs.following")
    : localizeUi("ui.slurp.profile.follow");
  // Follow gets a Pop; the capture phase runs it before the click toggles the state.
  const popOnFollow = (target: HTMLElement) => {
    if (!viewerCreator.followed) playSlpPop(target);
  };
  const closedLabel = localizeUi("ui.slurp.profile.messagingUnavailable", { defaultValue: "Messaging unavailable" });

  const tip = <SlpTipSheet model={model} />;

  const statusLine: ReactNode =
    subscriptionState.kind === "active" ? (
      <SlpCoinText>
        {localizeUi("ui.slurp.profile.renewsOn", {
          defaultValue: "Subscribed · renews {{day}} · {{price}} <coin/> / week",
          day: day(subscriptionState.until),
          price: subscriptionState.price,
        })}
      </SlpCoinText>
    ) : subscriptionState.kind === "cancelled" ? null : !renewing ? (
      localizeUi("ui.slurp.profile.subscribeBenefits", {
        defaultValue: "Faster replies · Free chat photos · Subscriber-only posts",
      })
    ) : null;

  return (
    <div data-slurp-profile-actions className="min-w-0 @min-[680px]:max-w-lg">
      {renewing ? null : subscribeButton}
      <div
        className={cn(
          "grid gap-2",
          !renewing && "mt-2",
          // A paid request names its price, so Message takes the room the others do not need.
          messaging === "paid"
            ? "grid-cols-[auto_minmax(0,1fr)_auto]"
            : // "Subscribed ✓" needs a little more room than Message and Tip.
              renewing || endingChip
              ? "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]"
              : "grid-cols-3",
        )}
      >
        {renewing ? (
          subscribedButton
        ) : endingChip ? (
          endingChip
        ) : (
          <SlpButton
            variant="quiet"
            disabled={followPending}
            aria-pressed={viewerCreator.followed}
            onClickCapture={(event) => popOnFollow(event.currentTarget)}
            onClick={() => onToggleFollow(profile.id, viewerCreator.followed)}
            className={cn(
              "min-w-0 whitespace-nowrap px-3 text-[13px]",
              viewerCreator.followed && "bg-[var(--slurp-tint)]",
            )}
          >
            {followLabel}
          </SlpButton>
        )}
        <SlpButton
          variant="quiet"
          disabled={messaging === "closed"}
          onClick={() => onOpenMessages(profile.id)}
          aria-label={messaging === "closed" ? closedLabel : undefined}
          title={messaging === "closed" ? closedLabel : undefined}
          className="min-w-0 whitespace-nowrap px-3 text-[13px]"
        >
          {messaging === "paid" ? (
            <SlpCoinText>
              {localizeUi("ui.slurp.profile.requestMessage", {
                defaultValue: "Request message · {{count}} <coin/>",
                count: requestFee,
              })}
            </SlpCoinText>
          ) : (
            localizeUi("ui.slurp.profile.message", { defaultValue: "Message" })
          )}
        </SlpButton>
        {tip}
      </div>
      {(statusLine || messaging === "closed") && (
        <p
          className={cn(
            SLP_TYPE.meta,
            "mt-2 text-center text-[var(--slurp-muted)] @min-[680px]:text-start",
            subscriptionState.kind === "active" && "font-semibold",
          )}
        >
          {statusLine}
          {messaging === "closed" && (
            <span className="block">
              {localizeUi("ui.slurp.profile.notTakingMessages", { defaultValue: "Not taking messages right now." })}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Tip: a glass sheet with 5 / 10 / 25 / 50 © bubbles and a custom amount. One tap sends — no
 * confirmation (user decision); the bubble bursts and the coins fly to the balance chip.
 */
function SlpTipSheet({ model }: { model: StageProfileViewModel }) {
  const { customTip, localizeUi, profile, setCustomTip, setTipOpen, tipCreator, tipOpen, viewerAccount } = model;
  const tipButtonRef = useRef<HTMLButtonElement | null>(null);
  const coins = useSlpBalance();
  const [sentAmount, setSentAmount] = useState<number | null>(null);
  const custom = Number(customTip);
  const customValid = Number.isInteger(custom) && custom >= 1 && custom <= 9999;
  const canSend = (amount: number) =>
    Boolean(viewerAccount?.entityId) && !tipCreator.isPending && (coins === null || amount <= coins);
  const sendTip = (amount: number, origin: DOMRect) => {
    if (!viewerAccount?.entityId) return;
    setSentAmount(amount);
    tipCreator.mutate(
      {
        accountId: profile.id,
        personaId: viewerAccount.entityId,
        amount,
        requestId:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
      },
      {
        // The sheet stays open while the tip is in flight, so the Burst starts on the tapped bubble
        // as the sheet slides away and the coins fly to the balance chip.
        onSuccess: () => {
          setTipOpen(false);
          playSlpSpendMoment(origin);
          toast.success(
            <SlpCoinText>
              {localizeUi("ui.slurp.profile.tipSentAmount", {
                defaultValue: "Tip sent · {{amount}} <coin/>",
                amount,
              })}
            </SlpCoinText>,
          );
        },
        onError: () =>
          toast.error(
            localizeUi("ui.slurp.profile.tipFailed", {
              defaultValue: "The tip didn't go through. Your coins are safe.",
            }),
          ),
        onSettled: () => setSentAmount(null),
      },
    );
  };
  const label = localizeUi("ui.slurp.profile.tip", { defaultValue: "Tip" });
  return (
    <>
      <SlpButton
        ref={tipButtonRef}
        variant="quiet"
        disabled={tipCreator.isPending}
        aria-haspopup="dialog"
        aria-expanded={tipOpen}
        onClick={() => setTipOpen((open) => !open)}
        className="min-w-0 whitespace-nowrap px-3 text-[13px]"
      >
        {label}
      </SlpButton>
      <SlpSheet
        open={tipOpen}
        onClose={() => setTipOpen(false)}
        anchorRef={tipButtonRef}
        title={localizeUi("ui.slurp.profile.tipCreator", { defaultValue: "Tip {{name}}", name: profile.displayName })}
      >
        <div className="px-3 pb-2 pt-1" data-slurp-tip-sheet>
          {coins !== null && (
            <p className={cn(SLP_TYPE.meta, "mb-3 text-[var(--slurp-muted)]")}>
              <SlpCoinText>
                {localizeUi("ui.slurp.profile.tipBalance", {
                  defaultValue: "You have {{amount}} <coin/>",
                  amount: coins,
                })}
              </SlpCoinText>
            </p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {TIP_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                aria-busy={sentAmount === amount}
                disabled={!canSend(amount)}
                onClick={(event) => sendTip(amount, event.currentTarget.getBoundingClientRect())}
                aria-label={slpCoinPlainText(
                  localizeUi("ui.slurp.profile.tipSendAmount", { defaultValue: "Send {{amount}} <coin/>", amount }),
                )}
                className="relative isolate flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl bg-[image:var(--slurp-nav-active)] text-[var(--slurp-text)] shadow-[var(--slurp-highlight),0_8px_20px_-14px_var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 transition-[transform,filter] duration-[var(--slurp-motion-fast)] hover:brightness-110 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:cursor-not-allowed disabled:opacity-40 aria-busy:opacity-100 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <SlurpCoinBurst active={sentAmount === amount} />
                <span className="flex items-center gap-1 text-[17px] font-extrabold tabular-nums leading-5">
                  {amount}
                  <SlurpCoin size={15} />
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              value={customTip}
              placeholder={localizeUi("ui.slurp.profile.customTipPlaceholder", { defaultValue: "Other amount" })}
              onChange={(event) => setCustomTip(event.target.value)}
              aria-label={localizeUi("ui.slurp.profile.customTip", { defaultValue: "Custom tip amount" })}
              className="min-h-11 min-w-0 flex-1 rounded-full bg-[var(--slurp-surface)] px-4 text-sm tabular-nums shadow-[inset_0_0_0_1px_var(--noodle-divider)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--slurp-focus)]"
            />
            <SlpPrimaryButton
              disabled={!customValid || !canSend(custom)}
              onClick={(event) => {
                sendTip(custom, event.currentTarget.getBoundingClientRect());
                setCustomTip("");
              }}
              className="shrink-0 whitespace-nowrap px-4"
            >
              {customValid ? (
                <SlpCoinText>
                  {localizeUi("ui.slurp.profile.tipSendAmount", {
                    defaultValue: "Send {{amount}} <coin/>",
                    amount: custom,
                  })}
                </SlpCoinText>
              ) : (
                localizeUi("ui.slurp.profile.sendTip", { defaultValue: "Send" })
              )}
            </SlpPrimaryButton>
          </div>
          <p className={cn(SLP_TYPE.meta, "mt-3 text-center text-[var(--slurp-muted)]")}>
            {localizeUi("ui.slurp.profile.tipHint", { defaultValue: "One tap sends. A tip is a gift." })}
          </p>
        </div>
      </SlpSheet>
    </>
  );
}
