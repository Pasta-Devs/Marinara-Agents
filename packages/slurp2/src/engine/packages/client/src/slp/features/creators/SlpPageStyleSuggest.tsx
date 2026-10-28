import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type {
  SlpCreatorManagedStageProfile,
  SlpPageStylePatch,
  SlpPageStyleSuggestion,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { useSuggestCreatorPageStyle, useUpdateCreatorStrategy } from "./slp-creators-hooks";
import { accentButton, noteClass, quietButton } from "./slp-creator-classes";

type T = ReturnType<typeof useTranslation>["t"];

/** A page style in plain words: the style and the picture balance, e.g. "Polished · mostly pictures". */
export function slpPageStyleLine(t: T, style: string, textOnlyRate: number): string {
  // The rate is a lean, not a share: even at 100 most posts have a picture, so no "mostly words".
  const balance = textOnlyRate <= 30 ? "pictures" : textOnlyRate >= 70 ? "words" : "mixed";
  return [
    t(`ui.slurp.settings.creators.strategy.style.${style}`, { defaultValue: style }),
    t(`ui.slurp.settings.creators.pageStyle.balance.${balance}`, {
      defaultValue: {
        pictures: "nearly always pictures",
        words: "writes more than most",
        mixed: "pictures, some notes",
      }[balance],
    }),
  ].join(" · ");
}

const KEYS: (keyof SlpPageStylePatch)[] = ["style", "textOnlyRate", "intentWeights", "strategyText"];

/** Each intent's share of the drawn mix, in whole percent. */
function shares(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0) || 1;
  return Object.fromEntries(
    Object.entries(weights).map(([intent, weight]) => [intent, Math.round((weight / total) * 100)]),
  );
}

/**
 * "Suggest from card": one tap reads the Character card and proposes a page style. The player sees
 * the result in plain words and either uses it or keeps what they have; the exact values wait
 * behind "See exact changes", and the Fine-tune controls adjust anything afterwards.
 */
