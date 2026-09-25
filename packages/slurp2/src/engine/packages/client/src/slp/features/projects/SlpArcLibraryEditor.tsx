import { useResetSlurpArcType } from "../settings/slp-settings-contract";
import { CircleHelp, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SlurpArcType } from "./slp-projects-contract";
import { useGenerateSlurpArcType } from "./slp-projects-hooks";
import { toast } from "sonner";
import { ArcLibraryDraftEditor } from "./SlpArcLibraryDraftEditor";

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
        throw new Error("This file is not a valid Slurp storyline type.");
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
      <ArcLibraryDraftEditor
        draft={draft}
        setDraft={setDraft}
        selectedChapters={selectedChapters}
        setSelectedChapters={setSelectedChapters}
        reviewingGeneratedDraft={reviewingGeneratedDraft}
        setReviewingGeneratedDraft={setReviewingGeneratedDraft}
        replace={replace}
        busy={busy}
        library={library}
        tags={tags}
      />
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
