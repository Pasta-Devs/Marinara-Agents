import { BriefcaseBusiness, Check, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../../lib/utils";
import { useSlurpMediaSrc } from "../../../base/media/slp-media-src";
import { formatTime } from "../../../base/ui/slp-date-time";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "../../../modules/coin/SlpCoin";
import { useSlurpWallet } from "../../economy/slp-economy-hooks";
import {
  useAcceptSlurpCommission,
  useCounterSlurpCommission,
  useDeclineSlurpCommission,
  useDeliverSlurpCommission,
  useQuoteSlurpCommission,
} from "./slp-commission-hooks";
import { getApiErrorMessage } from "../../../../lib/api-client";
import type { SlurpCommission, SlurpMessage } from "../slp-messages-contract";

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
}: {
  disabled: boolean;
  pending: boolean;
  initialBrief: string;
  onSendAsMessage: (() => void) | null;
  onSubmit: (brief: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [brief, setBrief] = useState(initialBrief);

  useEffect(() => {
    setBrief(initialBrief);
  }, [initialBrief]);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[var(--slurp-surface)] p-3 ring-1 ring-inset ring-[var(--noodle-divider)]">
      <label className="text-xs font-bold" htmlFor="slurp-commission-brief">
        {localizeUi("ui.slurp.messages.commissionLabel", { defaultValue: "Commission brief" })}
      </label>
      <p className="text-xs leading-5 text-[var(--muted-foreground)]">
        {localizeUi("ui.slurp.messages.commissionRequestDetail", {
          defaultValue: "Describe the finished piece. The Creator will quote a price before you pay.",
        })}
      </p>
      <textarea
        id="slurp-commission-brief"
        value={brief}
        rows={2}
        maxLength={2000}
        onChange={(event) => setBrief(event.target.value)}
        placeholder={localizeUi("ui.slurp.messages.commissionPlaceholder", {
          defaultValue: "Describe what you want made…",
        })}
        className="w-full resize-y rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 py-2 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs tabular-nums text-[var(--muted-foreground)]">{brief.length}/2000</span>
        <div className="flex items-center gap-2">
          {onSendAsMessage && (
            <button
              type="button"
              onClick={onSendAsMessage}
              className="min-h-11 rounded-xl px-3 text-xs font-bold ring-1 ring-inset ring-[var(--noodle-divider)]"
            >
              Send as message
            </button>
          )}
          <button
            type="button"
            disabled={disabled || pending || !brief.trim()}
            onClick={() => {
              onSubmit(brief.trim());
              setBrief("");
            }}
            className="min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {localizeUi("ui.slurp.messages.commissionSend", { defaultValue: "Send request" })}
          </button>
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
}: {
  commission: SlurpCommission;
  deliveryMessage: SlurpMessage | null;
  personaId: string;
  ownsCreator: boolean;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const quote = useQuoteSlurpCommission();
  const counter = useCounterSlurpCommission();
  const accept = useAcceptSlurpCommission();
  const deliver = useDeliverSlurpCommission();
  const decline = useDeclineSlurpCommission();
  const [price, setPrice] = useState(commission.price > 0 ? commission.price : (commission.suggestedPrice ?? 25));
  const [offer, setOffer] = useState(Math.max(1, Math.round(commission.price * 0.8)));
  const pendingOffer = commission.counterPrice ?? null;
  const canOffer = pendingOffer === null && (commission.haggleRounds ?? 0) < 3;
  const canEnd =
    commission.state === "brief" ||
    commission.state === "quoted" ||
    (!ownsCreator &&
      commission.state === "accepted" &&
      (!commission.deliverAt || commission.deliverAt <= new Date().toISOString()));
  const [generateImage, setGenerateImage] = useState(false);
  const [delivery, setDelivery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const busy = quote.isPending || counter.isPending || accept.isPending || deliver.isPending || decline.isPending;
  const wallet = useSlurpWallet(personaId);
  const steps = ["brief", "quoted", "accepted", "delivered"] as const;
  const currentStep = commission.state === "declined" ? -1 : steps.indexOf(commission.state);
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

  return (
    <article className="min-w-0 max-w-full overflow-hidden rounded-xl bg-[color-mix(in_srgb,var(--slurp-violet)_5%,var(--slurp-surface))] p-3 text-xs ring-1 ring-inset ring-[var(--slurp-violet)]/20 sm:p-4">
      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-black">
            <Sparkles size={15} className="text-[var(--noodle-accent)]" aria-hidden="true" />
            {localizeUi("ui.slurp.messages.commissionTitle", { defaultValue: "Commission" })}
          </p>
          <p className="mt-1 break-words font-semibold text-[var(--muted-foreground)]">
            {localizeUi(`ui.slurp.messages.commissionState.${commission.state}`, { defaultValue: commission.state })}
          </p>
        </div>
        {commission.price > 0 && (
          <span className="shrink-0 rounded-full bg-[var(--slurp-surface-raised)] px-2.5 py-1 font-bold tabular-nums text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/20">
            <SlurpCoinAmount amount={commission.price} />
          </span>
        )}
      </div>
      <div className="mt-3 rounded-xl bg-[var(--slurp-surface)]/70 p-3 ring-1 ring-inset ring-[var(--noodle-divider)]">
        <p className="font-bold">
          {localizeUi("ui.slurp.messages.commissionLabel", { defaultValue: "Commission brief" })}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words leading-5 text-[var(--muted-foreground)]">
          {commission.brief}
        </p>
      </div>

      {currentStep >= 0 && (
        <ol
          className="mt-4 grid min-w-0 grid-cols-4 gap-1"
          aria-label={localizeUi("ui.slurp.messages.commissionProgress", { defaultValue: "Commission progress" })}
        >
          {steps.map((step, index) => (
            <li key={step} className="relative flex min-w-0 max-w-full flex-col items-center gap-1 text-center">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute right-1/2 top-2.5 h-px w-full",
                    index <= currentStep ? "bg-[var(--noodle-accent)]" : "bg-[var(--noodle-divider)]",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ring-2 ring-[var(--slurp-surface)]",
                  index <= currentStep
                    ? "bg-[var(--noodle-accent)] text-zinc-950 [&_svg]:!text-zinc-950"
                    : "bg-[var(--slurp-surface-raised)] text-[var(--muted-foreground)]",
                )}
              >
                {index < currentStep ? <Check size={11} aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0 max-w-full break-words text-[0.65rem] font-semibold leading-4 text-[var(--muted-foreground)] sm:text-xs">
                {localizeUi(`ui.slurp.messages.commissionStep.${step}`, {
                  defaultValue: step === "accepted" ? "Paid" : step[0]?.toUpperCase() + step.slice(1),
                })}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 leading-5 text-[var(--muted-foreground)]">
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
                    : "This commission is closed.",
        })}
      </p>

      {ownsCreator && commission.state === "quoted" && pendingOffer !== null && (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 rounded-xl bg-[var(--noodle-accent)]/10 p-3">
          <span className="font-semibold">
            {localizeUi("ui.slurp.messages.commissionOfferReceived", {
              defaultValue: "The fan offers {{amount}} coins.",
              amount: pendingOffer,
            })}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                quote.mutateAsync({ commissionId: commission.id, personaId, price: pendingOffer }),
                localizeUi("ui.slurp.messages.commissionQuoteFailed", { defaultValue: "Could not send that quote." }),
                localizeUi("ui.slurp.messages.commissionOfferTaken", { defaultValue: "Offer accepted." }),
              )
            }
            className="min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {localizeUi("ui.slurp.messages.commissionTakeOffer", { defaultValue: "Accept offer" })}
          </button>
          <span className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.commissionCounterHint", {
              defaultValue: "Or send a new quote below to meet in the middle.",
            })}
          </span>
        </div>
      )}

      {ownsCreator &&
        (commission.state === "brief" || commission.state === "quoted") &&
        (commission.suggestedPrice !== undefined && commission.state === "brief" ? (
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.messages.commissionSuggestedQuote", {
              defaultValue: "Your pricing suggests {{amount}} coins for this brief.",
              amount: commission.suggestedPrice,
            })}
          </p>
        ) : null)}

      {ownsCreator && (commission.state === "brief" || commission.state === "quoted") && (
        <div className="mt-3 flex min-w-0 flex-wrap items-end gap-2">
          <label htmlFor={`slurp-quote-${commission.id}`} className="flex flex-col gap-1 font-bold">
            {localizeUi("ui.slurp.messages.commissionQuoteLabel", {
              defaultValue: commission.state === "quoted" ? "Update quote" : "Quote price",
            })}
            <span className="flex h-11 items-center gap-1.5 rounded-xl bg-[var(--slurp-canvas,var(--background))] px-3 ring-1 ring-inset ring-[var(--noodle-divider)] focus-within:ring-2 focus-within:ring-[var(--noodle-accent)]">
              <SlurpCoin size={15} />
              <input
                id={`slurp-quote-${commission.id}`}
                type="number"
                min={1}
                max={9999}
                value={price}
                onChange={(event) => setPrice(Math.max(1, Math.floor(Number(event.target.value) || 0)))}
                className="w-20 bg-transparent text-sm tabular-nums outline-none"
              />
            </span>
          </label>
          <button
            type="button"
            disabled={busy || price <= 0}
            onClick={() =>
              run(
                quote.mutateAsync({ commissionId: commission.id, personaId, price }),
                localizeUi("ui.slurp.messages.commissionQuoteFailed", { defaultValue: "Could not send that quote." }),
                localizeUi("ui.slurp.messages.commissionQuoteSent", { defaultValue: "Quote sent." }),
              )
            }
            className="min-h-11 max-w-full rounded-xl bg-[var(--noodle-accent)] px-4 font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {quote.isPending
              ? localizeUi("ui.slurp.messages.commissionQuotePending", { defaultValue: "Sending quote…" })
              : localizeUi("ui.slurp.messages.commissionQuote", {
                  defaultValue: commission.state === "quoted" ? "Send new quote" : "Send quote",
                })}
          </button>
        </div>
      )}

      {/* A brief with no exit sat in the thread forever. Either side may end it until it is paid. */}
      {canEnd && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(
              decline.mutateAsync({ commissionId: commission.id, personaId }),
              localizeUi("ui.slurp.messages.commissionDeclineFailed", {
                defaultValue: "Could not end that commission.",
              }),
            )
          }
          className="mt-3 min-h-11 rounded-xl px-3 font-bold text-[var(--muted-foreground)] transition-[background-color,transform] hover:bg-[var(--accent)] hover:text-[var(--foreground)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {ownsCreator
            ? localizeUi("ui.slurp.messages.commissionDecline", { defaultValue: "Decline" })
            : commission.state === "accepted"
              ? localizeUi("ui.slurp.messages.commissionCancel", { defaultValue: "Cancel and refund" })
              : localizeUi("ui.slurp.messages.commissionWithdraw", { defaultValue: "Withdraw request" })}
        </button>
      )}

      {!ownsCreator && commission.state === "quoted" && (
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(
                accept.mutateAsync({ commissionId: commission.id, personaId }).then(() => wallet.refetch()),
                localizeUi("ui.slurp.messages.commissionAcceptFailed", { defaultValue: "Unable to process payment." }),
                localizeUi("ui.slurp.messages.commissionAccepted", {
                  defaultValue: "Payment sent. Your commission is now in progress.",
                }),
              )
            }
            className="relative inline-flex min-h-11 max-w-full items-center gap-1.5 overflow-visible rounded-xl bg-[var(--noodle-accent)] px-4 font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <SlurpCoinBurst active={accept.isPending} />
            {accept.isPending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {accept.isPending
              ? localizeUi("ui.slurp.messages.commissionAcceptPending", { defaultValue: "Processing payment…" })
              : localizeUi("ui.slurp.messages.commissionAccept", { defaultValue: "Accept and pay" })}
            {!accept.isPending && <SlurpCoinAmount amount={commission.price} />}
          </button>
          {wallet.data && wallet.data.coins < commission.price && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {localizeUi("ui.slurp.messages.commissionBalanceShort", {
                defaultValue: "You need {{amount}} more coins.",
                amount: commission.price - wallet.data.coins,
              })}
            </span>
          )}
        </div>
      )}

      {!ownsCreator && commission.state === "quoted" && pendingOffer !== null && (
        <p className="mt-3 font-semibold text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.messages.commissionOfferPending", {
            defaultValue: "You offered {{amount}} coins. Waiting for the Creator.",
            amount: pendingOffer,
          })}
        </p>
      )}

      {!ownsCreator && commission.state === "quoted" && canOffer && (
        <div className="mt-3 flex min-w-0 flex-wrap items-end gap-2">
          <label htmlFor={`slurp-offer-${commission.id}`} className="flex flex-col gap-1 font-bold">
            {localizeUi("ui.slurp.messages.commissionOfferLabel", { defaultValue: "Offer a lower price" })}
            <span className="flex h-11 items-center gap-1.5 rounded-xl bg-[var(--slurp-canvas,var(--background))] px-3 ring-1 ring-inset ring-[var(--noodle-divider)] focus-within:ring-2 focus-within:ring-[var(--noodle-accent)]">
              <SlurpCoin size={15} />
              <input
                id={`slurp-offer-${commission.id}`}
                type="number"
                min={1}
                max={99999}
                value={offer}
                onChange={(event) => setOffer(Math.max(1, Math.floor(Number(event.target.value) || 0)))}
                className="w-20 bg-transparent text-sm tabular-nums outline-none"
              />
            </span>
          </label>
          <button
            type="button"
            disabled={busy || offer >= commission.price}
            onClick={() =>
              run(
                counter.mutateAsync({ commissionId: commission.id, personaId, price: offer }),
                localizeUi("ui.slurp.messages.commissionOfferFailed", { defaultValue: "Could not send that offer." }),
                localizeUi("ui.slurp.messages.commissionOfferSent", { defaultValue: "Offer sent." }),
              )
            }
            className="min-h-11 rounded-xl px-4 font-bold ring-1 ring-inset ring-[var(--noodle-accent)] transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {counter.isPending
              ? localizeUi("ui.slurp.messages.commissionOfferPendingSend", { defaultValue: "Sending offer…" })
              : localizeUi("ui.slurp.messages.commissionMakeOffer", { defaultValue: "Make offer" })}
          </button>
        </div>
      )}

      {/*
        A character Creator's piece is finished and paid for, and now being waited on. Saying so,
        with the time it is due, is the difference between a wait and a screen that looks stuck.
      */}
      {commission.state === "accepted" && (
        <p className="mt-2 text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.messages.commissionDeliveryTime", {
            defaultValue: "Automatic Creators deliver in about 5 to 45 minutes.",
          })}{" "}
          {localizeUi("ui.slurp.messages.commissionRefundHint", {
            defaultValue: "If an accepted commission never arrives, you can cancel it for a full refund.",
          })}
        </p>
      )}

      {commission.state === "accepted" && commission.deliverAt && (
        <p className="mt-3 flex items-center gap-1.5 font-semibold text-[var(--noodle-accent)]">
          <Loader2 size={13} className="animate-spin motion-reduce:hidden" aria-hidden="true" />
          {localizeUi("ui.slurp.messages.commissionArriving", {
            defaultValue: "Being made. Arriving around {{time}}.",
            time: formatTime(commission.deliverAt, i18n.language),
          })}
        </p>
      )}

      {ownsCreator && commission.state === "accepted" && !commission.deliverAt && (
        <div className="mt-3 flex flex-col gap-2">
          <label className="font-bold" htmlFor={`slurp-deliver-${commission.id}`}>
            {localizeUi("ui.slurp.messages.commissionDeliverLabel", { defaultValue: "Delivery" })}
          </label>
          <textarea
            id={`slurp-deliver-${commission.id}`}
            value={delivery}
            rows={2}
            maxLength={2000}
            onChange={(event) => setDelivery(event.target.value)}
            placeholder={localizeUi("ui.slurp.messages.commissionDeliverPlaceholder", {
              defaultValue: "Deliver the finished piece…",
            })}
            className="w-full resize-y rounded-xl bg-[var(--slurp-canvas,var(--background))] px-3 py-2.5 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
          />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-[var(--muted-foreground)] hover:bg-[var(--slurp-surface)]">
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
          <button
            type="button"
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
            className="ml-auto min-h-11 rounded-xl bg-[var(--noodle-accent)] px-4 font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {localizeUi("ui.slurp.messages.commissionDeliver", { defaultValue: "Deliver" })}
          </button>
        </div>
      )}

      {commission.state === "delivered" && deliveryMessage && (
        <div className="mt-3 overflow-hidden rounded-xl bg-[var(--slurp-surface)] ring-1 ring-inset ring-[var(--noodle-divider)]">
          {deliveryMessage.imageUrl && !deliveryImage && (
            <div className="flex min-h-40 items-center justify-center px-4 text-center text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.messages.commissionImageLoading", { defaultValue: "Loading the finished image…" })}
            </div>
          )}
          {deliveryImage && (
            <img
              src={deliveryImage}
              alt={localizeUi("ui.slurp.messages.attachedImage", { defaultValue: "Commission delivery" })}
              className="max-h-[32rem] w-full object-contain outline outline-1 outline-black/10 dark:outline-white/10"
            />
          )}
          {deliveryMessage.content && (
            <p className="whitespace-pre-wrap break-words px-3.5 py-3 text-sm leading-relaxed">
              {deliveryMessage.content}
            </p>
          )}
        </div>
      )}

      {success && (
        <p role="status" className="mt-2 text-[var(--noodle-accent)]">
          {success}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
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
  return (
    <div className="flex flex-col gap-2 p-3">
      {onAskCommission && (
        <button
          type="button"
          onClick={onAskCommission}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950"
        >
          <BriefcaseBusiness size={15} aria-hidden="true" />
          Ask for commission
        </button>
      )}
      {commissions.length === 0 && (
        <p className="px-1 py-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.messages.commissionsEmpty", {
            defaultValue: "No commissions in this conversation yet.",
          })}
        </p>
      )}
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
    </div>
  );
}
