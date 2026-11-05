import { useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  SLP_STORY_DECK_MAX,
  SLP_STORY_LINE_MAX,
  SLP_STORY_LOOK_MAX,
  SLP_STORY_TRACKS,
  type SlpStoryFact,
  type SlpStoryTrack,
} from "../../../../../shared/src/slp/slp-story-engine.js";
import { cn } from "../../../lib/utils";
import { SlpButton, SlpChip, SlpPrimaryButton, SlpSegment } from "../../modules/chrome/SlpButton";
import { fieldClass, textareaClass } from "../../modules/post/SlpPostHelpers";
import { ChipListInput } from "../../modules/settings/SlpSettingsInputs";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { useSlurpCreatorLife, useSlurpCreatorLifeMutations } from "./slp-life-hooks";

const labelClass = "block text-xs font-semibold";
const noteClass = "text-xs leading-5 text-[var(--slurp-muted)]";
const LASTS = ["open", "7", "42", "90"] as const;
const SHARES = [
  { value: "0.1", key: "rarely" },
  { value: "0.25", key: "sometimes" },
  { value: "0.5", key: "often" },
] as const;

type Draft = {
  label: string;
  line: string;
  look: string;
  lasts: (typeof LASTS)[number];
  prefer: string[];
  avoid: string[];
  deck: string[];
  share: (typeof SHARES)[number]["value"];
};
const EMPTY: Draft = { label: "", line: "", look: "", lasts: "open", prefer: [], avoid: [], deck: [], share: "0.25" };

/**
 * The Life panel (docs/STORYLINES.md, PR 1): what is true about a Creator right now, one condition
 * per track. Posts, replies and pictures read it; a storyline or the player sets it.
 */
