import { Field, GuidanceBox } from "../../modules/settings/SlpSettingsControls";
import { ARC_MOODS } from "../../modules/settings/slp-backstage-format";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SlurpArcType } from "./slp-projects-contract";

export function ArcLibraryDraftEditor({
  draft,
  setDraft,
  selectedChapters,
  setSelectedChapters,
  reviewingGeneratedDraft,
  setReviewingGeneratedDraft,
  replace,
  busy,
  library,
  tags,
}: {
  draft: SlurpArcType;
  setDraft: (draft: SlurpArcType | null) => void;
  selectedChapters: Set<number>;
  setSelectedChapters: (fn: (current: Set<number>) => Set<number>) => void;
  reviewingGeneratedDraft: boolean;
  setReviewingGeneratedDraft: (value: boolean) => void;
  replace: (type: SlurpArcType) => void;
  busy: boolean;
  library: SlurpArcType[];
  tags: string[];
}) {
  const { t } = useTranslation();
  const input =
    "min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base sm:text-sm";
  const button =
    "min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-[var(--slurp-surface-raised)] disabled:opacity-50";
  const days = (value: string) => Math.min(90, Math.max(0, Math.floor(Number(value)) || 0));
  const setChapter = (index: number, patch: Partial<SlurpArcType["chapters"][number]>) =>
    setDraft({
      ...draft,
      chapters: draft.chapters.map((chapter, at) => (at === index ? { ...chapter, ...patch } : chapter)),
    });
  const setOption = (
    index: number,
    optionIndex: number,
    patch: Partial<NonNullable<SlurpArcType["chapters"][number]["choice"]>["options"][number]>,
  ) => {
    const choice = draft?.chapters[index]?.choice;
    if (choice)
      setChapter(index, {
        choice: {
          ...choice,
          options: choice.options.map((option, at) => (at === optionIndex ? { ...option, ...patch } : option)),
        },
      });
  };
  const cleanChoice = (choice: NonNullable<SlurpArcType["chapters"][number]["choice"]>) => {
    const question = choice.question.trim();
    const options = choice.options
      .map((option) => ({
        label: option.label.trim(),
        chapters: option.chapters
          .filter((chapter) => chapter.label.trim())
          .map((chapter) => ({ ...chapter, label: chapter.label.trim() })),
      }))
      .filter((option) => option.label);
    return question && options.length >= 2 ? { question, options } : undefined;
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.name.trim()) return;
        replace({
          ...draft,
          name: draft.name.trim(),
          description: draft.description.trim(),
          tone: draft.tone.trim(),
          chapters: (reviewingGeneratedDraft
            ? draft.chapters.filter((_, index) => selectedChapters.has(index))
            : draft.chapters
          )
            .filter((chapter) => chapter.label.trim())
            .map((chapter) => {
              const choice = chapter.choice && cleanChoice(chapter.choice);
              const effects = Object.fromEntries(
                Object.entries(chapter.effects ?? {}).filter(([, pct]) => Number.isInteger(pct) && pct !== 0),
              );
              const bio = chapter.profile?.bio?.trim();
              const location = chapter.profile?.location?.trim();
              const { choice: _choice, effects: _effects, profile: _profile, ...baseChapter } = chapter;
              return {
                ...baseChapter,
                label: chapter.label.trim(),
                minDays: chapter.minDays,
                maxDays: Math.max(chapter.minDays, chapter.maxDays),
                ...(choice ? { choice } : {}),
                ...(chapter.mood ? { mood: chapter.mood } : {}),
                ...(Object.keys(effects).length ? { effects } : {}),
                ...(bio || location ? { profile: { ...(bio ? { bio } : {}), ...(location ? { location } : {}) } } : {}),
              };
            }),
        });
        setDraft(null);
        setSelectedChapters(() => new Set());
        setReviewingGeneratedDraft(false);
      }}
    >
      <GuidanceBox
        title={t("ui.slurp.settings.arcLibrary.editorTitle", { defaultValue: "Build the arc in layers" })}
        detail={t("ui.slurp.settings.arcLibrary.editorDetail", {
          defaultValue:
            "Start with the story idea. Add chapters only when you want precise pacing, effects, profile changes, or fan choices.",
        })}
      />
      {draft.chapters.length > 0 && (
        <div className="rounded-xl border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">
                {t("ui.slurp.settings.arcLibrary.chapterSelection", { defaultValue: "Choose the chapters to keep" })}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                {t("ui.slurp.settings.arcLibrary.chapterSelectionDetail", {
                  defaultValue: "AI suggestions are editable. Uncheck any chapter you do not want in this arc.",
                })}
              </p>
            </div>
            <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
              {selectedChapters.size}/{draft.chapters.length}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {draft.chapters.map((chapter, index) => (
              <label
                key={`${chapter.label}-${index}`}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-semibold"
              >
                <input
                  type="checkbox"
                  checked={selectedChapters.has(index)}
                  onChange={(event) =>
                    setSelectedChapters((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(index);
                      else next.delete(index);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 truncate">{chapter.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("ui.slurp.settings.arcLibrary.name")}
          detail={t("ui.slurp.settings.arcLibrary.nameDetail", {
            defaultValue: "A short name shown in the Arc Library.",
          })}
        >
          <input
            value={draft.name}
            maxLength={80}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className={input}
          />
        </Field>
        <Field
          label={t("ui.slurp.settings.arcLibrary.tone")}
          detail={t("ui.slurp.settings.arcLibrary.toneDetail", {
            defaultValue: "The feeling the Creator should bring to posts.",
          })}
        >
          <input
            value={draft.tone}
            maxLength={80}
            onChange={(event) => setDraft({ ...draft, tone: event.target.value })}
            className={input}
          />
        </Field>
      </div>
      <Field
        label={t("ui.slurp.settings.arcLibrary.description")}
        detail={t("ui.slurp.settings.arcLibrary.descriptionDetail", {
          defaultValue: "Give the model enough direction to make the arc feel specific.",
        })}
      >
        <textarea
          value={draft.description}
          maxLength={2000}
          rows={3}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          className={`${input} py-2`}
        />
      </Field>
      <div className="flex items-end justify-between gap-3 border-t border-[var(--slurp-outline)] pt-4">
        <div>
          <h3 className="text-sm font-bold">{t("ui.slurp.settings.arcLibrary.chapters")}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
            {t("ui.slurp.settings.arcLibrary.chapterDetail", {
              defaultValue: "Each chapter can change the pace, mood, stats, profile, and fan choices.",
            })}
          </p>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">{draft.chapters.length}/12</span>
      </div>
      {draft.chapters.map((chapter, index) => (
        <fieldset
          key={index}
          className="space-y-4 rounded-xl border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-4"
        >
          <legend className="px-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
            {t("ui.slurp.settings.arcLibrary.chapterNumber", {
              defaultValue: "Chapter {{number}}",
              number: index + 1,
            })}
          </legend>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] sm:items-end">
            <Field label={t("ui.slurp.settings.arcLibrary.chapterLabel")}>
              <input
                value={chapter.label}
                maxLength={200}
                onChange={(event) => setChapter(index, { label: event.target.value })}
                className={input}
              />
            </Field>
            <Field label={t("ui.slurp.settings.arcLibrary.minDays")}>
              <input
                type="number"
                min={0}
                max={90}
                value={chapter.minDays}
                onChange={(event) => setChapter(index, { minDays: days(event.target.value) })}
                className={input}
              />
            </Field>
            <Field label={t("ui.slurp.settings.arcLibrary.maxDays")}>
              <input
                type="number"
                min={0}
                max={90}
                value={chapter.maxDays}
                onChange={(event) => setChapter(index, { maxDays: days(event.target.value) })}
                className={input}
              />
            </Field>
            <button
              type="button"
              className={`${button} text-red-600`}
              onClick={() => {
                setDraft({ ...draft, chapters: draft.chapters.filter((_, at) => at !== index) });
                setSelectedChapters((current) => {
                  const next = new Set<number>();
                  for (const at of current) {
                    if (at < index) next.add(at);
                    else if (at > index) next.add(at - 1);
                  }
                  return next;
                });
              }}
            >
              {t("ui.slurp.settings.arcLibrary.removeChapter")}
            </button>
          </div>
          <details className="group rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-surface-raised,var(--background))]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-bold text-[var(--muted-foreground)] [&::-webkit-details-marker]:hidden">
              <span>{t("ui.slurp.settings.arcLibrary.advanced", { defaultValue: "Advanced chapter options" })}</span>
              <ChevronRight size={15} className="transition-transform group-open:rotate-90" aria-hidden="true" />
            </summary>
            <div className="space-y-4 border-t border-[var(--slurp-outline)] p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t("ui.slurp.settings.arcLibrary.mood")}
                  detail={t("ui.slurp.settings.arcLibrary.moodDetail", {
                    defaultValue: "Set the mood when this chapter starts.",
                  })}
                >
                  <select
                    value={chapter.mood ?? ""}
                    onChange={(event) => setChapter(index, { mood: event.target.value || undefined })}
                    className={input}
                  >
                    <option value="">{t("ui.slurp.settings.arcLibrary.noMood")}</option>
                    {ARC_MOODS.map((mood) => (
                      <option key={mood} value={mood}>
                        {mood.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={t("ui.slurp.settings.arcLibrary.effects", { defaultValue: "Audience effects" })}
                  detail={t("ui.slurp.settings.arcLibrary.effectsDetail", {
                    defaultValue: "Optional changes to growth, earnings, and loyalty.",
                  })}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {(["growth", "earnings", "loyalty"] as const).map((stat) => (
                      <input
                        key={stat}
                        type="number"
                        aria-label={t(`ui.slurp.settings.arcLibrary.effect.${stat}`)}
                        min={-50}
                        max={50}
                        value={chapter.effects?.[stat] ?? ""}
                        onChange={(event) =>
                          setChapter(index, {
                            effects: {
                              ...chapter.effects,
                              [stat]:
                                event.target.value === ""
                                  ? undefined
                                  : Math.max(-50, Math.min(50, Math.round(Number(event.target.value)) || 0)),
                            },
                          })
                        }
                        className={input}
                        placeholder={stat.slice(0, 3).toUpperCase()}
                      />
                    ))}
                  </div>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t("ui.slurp.settings.arcLibrary.profileBio")}
                  detail={t("ui.slurp.settings.arcLibrary.profileBioDetail", {
                    defaultValue: "Optional bio change. Slurp asks before applying it.",
                  })}
                >
                  <input
                    value={chapter.profile?.bio ?? ""}
                    maxLength={500}
                    onChange={(event) =>
                      setChapter(index, { profile: { ...chapter.profile, bio: event.target.value } })
                    }
                    className={input}
                  />
                </Field>
                <Field
                  label={t("ui.slurp.settings.arcLibrary.profileLocation")}
                  detail={t("ui.slurp.settings.arcLibrary.profileLocationDetail", {
                    defaultValue: "Optional location change. Slurp asks before applying it.",
                  })}
                >
                  <input
                    value={chapter.profile?.location ?? ""}
                    maxLength={120}
                    onChange={(event) =>
                      setChapter(index, { profile: { ...chapter.profile, location: event.target.value } })
                    }
                    className={input}
                  />
                </Field>
              </div>
              {chapter.choice ? (
                <div className="basis-full space-y-2 border-l-2 border-[var(--slurp-outline)] pl-3">
                  <input
                    aria-label={t("ui.slurp.settings.arcLibrary.choiceQuestion")}
                    placeholder={t("ui.slurp.settings.arcLibrary.choiceQuestion")}
                    value={chapter.choice.question}
                    maxLength={240}
                    onChange={(event) =>
                      setChapter(index, { choice: { ...chapter.choice!, question: event.target.value } })
                    }
                    className={input}
                  />
                  {chapter.choice.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex flex-wrap items-start gap-2">
                      <input
                        aria-label={t("ui.slurp.settings.arcLibrary.choiceOption")}
                        placeholder={t("ui.slurp.settings.arcLibrary.choiceOption")}
                        value={option.label}
                        maxLength={120}
                        onChange={(event) => setOption(index, optionIndex, { label: event.target.value })}
                        className={`${input} min-w-0 flex-1`}
                      />
                      <textarea
                        aria-label={t("ui.slurp.settings.arcLibrary.choiceBranch")}
                        placeholder={t("ui.slurp.settings.arcLibrary.choiceBranch")}
                        value={option.chapters.map((entry) => entry.label).join("\n")}
                        rows={2}
                        onChange={(event) =>
                          setOption(index, optionIndex, {
                            chapters: event.target.value
                              .split("\n")
                              .slice(0, 4)
                              .map((label) => {
                                const known = option.chapters.find((entry) => entry.label === label);
                                return { label, minDays: known?.minDays ?? 1, maxDays: known?.maxDays ?? 3 };
                              }),
                          })
                        }
                        className={`${input} min-w-0 flex-1 py-2`}
                      />
                      {chapter.choice!.options.length > 2 && (
                        <button
                          type="button"
                          className={button}
                          onClick={() =>
                            setChapter(index, {
                              choice: {
                                ...chapter.choice!,
                                options: chapter.choice!.options.filter((_, at) => at !== optionIndex),
                              },
                            })
                          }
                        >
                          {t("ui.slurp.settings.arcLibrary.removeOption")}
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    {chapter.choice.options.length < 4 && (
                      <button
                        type="button"
                        className={button}
                        onClick={() =>
                          setChapter(index, {
                            choice: {
                              ...chapter.choice!,
                              options: [...chapter.choice!.options, { label: "", chapters: [] }],
                            },
                          })
                        }
                      >
                        {t("ui.slurp.settings.arcLibrary.addOption")}
                      </button>
                    )}
                    <button type="button" className={button} onClick={() => setChapter(index, { choice: undefined })}>
                      {t("ui.slurp.settings.arcLibrary.removeChoice")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    setChapter(index, {
                      choice: {
                        question: "",
                        options: [
                          { label: "", chapters: [] },
                          { label: "", chapters: [] },
                        ],
                      },
                    })
                  }
                >
                  {t("ui.slurp.settings.arcLibrary.addChoice")}
                </button>
              )}
            </div>
          </details>
        </fieldset>
      ))}
      {draft.chapters.length < 12 && (
        <button
          type="button"
          className={button}
          onClick={() => setDraft({ ...draft, chapters: [...draft.chapters, { label: "", minDays: 1, maxDays: 3 }] })}
        >
          {t("ui.slurp.settings.arcLibrary.addChapter")}
        </button>
      )}
      {draft.chapters.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.revertProfileAtEnd === true}
            onChange={(event) => setDraft({ ...draft, revertProfileAtEnd: event.target.checked })}
          />
          {t("ui.slurp.settings.arcLibrary.revertProfileAtEnd")}
        </label>
      )}
      {draft.chapters.length === 0 && (
        <label className="flex items-center gap-2 text-sm">
          {t("ui.slurp.settings.arcLibrary.durationDays")}
          <input
            type="number"
            min={1}
            max={365}
            value={draft.durationDays}
            onChange={(event) =>
              setDraft({
                ...draft,
                durationDays: Math.min(365, Math.max(1, Math.floor(Number(event.target.value)) || 1)),
              })
            }
            className={`${input} w-24`}
          />
        </label>
      )}
      <p className="text-sm font-semibold">{t("ui.slurp.settings.arcLibrary.tags")}</p>
      <div className="flex flex-wrap gap-x-4">
        {[...new Set([...tags, ...draft.tags])].map((tag) => (
          <label key={tag} className="inline-flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.tags.includes(tag)}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  tags: event.target.checked ? [...draft.tags, tag] : draft.tags.filter((entry) => entry !== tag),
                })
              }
            />
            {tag}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !draft.name.trim()}
          className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {t("ui.slurp.settings.arcLibrary.save")}
        </button>
        <button type="button" className={button} onClick={() => setDraft(null)}>
          {t("ui.slurp.settings.arcLibrary.cancel")}
        </button>
      </div>
    </form>
  );
}
