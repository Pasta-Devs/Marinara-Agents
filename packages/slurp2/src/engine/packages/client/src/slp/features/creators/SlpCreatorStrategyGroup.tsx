import { useState } from "react";
import { slpSpiceFromStrategyText } from "../../../../../shared/src/slp/slp-spice.js";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { SlpCreatorManagedStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import { AdvancedGroup, Field, SettingsGroup } from "../../modules/settings/SlpSettingsControls";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { useUpdateCreatorStrategy } from "./slp-creators-hooks";
import { quietButton, selectClass } from "./slp-creator-classes";
import { slpPageStyleLine, SlpPageStyleSuggest } from "./SlpPageStyleSuggest";

const STYLES = ["homemade", "polished", "documentary", "theatrical"] as const;
type Style = (typeof STYLES)[number];
/**
 * How this Creator runs their page: production style, how often a slot stays quiet, how much they
 * write instead of shooting, and a note in their own words.
 *
 * Every value starts derived. A saved value overrides only itself, and Reset returns it to the
 * derived default, so a Creator nobody has tuned keeps improving with the defaults.
 */
export function SlurpCreatorStrategyGroup({ creator }: { creator: SlpCreatorManagedStageProfile }) {
  const { t } = useTranslation();
  const update = useUpdateCreatorStrategy();
  const { saved, effective } = creator.strategy;
  // Keyed by Creator so switching Creators never carries one draft over to the next.
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);
  // The sign-up chat's spice lines moved to the Creator's spice; the server moves them on save.
  const savedText = slpSpiceFromStrategyText(saved?.strategyText ?? "").rest;
  const text = draft?.id === creator.id ? draft.text : savedText;
  const save = (patch: Parameters<typeof update.mutate>[0]) =>
    update.mutate(patch, { onError: (error) => toast.error(errorMessage(error)) });
  const styleName = (style: string) => t(`ui.slurp.settings.creators.strategy.style.${style}`, { defaultValue: style });

  const rate = (key: "skipRate" | "textOnlyRate", max: number, label: string, detail: string) => (
    <Field label={label} detail={detail}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          step={1}
          // Keyed on the effective value so a save or a reset refreshes the field.
          key={`${creator.id}:${key}:${effective[key]}`}
          defaultValue={effective[key]}
          disabled={update.isPending}
          onBlur={(event) => {
            const value = Math.round(Number(event.currentTarget.value));
            if (!Number.isFinite(value) || value === effective[key]) return;
            save({ accountId: creator.id, [key]: Math.min(max, Math.max(0, value)) });
          }}
          className={`${selectClass} max-w-28 tabular-nums`}
        />
        {key === "skipRate" && <span className="text-sm text-[var(--slurp-muted)]">%</span>}
        {saved?.[key] !== undefined && (
          <button
            type="button"
            className={quietButton}
            disabled={update.isPending}
            onClick={() => save({ accountId: creator.id, [key]: null })}
          >
            {t("ui.slurp.settings.creators.strategy.reset", { defaultValue: "Reset" })}
          </button>
        )}
      </div>
    </Field>
  );

  // The sign-up chat's spice lines in an old note are not the player's tuning.
  const custom = Boolean(savedText) || Object.keys(saved ?? {}).some((key) => key !== "strategyText");

  return (
    <>
      <SettingsGroup title={t("ui.slurp.settings.creators.pageStyle.title", { defaultValue: "Page style" })}>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--slurp-text)]">
            {slpPageStyleLine(t, effective.style, effective.textOnlyRate)}
            <span className="font-normal text-[var(--slurp-muted)]">
              {" · "}
              {custom
                ? t("ui.slurp.settings.creators.pageStyle.custom", { defaultValue: "set by you" })
                : t("ui.slurp.settings.creators.pageStyle.auto", { defaultValue: "automatic" })}
            </span>
          </p>
          <p className="text-xs leading-5 text-[var(--slurp-muted)]">
            {t(`ui.slurp.settings.creators.pageStyle.about.${effective.style}`, {
              defaultValue: {
                homemade: "Shoots on a phone, first take, and never calls it work.",
                polished: "Puts time into the look: retakes, the right light, chosen frames.",
                documentary: "Posts what the day really looked like, flaws included.",
                theatrical: "Plans and stages every drop, and lets fans see the setup.",
              }[effective.style as Style],
            })}
          </p>
        </div>
        {/* An applied note replaces the saved one, so an old draft must not save itself back on blur. */}
        <SlpPageStyleSuggest creator={creator} onApplied={() => setDraft(null)} />
      </SettingsGroup>
      <AdvancedGroup
        title={t("ui.slurp.settings.creators.pageStyle.fineTune", { defaultValue: "Fine-tune page style" })}
      >
        <Field
          label={t("ui.slurp.settings.creators.strategy.styleLabel", { defaultValue: "Production style" })}
          detail={t("ui.slurp.settings.creators.strategy.styleDetail", {
            defaultValue: "How this Creator makes pictures: cameras, effort, and whether they show the work.",
          })}
        >
          <select
            className={selectClass}
            disabled={update.isPending}
            value={saved?.style ?? ""}
            onChange={(event) => save({ accountId: creator.id, style: (event.target.value || null) as Style | null })}
          >
            <option value="">
              {t("ui.slurp.settings.creators.strategy.styleAuto", {
                defaultValue: "Automatic ({{style}})",
                style: styleName(effective.style),
              })}
            </option>
            {STYLES.map((style) => (
              <option key={style} value={style}>
                {styleName(style)}
              </option>
            ))}
          </select>
        </Field>
        {rate(
          "skipRate",
          40,
          t("ui.slurp.settings.creators.strategy.skipLabel", { defaultValue: "Skipped posts" }),
          t("ui.slurp.settings.creators.strategy.skipDetail", {
            defaultValue: "How often a scheduled slot stays empty. Never two in a row.",
          }),
        )}
        {rate(
          "textOnlyRate",
          100,
          // A lean, not a share: even at 100 most posts still have a picture.
          t("ui.slurp.settings.creators.pageStyle.leanLabel", { defaultValue: "Lean towards words" }),
          t("ui.slurp.settings.creators.pageStyle.leanDetail", {
            defaultValue:
              "0 nearly always posts a picture. 100 posts words alone about twice as often as normal (50). Sets always have pictures.",
          }),
        )}
        {/* The mix has no editor of its own; a suggestion sets it, and Reset is the way back. */}
        {saved?.intentWeights && (
          <Field
            label={t("ui.slurp.settings.creators.pageStyle.mixLabel", { defaultValue: "Post mix" })}
            detail={t("ui.slurp.settings.creators.pageStyle.mixDetail", {
              defaultValue: "Set by a page style suggestion: what this Creator's posts are mostly for.",
            })}
          >
            <button
              type="button"
              className={quietButton}
              disabled={update.isPending}
              onClick={() => save({ accountId: creator.id, intentWeights: null })}
            >
              {t("ui.slurp.settings.creators.strategy.reset", { defaultValue: "Reset" })}
            </button>
          </Field>
        )}
        <Field
          label={t("ui.slurp.settings.creators.strategy.noteLabel", { defaultValue: "How they run their page" })}
          detail={t("ui.slurp.settings.creators.strategy.noteDetail", {
            defaultValue: "Optional. Describe habits, not personality: the Character card still decides who they are.",
          })}
        >
          <textarea
            rows={3}
            maxLength={2000}
            value={text}
            disabled={update.isPending}
            onChange={(event) => setDraft({ id: creator.id, text: event.target.value })}
            onBlur={() => {
              if (text.trim() === savedText) return;
              save({ accountId: creator.id, strategyText: text.trim() || null });
            }}
            className={`${selectClass} min-h-24 py-2`}
          />
        </Field>
      </AdvancedGroup>
    </>
  );
}