export function SlpPageStyleSuggest({
  creator,
  onApplied,
}: {
  creator: SlpCreatorManagedStageProfile;
  onApplied: () => void;
}) {
  const { t } = useTranslation();
  const suggest = useSuggestCreatorPageStyle();
  const update = useUpdateCreatorStrategy();
  // Keyed by Creator so a suggestion never shows on the next Creator's settings.
  const [result, setResult] = useState<{ id: string; suggestion: SlpPageStyleSuggestion } | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const shown = result?.id === creator.id ? result.suggestion : null;
  const shownError = error?.id === creator.id ? error.text : null;
  const busy = suggest.isPending || update.isPending;
  // Keyboard focus follows the swap: to the result when it arrives, back to the button when it goes.
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hadResult = useRef(false);
  useEffect(() => {
    if (shown) panelRef.current?.focus();
    else if (hadResult.current) buttonRef.current?.focus();
    hadResult.current = Boolean(shown);
  }, [shown]);
  const styleName = (style: string) => t(`ui.slurp.settings.creators.strategy.style.${style}`, { defaultValue: style });
  const intentName = (intent: string) => t(`ui.slurp.continuity.intent.${intent}`, { defaultValue: intent });

  const run = () => {
    setError(null);
    setResult(null);
    suggest.mutate(creator.id, {
      onSuccess: (suggestion) => setResult({ id: creator.id, suggestion }),
      onError: (failure) => setError({ id: creator.id, text: errorMessage(failure) }),
    });
  };

  const apply = () => {
    if (!shown) return;
    const keys = KEYS.filter((key) => shown.proposal[key] !== undefined);
    if (!keys.length) return;
    setError(null);
    update.mutate(
      {
        accountId: creator.id,
        ...Object.fromEntries(keys.map((key) => [key, shown.proposal[key]])),
        // Refuse the apply if any of these changed since the suggestion was made.
        expect: Object.fromEntries(keys.map((key) => [key, shown.saved[key] ?? null])),
      },
      {
        onSuccess: () => {
          setResult(null);
          onApplied();
          toast.success(t("ui.slurp.settings.creators.pageStyle.applied", { defaultValue: "Page style applied." }));
        },
        onError: (failure) => {
          // A conflict cannot be retried: the suggestion was made against values that are gone.
          if ((failure as { status?: unknown } | null)?.status === 409) setResult(null);
          setError({ id: creator.id, text: errorMessage(failure) });
        },
      },
    );
  };

  const changes = (suggestion: SlpPageStyleSuggestion) => {
    const { current, proposal, before: was, after: will } = suggestion;
    const before = shares(current.intentWeights);
    const after = proposal.intentWeights ? shares(proposal.intentWeights) : before;
    const mix = Object.keys(after).filter((intent) => (before[intent] ?? 0) !== after[intent]);
    // Rates are compared as the planner would use them: a new style moves the defaults it derives.
    const rate = (key: "textOnlyRate" | "skipRate", label: string, unit: string) =>
      was[key] !== will[key] && { label, value: `${was[key]}${unit} → ${will[key]}${unit}` };
    return {
      // What fans will notice: the style, the balance, and the kinds of post that grow by a real amount.
      line: slpPageStyleLine(t, will.style, will.textOnlyRate),
      more: mix.filter((intent) => after[intent]! - (before[intent] ?? 0) >= 5).map(intentName),
      rows: [
        was.style !== will.style && {
          label: t("ui.slurp.settings.creators.strategy.styleLabel", { defaultValue: "Production style" }),
          value: `${styleName(was.style)} → ${styleName(will.style)}`,
        },
        rate(
          "textOnlyRate",
          t("ui.slurp.settings.creators.pageStyle.leanLabel", { defaultValue: "Lean towards words" }),
          "",
        ),
        rate("skipRate", t("ui.slurp.settings.creators.strategy.skipLabel", { defaultValue: "Skipped posts" }), "%"),
        ...mix.map((intent) => ({
          label: `${t("ui.slurp.settings.creators.pageStyle.mixLabel", { defaultValue: "Post mix" })}: ${intentName(intent)}`,
          value: `${before[intent] ?? 0}% → ${after[intent]}%`,
        })),
      ].filter((row): row is { label: string; value: string } => Boolean(row)),
      // Applying writes only the proposed keys; rows above may also show derived defaults moving.
      apply: Object.keys(proposal).length > 0,
      note: proposal.strategyText,
    };
  };

  const view = shown ? changes(shown) : null;

  return (
    <div className="space-y-3" aria-live="polite">
      {!shown && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            ref={buttonRef}
            type="button"
            className={quietButton}
            disabled={busy}
            onClick={run}
            aria-busy={suggest.isPending}
          >
            {suggest.isPending && (
              <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            )}
            {suggest.isPending
              ? t("ui.slurp.settings.creators.pageStyle.loading", { defaultValue: "Reading the card…" })
              : t("ui.slurp.settings.creators.pageStyle.action", { defaultValue: "Suggest from card" })}
          </button>
          <p className="min-w-0 flex-1 basis-48 text-xs leading-5 text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.creators.pageStyle.detail", {
              defaultValue: "Optional. Nothing changes until you choose Use.",
            })}
          </p>
        </div>
      )}
      {shownError && (
        <p role="alert" className="text-sm break-words text-[var(--slurp-danger)]">
          {shownError}
        </p>
      )}
      {shown && view && (
        <div ref={panelRef} tabIndex={-1} className={`${noteClass} space-y-3 focus-visible:outline-none`}>
          {shown.explanation && (
            <p className="text-sm leading-6 break-words text-[var(--slurp-text)]">{shown.explanation}</p>
          )}
          {!view.apply ? (
            <p>
              {t("ui.slurp.settings.creators.pageStyle.fits", { defaultValue: "The current page style already fits." })}
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold break-words text-[var(--slurp-text)]">
                {view.line}
                {view.more.length > 0 && (
                  <span className="block font-normal text-[var(--slurp-muted)]">
                    {t("ui.slurp.settings.creators.pageStyle.more", {
                      defaultValue: "More: {{list}}",
                      list: view.more.join(", "),
                    })}
                  </span>
                )}
              </p>
              {view.note && (
                <p className="break-words">
                  <span className="font-semibold text-[var(--slurp-text)]">
                    {t("ui.slurp.settings.creators.pageStyle.noteLabel", { defaultValue: "Page note" })}
                    {": "}
                  </span>
                  {view.note}
                </p>
              )}
              {view.rows.length > 0 && (
                <details>
                  <summary className="-mx-1 flex min-h-11 cursor-pointer items-center rounded-lg px-1 text-xs font-semibold text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]">
                    {t("ui.slurp.settings.creators.pageStyle.details", { defaultValue: "See exact changes" })}
                  </summary>
                  <dl className="space-y-1.5 pt-1">
                    {view.rows.map((row) => (
                      <div key={row.label} className="min-w-0 break-words">
                        <dt className="font-semibold text-[var(--slurp-text)]">{row.label}</dt>
                        <dd className="tabular-nums">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {view.apply && (
              <button type="button" className={accentButton} disabled={busy} onClick={apply}>
                {update.isPending && (
                  <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                )}
                {t("ui.slurp.settings.creators.pageStyle.apply", { defaultValue: "Use this page style" })}
              </button>
            )}
            <button
              type="button"
              className={quietButton}
              disabled={update.isPending}
              onClick={() => {
                setResult(null);
                setError(null);
              }}
            >
              {view.apply
                ? t("ui.slurp.settings.creators.pageStyle.keep", { defaultValue: "Keep current" })
                : t("ui.slurp.settings.creators.pageStyle.close", { defaultValue: "Close" })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
