import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { focusRing } from "../../base/chrome/slp-focus";
import type { SlurpProject } from "./slp-projects-contract";
import { SlpTextAssist } from "../assist/slp-assist-contract";

const inputClass = `min-h-11 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] disabled:opacity-50 sm:text-sm ${focusRing}`;

type ChapterAction = "skip" | "back" | "label" | "hold" | "release" | "insert";

/**
 * The player's hand on a running storyline's chapters: stay on this one, move on, go back, rename
 * it, or add what happens next. Chapter control is open without Director mode; pausing, twists and
 * ending an arc stay Director tools.
 */
export function SlpArcChapterControls({
  project,
  accountId,
  busy,
  onAct,
}: {
  project: SlurpProject;
  /** The Creator whose storyline it is, for the writing help. */
  accountId?: string;
  busy: boolean;
  onAct: (action: ChapterAction, value?: string) => void;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const [editing, setEditing] = useState<{ action: "label" | "insert"; value: string } | null>(null);
  if (!project.chapters.length || (project.status !== "active" && project.status !== "paused")) return null;
  const last = project.chapter >= project.chapters.length - 1;
  const small = "min-h-10 px-3 text-xs";
  return (
    <div data-slurp-chapter-controls className="mt-2 space-y-2">
      <p className="text-xs leading-5 text-[var(--slurp-muted)]">
        {project.held
          ? t("ui.slurp.projects.chapterHeld", { chapter: project.chapters[project.chapter] ?? "" })
          : t("ui.slurp.projects.chapterNow", { chapter: project.chapters[project.chapter] ?? "" })}
      </p>
      <div className="flex flex-wrap gap-2">
        <SlpButton
          variant={project.held ? "secondary" : "quiet"}
          aria-pressed={project.held === true}
          disabled={busy}
          onClick={() => onAct(project.held ? "release" : "hold")}
          className={small}
        >
          {project.held ? t("ui.slurp.projects.release") : t("ui.slurp.projects.hold")}
        </SlpButton>
        {!last && (
          <SlpButton variant="quiet" disabled={busy} onClick={() => onAct("skip")} className={small}>
            {t("ui.slurp.projects.moveOn")}
          </SlpButton>
        )}
        <SlpButton
          variant="quiet"
          disabled={busy}
          onClick={() => setEditing({ action: "insert", value: "" })}
          className={small}
        >
          {t("ui.slurp.projects.addNext")}
        </SlpButton>
        <SlpButton
          variant="tertiary"
          disabled={busy}
          onClick={() => setEditing({ action: "label", value: project.chapters[project.chapter] ?? "" })}
          className={small}
        >
          {t("ui.slurp.projects.renameChapter", { defaultValue: "Rename chapter" })}
        </SlpButton>
        {project.chapter > 0 && (
          <SlpButton variant="tertiary" disabled={busy} onClick={() => onAct("back")} className={small}>
            {t("ui.slurp.projects.back", { defaultValue: "Go back" })}
          </SlpButton>
        )}
      </div>
      {editing && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!editing.value.trim()) return;
            onAct(editing.action, editing.value.trim());
            setEditing(null);
          }}
        >
          <div className="flex flex-wrap items-center gap-x-2">
            <label htmlFor={inputId} className="block text-xs font-semibold">
              {editing.action === "insert" ? t("ui.slurp.projects.addNextLabel") : t("ui.slurp.projects.renameLabel")}
            </label>
            <SlpTextAssist
              field="chapter"
              value={editing.value}
              accountId={accountId}
              context={`Storyline “${project.title}”. Chapters so far: ${project.chapters.join(" → ")}. Now: ${project.chapters[project.chapter] ?? ""}.`}
              onApply={(value) => setEditing((current) => (current ? { ...current, value } : current))}
            />
          </div>
          <input
            id={inputId}
            autoFocus
            value={editing.value}
            maxLength={200}
            placeholder={editing.action === "insert" ? t("ui.slurp.projects.addNextPlaceholder") : undefined}
            onChange={(event) => setEditing({ ...editing, value: event.target.value })}
            className={inputClass}
          />
          <div className="flex gap-2">
            <SlpButton type="submit" variant="secondary" disabled={busy || !editing.value.trim()} className={small}>
              {t("ui.slurp.projects.save", { defaultValue: "Save" })}
            </SlpButton>
            <SlpButton type="button" variant="tertiary" onClick={() => setEditing(null)} className={small}>
              {t("ui.slurp.projects.cancel", { defaultValue: "Cancel" })}
            </SlpButton>
          </div>
        </form>
      )}
    </div>
  );
}
