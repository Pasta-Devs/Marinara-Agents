import { BriefcaseBusiness, Check, Loader2 } from "lucide-react";
import { SlpTextAssist } from "../../assist/slp-assist-contract";
import { SlpSparkleGlyph } from "../../../base/chrome/SlpGlyphs";
import { useEffect, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../../lib/utils";
import { useSlurpMediaSrc } from "../../../base/media/slp-media-src";
import { formatTime } from "../../../base/ui/slp-date-time";
import { SlurpCoin, SlurpCoinAmount, SlpCoinText } from "../../../modules/coin/SlpCoin";
import { SLP_IMG_FRAME_CLASS, slpImgFade } from "../../../base/chrome/SlpChrome";
import { SlpButton, SlpPrimaryButton } from "../../../modules/chrome/SlpButton";
import { playSlpSpendMoment } from "../../../modules/sparkle/SlpSparkle";

import { useSlurpWallet } from "../../economy/slp-economy-contract";
import {
  useAcceptSlurpCommission,
  useCounterSlurpCommission,
  useDeclineSlurpCommission,
  useDeliverSlurpCommission,
  useQuoteSlurpCommission,
} from "./slp-commission-hooks";
import { getApiErrorMessage } from "../../../../lib/api-client";
import type { SlurpCommission, SlurpMessage } from "../slp-messages-contract";

const AMOUNT_FIELD =
  "flex h-11 items-center gap-1.5 rounded-xl bg-[var(--slurp-surface)] px-3 ring-1 ring-inset ring-[var(--noodle-divider)] focus-within:ring-2 focus-within:ring-[var(--slurp-focus)]";

export function isCommissionRequest(content: string): boolean {
  return /\b(commission|custom\s+(art|piece|work)|request\s+(a|an)\s+(image|picture|piece))\b/i.test(content);
}

/** Fan-side brief. A commission starts as a description and a price the creator names later. */
export function CommissionRequest({
  disabled,
  pending,
  initialBrief,
  onSendAsMessage,
  onSubmit,
  creatorId,
}: {
  disabled: boolean;
  pending: boolean;
  initialBrief: string;
  /** The Creator the brief goes to, so the writing help knows who it asks. */
  creatorId?: string;
  onSendAsMessage: (() => void) | null;
  onSubmit: (brief: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [brief, setBrief] = useState(initialBrief);

  useEffect(() => {
    setBrief(initialBrief);
  }, [initialBrief]);

  return (
    <div className="flex flex-col gap-2 px-1">
      <div className="flex flex-wrap items-center gap-x-2">
        <label className="text-[13px] font-bold" htmlFor="slurp-commission-brief">
          {localizeUi("ui.slurp.messages.commissionLabel", { defaultValue: "Commission brief" })}
        </label>
        <SlpTextAssist field="brief" value={brief} accountId={creatorId} disabled={disabled} onApply={setBrief} />
      </div>
      <p className="text-xs leading-4 text-[var(--slurp-muted)]">
        {localizeUi("ui.slurp.messages.commissionRequestDetail", {
          defaultValue: "Describe the finished piece. The Creator will quote a price before you pay.",
        })}
      </p>
      <textarea
        id="slurp-commission-brief"
        value={brief}
        rows={4}
        maxLength={2000}
        onChange={(event) => setBrief(event.target.value)}
        placeholder={localizeUi("ui.slurp.messages.commissionPlaceholder", {
          defaultValue: "Describe what you want made…",
        })}
        className="w-full resize-y rounded-xl bg-[var(--slurp-surface)] px-3 py-2.5 text-base outline-none ring-1 ring-inset ring-[var(--noodle-divider)] placeholder:text-[var(--slurp-muted)] focus:ring-2 focus:ring-[var(--slurp-focus)] sm:text-sm"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-[var(--slurp-muted)]">{brief.length}/2000</span>
        <div className="flex items-center gap-2">
          {onSendAsMessage && (
            <SlpButton variant="tertiary" onClick={onSendAsMessage}>
              {localizeUi("ui.slurp.messages.sendAsMessage", { defaultValue: "Send as message" })}
            </SlpButton>
          )}
          <SlpPrimaryButton
            disabled={disabled || pending || !brief.trim()}
            onClick={() => {
              onSubmit(brief.trim());
              setBrief("");
            }}
          >
            {localizeUi("ui.slurp.messages.commissionSend", { defaultValue: "Send request" })}
          </SlpPrimaryButton>
        </div>
      </div>
    </div>
  );
}

/**
 * One commission, showing only the action its current state allows.
 *
 * The two sides never see the same button: the creator quotes and delivers, the fan accepts. A
 * state with nothing to do for this side renders as a status line, so the row still explains
 * what is being waited on.
 */
export function CommissionRow({
  commission,
  deliveryMessage,
  personaId,
  ownsCreator,
  compact = false,
}: {
  commission: SlurpCommission;
  deliveryMessage: SlurpMessage | null;
  personaId: string;
  ownsCreator: boolean;
  /** One line with the next step (the thread header strip); the full card everywhere else. */
  compact?: boolean;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const quote = useQuoteSlurpCommission();
  const counter = useCounterSlurpCommission();
  const accept = useAcceptSlurpCommission();
  const deliver = useDeliverSlurpCommission();
  const decline = useDeclineSlurpCommission();
  const [price, setPrice] = useState(commission.price > 0 ? commission.price : (commission.suggestedPrice ?? 25));
  // Derived until the fan edits it: a row mounted as a brief has price 0, and a fixed initial
  // state kept offering 1 coin after the quote arrived.
  const [offerInput, setOffer] = useState<number | null>(null);
  const offer = offerInput ?? Math.max(1, Math.round(commission.price * 0.8));
  const pendingOffer = commission.counterPrice ?? null;
  const canOffer = pendingOffer === null && (commission.haggleRounds ?? 0) < 3;
  const canEnd =
    commission.state === "brief" ||
    commission.state === "quoted" ||
    (!ownsCreator &&
      commission.state === "accepted" &&
      (!commission.deliverAt || commission.deliverAt <= new Date().toISOString())) ||
    // A cancellation whose refund failed part-way; the server lets the fan retry it.
    (!ownsCreator && commission.state === "cancellation_pending");
  const [generateImage, setGenerateImage] = useState(false);
  const [delivery, setDelivery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const busy = quote.isPending || counter.isPending || accept.isPending || deliver.isPending || decline.isPending;
  const wallet = useSlurpWallet(personaId);
  const steps = ["brief", "quoted", "accepted", "delivered"] as const;
  const currentStep =
    commission.state === "declined"
      ? -1
      : steps.indexOf(commission.state === "cancellation_pending" ? "accepted" : commission.state);
  const deliveryImage = useSlurpMediaSrc(
    deliveryMessage?.imageUrl
      ? `${deliveryMessage.imageUrl}${deliveryMessage.imageUrl.includes("?") ? "&" : "?"}personaId=${encodeURIComponent(personaId)}`
      : null,
  );

  const run = (action: Promise<unknown>, fallback: string, successMessage?: string) => {
    setError(null);
    setSuccess(null);
    void action
      .then(() => {
        if (successMessage) setSuccess(successMessage);
      })
      .catch((cause: unknown) => {
        const raw = cause instanceof Error ? cause.message : cause;
        const message = getApiErrorMessage(raw, fallback);
        setError(/^\{[\s\S]*\}$/u.test(message) || message === "[object Object]" ? fallback : message);
      });
  };

  const stateLabel = localizeUi(`ui.slurp.messages.commissionState.${commission.state}`, {
    defaultValue: commission.state,
  });
  // The next thing to do is the one primary button. For a fan with a quote waiting that is paying.
  const acceptButton = !ownsCreator && commission.state === "quoted" && (
    <SlpPrimaryButton
      disabled={busy}
      onClick={(event) => {
        const origin = event.currentTarget.getBoundingClientRect();
        run(
          accept.mutateAsync({ commissionId: commission.id, personaId }).then(() => {
            playSlpSpendMoment(origin);
            return wallet.refetch();
          }),
          localizeUi("ui.slurp.messages.commissionAcceptFailed", { defaultValue: "Unable to process payment." }),
          localizeUi("ui.slurp.messages.commissionAccepted", {
            defaultValue: "Payment sent. Your commission is now in progress.",
          }),
        );
      }}
      className={compact ? "h-10 min-h-10 shrink-0 gap-1.5 px-3.5 text-[13px]" : "w-full"}
    >
      {accept.isPending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
      {accept.isPending
        ? localizeUi("ui.slurp.messages.commissionAcceptPending", { defaultValue: "Processing payment…" })
        : localizeUi("ui.slurp.messages.commissionAccept", { defaultValue: "Accept and pay" })}
      {!accept.isPending && <SlurpCoinAmount amount={commission.price} className="tabular-nums" />}
    </SlpPrimaryButton>
  );
  const feedback = (
    <>
      {success && (
        <p role="status" className="mt-2 text-xs text-[var(--slurp-ink)]">
          {success}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-[var(--slurp-danger)]">
          {error}
        </p>
      )}
    </>
  );

  if (compact) {
    // One line in the thread header: what it is, where it stands, and the next step.
    return (
      <div className="min-w-0">
        <div className="flex min-h-10 min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--slurp-tint)]">
            <BriefcaseBusiness size={16} className="text-[var(--slurp-ink)]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold leading-5">
              {commission.state === "delivered"
                ? localizeUi("ui.slurp.messages.commissionDeliveredHint", {
                    defaultValue: "The finished commission is in this chat",
                  })
                : commission.brief}
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--slurp-muted)]">
              <span className="truncate">{stateLabel}</span>
              {commission.price > 0 && !acceptButton && (
                <SlurpCoinAmount amount={commission.price} className="shrink-0 tabular-nums text-[var(--slurp-warm)]" />
              )}
            </span>
          </span>
          {acceptButton}
        </div>
        {feedback}
      </div>
    );
  }

  return (
    <article className="min-w-0 max-w-full overflow-hidden rounded-2xl bg-[var(--slurp-surface-raised)] p-4 text-xs shadow-[var(--slurp-highlight),var(--slurp-shadow-raised)]">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[15px] font-bold leading-5">
            <SlpSparkleGlyph size={16} className="text-[var(--slurp-ink)]" aria-hidden="true" />
            {localizeUi("ui.slurp.messages.commissionTitle", { defaultValue: "Commission" })}
          </p>
          <p className="mt-0.5 break-words text-xs font-semibold text-[var(--slurp-muted)]">{stateLabel}</p>
        </div>
        {commission.price > 0 && (
          <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[color-mix(in_srgb,var(--slurp-warm)_12%,transparent)] px-2.5 text-[13px] font-bold tabular-nums text-[var(--slurp-warm)]">
            <SlurpCoinAmount amount={commission.price} />
          </span>
        )}
      </div>
      {/* The brief once, as plain text: no box inside the card. */}
      <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-[19px] text-[var(--slurp-text)]">
        {commission.brief}
      </p>

      {currentStep >= 0 && (
        <ol
          className="mt-4 grid min-w-0 grid-cols-4 gap-1"
          aria-label={localizeUi("ui.slurp.messages.commissionProgress", { defaultValue: "Commission progress" })}
        >
          {steps.map((step, index) => (
            <li
              key={step}
              aria-current={index === currentStep ? "step" : undefined}
              className="relative flex min-w-0 max-w-full flex-col items-center gap-1 text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute right-1/2 top-2 h-0.5 w-full rounded-full",
                    index <= currentStep ? "bg-[var(--noodle-accent)]" : "bg-[var(--slurp-outline)]",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-[var(--slurp-surface-raised)]",
                  index <= currentStep
                    ? "bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] [&_svg]:!text-[var(--slurp-on-accent)]"
                    : "bg-[var(--slurp-surface)] text-[var(--slurp-muted)]",
                )}
              >
                {index < currentStep ? <Check size={11} aria-hidden="true" /> : index + 1}
              </span>
              <span
                className={cn(
                  "min-w-0 max-w-full break-words text-[11px] font-semibold leading-[14px]",
                  index === currentStep ? "text-[var(--slurp-text)]" : "text-[var(--slurp-muted)]",
                )}
              >
                {localizeUi(`ui.slurp.messages.commissionStep.${step}`, {
                  defaultValue: step === "accepted" ? "Paid" : step[0]?.toUpperCase() + step.slice(1),
                })}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 leading-4 text-[var(--slurp-muted)]">
        {localizeUi(`ui.slurp.messages.commissionNext.${commission.state}.${ownsCreator ? "creator" : "viewer"}`, {
          defaultValue:
            commission.state === "brief"
              ? ownsCreator
                ? "Review the brief, then send a price or decline."
                : "Waiting for the Creator to send a price."
              : commission.state === "quoted"
                ? ownsCreator
                  ? "Waiting for the fan to accept and pay."
                  : "Accepting pays the quoted amount and starts the work."
                : commission.state === "accepted"
                  ? ownsCreator
                    ? "Payment is complete. Send the finished piece when it is ready."
                    : "Paid. The Creator is working on your request."
                  : commission.state === "delivered"
                    ? "The finished commission is in this chat."
                    : commission.state === "cancellation_pending"
                      ? ownsCreator
                        ? "The fan cancelled. The refund is still being processed."
                        : "Your refund is not finished yet. Cancel again to retry it."
                      : "This commission is closed.",
        })}
      </p>

      {acceptButton && <div className="mt-3">{acceptButton}</div>}
      {!ownsCreator && commission.state === "quoted" && wallet.data && wallet.data.coins < commission.price && (
        <p className="mt-2 text-xs text-[var(--slurp-danger)]">
          <SlpCoinText>
            {localizeUi("ui.slurp.messages.commissionBalanceShort", {
              defaultValue: "You need {{amount}} <coin/> more.",
              amount: commission.price - wallet.data.coins,
            })}
          </SlpCoinText>
        </p>
      )}

      {ownsCreator && commission.state === "quoted" && pendingOffer !== null && (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 rounded-xl bg-[var(--slurp-tint)] p-3">
          <span className="font-semibold">
            <SlpCoinText>
              {localizeUi("ui.slurp.messages.commissionOfferReceived", {
                defaultValue: "The fan offers {{amount}} <coin/>.",
                amount: pendingOffer,
              })}
            </SlpCoinText>
          </span>
          <SlpPrimaryButton
            disabled={busy}
            onClick={() =>
              run(
                quote.mutateAsync({ commissionId: commission.id, personaId, price: pendingOffer }),
                localizeUi("ui.slurp.messages.commissionQuoteFailed", { defaultValue: "Could not send that quote." }),
                localizeUi("ui.slurp.messages.commissionOfferTaken", { defaultValue: "Offer accepted." }),
              )
            }
          >
            {localizeUi("ui.slurp.messages.commissionTakeOffer", { defaultValue: "Accept offer" })}
          </SlpPrimaryButton>
          <span className="text-xs text-[var(--slurp-muted)]">
            {localizeUi("ui.slurp.messages.commissionCounterHint", {
              defaultValue: "Or send a new quote below to meet in the middle.",
            })}
          </span>
        </div>
      )}

      {ownsCreator && commission.suggestedPrice !== undefined && commission.state === "brief" && (
        <p className="mt-3 text-xs text-[var(--slurp-muted)]">
          <SlpCoinText>
            {localizeUi("ui.slurp.messages.commissionSuggestedQuote", {
              defaultValue: "Your pricing suggests {{amount}} <coin/> for this brief.",
              amount: commission.suggestedPrice,
            })}
          </SlpCoinText>
        </p>
      )}

      {ownsCreator && (commission.state === "brief" || commission.state === "quoted") && (
        <div className="mt-3 flex min-w-0 flex-wrap items-end gap-2">
          <label htmlFor={`slurp-quote-${commission.id}`} className="flex flex-col gap-1 font-semibold">
            {localizeUi("ui.slurp.messages.commissionQuoteLabel", {
              defaultValue: commission.state === "quoted" ? "Update quote" : "Quote price",
            })}
            <span className={AMOUNT_FIELD}>
              <input
                id={`slurp-quote-${commission.id}`}
                type="number"
                min={1}
                max={9999}
                value={price}
                onChange={(event) => setPrice(Math.max(1, Math.floor(Number(event.target.value) || 0)))}
                className="w-20 bg-transparent text-sm tabular-nums outline-none"
              />
              <SlurpCoin size={15} />
            </span>
          </label>
          {/* With a fan's offer on the table, accepting it is the primary; a new quote is the alternative. */}
          {(() => {
            const quoteLabel = quote.isPending
              ? localizeUi("ui.slurp.messages.commissionQuotePending", { defaultValue: "Sending quote…" })
              : localizeUi("ui.slurp.messages.commissionQuote", {
                  defaultValue: commission.state === "quoted" ? "Send new quote" : "Send quote",
                });
            const sendQuote = () =>
              run(
                quote.mutateAsync({ commissionId: commission.id, personaId, price }),
                localizeUi("ui.slurp.messages.commissionQuoteFailed", { defaultValue: "Could not send that quote." }),
                localizeUi("ui.slurp.messages.commissionQuoteSent", { defaultValue: "Quote sent." }),
              );
            return pendingOffer !== null ? (
              <SlpButton disabled={busy || price <= 0} onClick={sendQuote}>
                {quoteLabel}
              </SlpButton>
            ) : (
              <SlpPrimaryButton disabled={busy || price <= 0} onClick={sendQuote}>
                {quoteLabel}
              </SlpPrimaryButton>
            );
          })()}
        </div>
      )}

      {!ownsCreator && commission.state === "quoted" && pendingOffer !== null && (
        <p className="mt-3 font-semibold text-[var(--slurp-muted)]">
          <SlpCoinText>
            {localizeUi("ui.slurp.messages.commissionOfferPending", {
              defaultValue: "You offered {{amount}} <coin/>. Waiting for the Creator.",
              amount: pendingOffer,
            })}
          </SlpCoinText>
        </p>
      )}

      {!ownsCreator && commission.state === "quoted" && canOffer && (
        <div className="mt-3 flex min-w-0 flex-wrap items-end gap-2">
          <label htmlFor={`slurp-offer-${commission.id}`} className="flex flex-col gap-1 font-semibold">
            {localizeUi("ui.slurp.messages.commissionOfferLabel", { defaultValue: "Offer a lower price" })}
            <span className={AMOUNT_FIELD}>
              <input
                id={`slurp-offer-${commission.id}`}
                type="number"
                min={1}
                max={99999}
                value={offer}
                onChange={(event) => setOffer(Math.max(1, Math.floor(Number(event.target.value) || 0)))}
                className="w-20 bg-transparent text-sm tabular-nums outline-none"
              />
              <SlurpCoin size={15} />
            </span>
          </label>
          <SlpButton
            variant="quiet"
            disabled={busy || offer >= commission.price}
            onClick={() =>
              run(
                counter.mutateAsync({ commissionId: commission.id, personaId, price: offer }),
                localizeUi("ui.slurp.messages.commissionOfferFailed", { defaultValue: "Could not send that offer." }),
                localizeUi("ui.slurp.messages.commissionOfferSent", { defaultValue: "Offer sent." }),
              )
            }
          >
            {counter.isPending
              ? localizeUi("ui.slurp.messages.commissionOfferPendingSend", { defaultValue: "Sending offer…" })
              : localizeUi("ui.slurp.messages.commissionMakeOffer", { defaultValue: "Make offer" })}
          </SlpButton>
        </div>
      )}

      {/*
        A character Creator's piece is finished and paid for, and now being waited on. Saying so,
        with the time it is due, is the difference between a wait and a screen that looks stuck.
      */}
      {commission.state === "accepted" && (
        <p className="mt-2 leading-4 text-[var(--slurp-muted)]">
          {localizeUi("ui.slurp.messages.commissionDeliveryTime", {
            defaultValue: "Automatic Creators deliver in about 5 to 45 minutes.",
          })}{" "}
          {localizeUi("ui.slurp.messages.commissionRefundHint", {
            defaultValue: "If an accepted commission never arrives, you can cancel it for a full refund.",
          })}
        </p>
      )}

      {commission.state === "accepted" && commission.deliverAt && (
        <p className="mt-3 flex items-center gap-1.5 font-semibold text-[var(--slurp-ink)]">
          <Loader2 size={13} className="animate-spin motion-reduce:hidden" aria-hidden="true" />
          {localizeUi("ui.slurp.messages.commissionArriving", {
            defaultValue: "Being made. Arriving around {{time}}.",
            time: formatTime(commission.deliverAt, i18n.language),
          })}
        </p>
      )}

      {ownsCreator && commission.state === "accepted" && !commission.deliverAt && (
        <div className="mt-3 flex flex-col gap-2">
          <label className="font-semibold" htmlFor={`slurp-deliver-${commission.id}`}>
            {localizeUi("ui.slurp.messages.commissionDeliverLabel", { defaultValue: "Delivery" })}
          </label>
          <textarea
            id={`slurp-deliver-${commission.id}`}
            value={delivery}
            rows={3}
            maxLength={2000}
            onChange={(event) => setDelivery(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.commissionDeliverPlaceholder", {
              defaultValue: "Deliver the finished piece…",
            })}
            className="w-full resize-y rounded-xl bg-[var(--slurp-surface)] px-3 py-2.5 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--slurp-focus)]"
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-[var(--slurp-muted)] hover:bg-[var(--accent)]">
            <input
              type="checkbox"
              checked={generateImage}
              onChange={(event) => setGenerateImage(event.target.checked)}
              className="size-4 accent-[var(--noodle-accent)]"
            />
            {localizeUi("ui.slurp.messages.generateCommissionImage", {
              defaultValue: "Generate the commissioned image from the brief",
            })}
          </label>
          <SlpPrimaryButton
            disabled={busy || !delivery.trim()}
            onClick={() =>
              run(
                deliver
                  .mutateAsync({
                    commissionId: commission.id,
                    personaId,
                    content: delivery.trim(),
                    generateImage,
                  })
                  .then(() => {
                    setDelivery("");
                    setGenerateImage(false);
                  }),
                localizeUi("ui.slurp.messages.commissionDeliverFailed", { defaultValue: "Could not deliver that." }),
              )
            }
            className="self-end"
          >
            {localizeUi("ui.slurp.messages.commissionDeliver", { defaultValue: "Deliver" })}
          </SlpPrimaryButton>
        </div>
      )}

      {/* A brief with no exit sat in the thread forever. Either side may end it until it is paid. */}
      {canEnd && (
        <SlpButton
          variant="tertiary"
          disabled={busy}
          onClick={() =>
            run(
              decline.mutateAsync({ commissionId: commission.id, personaId }),
              localizeUi("ui.slurp.messages.commissionDeclineFailed", {
                defaultValue: "Could not end that commission.",
              }),
            )
          }
          className="mt-2 -ms-2 text-[13px]"
        >
          {ownsCreator
            ? localizeUi("ui.slurp.messages.commissionDecline", { defaultValue: "Decline" })
            : commission.state === "accepted"
              ? localizeUi("ui.slurp.messages.commissionCancel", { defaultValue: "Cancel and refund" })
              : localizeUi("ui.slurp.messages.commissionWithdraw", { defaultValue: "Withdraw request" })}
        </SlpButton>
      )}

      {commission.state === "delivered" && deliveryMessage && (
        <div className="mt-3 overflow-hidden rounded-xl bg-[var(--slurp-surface)]">
          {deliveryMessage.imageUrl && (
            <span className={cn(SLP_IMG_FRAME_CLASS, "relative block min-h-40 w-full")}>
              {deliveryImage && (
                <img
                  key={deliveryImage}
                  src={deliveryImage}
                  alt={localizeUi("ui.slurp.messages.attachedImage", { defaultValue: "Commission delivery" })}
                  {...slpImgFade}
                  className="max-h-[32rem] w-full object-contain"
                />
              )}
            </span>
          )}
          {deliveryMessage.content && (
            <p className="whitespace-pre-wrap break-words px-3.5 py-3 text-sm leading-relaxed">
              {deliveryMessage.content}
            </p>
          )}
        </div>
      )}

      {feedback}
    </article>
  );
}

/**
 * Every commission in this conversation, newest first.
 *
 * The chat only carries the ones still worth answering, and clearing the conversation takes them
 * out of it entirely. This is where the older ones stay readable.
 */
export function SlurpCommissionsPanel({
  commissions,
  personaId,
  ownsCreator,
  onAskCommission,
}: {
  commissions: SlurpCommission[];
  personaId: string | null;
  ownsCreator: boolean;
  onAskCommission: (() => void) | null;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (!personaId) return null;
  // Asking for a new one is the primary only while nothing is open; an open one's next step leads.
  const open = commissions.some((commission) => ["brief", "quoted", "accepted"].includes(commission.state));
  const askLabel = localizeUi("ui.slurp.messages.askCommission", { defaultValue: "Ask for commission" });
  return (
    <div className="flex flex-col gap-3 p-2">
      {[...commissions]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((commission) => (
          <CommissionRow
            key={commission.id}
            commission={commission}
            deliveryMessage={null}
            personaId={personaId}
            ownsCreator={ownsCreator}
          />
        ))}
      {commissions.length === 0 && (
        <p className="px-2 py-2 text-[13px] text-[var(--slurp-muted)]">
          {localizeUi("ui.slurp.messages.commissionsEmpty", {
            defaultValue: "No commissions in this conversation yet.",
          })}
        </p>
      )}
      {onAskCommission &&
        (open ? (
          <SlpButton onClick={onAskCommission}>
            <BriefcaseBusiness size={16} aria-hidden="true" />
            {askLabel}
          </SlpButton>
        ) : (
          <SlpPrimaryButton onClick={onAskCommission}>
            <BriefcaseBusiness size={16} aria-hidden="true" />
            {askLabel}
          </SlpPrimaryButton>
        ))}
    </div>
  );
}
