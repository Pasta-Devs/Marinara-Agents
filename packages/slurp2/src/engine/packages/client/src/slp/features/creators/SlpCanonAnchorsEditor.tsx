import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { textareaClass } from "../../modules/post/SlpPostHelpers";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { accentButton, noteClass, quietButton, selectClass } from "./slp-creator-classes";
import { useSlurpCanonAnchorMutations, useSlurpCanonAnchors } from "./slp-canon-anchor-hooks";
import { slpCanonAnchorDraft, slpCanonAnchorsFromDraft, type SlpCanonAnchorDraft } from "./slp-canon-anchor-text";

const LIST_FIELDS = ["people", "places", "work", "objects", "habits", "runningJokes", "routine"] as const;
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
      <div className="grid gap-3 sm:grid-cols-2">
        {LIST_FIELDS.map((field) => (
          <label key={field} className="block space-y-1">
            <span className="text-xs font-semibold">{t(`ui.slurp.canonAnchors.${field}`)}</span>
            <textarea
              rows={3}
              disabled={busy || !state.hasCard}
              value={draft[field]}
              onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
              placeholder={t(`ui.slurp.canonAnchors.${field}Placeholder`)}
              className={`${textareaClass} !min-h-0`}
            />
          </label>
        ))}
        {(["heatMin", "heatMax"] as const).map((field) => (
          <label key={field} className="block space-y-1">
            <span className="text-xs font-semibold">{t(`ui.slurp.canonAnchors.${field}`)}</span>
            <select
              value={draft[field]}
              disabled={busy || !state.hasCard}
              onChange={(event) => setDraft((current) => ({ ...current, [field]: Number(event.target.value) }))}
              className={selectClass}
            >
              {HEAT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {t(`ui.slurp.canonAnchors.heat${level}`)}
                </option>
              ))}
            </select>
          </label>
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
