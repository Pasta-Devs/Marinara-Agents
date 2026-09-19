// Project editor form, split out of components/slurp/SlurpProjectsPanel.tsx in Slice 10.

import { Draft } from "./SlpProjectsBoard";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlurpArcType } from "./slp-projects-contract";

const canSave = (draft: Draft) => Boolean(draft.title.trim()) || draft.typeId !== null;

function ProjectEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  busy,
  library = [],
  isNew = false,
}: {
  draft: Draft | null;
  setDraft: (draft: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  library?: SlurpArcType[];
  isNew?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (!draft) return null;
  const field = "w-full rounded border border-[var(--noodle-divider)] bg-transparent px-2 py-1 text-xs";
  return (
    <div className="flex flex-col gap-2">
      {/* The type only matters when the arc is made: it fills the fields, then the text is the player's. */}
      {isNew && (
        <label className="flex flex-col gap-1 text-[0.7rem] font-semibold">
          {localizeUi("ui.slurp.projects.kind", { defaultValue: "Type" })}
          <select
            value={draft.typeId ?? ""}
            onChange={(event) => {
              const type = library.find((entry) => entry.id === event.target.value);
              setDraft(
                type
                  ? {
                      ...draft,
                      typeId: type.id,
                      title: type.name,
                      direction: type.description,
                      chapters: type.chapters.map((chapter) => chapter.label).join("\n"),
                      durationDays: type.chapters.length ? "" : String(type.durationDays),
                    }
                  : { ...draft, typeId: null, durationDays: "" },
              );
            }}
            className={field}
          >
            <option value="">{localizeUi("ui.slurp.projects.customType", { defaultValue: "Custom" })}</option>
            {library.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
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
      {/* An open-ended arc from a type ends after its duration; a custom one runs until finished by hand. */}
      {draft.typeId && !draft.chapters.trim() && (
        <label className="flex items-center gap-2 text-[0.7rem] font-semibold">
          {localizeUi("ui.slurp.projects.durationDays", { defaultValue: "Days until it ends" })}
          <input
            type="number"
            min={1}
            max={365}
            value={draft.durationDays}
            onChange={(event) => setDraft({ ...draft, durationDays: event.target.value })}
            className={`${field} w-20`}
          />
        </label>
      )}
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
