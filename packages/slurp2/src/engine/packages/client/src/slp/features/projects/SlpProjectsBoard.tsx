// The Projects navigation destination, split out of components/slurp/SlurpProjectsPanel.tsx in
// Slice 10. Named Board to avoid colliding with the Backstage SlpProjectsPanel from Slice 9.

import { useSlurpSettings } from "../settings/slp-settings-contract";
import { ArcConfigSection } from "./SlpArcConfigSection";
import { ProjectEditor, canSave } from "./SlpProjectEditor";
import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlurpProject } from "./slp-projects-contract";
import {
  useCreateSlurpProject,
  useDeleteSlurpProject,
  useDirectSlurpProject,
  useGenerateSlurpProject,
  useResolveSlurpArcProfile,
  useSaveSlurpProjectToLibrary,
  useSlurpProjects,
  useUpdateSlurpProject,
} from "./slp-projects-hooks";

type Draft = {
  title: string;
  direction: string;
  chapters: string;
  typeId: string | null;
  durationDays: string;
  /** Set for a new crossover: the other Creators picked so far. */
  crossoverWith?: string[];
};

/**
 * What a Creator is currently posting about, and what comes next.
 *
 * A dashboard rather than a review queue. Somebody running thirty Creators cannot approve thirty
 * threads, so this is built to be read down and edited only where a project went somewhere dull.
 * Nothing here blocks posting: a project runs whether or not this panel is ever opened.
 */
