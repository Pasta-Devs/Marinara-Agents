import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  SLURP_ARC_KINDS,
  useCreateSlurpProject,
  useDeleteSlurpProject,
  useSlurpProjects,
  useUpdateSlurpProject,
  type SlurpArcKind,
  type SlurpProject,
} from "../../hooks/use-slurp";

type Draft = { title: string; direction: string; chapters: string; kind: SlurpArcKind };

/**
 * What a Creator is currently posting about, and what comes next.
 *
 * A dashboard rather than a review queue. Somebody running thirty Creators cannot approve thirty
 * threads, so this is built to be read down and edited only where a project went somewhere dull.
 * Nothing here blocks posting: a project runs whether or not this panel is ever opened.
 */
export function SlurpProjectsPanel({ personaId, creatorAccountId }: { personaId: string; creatorAccountId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const query = useSlurpProjects(personaId, creatorAccountId);
  const create = useCreateSlurpProject();
  const update = useUpdateSlurpProject();
  const remove = useDeleteSlurpProject();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const projects = query.data?.projects ?? [];
  const activeCount = projects.filter((project) => project.status === "active").length;

  // One textarea, one chapter per line. A chapter is a line like "the consultation", so a list
  // editor with add and remove buttons would be more controls for the same text.
  const chaptersToText = (chapters: string[]) => chapters.join("\n");
  const chaptersFromText = (text: string) =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const startEdit = (project: SlurpProject) => {
    setEditingId(project.id);
    setDraft({
      title: project.title,
      direction: project.direction,
      chapters: chaptersToText(project.chapters),
      kind: project.kind,
    });
  };

  const startNew = () => {
    setEditingId("new");
    setDraft({ title: "", direction: "", chapters: "", kind: "custom" });
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(null);
  };

  const save = async () => {
    if (!draft || !canSave(draft)) return;
    const body = {
      title: draft.title.trim(),
      direction: draft.direction.trim(),
      chapters: chaptersFromText(draft.chapters),
    };
    if (editingId === "new") await create.mutateAsync({ creatorAccountId, personaId, ...body, kind: draft.kind });
    else if (editingId) await update.mutateAsync({ creatorAccountId, personaId, projectId: editingId, ...body });
    cancel();
  };

  const setStatus = (project: SlurpProject, status: SlurpProject["status"]) =>
    update.mutate({ creatorAccountId, personaId, projectId: project.id, status });

  const setIntensity = (project: SlurpProject, intensity: SlurpProject["intensity"]) =>
    update.mutate({ creatorAccountId, personaId, projectId: project.id, intensity });

  const busy = create.isPending || update.isPending || remove.isPending;
  const error = create.error ?? update.error ?? remove.error;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.projects.heading", { defaultValue: "Arcs" })}
        </h3>
        {editingId === null && (
          <button
            type="button"
            onClick={startNew}
            className="text-[0.7rem] font-semibold underline disabled:opacity-50"
            disabled={busy}
          >
            {localizeUi("ui.slurp.projects.new", { defaultValue: "New arc" })}
          </button>
        )}
      </div>

      {query.isPending ? (
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.projects.loading", { defaultValue: "Loading…" })}
        </p>
      ) : projects.length === 0 && editingId === null ? (
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.projects.empty", {
            defaultValue: "No arcs. Posts stand on their own until this Creator has one.",
          })}
        </p>
      ) : null}

      <ul className="mt-2 flex flex-col divide-y divide-[var(--noodle-divider)]">
        {projects.map((project) =>
          editingId === project.id ? (
            <li key={project.id} className="py-2">
              <ProjectEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} busy={busy} />
            </li>
          ) : (
            <li key={project.id} className="flex items-start justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{project.title}</span>
                <span className="block truncate text-[0.7rem] text-[var(--muted-foreground)]">
                  {[
                    localizeUi(`ui.slurp.projects.status.${project.status}`, { defaultValue: project.status }),
                    ...(project.intensity === "focus"
                      ? [localizeUi("ui.slurp.projects.focus", { defaultValue: "Focus" })]
                      : []),
                    // Progress only means something when there is a plan to measure against.
                    project.chapters.length
                      ? localizeUi("ui.slurp.projects.chapterOf", {
                          defaultValue: "{{current}} of {{total}}: {{chapter}}",
                          current: project.chapter + 1,
                          total: project.chapters.length,
                          chapter: project.chapters[project.chapter] ?? "",
                        })
                      : localizeUi("ui.slurp.projects.openEnded", { defaultValue: "Open-ended" }),
                    localizeUi("ui.slurp.projects.postCount", {
                      defaultValue: "{{count}} posts",
                      count: project.posts,
                    }),
                  ].join(" · ")}
                </span>
              </span>
              <span className="flex shrink-0 gap-2 text-[0.65rem] font-semibold">
                {/* A suggestion is the player's call before it is anything else: accept it or let it go. */}
                {project.status === "suggested" && (
                  <button
                    type="button"
                    onClick={() => setStatus(project, "active")}
                    className="underline"
                    disabled={busy}
                  >
                    {localizeUi("ui.slurp.projects.accept", { defaultValue: "Accept" })}
                  </button>
                )}
                <button type="button" onClick={() => startEdit(project)} className="underline" disabled={busy}>
                  {localizeUi("ui.slurp.projects.edit", { defaultValue: "Edit" })}
                </button>
                {project.status === "active" && (
                  <button
                    type="button"
                    onClick={() => setIntensity(project, project.intensity === "focus" ? "background" : "focus")}
                    className="underline"
                    disabled={busy}
                  >
                    {project.intensity === "focus"
                      ? localizeUi("ui.slurp.projects.unfocus", { defaultValue: "Background" })
                      : localizeUi("ui.slurp.projects.makeFocus", { defaultValue: "Make focus" })}
                  </button>
                )}
                {project.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => setStatus(project, "paused")}
                    className="underline"
                    disabled={busy}
                  >
                    {localizeUi("ui.slurp.projects.pause", { defaultValue: "Pause" })}
                  </button>
                ) : project.status === "paused" ? (
                  <button
                    type="button"
                    onClick={() => setStatus(project, "active")}
                    className="underline"
                    disabled={busy}
                  >
                    {localizeUi("ui.slurp.projects.resume", { defaultValue: "Resume" })}
                  </button>
                ) : null}
                {(project.status === "active" || project.status === "paused") && (
                  <button
                    type="button"
                    onClick={() => setStatus(project, "complete")}
                    className="underline"
                    disabled={busy}
                  >
                    {localizeUi("ui.slurp.projects.finish", { defaultValue: "Finish" })}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove.mutate({ creatorAccountId, personaId, projectId: project.id })}
                  className="underline"
                  disabled={busy}
                >
                  {project.status === "suggested"
                    ? localizeUi("ui.slurp.projects.dismiss", { defaultValue: "Dismiss" })
                    : localizeUi("ui.slurp.projects.delete", { defaultValue: "Delete" })}
                </button>
              </span>
            </li>
          ),
        )}
        {editingId === "new" && (
          <li className="py-2">
            <ProjectEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} busy={busy} isNew />
          </li>
        )}
      </ul>

      {/* Deleting a project leaves its posts published. Say so, because "delete" usually does not. */}
      {projects.length > 0 && editingId === null && (
        <p className="mt-2 text-[0.65rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.projects.deleteNote", { defaultValue: "Deleting an arc keeps its posts." })}
        </p>
      )}
      {activeCount >= 3 && editingId === null && (
        <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.projects.activeLimit", {
            defaultValue: "Three running at once is the limit. Pause or finish one to start another.",
          })}
        </p>
      )}
      {error && <p className="mt-2 text-[0.7rem] text-[var(--destructive)]">{error.message}</p>}
    </div>
  );
}