export function SlpCreatorLifeCard({ creatorId, name }: { creatorId: string; name: string }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const query = useSlurpCreatorLife(creatorId);
  const { put, remove } = useSlurpCreatorLifeMutations(creatorId);
  const [editing, setEditing] = useState<SlpStoryTrack | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const onError = (error: unknown) => toast.error(errorMessage(error));
  if (query.isError) return <p className={noteClass}>{t("ui.slurp.life.loadFailed")}</p>;
  if (!query.data) return <p className={noteClass}>{t("ui.slurp.settings.loading", { defaultValue: "Loading…" })}</p>;
  const { facts, state } = query.data;
  const byTrack = new Map(facts.filter((fact) => fact.track).map((fact) => [fact.track!, fact]));
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const save = (track: SlpStoryTrack) =>
    put.mutate(
      {
        track,
        label: draft.label.trim(),
        ...(draft.line.trim() ? { line: draft.line.trim() } : {}),
        ...(draft.look.trim() ? { look: draft.look.trim() } : {}),
        ...(draft.prefer.length || draft.avoid.length
          ? { wardrobe: { prefer: draft.prefer, avoid: draft.avoid } }
          : {}),
        ...(draft.deck.length ? { deck: draft.deck.map((line) => ({ line })), share: Number(draft.share) } : {}),
        days: draft.lasts === "open" ? null : Number(draft.lasts),
      },
      {
        onSuccess: () => {
          setEditing(null);
          setDraft(EMPTY);
        },
        onError,
      },
    );
  const until = (fact: SlpStoryFact) =>
    fact.expiresAt
      ? t("ui.slurp.life.until", {
          date: new Date(fact.expiresAt).toLocaleDateString(i18n.language, { month: "short", day: "numeric" }),
        })
      : t("ui.slurp.life.untilRemoved");

  return (
    <section data-slurp-life className="space-y-3" aria-labelledby={`${id}-title`}>
      <div>
        <h3 id={`${id}-title`} className="text-[13px] font-semibold text-[var(--slurp-text)]">
          {t("ui.slurp.life.title", { name })}
        </h3>
        <p className="mt-0.5 text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.life.intro", { name })}</p>
      </div>
      <ul className="divide-y divide-[var(--noodle-divider)]">
        {SLP_STORY_TRACKS.map((track) => {
          const fact = byTrack.get(track);
          const open = editing === track;
          return (
            <li key={track} className="py-2">
              <div className="flex min-h-11 items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--slurp-muted)]">
                    {t(`ui.slurp.life.track.${track}`)}
                  </p>
                  {fact ? (
                    <>
                      <p className="text-sm font-semibold text-[var(--slurp-text)] [overflow-wrap:anywhere]">
                        {fact.label}
                      </p>
                      {fact.line && (
                        <p className="text-xs leading-5 text-[var(--slurp-text)] [overflow-wrap:anywhere]">
                          {fact.line}
                        </p>
                      )}
                      <p className={noteClass}>
                        {until(fact)} · {t(`ui.slurp.life.source.${fact.sourceKind}`)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--slurp-muted)]">—</p>
                  )}
                </div>
                {fact ? (
                  <SlpButton
                    variant="tertiary"
                    disabled={remove.isPending}
                    aria-label={t("ui.slurp.life.remove", { label: fact.label })}
                    onClick={() => remove.mutate(fact.id, { onError })}
                    className="shrink-0"
                  >
                    <X size={16} aria-hidden="true" />
                  </SlpButton>
                ) : (
                  !open && (
                    <SlpButton
                      variant="tertiary"
                      aria-label={t("ui.slurp.life.add", { track: t(`ui.slurp.life.track.${track}`) })}
                      onClick={() => {
                        setDraft(EMPTY);
                        setEditing(track);
                      }}
                      className="shrink-0"
                    >
                      <Plus size={16} aria-hidden="true" />
                    </SlpButton>
                  )
                )}
              </div>
              {open && (
                <form
                  className="mt-2 space-y-3 rounded-xl bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (draft.label.trim()) save(track);
                  }}
                >
                  <label className="block space-y-1">
                    <span className={labelClass}>{t("ui.slurp.life.label")}</span>
                    <input
                      className={fieldClass}
                      value={draft.label}
                      maxLength={120}
                      placeholder={t("ui.slurp.life.labelPlaceholder")}
                      onChange={(event) => set({ label: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>{t("ui.slurp.life.line")}</span>
                    <textarea
                      className={cn(textareaClass, "!min-h-16")}
                      value={draft.line}
                      maxLength={SLP_STORY_LINE_MAX}
                      placeholder={t("ui.slurp.life.linePlaceholder")}
                      onChange={(event) => set({ line: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className={labelClass}>{t("ui.slurp.life.look")}</span>
                    <input
                      className={fieldClass}
                      value={draft.look}
                      maxLength={SLP_STORY_LOOK_MAX}
                      placeholder={t("ui.slurp.life.lookPlaceholder")}
                      onChange={(event) => set({ look: event.target.value })}
                    />
                  </label>
                  <div className="space-y-1">
                    <span className={labelClass}>{t("ui.slurp.life.lasts")}</span>
                    <SlpSegment
                      label={t("ui.slurp.life.lasts")}
                      value={draft.lasts}
                      onChange={(lasts) => set({ lasts })}
                      options={LASTS.map((value) => ({ value, label: t(`ui.slurp.life.lastsOption.${value}`) }))}
                      className="flex w-full flex-wrap"
                    />
                  </div>
                  <details className="group space-y-3">
                    <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold text-[var(--slurp-ink)]">
                      {t("ui.slurp.life.more")}
                    </summary>
                    <div className="space-y-3 pt-1">
                      <ChipListInput
                        label={t("ui.slurp.life.moments")}
                        values={draft.deck}
                        onChange={(deck) => set({ deck })}
                        placeholder={t("ui.slurp.life.momentsPlaceholder")}
                        max={SLP_STORY_DECK_MAX}
                        maxLength={SLP_STORY_LINE_MAX}
                        wrap
                      />
                      {draft.deck.length > 0 && (
                        <fieldset className="space-y-1">
                          <legend className={labelClass}>{t("ui.slurp.life.share")}</legend>
                          <div className="flex flex-wrap gap-1.5">
                            {SHARES.map((option) => (
                              <SlpChip
                                key={option.value}
                                selected={draft.share === option.value}
                                onClick={() => set({ share: option.value })}
                              >
                                {t(`ui.slurp.life.shareOption.${option.key}`)}
                              </SlpChip>
                            ))}
                          </div>
                        </fieldset>
                      )}
                      <ChipListInput
                        label={t("ui.slurp.life.prefer")}
                        values={draft.prefer}
                        onChange={(prefer) => set({ prefer })}
                        max={6}
                        maxLength={64}
                      />
                      <ChipListInput
                        label={t("ui.slurp.life.avoid")}
                        values={draft.avoid}
                        onChange={(avoid) => set({ avoid })}
                        max={6}
                        maxLength={64}
                      />
                    </div>
                  </details>
                  <div className="flex gap-2">
                    <SlpPrimaryButton type="submit" disabled={!draft.label.trim() || put.isPending} className="flex-1">
                      {t("ui.slurp.life.save")}
                    </SlpPrimaryButton>
                    <SlpButton variant="tertiary" onClick={() => setEditing(null)}>
                      {t("ui.slurp.life.cancel")}
                    </SlpButton>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {state.tags.length > 0 && (
        <div className="space-y-1">
          <p className={labelClass}>{t("ui.slurp.life.tags")}</p>
          <p className={cn(noteClass, "[overflow-wrap:anywhere]")}>{state.tags.join(" · ")}</p>
        </div>
      )}
    </section>
  );
}
