import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  SLP_SPICE_LANGUAGES,
  SLP_SPICE_LEVELS,
  SLP_TASTE_IDEAS,
  SLP_TASTE_STRENGTHS,
  SLP_TASTE_TEXT_MAX,
  SLP_TASTES_MAX,
  slpExplicitOfStep,
  slpSpiceStepOf,
  slpTasteKey,
  type SlpSpiceLanguage,
  type SlpSpiceLevel,
  type SlpTaste,
  type SlpTasteStrength,
} from "../../../../../shared/src/slp/slp-spice.js";
import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";
import { ChipListInput, ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";
import { SettingsGroup } from "../../modules/settings/SlpSettingsControls";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { noteClass, selectClass } from "./slp-creator-classes";
import { useSlurpSpice, useSlurpSpiceMutations } from "./slp-spice-hooks";
import { SlpSpiceLevelChoice } from "./SlpSpiceLevelChoice";
import { useSlurpPostGuidance, useUpdateSlurpPostGuidance } from "../settings/slp-post-guidance-contract";

const pill =
  "flex min-h-10 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-md px-2 text-center text-xs font-semibold transition-colors focus-within:ring-2 focus-within:ring-[var(--slurp-focus)] motion-reduce:transition-none";

/** One taste: its words, how strong it is, and a way to drop it. */
function TasteRow({
  taste,
  onStrength,
  onRemove,
  disabled,
}: {
  taste: SlpTaste;
  onStrength: (strength: SlpTasteStrength) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <li data-slurp-taste className="space-y-2">
      <div className="flex min-h-11 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{taste.text}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          aria-label={t("ui.slurp.spice.removeTaste", { taste: taste.text })}
          className="-me-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <fieldset
        disabled={disabled}
        className="flex gap-1 rounded-lg bg-[var(--slurp-canvas)] p-1 ring-1 ring-inset ring-[var(--slurp-outline)]"
      >
        <legend className="sr-only">{t("ui.slurp.spice.strengthFor", { taste: taste.text })}</legend>
        {SLP_TASTE_STRENGTHS.map((strength) => {
          const checked = taste.strength === strength;
          return (
            <label
              key={strength}
              className={`${pill} ${checked ? "bg-[image:var(--slurp-nav-active)] text-[var(--slurp-text)] shadow-sm ring-1 ring-inset ring-[var(--noodle-accent)]/45" : "text-[var(--slurp-muted)] hover:text-[var(--slurp-text)]"}`}
            >
              <input
                type="radio"
                name={name}
                value={strength}
                checked={checked}
                onChange={() => onStrength(strength)}
                className="sr-only"
              />
              <span className="truncate">{t(`ui.slurp.spice.strengths.${strength}`)}</span>
            </label>
          );
        })}
      </fieldset>
    </li>
  );
}

/**
 * Backstage › Spice: how far Slurp goes, the player's own taste, the never list, and what Slurp
 * noticed they like. No AI calls here; the taste reaches posts, offers and chats Slurp already writes.
 */
/**
 * Every Creator's default level and the words they use (0.3.17). The level lives with the post
 * guidance (Creators override it in Content rules); the language with the rest of spice.
 */
function SpiceDefaults({
  max,
  language,
  busy,
  onLanguage,
}: {
  max: SlpSpiceLevel;
  language: SlpSpiceLanguage;
  busy: boolean;
  onLanguage: (language: SlpSpiceLanguage) => void;
}) {
  const { t } = useTranslation();
  const guidance = useSlurpPostGuidance();
  const update = useUpdateSlurpPostGuidance();
  const builtIn = guidance.data ? (slpSpiceStepOf(guidance.data.builtInLevel) ?? undefined) : undefined;
  return (
    <SettingsGroup title={t("ui.slurp.spice.defaultTitle")}>
      <SlpSpiceLevelChoice
        label={t("ui.slurp.spice.defaultLevel")}
        value={slpSpiceStepOf(guidance.data?.defaults.level)}
        inherited={builtIn}
        inheritLabelKey="ui.slurp.spice.inheritShipped"
        max={max}
        disabled={!guidance.data || update.isPending}
        onChange={(step) =>
          update.mutate(
            { level: step ? slpExplicitOfStep(step) : "" },
            { onError: (error) => toast.error(errorMessage(error)) },
          )
        }
      />
      <ChoiceSetting
        variant="cards"
        label={t("ui.slurp.spice.language")}
        detail={t("ui.slurp.spice.languageDetail")}
        options={SLP_SPICE_LANGUAGES.map((value) => ({
          value,
          label: t(`ui.slurp.spice.languages.${value}`),
          detail: t(`ui.slurp.spice.languageHint.${value}`),
        }))}
        value={language}
        disabled={busy}
        onChange={onLanguage}
      />
    </SettingsGroup>
  );
}

export function SlpSpicePanel() {
  const { t } = useTranslation();
  const query = useSlurpSpice();
  const { patch, answerNoticed } = useSlurpSpiceMutations();
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const onError = (error: unknown) => toast.error(errorMessage(error));

  if (query.isError) return <p className={noteClass}>{t("ui.slurp.spice.loadFailed")}</p>;
  if (!query.data) return <p className={noteClass}>{t("ui.slurp.settings.loading", { defaultValue: "Loading…" })}</p>;
  const { spice, noticed } = query.data;
  const busy = patch.isPending || answerNoticed.isPending;
  const full = spice.tastes.length >= SLP_TASTES_MAX;
  const saveTastes = (tastes: SlpTaste[]) => patch.mutate({ tastes }, { onError });
  const addTaste = (text: string) => {
    const value = text.trim().slice(0, SLP_TASTE_TEXT_MAX);
    if (!value || full || spice.tastes.some((taste) => slpTasteKey(taste.text) === slpTasteKey(value))) return;
    patch.mutate(
      { tastes: [...spice.tastes, { text: value, strength: "hint" as const }] },
      { onError, onSuccess: () => setDraft("") },
    );
  };
  const taken = new Set([...spice.tastes.map((taste) => slpTasteKey(taste.text)), ...spice.never.map(slpTasteKey)]);
  const ideas = SLP_TASTE_IDEAS.filter((idea) => !taken.has(idea)).slice(0, 10);

  return (
    <div data-slurp-spice-page className="space-y-6">
      <BackstagePageHeader detail={t("ui.slurp.spice.pageDetail")} />

      {noticed.length > 0 && (
        <section
          data-slurp-spice-noticed
          aria-label={t("ui.slurp.spice.noticedTitle")}
          className="space-y-3 rounded-xl bg-[var(--slurp-tint)] p-4 ring-1 ring-inset ring-[var(--noodle-accent)]/30"
        >
          <p className="text-sm font-semibold text-[var(--slurp-text)]">{t("ui.slurp.spice.noticedTitle")}</p>
          <ul className="space-y-2">
            {noticed.map((item) => (
              <li key={item.label} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 basis-32 text-sm">
                  {item.existing
                    ? t("ui.slurp.spice.noticedMore", { taste: item.label })
                    : t("ui.slurp.spice.noticedNew", { taste: item.label })}
                </span>
                <div className="flex items-center gap-1.5">
                  {!item.existing && (
                    <SlpPrimaryButton
                      disabled={busy}
                      onClick={() => answerNoticed.mutate({ label: item.label, answer: "accept" }, { onError })}
                      className="min-h-11 px-3.5 text-xs"
                    >
                      {t("ui.slurp.spice.noticedAccept")}
                    </SlpPrimaryButton>
                  )}
                  <SlpButton
                    variant="secondary"
                    disabled={busy}
                    onClick={() => answerNoticed.mutate({ label: item.label, answer: "stronger" }, { onError })}
                    className="min-h-11 px-3.5 text-xs"
                  >
                    {t("ui.slurp.spice.noticedStronger")}
                  </SlpButton>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => answerNoticed.mutate({ label: item.label, answer: "remove" }, { onError })}
                    aria-label={t("ui.slurp.spice.noticedRemove", { taste: item.label })}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SpiceDefaults
        max={spice.max}
        language={spice.language}
        busy={busy}
        onLanguage={(language) => patch.mutate({ language }, { onError })}
      />

      <SettingsGroup title={t("ui.slurp.spice.maxTitle")}>
        <ChoiceSetting
          variant="cards"
          label={t("ui.slurp.spice.max")}
          detail={t("ui.slurp.spice.maxDetail")}
          options={SLP_SPICE_LEVELS.map((level) => ({
            value: level,
            label: t(`ui.slurp.spice.levels.${level}`),
            detail: t(`ui.slurp.spice.maxOption.${level}`),
          }))}
          value={spice.max}
          disabled={busy}
          onChange={(max) => patch.mutate({ max }, { onError })}
        />
      </SettingsGroup>

      <SettingsGroup title={t("ui.slurp.spice.tasteTitle")}>
        <div className="space-y-4">
          <p className="text-xs leading-5 text-[var(--slurp-muted)] text-pretty">{t("ui.slurp.spice.tasteDetail")}</p>
          {spice.tastes.length > 0 ? (
            <ul className="space-y-3">
              {spice.tastes.map((taste) => (
                <TasteRow
                  key={taste.id}
                  taste={taste}
                  disabled={busy}
                  onStrength={(strength) =>
                    saveTastes(spice.tastes.map((entry) => (entry.id === taste.id ? { ...entry, strength } : entry)))
                  }
                  onRemove={() => saveTastes(spice.tastes.filter((entry) => entry.id !== taste.id))}
                />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--slurp-muted)]">{t("ui.slurp.spice.noTastes")}</p>
          )}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addTaste(draft);
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              {t("ui.slurp.spice.addTasteLabel")}
            </label>
            <input
              id={inputId}
              value={draft}
              maxLength={SLP_TASTE_TEXT_MAX}
              disabled={full}
              placeholder={full ? t("ui.slurp.spice.tastesFull") : t("ui.slurp.spice.addTastePlaceholder")}
              onChange={(event) => setDraft(event.target.value)}
              className={`${selectClass} min-w-0 flex-1`}
            />
            <SlpButton
              type="submit"
              variant="secondary"
              disabled={!draft.trim() || full || busy}
              className="min-h-11 shrink-0 px-3.5 text-xs"
            >
              <Plus size={14} aria-hidden="true" />
              {t("ui.slurp.spice.addTaste")}
            </SlpButton>
          </form>
          {ideas.length > 0 && !full && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--slurp-muted)]">{t("ui.slurp.spice.ideas")}</p>
              <div className="flex flex-wrap gap-1.5">
                {ideas.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    disabled={busy}
                    onClick={() => addTaste(idea)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[var(--slurp-canvas)] px-3.5 text-sm text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)] transition-colors hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
                  >
                    <Plus size={13} aria-hidden="true" />
                    {idea}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("ui.slurp.spice.neverTitle")}>
        <div className="space-y-2">
          <p className="text-xs leading-5 text-[var(--slurp-muted)] text-pretty">{t("ui.slurp.spice.neverDetail")}</p>
          <ChipListInput
            label={t("ui.slurp.spice.never")}
            values={spice.never}
            disabled={busy}
            placeholder={t("ui.slurp.spice.neverPlaceholder")}
            onChange={(never) => patch.mutate({ never }, { onError })}
          />
        </div>
      </SettingsGroup>
    </div>
  );
}
