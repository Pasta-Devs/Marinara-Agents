import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { textareaClass } from "../../modules/post/SlpPostHelpers";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { ChipListInput, ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";
import { accentButton, noteClass, quietButton } from "./slp-creator-classes";
import { useSlurpCanonAnchorMutations, useSlurpCanonAnchors } from "./slp-canon-anchor-hooks";
import { slpCanonAnchorDraft, slpCanonAnchorsFromDraft, type SlpCanonAnchorDraft } from "./slp-canon-anchor-text";

const LIST_FIELDS = ["people", "places", "work", "objects", "habits", "runningJokes"] as const;
/** The draft keeps one entry per line, so the chip editor and the text parser share one format. */
const entries = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
const HEAT_LEVELS = [0, 1, 2, 3] as const;

/**
 * What the Beats planner took from this Creator's card, editable. An extraction can miss a person
 * or invent a habit; this is where the player fixes it. Saved edits win until the card changes.
 */
export function SlpCanonAnchorsEditor({ creatorId }: { creatorId: string }) {
  const { t } = useTranslation();
  const query = useSlurpCanonAnchors(creatorId);
  const { save, reread } = useSlurpCanonAnchorMutations(creatorId);
  const [draft, setDraft] = useState<SlpCanonAnchorDraft>(() => slpCanonAnchorDraft(null));
  const state = query.data;
  useEffect(() => {
    if (state) setDraft(slpCanonAnchorDraft(state.anchors));
  }, [state]);
  if (query.isError) return <p className={noteClass}>{t("ui.slurp.canonAnchors.loadFailed")}</p>;
  if (!state) return <p className={noteClass}>{t("ui.slurp.settings.loading", { defaultValue: "Loading…" })}</p>;
  const busy = save.isPending || reread.isPending;
  const status = !state.hasCard
    ? t("ui.slurp.canonAnchors.noCard")
    : !state.read
      ? t("ui.slurp.canonAnchors.notRead")
      : !state.current
        ? t("ui.slurp.canonAnchors.stale")
        : state.edited
          ? t("ui.slurp.canonAnchors.edited")
          : t("ui.slurp.canonAnchors.extracted");
  const onSave = () =>
    save.mutate(slpCanonAnchorsFromDraft(draft, state.anchors?.palette ?? {}), {
      onSuccess: () => toast.success(t("ui.slurp.canonAnchors.saved")),
      onError: (error) => toast.error(errorMessage(error)),
    });
  const onReread = () =>
    reread.mutate(undefined, {
      onSuccess: () => toast.success(t("ui.slurp.canonAnchors.rereadQueued")),
      onError: (error) => toast.error(errorMessage(error)),
    });
  return (
    <section className="space-y-3" aria-labelledby={`canon-anchors-${creatorId}`}>
      <h3 id={`canon-anchors-${creatorId}`} className="text-sm font-bold">
        {t("ui.slurp.canonAnchors.title")}
      </h3>
      <p className={noteClass}>
        {t("ui.slurp.canonAnchors.detail")} {status}
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {LIST_FIELDS.map((field) => (
          <ChipListInput
            key={field}
            label={t(`ui.slurp.canonAnchors.${field}`)}
            values={entries(draft[field])}
            disabled={busy || !state.hasCard}
            onChange={(values) => setDraft((current) => ({ ...current, [field]: values.join("\n") }))}
            placeholder={t(`ui.slurp.canonAnchors.${field}Placeholder`)}
          />
        ))}
      </div>
      {/* Routine is time + activity pairs, one per line: text, not chips. */}
      <label className="block space-y-1">
        <span className="text-xs font-semibold">{t("ui.slurp.canonAnchors.routine")}</span>
        <textarea
          rows={3}
          disabled={busy || !state.hasCard}
          value={draft.routine}
          onChange={(event) => setDraft((current) => ({ ...current, routine: event.target.value }))}
          placeholder={t("ui.slurp.canonAnchors.routinePlaceholder")}
          className={`${textareaClass} !min-h-0`}
        />
      </label>
      <div className="grid gap-3 lg:grid-cols-2">
        {(["heatMin", "heatMax"] as const).map((field) => (
          <ChoiceSetting
            key={field}
            label={t(`ui.slurp.canonAnchors.${field}`)}
            options={HEAT_LEVELS.map((level) => ({
              value: String(level) as "0" | "1" | "2" | "3",
              label: t(`ui.slurp.canonAnchors.heat${level}`),
            }))}
            value={String(draft[field]) as "0" | "1" | "2" | "3"}
            disabled={busy || !state.hasCard}
            onChange={(level) => setDraft((current) => ({ ...current, [field]: Number(level) }))}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSave} disabled={busy || !state.hasCard} className={accentButton}>
          {t("ui.slurp.canonAnchors.save")}
        </button>
        <button type="button" onClick={onReread} disabled={busy || !state.hasCard} className={quietButton}>
          {t("ui.slurp.canonAnchors.reread")}
        </button>
      </div>
    </section>
  );
}
