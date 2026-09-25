import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { SlpCreatorManagedStageProfile } from "../../../../../shared/src/slp/slp-social.types.js";
import { Field, SettingsGroup } from "../../modules/settings/SlpSettingsControls";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { useUpdateCreatorStrategy } from "./slp-creators-hooks";
import { quietButton, selectClass } from "./slp-creator-classes";

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
  const text = draft?.id === creator.id ? draft.text : (saved?.strategyText ?? "");
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
        <span className="text-sm text-[var(--slurp-muted)]">%</span>
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

  return (
    <SettingsGroup title={t("ui.slurp.settings.creators.strategy.title", { defaultValue: "Posting strategy" })}>
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
        t("ui.slurp.settings.creators.strategy.textLabel", { defaultValue: "Posts without pictures" }),
        t("ui.slurp.settings.creators.strategy.textDetail", {
          defaultValue:
            "How often a post goes out without a picture. 50 is the default balance. Sets always have pictures.",
        }),
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
            if (text.trim() === (saved?.strategyText ?? "")) return;
            save({ accountId: creator.id, strategyText: text.trim() || null });
          }}
          className={`${selectClass} min-h-24 py-2`}
        />
      </Field>
    </SettingsGroup>
  );
}
