import { useResetSlurpArcType } from "../settings/slp-settings-contract";
import { Download, Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";
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

  const iconButton =
    "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:bg-[var(--slurp-surface-raised)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50";
  const visible = library.filter((type) => !type.hidden || type.builtin);
  return (
    <div className="space-y-4">
      {/* Make a new type: describe it to AI, start blank, or import a shared file. One toolbar,
          above the list, so the ways to add are not scattered under it. */}
      <section className="space-y-3 rounded-xl bg-[color-mix(in_srgb,var(--noodle-accent)_7%,var(--slurp-surface-raised))] p-4 ring-1 ring-inset ring-[var(--noodle-accent)]/25">
        <label className="block space-y-2 text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            <Sparkles size={15} className="text-[var(--noodle-accent)]" aria-hidden="true" />
            {t("ui.slurp.settings.arcLibrary.aiBrief", { defaultValue: "Describe the arc to AI" })}
          </span>
          <span className="block text-xs font-normal text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.arcLibrary.aiBriefDetail", {
              defaultValue: "AI creates an editable arc draft. Nothing is saved until you save it.",
            })}
          </span>
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t("ui.slurp.settings.arcLibrary.aiBriefPlaceholder", {
              defaultValue: "For example: a summer road trip that starts badly and ends with a surprise collaboration.",
            })}
            className={`${input} py-2 font-normal`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:opacity-50"
            disabled={busy || generate.isPending || !brief.trim() || !creatorAccountId || !personaId}
            onClick={() => void generateDraft()}
          >
            <Sparkles size={15} aria-hidden="true" />
            {generate.isPending
              ? t("ui.slurp.settings.arcLibrary.generating", { defaultValue: "Building draft..." })
              : t("ui.slurp.settings.arcLibrary.buildWithAi", { defaultValue: "Build with AI" })}
          </button>
          <button
            type="button"
            className={`${button} inline-flex items-center gap-1.5 ring-1 ring-inset ring-[var(--slurp-outline)]`}
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
          <label
            htmlFor={importInputId}
            className={`${button} inline-flex cursor-pointer items-center gap-1.5 ring-1 ring-inset ring-[var(--slurp-outline)]`}
          >
            <Upload size={15} aria-hidden="true" />
            {t("ui.slurp.settings.arcLibrary.import", { defaultValue: "Import Arc" })}
          </label>
        </div>
        {generate.error && (
          <p role="alert" className="text-xs text-[var(--destructive)]">
            {generate.error.message}
          </p>
        )}
      </section>
      <ul className="divide-y divide-[var(--slurp-outline)] overflow-hidden rounded-xl bg-[var(--slurp-canvas)] ring-1 ring-inset ring-[var(--slurp-outline)]">
        {visible.map((type) => (
          <li key={type.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm sm:px-4">
            <div className="min-w-0 flex-1 basis-56">
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
              <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-[var(--muted-foreground)]">
                {[
                  t("ui.slurp.settings.arcLibrary.chapterCount", {
                    defaultValue: "{{count}} chapters",
                    count: type.chapters.length,
                  }),
                  type.tone,
                  type.description ||
                    t("ui.slurp.settings.arcLibrary.noDescription", { defaultValue: "No direction added." }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {type.hidden ? (
              type.builtin && (
                <button
                  type="button"
                  className={button}
                  disabled={busy || reset.isPending}
                  onClick={() => reset.mutate(type.id)}
                >
                  {t("ui.slurp.settings.arcLibrary.reset")}
                </button>
              )
            ) : (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className={iconButton}
                  disabled={busy}
                  aria-label={`${t("ui.slurp.settings.arcLibrary.edit")}: ${type.name}`}
                  title={t("ui.slurp.settings.arcLibrary.edit")}
                  onClick={() => {
                    setReviewingGeneratedDraft(false);
                    setDraft(structuredClone(type));
                  }}
                >
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={busy}
                  aria-label={`${t("ui.slurp.settings.arcLibrary.export", { defaultValue: "Export" })}: ${type.name}`}
                  title={t("ui.slurp.settings.arcLibrary.export", { defaultValue: "Export" })}
                  onClick={() => exportArc(type)}
                >
                  <Download size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`${iconButton} hover:text-red-400`}
                  disabled={busy}
                  aria-label={`${t("ui.slurp.settings.arcLibrary.delete")}: ${type.name}`}
                  title={t("ui.slurp.settings.arcLibrary.delete")}
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
                  <Trash2 size={16} aria-hidden="true" />
                </button>
                <label className="ms-1 inline-flex min-h-11 cursor-pointer items-center">
                  <span className="sr-only">
                    {t("ui.slurp.settings.arcLibrary.enabled")}: {type.name}
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={type.enabled}
                    disabled={busy}
                    onChange={(event) => replace({ ...type, enabled: event.target.checked })}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className="relative h-6 w-10 shrink-0 rounded-full bg-[var(--muted-foreground)]/25 transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[var(--noodle-accent)] peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:after:transition-none"
                  />
                </label>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