export function SlurpProjectsPanel({
  personaId,
  creatorAccountId,
  otherCreators = [],
}: {
  personaId: string;
  creatorAccountId: string;
  /** The player's other Creators, for a crossover. */
  otherCreators?: { id: string; displayName: string }[];
}) {
  const { t: localizeUi } = useUiTranslation();
  const query = useSlurpProjects(personaId, creatorAccountId);
  const create = useCreateSlurpProject();
  const update = useUpdateSlurpProject();
  const remove = useDeleteSlurpProject();
  const generate = useGenerateSlurpProject();
  const saveToLibrary = useSaveSlurpProjectToLibrary();
  const direct = useDirectSlurpProject();
  const resolveProfile = useResolveSlurpArcProfile();
  const settings = useSlurpSettings().data;
  const director = settings?.arcDirectorMode === true;
  /** Inline Director input: which arc, and whether it renames the chapter or adds a twist. */
  const [directing, setDirecting] = useState<{ id: string; action: "label" | "twist"; value: string } | null>(null);
  const library = (settings?.arcLibrary ?? []).filter((type) => !type.hidden);
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
      typeId: project.typeId,
      durationDays: project.durationDays ? String(project.durationDays) : "",
    });
  };

  const startNew = () => {
    setEditingId("new");
    setDraft({ title: "", direction: "", chapters: "", typeId: null, durationDays: "" });
  };

  const cancel = () => {
    setEditingId(null);
    setDraft(null);
  };

  const save = async () => {
    if (!draft || !canSave(draft)) return;
    const days = Math.floor(Number(draft.durationDays));
    const body = {
      title: draft.title.trim(),
      direction: draft.direction.trim(),
      chapters: chaptersFromText(draft.chapters),
      ...(draft.typeId && draft.durationDays.trim() && days >= 1
        ? { durationDays: Math.min(365, days) }
        : editingId !== "new" && draft.typeId
          ? { durationDays: null }
          : {}),
    };
    if (editingId === "new")
      await create.mutateAsync({
        creatorAccountId,
        personaId,
        ...body,
        typeId: draft.typeId,
        ...(draft.crossoverWith ? { crossoverWith: draft.crossoverWith } : {}),
      });
    else if (editingId) await update.mutateAsync({ creatorAccountId, personaId, projectId: editingId, ...body });
    cancel();
  };

  const setStatus = (project: SlurpProject, status: SlurpProject["status"]) =>
    update.mutate({ creatorAccountId, personaId, projectId: project.id, status });

  const setIntensity = (project: SlurpProject, intensity: SlurpProject["intensity"]) =>
    update.mutate({ creatorAccountId, personaId, projectId: project.id, intensity });

  const act = (project: SlurpProject, action: Parameters<typeof direct.mutate>[0]["action"], value?: string) =>
    direct.mutate({ creatorAccountId, personaId, projectId: project.id, action, value });

  const busy =
    create.isPending ||
    update.isPending ||
    remove.isPending ||
    generate.isPending ||
    saveToLibrary.isPending ||
    direct.isPending ||
    resolveProfile.isPending;
  const error =
    create.error ??
    update.error ??
    remove.error ??
    generate.error ??
    saveToLibrary.error ??
    direct.error ??
    resolveProfile.error;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.projects.heading", { defaultValue: "Arcs" })}
        </h3>
        {editingId === null && (
          <span className="flex gap-3">
            <button
              type="button"
              onClick={() => generate.mutate({ creatorAccountId, personaId })}
              className="text-[0.7rem] font-semibold underline disabled:opacity-50"
              disabled={busy}
            >
              {generate.isPending
                ? localizeUi("ui.slurp.projects.generating", { defaultValue: "Generating…" })
                : localizeUi("ui.slurp.projects.generate", { defaultValue: "Generate arc" })}
            </button>
            <button
              type="button"
              onClick={startNew}
              className="text-[0.7rem] font-semibold underline disabled:opacity-50"
              disabled={busy}
            >
              {localizeUi("ui.slurp.projects.new", { defaultValue: "New arc" })}
            </button>
            {otherCreators.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setEditingId("new");
                  setDraft({
                    title: "",
                    direction: "",
                    chapters: "",
                    typeId: null,
                    durationDays: "",
                    crossoverWith: [],
                  });
                }}
                className="text-[0.7rem] font-semibold underline disabled:opacity-50"
                disabled={busy}
              >
                {localizeUi("ui.slurp.projects.startCrossover", { defaultValue: "Start crossover" })}
              </button>
            )}
          </span>
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
                    ...(project.generated
                      ? [localizeUi("ui.slurp.projects.generated", { defaultValue: "Generated" })]
                      : []),
                    ...(project.partnerNames?.length
                      ? [
                          localizeUi("ui.slurp.projects.with", {
                            defaultValue: "With {{names}}",
                            names: project.partnerNames.join(", "),
                          }),
                        ]
                      : []),
                    ...(project.tone ? [project.tone] : []),
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
                {project.twist && (
                  <span className="block truncate text-[0.7rem] text-[var(--noodle-accent)]">
                    {localizeUi("ui.slurp.projects.twistPending", {
                      defaultValue: "Twist for the next post: {{twist}}",
                      twist: project.twist,
                    })}
                  </span>
                )}
                {/* Not a Director control: a profile change always waits for the player. */}
                {project.pendingProfile && (
                  <span className="mt-1 block text-[0.7rem]">
                    <span className="block">
                      {project.pendingProfile.revert
                        ? localizeUi("ui.slurp.projects.profileRevert", {
                            defaultValue: "The arc ended. Put the profile back?",
                          })
                        : localizeUi("ui.slurp.projects.profileProposal", {
                            defaultValue: "The arc wants to change the profile:",
                          })}
                    </span>
                    {project.pendingProfile.bio !== undefined && (
                      <span className="block text-[var(--muted-foreground)]">
                        {localizeUi("ui.slurp.projects.profileBio", {
                          defaultValue: "Bio: {{value}}",
                          value: project.pendingProfile.bio,
                        })}
                      </span>
                    )}
                    {project.pendingProfile.location !== undefined && (
                      <span className="block text-[var(--muted-foreground)]">
                        {localizeUi("ui.slurp.projects.profileLocation", {
                          defaultValue: "Location: {{value}}",
                          value: project.pendingProfile.location,
                        })}
                      </span>
                    )}
                    <span className="flex gap-3 font-semibold">
                      {([true, false] as const).map((apply) => (
                        <button
                          key={String(apply)}
                          type="button"
                          className="underline"
                          disabled={busy}
                          onClick={() =>
                            resolveProfile.mutate({ creatorAccountId, personaId, projectId: project.id, apply })
                          }
                        >
                          {apply
                            ? localizeUi("ui.slurp.projects.profileApply", { defaultValue: "Apply" })
                            : localizeUi("ui.slurp.projects.profileReject", { defaultValue: "Reject" })}
                        </button>
                      ))}
                    </span>
                  </span>
                )}
                {director &&
                  (project.status === "active" || project.status === "paused") &&
                  project.choices[project.chapter] && (
                    <span className="mt-1 block text-[0.7rem]">
                      <span className="block">
                        {localizeUi("ui.slurp.projects.choice", {
                          defaultValue: "Fans are voting: {{question}}",
                          question: project.choices[project.chapter]!.question,
                        })}
                      </span>
                      <span className="flex flex-wrap gap-2 font-semibold">
                        {localizeUi("ui.slurp.projects.pick", { defaultValue: "Pick:" })}
                        {project.choices[project.chapter]!.options.map((option, optionIndex) => (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => act(project, "choose", String(optionIndex))}
                            className="underline"
                            disabled={busy}
                          >
                            {option.label}
                          </button>
                        ))}
                      </span>
                    </span>
                  )}
                {directing?.id === project.id && (
                  <span className="mt-1 flex flex-col gap-1">
                    <input
                      value={directing.value}
                      onChange={(event) => setDirecting({ ...directing, value: event.target.value })}
                      placeholder={
                        directing.action === "twist"
                          ? localizeUi("ui.slurp.projects.twistPlaceholder", {
                              defaultValue: "What happens next? Leave empty for a random twist.",
                            })
                          : undefined
                      }
                      maxLength={directing.action === "twist" ? 300 : 200}
                      className="w-full rounded border border-[var(--noodle-divider)] bg-transparent px-2 py-1 text-xs"
                    />
                    <span className="flex gap-3 text-[0.7rem] font-semibold">
                      <button
                        type="button"
                        className="underline"
                        disabled={busy || (directing.action === "label" && !directing.value.trim())}
                        onClick={() => {
                          act(project, directing.action, directing.value.trim() || "random");
                          setDirecting(null);
                        }}
                      >
                        {localizeUi("ui.slurp.projects.save", { defaultValue: "Save" })}
                      </button>
                      <button type="button" className="underline" onClick={() => setDirecting(null)}>
                        {localizeUi("ui.slurp.projects.cancel", { defaultValue: "Cancel" })}
                      </button>
                    </span>
                  </span>
                )}
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
                {/* A suggestion is not running yet, so editing it before accepting stays open. */}
                {(director || project.status === "suggested") && (
                  <button type="button" onClick={() => startEdit(project)} className="underline" disabled={busy}>
                    {localizeUi("ui.slurp.projects.edit", { defaultValue: "Edit" })}
                  </button>
                )}
                {project.generated && (
                  <button
                    type="button"
                    onClick={() => saveToLibrary.mutate({ creatorAccountId, personaId, projectId: project.id })}
                    className="underline"
                    disabled={busy}
                  >
                    {localizeUi("ui.slurp.projects.saveToLibrary", { defaultValue: "Save to library" })}
                  </button>
                )}
                {director && project.status === "active" && (
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
                {director && (project.status === "active" || project.status === "paused") && (
                  <>
                    <button
                      type="button"
                      onClick={() => act(project, project.status === "active" ? "pause" : "resume")}
                      className="underline"
                      disabled={busy}
                    >
                      {project.status === "active"
                        ? localizeUi("ui.slurp.projects.pause", { defaultValue: "Pause" })
                        : localizeUi("ui.slurp.projects.resume", { defaultValue: "Resume" })}
                    </button>
                    {project.chapter > 0 && (
                      <button type="button" onClick={() => act(project, "back")} className="underline" disabled={busy}>
                        {localizeUi("ui.slurp.projects.back", { defaultValue: "Go back" })}
                      </button>
                    )}
                    {project.chapter < project.chapters.length - 1 && (
                      <button type="button" onClick={() => act(project, "skip")} className="underline" disabled={busy}>
                        {localizeUi("ui.slurp.projects.skip", { defaultValue: "Skip chapter" })}
                      </button>
                    )}
                    {project.chapters.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDirecting({
                            id: project.id,
                            action: "label",
                            value: project.chapters[project.chapter] ?? "",
                          })
                        }
                        className="underline"
                        disabled={busy}
                      >
                        {localizeUi("ui.slurp.projects.renameChapter", { defaultValue: "Rename chapter" })}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDirecting({ id: project.id, action: "twist", value: "" })}
                      className="underline"
                      disabled={busy}
                    >
                      {localizeUi("ui.slurp.projects.addTwist", { defaultValue: "Add twist" })}
                    </button>
                    <button type="button" onClick={() => act(project, "end")} className="underline" disabled={busy}>
                      {localizeUi("ui.slurp.projects.endEarly", { defaultValue: "End early" })}
                    </button>
                  </>
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
            {draft?.crossoverWith && (
              <fieldset className="mb-2 flex flex-col gap-1 text-[0.7rem]">
                <legend className="font-semibold">
                  {localizeUi("ui.slurp.projects.crossoverWith", { defaultValue: "With (up to 2)" })}
                </legend>
                {otherCreators.map((other) => {
                  const picked = draft.crossoverWith!;
                  const checked = picked.includes(other.id);
                  return (
                    <label key={other.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={busy || (!checked && picked.length >= 2)}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            crossoverWith: checked ? picked.filter((id) => id !== other.id) : [...picked, other.id],
                          })
                        }
                      />
                      {other.displayName}
                    </label>
                  );
                })}
              </fieldset>
            )}
            <ProjectEditor
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={cancel}
              busy={busy || draft?.crossoverWith?.length === 0}
              library={library}
              isNew
            />
          </li>
        )}
      </ul>

      {/* Deleting a project leaves its posts published. Say so, because "delete" usually does not. */}
      {projects.length > 0 && editingId === null && (
        <p className="mt-2 text-[0.65rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.projects.deleteNote", { defaultValue: "Deleting an arc keeps its posts." })}
        </p>
      )}
      {!director && projects.some((project) => project.status === "active" || project.status === "paused") && (
        <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.projects.readOnly", {
            defaultValue: "Arcs run by themselves. Turn on Director mode in Settings → Arcs to steer them.",
          })}
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

      {settings && (
        <ArcConfigSection
          personaId={personaId}
          creatorAccountId={creatorAccountId}
          global={settings}
          library={library}
        />
      )}
    </div>
  );
}

/**
 * The arc timeline on a Creator profile: the running arc with its chapter track and key posts, then
 * the finished ones. Reads the viewer-safe `/arcs` list, so it never shows directions or suggestions.
 * Each chapter is a list item so poll results or stat changes can sit under it later.
 */
