import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { focusRing } from "../../base/chrome/slp-focus";
import type { SlpActionName } from "../../../../../shared/src/slp/slp-actions.js";
import type { SlpStirView } from "../../../../../shared/src/slp/slp-stir.js";
import { useSlurpTrends } from "../discovery/slp-discovery-contract";
import { Choice, CreatorPicker } from "./SlpStirFormParts";
import type { SlpStirForm } from "./slp-stir-steps";

const inputClass = `min-h-11 w-full rounded-xl bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm ${focusRing}`;

/** Ready-made trends: one tap fills the name. The words are `ui.slurp.stir.trendPack.<id>` in the locales. */
export const SLP_TREND_PACKS = [
  "puppies",
  "emptyFridge",
  "mirrorSelfies",
  "cozyNight",
  "throwback",
  "rainyOutfits",
  "danceChallenge",
  "gymCheck",
  "midnightSnacks",
  "cosplaySwap",
] as const;

/**
 * The form of the two trend cards (docs/TRENDS.md). "Start a trend": ready-made trends, a name, what to
 * lean into, an optional starter. "Steer a trend": which live trend, and what it leans into.
 */
export function SlpStirTrendFields({
  action,
  form,
  set,
  creators,
}: {
  action: SlpActionName;
  form: SlpStirForm;
  set: (patch: SlpStirForm) => void;
  creators: SlpStirView["creators"];
}) {
  const { t } = useTranslation();
  const id = useId();
  const trends = useSlurpTrends().data ?? [];
  const lean = (
    <div key="lean" className="space-y-2">
      <label htmlFor={`${id}-lean`} className={cn(SLP_TYPE.meta, "font-semibold")}>
        {t("ui.slurp.stir.form.trendLean")}
      </label>
      <input
        id={`${id}-lean`}
        value={String(form.lean ?? "")}
        maxLength={80}
        placeholder={t("ui.slurp.stir.form.trendLeanPlaceholder")}
        onChange={(event) => set({ lean: event.target.value })}
        className={inputClass}
      />
    </div>
  );
  if (action === "steer-trend")
    return trends.length ? (
      <>
        <Choice
          label={t("ui.slurp.stir.form.trendPick")}
          value={typeof form.pick === "string" ? form.pick : null}
          onChange={(pick) => set({ pick, lean: trends.find((trend) => trend.id === pick)?.lean ?? "" })}
          options={trends.map((trend) => ({ value: trend.id, label: trend.label }))}
        />
        {typeof form.pick === "string" && lean}
      </>
    ) : (
      <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.stir.form.trendNone")}</p>
    );
  const pack = (name: string) => t(`ui.slurp.stir.trendPack.${name}`);
  return (
    <>
      <Choice
        label={t("ui.slurp.stir.form.trendPacks")}
        value={SLP_TREND_PACKS.find((name) => pack(name) === form.title) ?? null}
        onChange={(name) => set({ title: pack(name) })}
        options={SLP_TREND_PACKS.map((name) => ({ value: name, label: pack(name) }))}
      />
      <div className="space-y-2">
        <label htmlFor={`${id}-title`} className={cn(SLP_TYPE.meta, "font-semibold")}>
          {t("ui.slurp.stir.form.trendName")}
        </label>
        <input
          id={`${id}-title`}
          value={String(form.title ?? "")}
          maxLength={60}
          placeholder={t("ui.slurp.stir.form.trendNamePlaceholder")}
          onChange={(event) => set({ title: event.target.value })}
          className={inputClass}
        />
      </div>
      {lean}
      <CreatorPicker
        max={1}
        label={t("ui.slurp.stir.form.trendStarter")}
        creators={creators.filter((creator) => creator.automatic)}
        picked={(form.who as string[] | undefined) ?? []}
        onPick={(who) => set({ who })}
      />
    </>
  );
}
