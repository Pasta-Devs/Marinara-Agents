// ponytail: 798 lines, 2 under the 800 ceiling. The draft-editor branch is the natural next split
// if this file needs another field; it needs a dozen pieces of state threaded through props.
// Arc library editor, moved out of components/slurp/SlurpBackstageWorkflow.tsx in Slice 10. It
// drives Projects hooks, so Projects owns it rather than the shared Backstage kit.

import { Field, GuidanceBox } from "../../modules/settings/SlpSettingsControls";
import { ARC_MOODS } from "../../modules/settings/slp-backstage-format";
import { useResetSlurpArcType } from "../settings/slp-settings-contract";
import { ChevronRight, CircleHelp, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SlurpArcType } from "slp-projects-contract";
import { useGenerateSlurpArcType } from "slp-projects-hooks";
import { toast } from "sonner";

export function ArcLibraryEditor({
  library,
  tags,
  busy,
  creatorAccountId,
  personaId,
  onChange,
}: {
  library: SlurpArcType[];
  tags: string[];
  busy: boolean;
  creatorAccountId: string | null;
  personaId: string | null;
  onChange: (library: SlurpArcType[]) => void;
}) {
  const { t } = useTranslation();
  const reset = useResetSlurpArcType();
  const generate = useGenerateSlurpArcType();
  const [draft, setDraft] = useState<SlurpArcType | null>(null);
  const [brief, setBrief] = useState("");
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [reviewingGeneratedDraft, setReviewingGeneratedDraft] = useState(false);
  const importInputId = "slurp-arc-library-import";
  const input =
    "min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base sm:text-sm";
  const button =
    "min-h-11 rounded-lg px-3 text-sm font-semibold hover:bg-[var(--slurp-surface-raised)] disabled:opacity-50";
  const replace = (type: SlurpArcType) =>
    onChange(
      library.some((entry) => entry.id === type.id)
        ? library.map((entry) => (entry.id === type.id ? type : entry))
        : [...library, type],
    );
  const setChapter = (index: number, patch: Partial<SlurpArcType["chapters"][number]>) =>
    draft &&
    setDraft({
      ...draft,
      chapters: draft.chapters.map((chapter, at) => (at === index ? { ...chapter, ...patch } : chapter)),
    });
  const days = (value: string) => Math.min(90, Math.max(0, Math.floor(Number(value)) || 0));
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
  /** A choice without a question or two named options is dropped on save rather than refused. */
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

  const exportArc = (type: SlurpArcType) => {
    const href = URL.createObjectURL(
      new Blob([JSON.stringify({ ...type, id: undefined, builtin: false, hidden: false }, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${
      type.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "slurp-arc"
    }.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  const importArc = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        typeof (parsed as { name?: unknown }).name !== "string" ||
        typeof (parsed as { description?: unknown }).description !== "string" ||
        !Array.isArray((parsed as { chapters?: unknown }).chapters) ||
        !Array.isArray((parsed as { tags?: unknown }).tags)
      )
        throw new Error("This file is not a valid Slurp Arc.");
      const value = parsed as SlurpArcType;
      const imported: SlurpArcType = {
        ...value,
        id: `custom-${Date.now().toString(36)}`,
        name: value.name.trim().slice(0, 80),
        description: value.description.trim().slice(0, 2_000),
        tone: typeof value.tone === "string" ? value.tone.trim().slice(0, 80) : "",
        tags: value.tags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 30),
        chapters: value.chapters.slice(0, 12),
        enabled: true,
        builtin: false,
        hidden: false,
      };
      if (!imported.name) throw new Error("The imported Arc needs a name.");
      replace(imported);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import that Arc.");
    }
  };

  const generateDraft = async () => {
    if (!creatorAccountId || !personaId || !brief.trim()) return;
    const result = await generate.mutateAsync({ creatorAccountId, personaId, brief: brief.trim() });
    setDraft(result.type);
    setSelectedChapters(new Set(result.type.chapters.map((_, index) => index)));
    setReviewingGeneratedDraft(true);
    setBrief("");
  };

  if (draft) {
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
                return {
                  label: chapter.label.trim(),
                  minDays: chapter.minDays,
                  maxDays: Math.max(chapter.minDays, chapter.maxDays),
                  ...(choice ? { choice } : {}),
                  ...(chapter.mood ? { mood: chapter.mood } : {}),
                  ...(Object.keys(effects).length ? { effects } : {}),
                  ...(bio || location
                    ? { profile: { ...(bio ? { bio } : {}), ...(location ? { location } : {}) } }
                    : {}),
                };
              }),
          });
          setDraft(null);
          setSelectedChapters(new Set());
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
          <span className="shrink-0 text-xs tabular-nums text-[var(--muted-foreground)]">
            {draft.chapters.length}/12
          </span>
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
                        {/* One branch chapter per line; a line keeps its days while its label is unchanged. */}
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

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {library
          .filter((type) => !type.hidden || type.builtin)
          .map((type) => (
            <li
              key={type.id}
              className="rounded-xl border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 text-sm shadow-sm sm:p-4"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-bold ${type.hidden ? "text-[var(--slurp-muted)] line-through" : ""}`}>
                      {type.name}
                    </span>
                    {type.builtin && (
                      <span className="rounded-full bg-[var(--noodle-accent)]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[var(--noodle-accent)]">
                        {t("ui.slurp.settings.arcLibrary.builtIn", { defaultValue: "Built in" })}
                      </span>
                    )}
                    {type.hidden && (
                      <span className="rounded-full bg-[var(--muted-foreground)]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[var(--muted-foreground)]">
                        {t("ui.slurp.settings.arcLibrary.hidden")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">
                    {type.description ||
                      t("ui.slurp.settings.arcLibrary.noDescription", { defaultValue: "No direction added." })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] text-[var(--muted-foreground)]">
                    <span>
                      {t("ui.slurp.settings.arcLibrary.chapterCount", {
                        defaultValue: "{{count}} chapters",
                        count: type.chapters.length,
                      })}
                    </span>
                    {type.tone && <span>{type.tone}</span>}
                    {type.tags.length > 0 && <span>{type.tags.join(", ")}</span>}
                  </div>
                </div>
                {!type.hidden && (
                  <label className="inline-flex min-h-10 shrink-0 items-center gap-2 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={type.enabled}
                      disabled={busy}
                      onChange={(event) => replace({ ...type, enabled: event.target.checked })}
                    />
                    {t("ui.slurp.settings.arcLibrary.enabled")}
                  </label>
                )}
              </div>
              {!type.hidden && (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--slurp-outline)] pt-3">
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setReviewingGeneratedDraft(false);
                      setDraft(structuredClone(type));
                    }}
                  >
                    {t("ui.slurp.settings.arcLibrary.edit")}
                  </button>
                  <button type="button" className={button} disabled={busy} onClick={() => exportArc(type)}>
                    {t("ui.slurp.settings.arcLibrary.export", { defaultValue: "Export" })}
                  </button>
                  <button
                    type="button"
                    className={`${button} text-red-600`}
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(t("ui.slurp.settings.arcLibrary.deleteConfirm", { name: type.name }))) return;
                      onChange(
                        type.builtin
                          ? library.map((entry) =>
                              entry.id === type.id ? { ...entry, enabled: false, hidden: true } : entry,
                            )
                          : library.filter((entry) => entry.id !== type.id),
                      );
                    }}
                  >
                    {t("ui.slurp.settings.arcLibrary.delete")}
                  </button>
                </div>
              )}
              {type.hidden && type.builtin && (
                <button
                  type="button"
                  className={button}
                  disabled={busy || reset.isPending}
                  onClick={() => reset.mutate(type.id)}
                >
                  {t("ui.slurp.settings.arcLibrary.reset")}
                </button>
              )}
            </li>
          ))}
      </ul>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input
          id={importInputId}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importArc(file);
          }}
        />
        <label htmlFor={importInputId} className={`${button} cursor-pointer border border-[var(--slurp-outline)]`}>
          {t("ui.slurp.settings.arcLibrary.import", { defaultValue: "Import Arc" })}
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block space-y-2 text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            {t("ui.slurp.settings.arcLibrary.aiBrief", { defaultValue: "Describe the arc to AI" })}
            <span
              title={t("ui.slurp.settings.arcLibrary.aiBriefDetail", {
                defaultValue: "AI creates an editable arc draft. Nothing is saved until you save it.",
              })}
              className="text-[var(--muted-foreground)]"
            >
              <CircleHelp size={14} aria-hidden="true" />
            </span>
          </span>
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t("ui.slurp.settings.arcLibrary.aiBriefPlaceholder", {
              defaultValue: "For example: a summer road trip that starts badly and ends with a surprise collaboration.",
            })}
            className={`${input} py-2`}
          />
        </label>
        <button
          type="button"
          className="min-h-11 self-end rounded-lg border border-[var(--noodle-accent)] px-4 text-sm font-bold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10 disabled:opacity-50"
          disabled={busy || generate.isPending || !brief.trim() || !creatorAccountId || !personaId}
          onClick={() => void generateDraft()}
        >
          {generate.isPending
            ? t("ui.slurp.settings.arcLibrary.generating", { defaultValue: "Building draft..." })
            : t("ui.slurp.settings.arcLibrary.buildWithAi", { defaultValue: "Build with AI" })}
        </button>
      </div>
      {generate.error && (
        <p role="alert" className="text-xs text-[var(--destructive)]">
          {generate.error.message}
        </p>
      )}
      <button
        type="button"
        className={button}
        disabled={busy}
        onClick={() => {
          setReviewingGeneratedDraft(false);
          setDraft({
            id: `custom-${Date.now().toString(36)}`,
            name: "",
            description: "",
            chapters: [],
            tags: [],
            tone: "",
            durationDays: 14,
            enabled: true,
            builtin: false,
            hidden: false,
          });
        }}
      >
        <Plus size={15} aria-hidden="true" />
        {t("ui.slurp.settings.arcLibrary.add")}
      </button>
    </div>
  );
}