/** A templated kind brings its own title, so only a custom arc needs one typed in. */
const canSave = (draft: Draft) => Boolean(draft.title.trim()) || draft.kind !== "custom";

function ProjectEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  busy,
  isNew = false,
}: {
  draft: Draft | null;
  setDraft: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  isNew?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (!draft) return null;
  const field = "w-full rounded border border-[var(--noodle-divider)] bg-transparent px-2 py-1 text-xs";
  return (
    <div className="flex flex-col gap-2">
      {/* The kind only matters when the arc is made: it picks the template, then the text is the player's. */}
      {isNew && (
        <label className="flex flex-col gap-1 text-[0.7rem] font-semibold">
          {localizeUi("ui.slurp.projects.kind", { defaultValue: "Kind" })}
          <select
            value={draft.kind}
            onChange={(event) => setDraft({ ...draft, kind: event.target.value as SlurpArcKind })}
            className={field}
          >
            {SLURP_ARC_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {localizeUi(`ui.slurp.projects.kinds.${kind}`, { defaultValue: kind })}
              </option>
            ))}
          </select>
          {draft.kind !== "custom" && (
            <span className="font-normal text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.projects.templateNote", {
                defaultValue: "Leave the title and chapters empty to use the template.",
              })}
            </span>
          )}
        </label>
      )}
      <input
        value={draft.title}
        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        placeholder={localizeUi("ui.slurp.projects.titlePlaceholder", { defaultValue: "What is this thread?" })}
        maxLength={80}
        className={field}
      />
      <textarea
        value={draft.direction}
        onChange={(event) => setDraft({ ...draft, direction: event.target.value })}
        placeholder={localizeUi("ui.slurp.projects.directionPlaceholder", {
          defaultValue: "What connects the posts, and where it is going.",
        })}
        maxLength={2000}
        rows={3}
        className={field}
      />
      <textarea
        value={draft.chapters}
        onChange={(event) => setDraft({ ...draft, chapters: event.target.value })}
        placeholder={localizeUi("ui.slurp.projects.chaptersPlaceholder", {
          defaultValue: "One chapter per line. Leave empty for an open-ended thread.",
        })}
        rows={4}
        className={field}
      />
      <div className="flex gap-3 text-[0.7rem] font-semibold">
        <button type="button" onClick={onSave} className="underline" disabled={busy || !canSave(draft)}>
          {localizeUi("ui.slurp.projects.save", { defaultValue: "Save" })}
        </button>
        <button type="button" onClick={onCancel} className="underline" disabled={busy}>
          {localizeUi("ui.slurp.projects.cancel", { defaultValue: "Cancel" })}
        </button>
      </div>
    </div>
  );
}
